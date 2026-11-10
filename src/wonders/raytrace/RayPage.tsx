import { useCallback, useEffect, useRef, useState } from 'react';
import { WonderShell, Slider, Stat } from '../../lib/ui';
import { wonderBySlug } from '../../registry';
import { Scene, Camera, renderTile, tonemap, denoise } from './trace';
import { SCENES, SceneId, buildScene, CAMERAS } from './scenes';
import { download } from '../../lib/math';

const W = wonderBySlug('raytrace')!;

const PRESETS: { id: string; label: string; res: number; spp: number; bounces: number }[] = [
  { id: 'draft', label: 'Draft', res: 0.4, spp: 1, bounces: 4 },
  { id: 'fast', label: 'Fast', res: 0.62, spp: 2, bounces: 6 },
  { id: 'beauty', label: 'Beauty', res: 0.85, spp: 3, bounces: 8 },
  { id: 'quality', label: 'Quality', res: 1.0, spp: 4, bounces: 10 },
];

export default function RayPage() {
  const [sceneId, setSceneId] = useState<SceneId>('studio');
  const [camId, setCamId] = useState('hero');
  const [quality, setQuality] = useState(1);
  const [aperture, setAperture] = useState(0);
  const [focus, setFocus] = useState(6);
  const [exposure, setExposure] = useState(1);
  const [bounces, setBounces] = useState(8);
  const [renderScale, setRenderScale] = useState(0.85);
  const [running, setRunning] = useState(false);
  const [samples, setSamples] = useState(0);
  const [totalSamples, setTotalSamples] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [denoiseOn, setDenoiseOn] = useState(true);
  const [raysPerSec, setRaysPerSec] = useState(0);
  const [finalPng, setFinalPng] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const accumRef = useRef<Float32Array | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const workersRef = useRef<Worker[]>([]);
  const runningRef = useRef(false);
  const pendingRef = useRef(0);
  const sampleBaseRef = useRef(0);
  const raysRef = useRef(0);
  const lastTimeRef = useRef(0);

  const nCores = Math.max(1, Math.min(8, navigator.hardwareConcurrency || 4));

  useEffect(() => {
    const ws: Worker[] = [];
    for (let i = 0; i < nCores; i++) {
      ws.push(new Worker(new URL('./traceWorker.ts', import.meta.url), { type: 'module' }));
    }
    workersRef.current = ws;
    return () => ws.forEach((w) => w.terminate());
  }, [nCores]);

  const buildCamera = useCallback((): Camera => {
    const c = CAMERAS.find((x) => x.id === camId) ?? CAMERAS[0];
    return { pos: c.pos, target: c.target, fov: c.fov, aperture, focus };
  }, [camId, aperture, focus]);

  const paintAccum = useCallback(() => {
    const canvas = canvasRef.current;
    const accum = accumRef.current;
    if (!canvas || !accum) return;
    const { w, h } = sizeRef.current;
    const ctx = canvas.getContext('2d')!;
    const img = tonemap(accum, Math.max(1, totalSamples), exposure);
    if (denoiseOn && totalSamples < 40) denoise(img, w, h, totalSamples < 4 ? 0.85 : 0.5);
    const id = new ImageData(new Uint8ClampedArray(img) as any, w, h);
    ctx.putImageData(id, 0, 0);
  }, [exposure, denoiseOn, totalSamples]);

  const stop = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
  }, []);

  const start = useCallback(async () => {
    if (runningRef.current) return;
    const scene = buildScene(sceneId);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(80, Math.floor(rect.width * renderScale));
    const h = Math.max(60, Math.floor(rect.height * renderScale));
    const dpr = 1;
    canvas.width = w;
    canvas.height = h;
    sizeRef.current = { w, h: h };
    void dpr;
    accumRef.current = new Float32Array(w * h * 3);
    sampleBaseRef.current = 0;
    setTotalSamples(0);
    setSamples(0);
    setElapsed(0);
    setFinalPng(null);
    raysRef.current = 0;
    lastTimeRef.current = performance.now();
    runningRef.current = true;
    setRunning(true);

    const sppPerPass = Math.max(1, Math.round(quality));
    const t0 = performance.now();
    const workers = workersRef.current;
    const rowsPerBatch = 24;

    let done = 0;
    const perWorker = Math.ceil(h / workers.length / rowsPerBatch);

    const launch = () =>
      new Promise<void>((resolve) => {
        let finished = 0;
        pendingRef.current = workers.length * perWorker;
        for (let wi = 0; wi < workers.length; wi++) {
          const worker = workers[wi];
          let batch = 0;
          const feed = () => {
            if (!runningRef.current) { resolve(); return; }
            if (batch >= perWorker) { resolve(); return; }
            const rowStart = Math.min(h, (wi * perWorker + batch) * rowsPerBatch);
            const rowEnd = Math.min(h, rowStart + rowsPerBatch);
            batch++;
            const startSample = sampleBaseRef.current;
            worker.postMessage({
              width: w, height: h, rowStart, rowEnd,
              sampleOffset: startSample,
              samplesPerPixel: sppPerPass,
              maxBounces: bounces,
              camera: buildCamera(),
              scene,
              seed: (startSample + 1) * 7919 + wi * 104729,
            });
          };
          worker.onmessage = (ev: MessageEvent) => {
            const { rowStart, rows, width, data } = ev.data as { rowStart: number; rows: number; width: number; data: Float32Array };
            const accum = accumRef.current;
            if (!accum) return;
            const off = rowStart * width * 3;
            for (let i = 0; i < data.length; i++) accum[off + i] += data[i];
            raysRef.current += width * rows * sppPerPass;
            done++;
            // repaint progressively every ~6% of the image
            if (done % Math.max(1, Math.floor(perWorker * workers.length / 12)) === 0) {
              setSamples(sampleBaseRef.current + sppPerPass);
              paintAccum();
              setElapsed((performance.now() - t0) / 1000);
              const dt = (performance.now() - lastTimeRef.current) / 1000;
              if (dt > 0.25) {
                setRaysPerSec(raysRef.current / ((performance.now() - t0) / 1000));
                lastTimeRef.current = performance.now();
              }
            }
            finished++;
            if (finished >= perWorker * workers.length) {
              resolve();
            } else {
              feed();
            }
          };
          feed();
        }
      });

    // iterative accumulation: refine forever until stopped, converging to ground truth
    let pass = 0;
    while (runningRef.current) {
      await launch();
      pass++;
      sampleBaseRef.current += sppPerPass;
      setTotalSamples(sampleBaseRef.current);
      setSamples(sampleBaseRef.current);
      paintAccum();
      setElapsed((performance.now() - t0) / 1000);
      setRaysPerSec(raysRef.current / Math.max(0.4, (performance.now() - t0) / 1000));
      if (pass >= 40) break;
      await new Promise((r) => setTimeout(r, 0));
    }
    runningRef.current = false;
    setRunning(false);
    paintAccum();
    // snapshot for download
    try {
      const c = canvasRef.current!;
      setFinalPng(c.toDataURL('image/png'));
    } catch {}
  }, [sceneId, renderScale, quality, bounces, buildCamera, paintAccum]);

  useEffect(() => {
    // repaint when exposure changes
    paintAccum();
  }, [exposure, paintAccum]);

  useEffect(() => {
    if (!running) {
      // auto-render a draft when settings change
      const t = setTimeout(() => { if (!runningRef.current) start(); }, 220);
      return () => clearTimeout(t);
    }
  }, [sceneId, camId, quality, bounces, renderScale, start, running]);

  const progress = Math.min(1, totalSamples / 120);

  return (
    <WonderShell w={W}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 16 }} className="ray-layout">
        <div className="stack" style={{ gap: 12 }}>
          <div className="panel" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
            <canvas
              ref={canvasRef}
              style={{ width: '100%', aspectRatio: '16/10', display: 'block', background: '#0a0a10', imageRendering: 'auto' }}
            />
            <div style={{ position: 'absolute', top: 12, left: 12 }} className="row">
              <span className={`chip ${running ? 'chip-live' : ''}`}>
                {running ? <><span className="dot" /> TRACING</> : 'CONVERGED'}
              </span>
              <span className="chip">{totalSamples} spp</span>
              <span className="chip">{nCores} cores</span>
            </div>
            {running && (
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'rgba(255,255,255,0.1)' }}>
                <div style={{ height: '100%', width: `${progress * 100}%`, background: 'var(--accent)', transition: 'width 0.4s' }} />
              </div>
            )}
          </div>

          <div className="row">
            <button className="btn btn-primary" onClick={start} disabled={running}>◉ Render</button>
            <button className="btn" onClick={stop} disabled={!running}>■ Stop</button>
            <button className="btn btn-ghost" onClick={() => setDenoiseOn((d) => !d)}>
              {denoiseOn ? '◐ Denoise on' : '◑ Denoise off'}
            </button>
            <button
              className="btn btn-ghost"
              disabled={!finalPng}
              onClick={() => {
                if (!finalPng) return;
                const a = document.createElement('a');
                a.href = finalPng;
                a.download = `photon-${sceneId}-${totalSamples}spp.png`;
                a.click();
              }}
            >↓ PNG</button>
            <div className="row" style={{ gap: 8, marginLeft: 'auto' }}>
              {PRESETS.map((p) => (
                <button key={p.id} className="btn btn-sm btn-ghost"
                  onClick={() => { setRenderScale(p.res); setQuality(p.spp); setBounces(p.bounces); }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="row" style={{ gap: 8 }}>
            <Stat label="Render time" value={`${elapsed.toFixed(1)}s`} />
            <Stat label="Samples / px" value={totalSamples} />
            <Stat label="Bounces" value={bounces} />
            <Stat label="Rays traced" value={raysPerSec > 0 ? `${(raysPerSec / 1e6).toFixed(1)}M/s` : '—'} sub={`${(raysRef.current / 1e6).toFixed(0)}M total`} />
            <Stat label="Resolution" value={`${sizeRef.current.w}×${sizeRef.current.h}`} />
          </div>
        </div>

        <div className="stack" style={{ gap: 14 }}>
          <div className="panel panel-pad stack" style={{ gap: 14 }}>
            <div className="section-title" style={{ margin: 0 }}>Scene</div>
            <div className="stack" style={{ gap: 6 }}>
              {SCENES.map((s) => (
                <button key={s.id} className="btn btn-sm" onClick={() => setSceneId(s.id)}
                  style={{
                    justifyContent: 'flex-start', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
                    background: sceneId === s.id ? 'rgba(255,181,69,0.14)' : 'transparent',
                    borderColor: sceneId === s.id ? 'rgba(255,181,69,0.5)' : 'var(--line)',
                    textAlign: 'left', padding: '9px 12px',
                  }}>
                  <span style={{ fontWeight: 500 }}>{s.name}</span>
                  <span style={{ fontSize: 10.5, color: 'var(--txt-3)' }}>{s.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="panel panel-pad stack" style={{ gap: 13 }}>
            <div className="section-title" style={{ margin: 0 }}>Camera</div>
            <div className="row" style={{ gap: 4 }}>
              {CAMERAS.map((c) => (
                <button key={c.id} className="btn btn-sm btn-ghost" style={{ flex: 1, padding: '6px 4px', fontSize: 11 }}
                  onClick={() => setCamId(c.id)}
                  {...(camId === c.id ? { style: { flex: 1, padding: '6px 4px', fontSize: 11, background: 'var(--panel-2)', borderColor: 'var(--line-2)' } } : {})}
                >{c.name}</button>
              ))}
            </div>
            <Slider label="Aperture (DoF)" value={aperture} min={0} max={0.5} onChange={setAperture} fmt={(v) => v.toFixed(2)} />
            <Slider label="Focus distance" value={focus} min={1} max={16} onChange={setFocus} fmt={(v) => v.toFixed(1)} />
            <Slider label="Exposure" value={exposure} min={0.2} max={3} onChange={setExposure} fmt={(v) => v.toFixed(2)} />
            <Slider label="Max bounces" value={bounces} min={1} max={16} step={1} onChange={(v) => setBounces(Math.round(v))} />
            <Slider label="Samples / pass" value={quality} min={1} max={8} step={1} onChange={(v) => setQuality(Math.round(v))} />
            <Slider label="Resolution" value={renderScale} min={0.25} max={1} onChange={setRenderScale} fmt={(v) => (v * 100).toFixed(0)} suffix="%" />
          </div>

          <div className="panel panel-pad">
            <div className="note">
              Every pixel fires rays that bounce off surfaces, refract through glass with Fresnel weighting, and
              terminate by Russian roulette. Light is gathered by sampling the emissive sphere directly — the same
              maths Pixar uses, running on {nCores} of your CPU cores.
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 980px) { .ray-layout { grid-template-columns: 1fr !important; } }
      `}</style>
    </WonderShell>
  );
}
