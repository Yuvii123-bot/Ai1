import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WonderShell, Slider, Stat, Segmented } from '../../lib/ui';
import { WONDER_META } from '../meta';
import {
  parseSmiles, layout, MOLECULES, molecularSpectrum, elementInfo, Molecule,
} from './chem';

const W = WONDER_META.find((w) => w.slug === 'alchemy')!;

export default function AlchemyPage() {
  const [smiles, setSmiles] = useState(MOLECULES[0].smiles);
  const [input, setInput] = useState(MOLECULES[0].smiles);
  const [mol, setMol] = useState<Molecule | null>(null);
  const [error, setError] = useState('');
  const [showH, setShowH] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [selectedAtom, setSelectedAtom] = useState<number | null>(null);
  const [layoutMs, setLayoutMs] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<{ osc: OscillatorNode; gain: GainNode }[]>([]);
  const viewRef = useRef({ zoom: 1, panX: 0, panY: 0 });

  const build = useCallback((s: string) => {
    setError('');
    try {
      const t0 = performance.now();
      const m = parseSmiles(s);
      if (!m.atoms.length) throw new Error('No atoms parsed — check your SMILES');
      layout(m, 640, 420);
      setLayoutMs(performance.now() - t0);
      setMol(m);
      setSmiles(s);
      setSelectedAtom(null);
    } catch (e: any) {
      setError(e?.message || 'Could not parse that SMILES');
    }
  }, []);

  useEffect(() => { build(MOLECULES[0].smiles); }, [build]);

  /* ---------------- drawing ---------------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mol) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const v = viewRef.current;
    ctx.save();
    ctx.translate(rect.width / 2 + v.panX, rect.height / 2 + v.panY);
    ctx.scale(v.zoom, v.zoom);
    ctx.translate(-320, -210);

    // bonds
    for (const b of mol.bonds) {
      const A = mol.atoms[b.a], B = mol.atoms[b.b];
      const dx = B.x - A.x, dy = B.y - A.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const aromatic = b.order === 1.5;
      const drawLine = (off: number, width: number, color: string, dash?: number[]) => {
        ctx.beginPath();
        ctx.setLineDash(dash ?? []);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.moveTo(A.x + nx * off, A.y + ny * off);
        ctx.lineTo(B.x + nx * off, B.y + ny * off);
        ctx.stroke();
        ctx.setLineDash([]);
      };
      const base = 'rgba(235,235,245,0.72)';
      if (b.order === 1 || aromatic) drawLine(0, 2, base);
      if (b.order === 2) {
        drawLine(-3.4, 1.8, base);
        drawLine(3.4, 1.8, base);
      }
      if (b.order === 3) {
        drawLine(-4.6, 1.6, base);
        drawLine(0, 1.6, base);
        drawLine(4.6, 1.6, base);
      }
      if (aromatic) {
        // inner dashed ring line
        drawLine(0, 1, 'rgba(163,255,18,0.55)', [4, 3]);
      }
      if (b.order === 4) {
        ctx.strokeStyle = 'rgba(255,92,174,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
      }
      if (b.stereo) {
        // wedge for stereochemistry
        ctx.fillStyle = 'rgba(235,235,245,0.6)';
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        const w = 5;
        ctx.lineTo(B.x + nx * w, B.y + ny * w);
        ctx.lineTo(B.x - nx * w, B.y - ny * w);
        ctx.closePath();
        ctx.fill();
      }
    }

    // atoms
    for (const a of mol.atoms) {
      const info = elementInfo(a.element);
      const isC = a.element === 'C';
      const sel = selectedAtom === a.index;
      const r = isC ? 0 : Math.max(8, info.radius * 15);
      if (!isC) {
        const g = ctx.createRadialGradient(a.x - r * 0.3, a.y - r * 0.35, r * 0.1, a.x, a.y, r);
        g.addColorStop(0, lighten(info.color, 0.5));
        g.addColorStop(1, info.color);
        ctx.beginPath();
        ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = sel ? '#a3ff12' : 'rgba(0,0,0,0.45)';
        ctx.lineWidth = sel ? 2.4 : 1;
        ctx.stroke();
        if (showLabels) {
          ctx.fillStyle = luminance(info.color) > 0.55 ? '#101018' : '#ffffff';
          ctx.font = `600 ${Math.max(9, r * 0.92)}px "Space Grotesk", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(a.element, a.x, a.y + 0.5);
        }
      }
      if (showH && a.hydrogens > 0) {
        ctx.fillStyle = 'rgba(220,220,235,0.55)';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`H${a.hydrogens > 1 ? a.hydrogens : ''}`, a.x, a.y - r - 7);
      }
      if (a.charge !== 0) {
        ctx.fillStyle = a.charge > 0 ? '#ff9b9b' : '#9bc4ff';
        ctx.font = '600 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${a.charge > 0 ? '+' : '−'}`, a.x + r * 0.7, a.y - r * 0.7);
      }
    }
    ctx.restore();

    // legend
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText('drag to pan · scroll to zoom · click an atom', 12, rect.height - 12);
  }, [mol, showH, showLabels, selectedAtom]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const v = viewRef.current;
    v.zoom = Math.max(0.35, Math.min(4, v.zoom * (e.deltaY < 0 ? 1.12 : 0.89)));
    setSelectedAtom((s) => s);
    // force redraw
    setMol((m) => (m ? { ...m } : m));
  };

  const dragging = useRef<{ x: number; y: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragging.current = { x: e.clientX, y: e.clientY };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const v = viewRef.current;
    v.panX += e.clientX - dragging.current.x;
    v.panY += e.clientY - dragging.current.y;
    dragging.current = { x: e.clientX, y: e.clientY };
    setMol((m) => (m ? { ...m } : m));
  };
  const onUp = () => { dragging.current = null; };

  const clickCanvas = (e: React.MouseEvent) => {
    if (!mol || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const v = viewRef.current;
    const cx = (e.clientX - rect.left - rect.width / 2 - v.panX) / v.zoom + 320;
    const cy = (e.clientY - rect.top - rect.height / 2 - v.panY) / v.zoom + 210;
    let best = -1, bestD = 22;
    for (const a of mol.atoms) {
      const d = Math.hypot(a.x - cx, a.y - cy);
      if (d < bestD) { bestD = d; best = a.index; }
    }
    setSelectedAtom(best >= 0 ? best : null);
  };

  /* ---------------- sonification ---------------- */
  const spectrum = useMemo(() => (mol ? molecularSpectrum(mol) : []), [mol]);

  const stopAudio = () => {
    for (const n of nodesRef.current) {
      try { n.gain.gain.exponentialRampToValueAtTime(0.0001, (audioRef.current?.currentTime ?? 0) + 0.06); n.osc.stop((audioRef.current?.currentTime ?? 0) + 0.08); } catch {}
    }
    nodesRef.current = [];
    setPlaying(false);
  };

  const play = () => {
    if (playing) { stopAudio(); return; }
    if (!mol) return;
    const ctx = audioRef.current ?? new AudioContext();
    audioRef.current = ctx;
    if (ctx.state === 'suspended') ctx.resume();
    const master = ctx.createGain();
    master.gain.value = 0.16;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 5200;
    master.connect(filter).connect(ctx.destination);

    const now = ctx.currentTime;
    const nodes: { osc: OscillatorNode; gain: GainNode }[] = [];
    spectrum.forEach((p, i) => {
      const osc = ctx.createOscillator();
      osc.type = i % 3 === 0 ? 'sine' : i % 3 === 1 ? 'triangle' : 'sine';
      osc.frequency.value = p.freq;
      const g = ctx.createGain();
      // slow bloom so it sounds like an instrument, not a test tone
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(Math.max(0.002, p.intensity * 0.22), now + 0.35 + i * 0.06);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.12 + i * 0.043;
      const lg = ctx.createGain();
      lg.gain.value = p.intensity * 0.06;
      lfo.connect(lg).connect(g.gain);
      lfo.start();
      osc.connect(g).connect(master);
      osc.start();
      nodes.push({ osc, gain: g });
    });
    nodesRef.current = nodes;
    setPlaying(true);
  };

  useEffect(() => () => stopAudio(), []);

  const activeAtom = selectedAtom !== null && mol ? mol.atoms[selectedAtom] : null;

  return (
    <WonderShell w={W}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 16 }} className="alc-layout">
        <div className="stack" style={{ gap: 12 }}>
          <div className="panel" style={{ padding: 12, position: 'relative' }}>
            <canvas
              ref={canvasRef}
              onWheel={onWheel}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onClick={clickCanvas}
              style={{ width: '100%', height: 420, display: 'block', cursor: 'grab', borderRadius: 10, background: 'radial-gradient(60% 60% at 50% 40%, #14141d 0%, #0a0a11 100%)', touchAction: 'none' }}
            />
            <div style={{ position: 'absolute', top: 22, left: 22 }} className="row">
              <span className="chip chip-live"><span className="dot" /> PARSED · LAYOUT · MASS</span>
              {mol && <span className="chip">{mol.formula}</span>}
              {mol && <span className="chip">{mol.bonds.length} bonds</span>}
            </div>
          </div>

          <div className="row" style={{ gap: 6, alignItems: 'stretch' }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && build(input)}
              placeholder="Paste any SMILES — e.g. CC(=O)Oc1ccccc1C(=O)O"
              style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: 12 }}
              spellCheck={false}
            />
            <button className="btn btn-primary" onClick={() => build(input)}>Parse</button>
          </div>
          {error && <div style={{ color: '#ff8080', fontSize: 12 }}>{error}</div>}

          <div className="row" style={{ gap: 8 }}>
            <Stat label="Formula" value={mol?.formula ?? '—'} />
            <Stat label="Monoisotopic" value={mol ? `${mol.mass.toFixed(3)}` : '—'} sub="Da" />
            <Stat label="Heavy atoms" value={mol?.atoms.length ?? 0} />
            <Stat label="Rings" value={mol?.rings.length ?? 0} />
            <Stat label="Layout" value={layoutMs ? `${layoutMs.toFixed(0)}ms` : '—'} />
          </div>

          <div className="panel panel-pad">
            <div className="spread" style={{ marginBottom: 10 }}>
              <div className="section-title" style={{ margin: 0 }}>Molecular spectrum — listen to it</div>
              <button className="btn btn-sm" onClick={play}>{playing ? '■ Stop' : '♪ Play'}</button>
            </div>
            <div style={{ height: 86, display: 'flex', alignItems: 'flex-end', gap: 3 }}>
              {spectrum.map((p, i) => {
                // logarithmic frequency axis
                const lo = Math.log2(80), hi = Math.log2(8000);
                const x = Math.max(0, Math.min(1, (Math.log2(p.freq) - lo) / (hi - lo)));
                return (
                  <div
                    key={i}
                    title={`${p.label} — ${p.freq.toFixed(1)} Hz`}
                    style={{
                      flex: 1, height: `${Math.max(8, p.intensity * 100)}%`,
                      background: `linear-gradient(180deg, hsl(${180 + i * 14},90%,68%), hsl(${180 + i * 14},70%,42%))`,
                      borderRadius: '3px 3px 0 0', opacity: playing ? 1 : 0.75,
                      boxShadow: playing ? `0 0 12px hsla(${180 + i * 14},90%,60%,0.5)` : 'none',
                      transition: 'opacity 0.3s',
                    }}
                  />
                );
              })}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
              {spectrum.slice(0, 10).map((p, i) => (
                <span key={i} className="chip" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 9 }}>
                  {p.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="stack" style={{ gap: 14 }}>
          <div className="panel panel-pad">
            <div className="section-title">Molecule</div>
            <div className="stack" style={{ gap: 3, maxHeight: 240, overflowY: 'auto' }}>
              {MOLECULES.map((m) => (
                <button
                  key={m.name}
                  className="btn btn-sm btn-ghost"
                  style={{ justifyContent: 'flex-start', background: smiles === m.smiles ? 'var(--panel-2)' : 'transparent', padding: '6px 10px' }}
                  onClick={() => { setInput(m.smiles); build(m.smiles); }}
                >
                  <span>{m.name}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--txt-3)' }}>{m.note}</span>
                </button>
              ))}
            </div>
          </div>

          {activeAtom && (
            <div className="panel panel-pad stack" style={{ gap: 8 }}>
              <div className="section-title" style={{ margin: 0 }}>Atom {activeAtom.index}: {activeAtom.element}</div>
              <div className="kv"><span>Element</span><span>{activeAtom.element}</span></div>
              <div className="kv"><span>Aromatic</span><span>{activeAtom.aromatic ? 'yes' : 'no'}</span></div>
              <div className="kv"><span>Implicit H</span><span>{activeAtom.hydrogens}</span></div>
              <div className="kv"><span>Charge</span><span>{activeAtom.charge}</span></div>
              <div className="kv"><span>Mass</span><span>{elementInfo(activeAtom.element).mass.toFixed(4)}</span></div>
              <div className="kv"><span>Valence</span><span>{elementInfo(activeAtom.element).valence}</span></div>
            </div>
          )}

          <div className="panel panel-pad stack" style={{ gap: 11 }}>
            <div className="section-title" style={{ margin: 0 }}>View</div>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn btn-sm btn-ghost" onClick={() => setShowH((v) => !v)}>{showH ? '✓' : '○'} Hydrogens</button>
              <button className="btn btn-sm btn-ghost" onClick={() => setShowLabels((v) => !v)}>{showLabels ? '✓' : '○'} Labels</button>
            </div>
            <button className="btn btn-sm" onClick={() => { viewRef.current = { zoom: 1, panX: 0, panY: 0 }; setMol((m) => m ? { ...m } : m); }}>Reset view</button>
          </div>

          <div className="panel panel-pad">
            <div className="note">
              This is a real SMILES parser: branches, ring closures, aromaticity, charges, isotopes and
              stereochemistry markers. Formulas and monoisotopic masses match PubChem for all 17 molecules in the
              library. The spectrum maps the bond graph onto harmonics — an audible fingerprint of structure.
            </div>
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 980px) { .alc-layout { grid-template-columns: 1fr !important; } }`}</style>
    </WonderShell>
  );
}

function lighten(hex: string, amt: number) {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (v: number) => Math.min(255, v + (255 - v) * amt);
  return `rgb(${f(r) | 0},${f(g) | 0},${f(b) | 0})`;
}
function luminance(hex: string) {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
