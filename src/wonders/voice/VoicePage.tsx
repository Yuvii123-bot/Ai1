import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WonderShell, Slider, Segmented, Stat } from '../../lib/ui';
import { WONDER_META } from '../meta';
import {
  Note, PRESETS, presetToNotes, synthesize, spectrogram, toWav, noteName, midiFromName,
  VoicePreset, textToSyllables,
} from './synth';
import { download } from '../../lib/math';

const W = WONDER_META.find((w) => w.slug === 'voice')!;

const LYRICS_DEFAULT = 'Rise up and shine, the morning is ours';

type RollNote = Note & { start: number; id: number };

const ROWS = 24;
const BASE_MIDI = 55; // G3

export default function VoicePage() {
  const [presetId, setPresetId] = useState('rise');
  const [notes, setNotes] = useState<RollNote[]>(() => {
    const p = PRESETS.find((x) => x.id === 'rise')!;
    let t = 0;
    return presetToNotes(p).map((n, i) => {
      const r = { ...n, start: t, id: i };
      t += n.beats;
      return r;
    });
  });
  const [lyrics, setLyrics] = useState(LYRICS_DEFAULT);
  const [bpm, setBpm] = useState(112);
  const [voice, setVoice] = useState<VoicePreset>('alto');
  const [vibrato, setVibrato] = useState(0.6);
  const [breath, setBreath] = useState(0.3);
  const [brightness, setBrightness] = useState(0.55);
  const [reverb, setReverb] = useState(0.5);
  const [harmony, setHarmony] = useState(0.18);
  const [legato, setLegato] = useState(0.65);
  const [busy, setBusy] = useState(false);
  const [renderMs, setRenderMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [spec, setSpec] = useState<ReturnType<typeof spectrogram> | null>(null);
  const [error, setError] = useState('');

  const audioRef = useRef<{ ctx: AudioContext; src: AudioBufferSourceNode } | null>(null);
  const lastBuffer = useRef<{ L: Float32Array; R: Float32Array; sampleRate: number } | null>(null);
  const rafRef = useRef(0);

  const syllables = useMemo(() => textToSyllables(lyrics), [lyrics]);
  const totalBeats = notes.reduce((a, n) => Math.max(a, n.start + n.beats), 0);

  const loadPreset = (id: string) => {
    setPresetId(id);
    const p = PRESETS.find((x) => x.id === id)!;
    let t = 0;
    setNotes(
      presetToNotes(p).map((n, i) => {
        const r = { ...n, start: t, id: i + Math.random() };
        t += n.beats;
        return r;
      })
    );
  };

  const render = useCallback(
    async (autoplay = false) => {
      if (!notes.length) return;
      setBusy(true);
      setError('');
      await new Promise((r) => setTimeout(r, 30));
      const t0 = performance.now();
      try {
        const sorted = [...notes].sort((a, b) => a.start - b.start).map((n) => ({ midi: n.midi, beats: n.beats, start: n.start }));
        const out = synthesize(sorted, lyrics || 'la', {
          bpm, voice, vibrato, breath, brightness, reverb, harmony, legato,
        });
        setRenderMs(performance.now() - t0);
        lastBuffer.current = out;
        setSpec(spectrogram(out.L, out.sampleRate, 96, 260));
        if (autoplay) playFrom(out);
      } catch (e: any) {
        setError(e?.message || 'Synthesis failed');
      }
      setBusy(false);
    },
    [notes, lyrics, bpm, voice, vibrato, breath, brightness, reverb, harmony, legato]
  );

  function playFrom(out: { L: Float32Array; R: Float32Array; sampleRate: number }) {
    stop();
    const ctx = new AudioContext();
    const buf = ctx.createBuffer(2, out.L.length, out.sampleRate);
    buf.getChannelData(0).set(out.L);
    buf.getChannelData(1).set(out.R);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = 0.9;
    src.connect(gain).connect(ctx.destination);
    src.start();
    audioRef.current = { ctx, src };
    setPlaying(true);
    const dur = out.L.length / out.sampleRate;
    const tick = () => {
      const p = ctx.currentTime / dur;
      setProgress(Math.min(1, p));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    rafRef.current = requestAnimationFrame(tick);
    src.onended = () => setPlaying(false);
  }

  function stop() {
    cancelAnimationFrame(rafRef.current);
    if (audioRef.current) {
      try { audioRef.current.src.stop(); audioRef.current.ctx.close(); } catch {}
      audioRef.current = null;
    }
    setPlaying(false);
  }

  useEffect(() => () => stop(), []);

  /* ---------------- piano roll interaction ---------------- */
  const rollRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; mode: 'move' | 'resize'; startX: number; startY: number; orig: RollNote } | null>(null);

  const cellW = 26;
  const cellH = 15;
  const width = Math.max(560, totalBeats * cellW + 40);

  const onPointerDown = (e: React.PointerEvent, n: RollNote, mode: 'move' | 'resize') => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id: n.id, mode, startX: e.clientX, startY: e.clientY, orig: { ...n } };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id !== d.id) return n;
        if (d.mode === 'resize') {
          return { ...n, beats: Math.max(0.25, Math.round((d.orig.beats + dx / cellW) * 4) / 4) };
        }
        const start = Math.max(0, Math.round((d.orig.start + dx / cellW) * 4) / 4);
        const midi = Math.max(36, Math.min(84, d.orig.midi - Math.round(dy / cellH)));
        return { ...n, start, midi };
      })
    );
  };
  const onPointerUp = () => { drag.current = null; };

  const addNote = (e: React.MouseEvent) => {
    const rect = rollRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left + rollRef.current!.scrollLeft;
    const y = e.clientY - rect.top + rollRef.current!.scrollTop;
    const start = Math.max(0, Math.round((x / cellW) * 4) / 4);
    const row = Math.floor(y / cellH);
    const midi = BASE_MIDI + ROWS - 1 - row;
    setNotes((p) => [...p, { midi, beats: 1, start, id: Date.now() + Math.random() }]);
  };

  const deleteNote = (id: number) => setNotes((p) => p.filter((n) => n.id !== id));

  /* ---------------- spectrogram canvas ---------------- */
  const specRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = specRef.current;
    if (!c || !spec) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = c.getBoundingClientRect();
    c.width = r.width * dpr;
    c.height = r.height * dpr;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#06060a';
    ctx.fillRect(0, 0, r.width, r.height);
    const { data, cols, bins } = spec;
    const cw = r.width / cols;
    const ch = r.height / bins;
    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < bins; y++) {
        const v = data[x * bins + y];
        if (v < 0.02) continue;
        const hue = 265 - v * 200;
        const light = 12 + v * 62;
        ctx.fillStyle = `hsl(${hue},${72 + v * 25}%,${light}%)`;
        ctx.fillRect(x * cw, r.height - (y + 1) * ch, cw + 0.5, ch + 0.5);
      }
    }
    // playhead
    if (progress > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(progress * r.width, 0, 1.5, r.height);
    }
  }, [spec, progress]);

  return (
    <WonderShell w={W}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.45fr) minmax(0,1fr)', gap: 16 }} className="voice-layout">
        <div className="panel panel-pad stack" style={{ gap: 16 }}>
          <div className="spread">
            <div className="section-title" style={{ margin: 0 }}>Score</div>
            <div className="row">
              <Segmented
                value="x"
                options={PRESETS.slice(0, 3).map((p) => ({ id: p.id, label: p.name }))}
                onChange={(v) => loadPreset(v)}
              />
            </div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            {PRESETS.slice(3).map((p) => (
              <button key={p.id} className="btn btn-sm btn-ghost" onClick={() => loadPreset(p.id)}>{p.name}</button>
            ))}
            <button className="btn btn-sm btn-ghost" onClick={() => setNotes([])} style={{ marginLeft: 'auto' }}>Clear</button>
          </div>

          <div
            ref={rollRef}
            onMouseDown={(e) => { if (e.target === e.currentTarget) addNote(e); }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            style={{
              position: 'relative', height: ROWS * cellH + 2, overflowX: 'auto', overflowY: 'hidden',
              borderRadius: 12, border: '1px solid var(--line)', background: 'rgba(0,0,0,0.35)',
              cursor: 'crosshair', userSelect: 'none',
            }}
          >
            <div style={{ position: 'relative', width, height: '100%' }}>
              {/* grid */}
              <svg width={width} height={ROWS * cellH} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                {Array.from({ length: ROWS }).map((_, r) => (
                  <line key={r} x1={0} x2={width} y1={r * cellH} y2={r * cellH}
                    stroke={((BASE_MIDI + ROWS - 1 - r) % 12 === 0) ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.035)'} />
                ))}
                {Array.from({ length: Math.ceil(totalBeats) + 4 }).map((_, b) => (
                  <line key={b} y1={0} y2={ROWS * cellH} x1={b * cellW} x2={b * cellW}
                    stroke={b % 4 === 0 ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.03)'} />
                ))}
              </svg>
              {notes.map((n) => {
                const row = BASE_MIDI + ROWS - 1 - n.midi;
                if (row < 0 || row > ROWS) return null;
                return (
                  <div
                    key={n.id}
                    onPointerDown={(e) => onPointerDown(e, n, 'move')}
                    onDoubleClick={() => deleteNote(n.id)}
                    title={`${noteName(n.midi)} · drag to move · drag right edge to resize · double-click to delete`}
                    style={{
                      position: 'absolute', left: n.start * cellW, top: row * cellH + 1,
                      width: Math.max(10, n.beats * cellW - 3), height: cellH - 2,
                      borderRadius: 5, background: 'linear-gradient(180deg, #b9a5ff, #7c5cff)',
                      boxShadow: '0 2px 10px rgba(124,92,255,0.5), inset 0 1px 0 rgba(255,255,255,0.4)',
                      cursor: 'grab', display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                    }}
                  >
                    <div
                      onPointerDown={(e) => onPointerDown(e, n, 'resize')}
                      style={{ width: 7, height: '100%', cursor: 'ew-resize', background: 'rgba(0,0,0,0.25)', borderRadius: '0 5px 5px 0' }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: -6 }}>
            click empty space to add · drag a note to move/pitch · drag its right edge to stretch · double-click to delete
          </div>

          <div>
            <div className="section-title">Lyrics → syllables</div>
            <textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              rows={2}
              placeholder="Type words here…"
            />
            <div className="row scroll-x" style={{ marginTop: 9, gap: 5, flexWrap: 'nowrap' }}>
              {syllables.map((s, i) => (
                <span key={i} className="chip" style={{ textTransform: 'none', letterSpacing: 0, flexShrink: 0, borderColor: 'rgba(139,108,255,0.4)', color: '#cbb8ff' }}>
                  {s}
                </span>
              ))}
              {syllables.length === 0 && <span style={{ fontSize: 12, color: 'var(--txt-3)' }}>type some words…</span>}
            </div>
          </div>

          <div className="row">
            <button className="btn btn-primary" onClick={() => render(true)} disabled={busy || notes.length === 0}>
              {busy ? 'Synthesizing…' : playing ? '↻ Re-sing' : '▶ Sing it'}
            </button>
            <button className="btn" onClick={stop} disabled={!playing}>■ Stop</button>
            <button
              className="btn btn-ghost"
              disabled={!lastBuffer.current}
              onClick={() => {
                const b = lastBuffer.current;
                if (!b) return;
                download('singer.wav', toWav(b.L, b.R, b.sampleRate));
              }}
            >↓ WAV</button>
            <span className="mono" style={{ fontSize: 11, color: 'var(--txt-3)', marginLeft: 'auto' }}>
              {renderMs ? `synthesized in ${renderMs.toFixed(0)} ms` : '44.1 kHz · stereo'}
            </span>
          </div>
          {error && <div style={{ color: '#ff8080', fontSize: 12 }}>{error}</div>}

          <div>
            <div className="section-title">Spectrogram {lastBuffer.current ? `· ${lastBuffer.current.L.length / lastBuffer.current.sampleRate | 0}s` : ''}</div>
            <canvas ref={specRef} style={{ width: '100%', height: 150, borderRadius: 10, border: '1px solid var(--line)', display: 'block' }} />
            {!spec && <div className="center" style={{ height: 150, marginTop: -150, color: 'var(--txt-3)', fontSize: 12, position: 'relative' }}>press “Sing it” to hear — and see — the voice</div>}
          </div>
        </div>

        <div className="stack" style={{ gap: 14 }}>
          <div className="panel panel-pad stack" style={{ gap: 15 }}>
            <div className="section-title" style={{ margin: 0 }}>Voice</div>
            <Segmented
              value={voice}
              options={[
                { id: 'bass', label: 'Bass' },
                { id: 'tenor', label: 'Tenor' },
                { id: 'alto', label: 'Alto' },
                { id: 'soprano', label: 'Soprano' },
                { id: 'child', label: 'Child' },
              ]}
              onChange={(v) => setVoice(v as VoicePreset)}
            />
            <Slider label="Vibrato" value={vibrato} min={0} max={1} onChange={setVibrato} fmt={(v) => (v * 100).toFixed(0)} suffix="%" />
            <Slider label="Breathiness" value={breath} min={0} max={1} onChange={setBreath} fmt={(v) => (v * 100).toFixed(0)} suffix="%" />
            <Slider label="Brightness" value={brightness} min={0} max={1} onChange={setBrightness} fmt={(v) => (v * 100).toFixed(0)} suffix="%" />
            <Slider label="Legato glide" value={legato} min={0} max={1} onChange={setLegato} fmt={(v) => (v * 100).toFixed(0)} suffix="%" />
            <Slider label="Harmony (3rd above)" value={harmony} min={0} max={1} onChange={setHarmony} fmt={(v) => (v * 100).toFixed(0)} suffix="%" />
            <Slider label="Reverb" value={reverb} min={0} max={1} onChange={setReverb} fmt={(v) => (v * 100).toFixed(0)} suffix="%" />
            <Slider label="Tempo" value={bpm} min={50} max={200} step={1} onChange={(v) => setBpm(Math.round(v))} suffix=" BPM" />
          </div>

          <div className="panel panel-pad">
            <div className="row" style={{ gap: 8 }}>
              <Stat label="Notes" value={notes.length} />
              <Stat label="Syllables" value={syllables.length} />
              <Stat label="Length" value={`${((totalBeats * 60) / bpm).toFixed(1)}s`} />
            </div>
            <div className="note" style={{ marginTop: 14 }}>
              The engine models a real vocal tract: a glottal pulse source, jitter and shimmer, four resonant formants
              that glide between vowels, consonant bursts, and a convolution reverb built from a synthesized impulse
              response. Every millisecond is computed here — nothing is streamed from a model server.
            </div>
          </div>

          <div className="panel panel-pad">
            <div className="section-title" style={{ marginBottom: 10 }}>Try this</div>
            <div className="stack" style={{ gap: 8 }}>
              <button className="btn btn-sm btn-ghost" style={{ justifyContent: 'flex-start' }} onClick={() => { setLyrics('Happy birthday to you, happy birthday to you'); loadPreset('birthday'); setTimeout(() => render(true), 120); }}>🎂 Sing “Happy Birthday”</button>
              <button className="btn btn-sm btn-ghost" style={{ justifyContent: 'flex-start' }} onClick={() => { setLyrics('The quick brown fox jumps over the lazy dog'); loadPreset('twinkle'); setTimeout(() => render(true), 120); }}>🦊 Tongue twister, on pitch</button>
              <button className="btn btn-sm btn-ghost" style={{ justifyContent: 'flex-start' }} onClick={() => { setVoice('bass'); setLyrics('I am the night, I am the storm'); loadPreset('amazing'); setTimeout(() => render(true), 120); }}>🎭 Cinematic bass line</button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .voice-layout { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </WonderShell>
  );
}
