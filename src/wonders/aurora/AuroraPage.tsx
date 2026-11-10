import { useCallback, useEffect, useRef, useState } from 'react';
import { WonderShell, Slider, Stat, Segmented, Toggle } from '../../lib/ui';
import { WONDER_META } from '../meta';
import { paint, makePalette, DEFAULT_ART, ArtConfig, toSvg } from './art';
import { download } from '../../lib/math';

const W = WONDER_META.find((w) => w.slug === 'aurora')!;

const STYLES: { id: ArtConfig['style']; name: string; desc: string }[] = [
  { id: 'silk', name: 'Silk', desc: 'Long, flowing, luminous ribbons' },
  { id: 'nocturne', name: 'Nocturne', desc: 'Deep night, cool light' },
  { id: 'ink', name: 'Ink', desc: 'Bold, sparse, graphic' },
  { id: 'bloom', name: 'Bloom', desc: 'Thousands of fine petals' },
  { id: 'topography', name: 'Topography', desc: 'Contour lines, map-like' },
];

export default function AuroraPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cfg, setCfg] = useState<ArtConfig>(DEFAULT_ART);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ms, setMs] = useState(0);
  const [history, setHistory] = useState<{ url: string; cfg: ArtConfig }[]>([]);
  const [thumbs, setThumbs] = useState<{ url: string; seed: number }[]>([]);
  const [palette, setPalette] = useState(() => makePalette(DEFAULT_ART.seed, DEFAULT_ART.style));
  const [size, setSize] = useState(720);
  const paintRef = useRef(cfg);
  paintRef.current = cfg;

  const renderArt = useCallback(
    (c: ArtConfig, targetSize = size, cb?: () => void) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = 1;
      canvas.width = targetSize;
      canvas.height = Math.round(targetSize * 0.75);
      const ctx = canvas.getContext('2d')!;
      const t0 = performance.now();
      const res = paint(ctx, canvas.width, canvas.height, c, (p) => setProgress(p));
      setPalette(res.palette);
      setMs(performance.now() - t0);
      cb?.();
    },
    [size]
  );

  const render = useCallback(() => {
    setBusy(true);
    setProgress(0);
    // defer so the busy state paints first
    setTimeout(() => {
      renderArt(cfg, size, () => {
        setBusy(false);
        const canvas = canvasRef.current!;
        setHistory((h) => [{ url: canvas.toDataURL('image/png'), cfg: { ...cfg } }, ...h].slice(0, 12));
      });
    }, 30);
  }, [cfg, size, renderArt]);

  useEffect(() => {
    renderArt(DEFAULT_ART, size, () => {
      const c = canvasRef.current!;
      setHistory([{ url: c.toDataURL('image/png'), cfg: { ...DEFAULT_ART } }]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // build a seed gallery of small thumbnails
  useEffect(() => {
    const c = document.createElement('canvas');
    c.width = 150;
    c.height = 112;
    const ctx = c.getContext('2d')!;
    const out: { url: string; seed: number }[] = [];
    for (let i = 0; i < 8; i++) {
      const seed = Math.floor(Math.random() * 9_999_999);
      paint(ctx, 150, 112, { ...DEFAULT_ART, seed, strokeCount: 700, grain: 0.1 }, undefined);
      out.push({ url: c.toDataURL('image/png'), seed });
    }
    setThumbs(out);
  }, []);

  const randomize = () => {
    const styles = STYLES.map((s) => s.id);
    const next: ArtConfig = {
      ...cfg,
      seed: Math.floor(Math.random() * 99_999_999),
      style: styles[Math.floor(Math.random() * styles.length)],
      complexity: 0.3 + Math.random() * 0.65,
      strokeCount: 1600 + Math.floor(Math.random() * 3400),
      bloom: 0.25 + Math.random() * 0.6,
    };
    setCfg(next);
    setBusy(true);
    setTimeout(() => {
      renderArt(next, size, () => {
        setBusy(false);
        const c = canvasRef.current!;
        setHistory((h) => [{ url: c.toDataURL('image/png'), cfg: { ...next } }, ...h].slice(0, 12));
      });
    }, 30);
  };

  const set = <K extends keyof ArtConfig>(k: K, v: ArtConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));

  const exportPng = (scale = 1) => {
    const src = canvasRef.current!;
    const c = document.createElement('canvas');
    c.width = Math.round(2400 * scale);
    c.height = Math.round(1800 * scale);
    const ctx = c.getContext('2d')!;
    ctx.drawImage(src, 0, 0, c.width, c.height);
    c.toBlob((b) => b && download(`aurora-${cfg.seed}.png`, b), 'image/png');
  };

  const exportSvg = () => {
    const svg = toSvg(1600, 1200, cfg, 1400);
    download(`aurora-${cfg.seed}.svg`, svg, 'image/svg+xml');
  };

  return (
    <WonderShell w={W}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 16 }} className="aur-layout">
        <div className="stack" style={{ gap: 12 }}>
          <div className="panel" style={{ padding: 12, position: 'relative' }}>
            <canvas ref={canvasRef} style={{ width: '100%', display: 'block', borderRadius: 10 }} />
            {busy && (
              <div style={{ position: 'absolute', inset: 12, display: 'grid', placeItems: 'center', background: 'rgba(6,6,10,0.6)', borderRadius: 10 }}>
                <div style={{ width: 220 }}>
                  <div style={{ fontSize: 12, marginBottom: 8, fontFamily: 'var(--mono)' }}>painting… {(progress * 100) | 0}%</div>
                  <div style={{ height: 3, background: 'rgba(255,255,255,0.12)', borderRadius: 99 }}>
                    <div style={{ width: `${progress * 100}%`, height: '100%', background: 'var(--violet)', borderRadius: 99 }} />
                  </div>
                </div>
              </div>
            )}
            <div style={{ position: 'absolute', top: 20, left: 20 }} className="row">
              <span className="chip chip-live"><span className="dot" /> SEED {cfg.seed}</span>
              <span className="chip">{palette.rule}</span>
              <span className="chip">{ms ? `${ms.toFixed(0)} ms` : ''}</span>
            </div>
          </div>

          <div className="row">
            <button className="btn btn-primary" onClick={render} disabled={busy}>↻ Paint</button>
            <button className="btn" onClick={randomize} disabled={busy}>✦ Surprise me</button>
            <button className="btn btn-sm btn-ghost" onClick={() => { set('seed', Math.floor(Math.random() * 99999999)); setTimeout(render, 0); }}>🎲 New seed</button>
            <div className="row" style={{ gap: 6, marginLeft: 'auto' }}>
              <button className="btn btn-sm btn-ghost" onClick={() => exportPng(0.5)}>↓ PNG 1200</button>
              <button className="btn btn-sm btn-ghost" onClick={() => exportPng(1)}>↓ PNG 2400</button>
              <button className="btn btn-sm btn-ghost" onClick={exportSvg}>↓ SVG</button>
            </div>
          </div>

          <div className="row" style={{ gap: 8 }}>
            <Stat label="Strokes" value={Math.round(cfg.strokeCount).toLocaleString()} />
            <Stat label="Palette" value={palette.rule} sub={palette.name.split('·')[1]} />
            <Stat label="Render" value={ms ? `${(ms / 1000).toFixed(2)}s` : '—'} />
            <div className="panel" style={{ padding: '12px 14px', flex: 2, minWidth: 180 }}>
              <div className="eyebrow" style={{ fontSize: 9.5, marginBottom: 7 }}>Colour theory</div>
              <div className="row" style={{ gap: 4 }}>
                {palette.colors.map((c, i) => (
                  <div key={i} title={c} style={{ flex: 1, height: 22, background: c, borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)' }} />
                ))}
              </div>
            </div>
          </div>

          <div className="panel panel-pad">
            <div className="spread" style={{ marginBottom: 9 }}>
              <div className="section-title" style={{ margin: 0 }}>Gallery — click any to revisit</div>
              <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>{history.length} pieces</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
              {history.map((h, i) => (
                <img
                  key={i}
                  src={h.url}
                  onClick={() => { setCfg(h.cfg); setTimeout(() => renderArt(h.cfg, size), 0); }}
                  style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--line)' }}
                  alt={`art ${i}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="stack" style={{ gap: 14 }}>
          <div className="panel panel-pad stack" style={{ gap: 12 }}>
            <div className="section-title" style={{ margin: 0 }}>Style</div>
            <div className="stack" style={{ gap: 5 }}>
              {STYLES.map((s) => (
                <button key={s.id} className="btn btn-sm" onClick={() => { set('style', s.id); }}
                  style={{
                    flexDirection: 'column', alignItems: 'flex-start', gap: 1, padding: '8px 11px',
                    background: cfg.style === s.id ? 'rgba(139,108,255,0.14)' : 'transparent',
                    borderColor: cfg.style === s.id ? 'rgba(139,108,255,0.45)' : 'var(--line)',
                    textAlign: 'left',
                  }}>
                  <span style={{ fontWeight: 500 }}>{s.name}</span>
                  <span style={{ fontSize: 10.5, color: 'var(--txt-3)' }}>{s.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="panel panel-pad stack" style={{ gap: 13 }}>
            <div className="section-title" style={{ margin: 0 }}>Brush</div>
            <Slider label="Strokes" value={cfg.strokeCount} min={400} max={8000} step={100} onChange={(v) => set('strokeCount', v)} fmt={(v) => v.toFixed(0)} />
            <Slider label="Complexity" value={cfg.complexity} min={0} max={1} onChange={(v) => set('complexity', v)} fmt={(v) => (v * 100).toFixed(0)} suffix="%" />
            <Slider label="Brush size" value={cfg.brushSize} min={0.8} max={12} onChange={(v) => set('brushSize', v)} fmt={(v) => v.toFixed(1)} />
            <Slider label="Bloom" value={cfg.bloom} min={0} max={1} onChange={(v) => set('bloom', v)} fmt={(v) => (v * 100).toFixed(0)} suffix="%" />
            <Slider label="Vignette" value={cfg.vignette} min={0} max={1} onChange={(v) => set('vignette', v)} fmt={(v) => (v * 100).toFixed(0)} suffix="%" />
            <Slider label="Film grain" value={cfg.grain} min={0} max={1} onChange={(v) => set('grain', v)} fmt={(v) => (v * 100).toFixed(0)} suffix="%" />
          </div>

          <div className="panel panel-pad">
            <div className="section-title">Seed gallery — one-of-one</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
              {thumbs.map((t) => (
                <img key={t.seed} src={t.url} onClick={() => { set('seed', t.seed); setTimeout(() => {
                  const c = canvasRef.current!;
                  paint(c.getContext('2d')!, c.width, c.height, { ...cfg, seed: t.seed }, setProgress);
                }, 0); }}
                  style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: 5, cursor: 'pointer', opacity: 0.85 }}
                  alt={`seed ${t.seed}`} />
              ))}
            </div>
          </div>

          <div className="panel panel-pad">
            <div className="note">
              Every output is a deterministic function of its seed — the same seed always paints the same picture, so
              a buyer can verify an edition. Exports as SVG (infinite resolution, editable) or 2400px PNG for print-on-demand.
            </div>
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 980px) { .aur-layout { grid-template-columns: 1fr !important; } }`}</style>
    </WonderShell>
  );
}
