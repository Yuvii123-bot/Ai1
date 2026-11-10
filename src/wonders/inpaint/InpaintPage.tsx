import { useCallback, useEffect, useRef, useState } from 'react';
import { WonderShell, Slider, Stat, Segmented, Toggle } from '../../lib/ui';
import { WONDER_META } from '../meta';
import { inpaint, dilate, Mask } from './inpaint';

const W = WONDER_META.find((w) => w.slug === 'inpaint')!;

const SAMPLES = [
  { id: 'beach', name: 'Beach', src: '/samples/beach.jpg', hint: 'Remove the umbrella' },
  { id: 'street', name: 'Street', src: '/samples/street.jpg', hint: 'Remove the sign' },
  { id: 'room', name: 'Interior', src: '/samples/room.jpg', hint: 'Remove the chair' },
];

export default function InpaintPage() {
  const [srcCanvas] = useState(() => document.createElement('canvas'));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalRef = useRef<ImageData | null>(null);
  const [mask, setMask] = useState<Mask | null>(null);
  const [brush, setBrush] = useState(26);
  const [erasing, setErasing] = useState(false);
  const [method, setMethod] = useState<'fast' | 'exemplar' | 'hybrid'>('hybrid');
  const [patch, setPatch] = useState(7);
  const [blend, setBlend] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const [sampleId, setSampleId] = useState('beach');
  const [maskedArea, setMaskedArea] = useState(0);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [showMask, setShowMask] = useState(true);
  const [sliderPos, setSliderPos] = useState(0.5);
  const [layer, setLayer] = useState<'before' | 'after'>('after');

  const drawComposite = (img: ImageData, m: Mask, overlay: boolean) => {
    if (!overlay) return;
    const d = img.data;
    for (let i = 0; i < m.length; i++) {
      if (!m[i]) continue;
      d[i * 4] = d[i * 4] * 0.35 + 255 * 0.65;
      d[i * 4 + 1] = d[i * 4 + 1] * 0.35 + 60 * 0.65;
      d[i * 4 + 2] = d[i * 4 + 2] * 0.35 + 190 * 0.65;
    }
  };

  const drawMaskOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mask || !size.w) return;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.getImageData(0, 0, size.w, size.h);
    drawComposite(img, mask, showMask);
    ctx.putImageData(img, 0, 0);
  }, [mask, size, showMask]);

  const loadImage = useCallback(
    (src: string) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // fit into a sane canvas size (max 640 wide) for interactive painting
        const maxW = 640;
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        srcCanvas.width = w;
        srcCanvas.height = h;
        const ctx = srcCanvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h);
        originalRef.current = data;
        setSize({ w, h });
        setMask(new Uint8Array(w * h));
        setMaskedArea(0);
        setResultUrl(null);
        setBeforeUrl(null);
        const canvas = canvasRef.current!;
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')!.putImageData(data, 0, 0);
      };
      img.onerror = () => {
        // fallback: generated gradient so the wonder still works offline
        const w = 560, h = 380;
        srcCanvas.width = w; srcCanvas.height = h;
        const ctx = srcCanvas.getContext('2d')!;
        const grd = ctx.createLinearGradient(0, 0, 0, h);
        grd.addColorStop(0, '#2b4c8c');
        grd.addColorStop(0.55, '#6fa8dc');
        grd.addColorStop(1, '#8ab24a');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);
        originalRef.current = ctx.getImageData(0, 0, w, h);
        setSize({ w, h });
        setMask(new Uint8Array(w * h));
        canvasRef.current!.width = w;
        canvasRef.current!.height = h;
        canvasRef.current!.getContext('2d')!.putImageData(originalRef.current!, 0, 0);
      };
      img.src = src;
    },
    [srcCanvas]
  );

  useEffect(() => {
    loadImage(SAMPLES[0].src);
  }, [loadImage]);

  const painting = useRef(false);
  const lastPt = useRef<{ x: number; y: number } | null>(null);

  const paintAt = (x: number, y: number) => {
    if (!mask || !size.w) return;
    const r = brush / 2;
    const x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(size.w - 1, Math.ceil(x + r));
    const y0 = Math.max(0, Math.floor(y - r)), y1 = Math.min(size.h - 1, Math.ceil(y + r));
    const next = mask;
    let added = 0;
    for (let yy = y0; yy <= y1; yy++) {
      for (let xx = x0; xx <= x1; xx++) {
        if ((xx - x) ** 2 + (yy - y) ** 2 > r * r) continue;
        const i = yy * size.w + xx;
        if (erasing) { if (next[i]) { next[i] = 0; added--; } }
        else if (!next[i]) { next[i] = 1; added++; }
      }
    }
    if (added !== 0) {
      setMask(new Uint8Array(next));
      setMaskedArea((a) => Math.max(0, a + added));
    }
  };

  const toLocal = (e: React.PointerEvent) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * size.w,
      y: ((e.clientY - r.top) / r.height) * size.h,
    };
  };

  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    painting.current = true;
    const p = toLocal(e);
    lastPt.current = p;
    paintAt(p.x, p.y);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!painting.current) return;
    const p = toLocal(e);
    // interpolate between points for smooth strokes
    const lp = lastPt.current;
    if (lp) {
      const steps = Math.max(1, Math.ceil(Math.hypot(p.x - lp.x, p.y - lp.y) / (brush * 0.35)));
      for (let i = 1; i <= steps; i++) {
        paintAt(lp.x + ((p.x - lp.x) * i) / steps, lp.y + ((p.y - lp.y) * i) / steps);
      }
    }
    lastPt.current = p;
  };
  const onUp = () => { painting.current = false; lastPt.current = null; };

  useEffect(() => { drawMaskOverlay(); }, [mask, showMask, drawMaskOverlay]);

  const run = async () => {
    const orig = originalRef.current;
    if (!orig || !mask) return;
    const count = mask.reduce((a, b) => a + b, 0);
    if (count === 0) return;
    setBusy(true);
    setProgress(0);
    await new Promise((r) => setTimeout(r, 30));
    const t0 = performance.now();
    // small dilation so antialiased fringes disappear too
    const grown = dilate(mask, size.w, size.h, 2);
    // run off the main thread's critical path in chunks
    setTimeout(() => {
      const { rgba, ms } = inpaint(orig.data, grown, size.w, size.h, {
        method, patch, blend,
        onProgress: (p) => setProgress(p),
      });
      const c = canvasRef.current!;
      const out = new ImageData(new Uint8ClampedArray(rgba) as any, size.w, size.h);
      c.getContext('2d')!.putImageData(out, 0, 0);
      setResultUrl(c.toDataURL('image/png'));
      const before = document.createElement('canvas');
      before.width = size.w;
      before.height = size.h;
      before.getContext('2d')!.putImageData(orig, 0, 0);
      setBeforeUrl(before.toDataURL('image/png'));
      setLayer('after');
      setElapsed(ms);
      setProgress(1);
      setBusy(false);
      // masked area is now filled; clear it
      setMask(new Uint8Array(size.w * size.h));
      setMaskedArea(0);
      // commit result as the new original so you can keep editing
      originalRef.current = new ImageData(new Uint8ClampedArray(rgba) as any, size.w, size.h);
      void t0;
    }, 60);
  };

  const download = () => {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = `restore-${sampleId}.png`;
    a.click();
  };

  const onUpload = (f: File) => {
    const url = URL.createObjectURL(f);
    setSampleId('upload');
    loadImage(url);
  };

  const pct = (maskedArea / Math.max(1, size.w * size.h)) * 100;

  return (
    <WonderShell w={W}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 16 }} className="inp-layout">
        <div className="stack" style={{ gap: 12 }}>
          <div className="panel" style={{ padding: 12, position: 'relative' }}>
            <canvas
              ref={canvasRef}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerLeave={onUp}
              style={{
                width: '100%', display: 'block', borderRadius: 10, cursor: 'crosshair',
                touchAction: 'none', background: '#0b0b12',
              }}
            />
            <div style={{ position: 'absolute', top: 20, left: 20 }} className="row">
              <span className="chip chip-live"><span className="dot" /> OFFLINE · ON-DEVICE</span>
              {maskedArea > 0 && <span className="chip">{pct.toFixed(1)}% selected</span>}
            </div>
            {busy && (
              <div style={{ position: 'absolute', inset: 12, display: 'grid', placeItems: 'center', background: 'rgba(6,6,10,0.72)', borderRadius: 10, backdropFilter: 'blur(4px)' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 13, marginBottom: 10 }}>Synthesising texture…</div>
                  <div style={{ width: 200, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${progress * 100}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.2s' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="row">
            <button className="btn btn-primary" onClick={run} disabled={busy || maskedArea === 0}>
              ✨ Remove it
            </button>
            <button className="btn btn-sm" onClick={() => { if (mask && size.w) { setMask(new Uint8Array(size.w * size.h)); setMaskedArea(0); } }}>Clear mask</button>
            <button className="btn btn-sm btn-ghost" onClick={() => { if (originalRef.current) { const c = canvasRef.current!; c.getContext('2d')!.putImageData(originalRef.current, 0, 0); setResultUrl(null); } }}>Revert</button>
            <button className="btn btn-sm" onClick={download} disabled={!resultUrl}>↓ Download</button>
            <label className="btn btn-sm btn-ghost" style={{ cursor: 'pointer' }}>
              ↑ Upload photo
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
            </label>
          </div>

          {resultUrl && beforeUrl && (
            <div className="panel panel-pad">
              <div className="spread" style={{ marginBottom: 10 }}>
                <div className="section-title" style={{ margin: 0 }}>Before / after</div>
                <Segmented
                  value={layer}
                  options={[{ id: 'before', label: 'Before' }, { id: 'after', label: 'After' }]}
                  onChange={(v) => setLayer(v as any)}
                />
              </div>
              <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--line)' }}>
                <img src={beforeUrl} style={{ width: '100%', display: 'block' }} alt="before" />
                <div style={{ position: 'absolute', inset: 0, width: `${sliderPos * 100}%`, overflow: 'hidden' }}>
                  <img src={resultUrl} style={{ width: `${100 / sliderPos}%`, maxWidth: 'none', display: 'block' }} alt="after" />
                </div>
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${sliderPos * 100}%`, width: 2, background: 'var(--accent)', boxShadow: '0 0 12px rgba(163,255,18,0.7)' }} />
                <input
                  type="range" min={0.02} max={0.98} step={0.001} value={sliderPos}
                  onChange={(e) => setSliderPos(parseFloat(e.target.value))}
                  style={{ position: 'absolute', bottom: 8, left: 8, right: 8, width: 'calc(100% - 16px)', opacity: 0.85 }}
                />
                <span className="chip" style={{ position: 'absolute', top: 8, left: 8 }}>before</span>
                <span className="chip" style={{ position: 'absolute', top: 8, right: 8 }}>{layer}</span>
              </div>
            </div>
          )}

          <div className="row" style={{ gap: 8 }}>
            <Stat label="Selected" value={`${pct.toFixed(1)}%`} />
            <Stat label="Last inpaint" value={elapsed ? `${elapsed.toFixed(0)} ms` : '—'} />
            <Stat label="Resolution" value={`${size.w}×${size.h}`} />
            <Stat label="Method" value={method} />
          </div>
        </div>

        <div className="stack" style={{ gap: 14 }}>
          <div className="panel panel-pad stack" style={{ gap: 13 }}>
            <div className="section-title" style={{ margin: 0 }}>Brush</div>
            <Slider label="Size" value={brush} min={4} max={90} step={1} onChange={(v) => setBrush(Math.round(v))} suffix=" px" />
            <Toggle label="Erase mode" on={erasing} onChange={setErasing} />
            <Toggle label="Show mask overlay" on={showMask} onChange={setShowMask} />
            <div style={{ fontSize: 11, color: 'var(--txt-3)', lineHeight: 1.5 }}>
              Paint over anything you want gone. Painting is interpolated so fast strokes never leave gaps.
            </div>
          </div>

          <div className="panel panel-pad stack" style={{ gap: 13 }}>
            <div className="section-title" style={{ margin: 0 }}>Algorithm</div>
            <Segmented
              value={method}
              options={[
                { id: 'fast', label: 'Fast' },
                { id: 'exemplar', label: 'Exemplar' },
                { id: 'hybrid', label: 'Hybrid' },
              ]}
              onChange={(v) => setMethod(v as any)}
            />
            <Slider label="Patch size" value={patch} min={3} max={15} step={2} onChange={(v) => setPatch(Math.round(v))} suffix=" px" />
            <Toggle label="Feather seam" on={blend} onChange={setBlend} />
            <div className="note" style={{ fontSize: 11.5 }}>
              <strong style={{ color: 'var(--txt)' }}>Hybrid</strong> fills structurally first, then synthesises
              texture by copying the best-matching real patch, then blends the seam. Nothing leaves your device.
            </div>
          </div>

          <div className="panel panel-pad">
            <div className="section-title">Sample photos</div>
            <div className="stack" style={{ gap: 6 }}>
              {SAMPLES.map((s) => (
                <button key={s.id} className="btn btn-sm btn-ghost"
                  style={{ justifyContent: 'flex-start', background: sampleId === s.id ? 'var(--panel-2)' : 'transparent' }}
                  onClick={() => { setSampleId(s.id); loadImage(s.src); }}>
                  {s.name} <span style={{ color: 'var(--txt-3)', marginLeft: 'auto', fontSize: 10.5 }}>{s.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 980px) { .inp-layout { grid-template-columns: 1fr !important; } }`}</style>
    </WonderShell>
  );
}
