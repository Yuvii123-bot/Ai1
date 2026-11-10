import { useCallback, useEffect, useRef, useState } from 'react';
import { WonderShell, Slider, Stat, Segmented, Toggle } from '../../lib/ui';
import { WONDER_META } from '../meta';
import { FluidSolver, paletteColor } from './solver';

const W = WONDER_META.find((w) => w.slug === 'fluid')!;

type Mode = 'paint' | 'wind' | 'smoke';
type Viz = 'dye' | 'speed' | 'vorticity' | 'pressure';

const GRID_W = 220;

export default function FluidPage() {
  const solverRef = useRef<FluidSolver | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>('paint');
  const [viz, setViz] = useState<Viz>('dye');
  const [vorticity, setVorticity] = useState(18);
  const [viscosity, setViscosity] = useState(0.15);
  const [pressureIters, setPressureIters] = useState(18);
  const [windSpeed, setWindSpeed] = useState(0.9);
  const [obstacle, setObstacle] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showArrows, setShowArrows] = useState(false);
  const [fps, setFps] = useState(0);
  const [energy, setEnergy] = useState(0);
  const [grid, setGrid] = useState({ w: 0, h: 0 });
  const [palette, setPalette] = useState(0);

  const mouseRef = useRef({
    x: 0, y: 0, px: 0, py: 0, down: false, hue: 0, lastMove: 0,
  });
  const stateRef = useRef({
    mode, viz, vorticity, viscosity, pressureIters, windSpeed, paused, showArrows, obstacle, palette,
  });
  stateRef.current = { mode, viz, vorticity, viscosity, pressureIters, windSpeed, paused, showArrows, obstacle, palette };

  const initSolver = useCallback((cw: number, ch: number) => {
    const gh = Math.max(40, Math.round((GRID_W * ch) / cw));
    const s = new FluidSolver(GRID_W, gh);
    if (stateRef.current.obstacle) s.setObstacleCircle(GRID_W * 0.32, gh * 0.5, gh * 0.17);
    solverRef.current = s;
    setGrid({ w: GRID_W, h: gh });
  }, []);

  /* ---------- main loop ---------- */
  const lastRef = useRef(performance.now());
  const fpsRef = useRef({ frames: 0, t: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    let offscreen = document.createElement('canvas');
    let offCtx = offscreen.getContext('2d')!;
    let imgData: ImageData | null = null;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(r.width * dpr);
      canvas.height = Math.floor(r.height * dpr);
      if (!solverRef.current) initSolver(r.width, r.height);
      const s = solverRef.current!;
      offscreen.width = s.w;
      offscreen.height = s.h;
      imgData = offCtx.createImageData(s.w, s.h);
    };
    resize();
    const ro = new ResizeObserver(() => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(r.width * dpr);
      canvas.height = Math.floor(r.height * dpr);
    });
    ro.observe(canvas);

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dtReal = Math.min(0.05, (now - lastRef.current) / 1000);
      lastRef.current = now;
      const s = solverRef.current;
      const ctx = canvas.getContext('2d');
      if (!s || !ctx || !imgData) return;
      const st = stateRef.current;

      // fps
      fpsRef.current.frames++;
      fpsRef.current.t += dtReal;
      if (fpsRef.current.t > 0.5) {
        setFps(Math.round(fpsRef.current.frames / fpsRef.current.t));
        setEnergy(s.energy());
        fpsRef.current = { frames: 0, t: 0 };
      }

      const m = mouseRef.current;

      if (!st.paused) {
        // continuous wind / smoke source
        if (st.mode === 'wind') {
          const y = s.h * (0.5 + 0.25 * Math.sin(now / 1400) + 0.12 * Math.sin(now / 430));
          s.splat(4, y, 5, st.windSpeed * 2.2, 0.08 * Math.sin(now / 300), [0.15, 0.55, 1.0]);
        }
        if (st.mode === 'smoke') {
          const y = s.h * 0.84;
          const x = s.w * (0.5 + 0.03 * Math.sin(now / 900));
          s.splat(x, y, 4.5, 0.12 * Math.sin(now / 500), -2.4, [0.9, 0.55, 0.25], 0.5);
        }
        // user painting
        if (m.down) {
          const dx = (m.x - m.px) * 12;
          const dy = (m.y - m.py) * 12;
          const col = paletteColor((st.palette + m.hue * 0.35 + now / 26000) % 1);
          s.splat(m.x, m.y, 4.2, dx, dy, col.map((c) => c * 1.4) as [number, number, number], 0.25);
          m.px = m.x; m.py = m.y;
        }

        const dtFixed = 1 / 60;
        s.step(dtFixed, {
          pressureIters: st.pressureIters,
          vorticity: st.vorticity * 0.1,
          dyeDiffusion: st.viscosity,
          buoyancy: st.mode === 'smoke' ? 22 : 0,
          cooling: st.mode === 'smoke' ? 0.6 : 0,
        });
      }

      /* ---------- paint ---------- */
      const d = imgData!.data;
      const sw = s.w, sh = s.h;
      for (let i = 0; i < sw * sh; i++) {
        let r = 0, g = 0, b = 0;
        if (st.viz === 'dye') {
          r = s.dye[i * 3]; g = s.dye[i * 3 + 1]; b = s.dye[i * 3 + 2];
        } else if (st.viz === 'speed') {
          const sp = Math.hypot(s.u[i], s.v[i]);
          const t = Math.min(1, sp * 0.09);
          r = t * 1.1; g = t * 0.5 + t * t * 0.4; b = 0.06 + t * 0.9;
        } else if (st.viz === 'vorticity') {
          const c = s.curl[i] || 0;
          const t = Math.max(-1, Math.min(1, c * 0.6));
          r = t > 0 ? t : 0;
          b = t < 0 ? -t : 0;
          g = Math.abs(t) * 0.25;
        } else {
          const p = s.pressure[i];
          const t = Math.max(-1, Math.min(1, p * 3));
          r = t > 0 ? t : 0; b = t < 0 ? -t : 0; g = Math.abs(t) * 0.4;
        }
        if (s.solid[i]) { r = 0.16; g = 0.17; b = 0.22; }
        // tone map: log-ish rolloff so dense dye doesn't clip to white
        const k = 0.62;
        d[i * 4] = 255 * (1 - Math.exp(-r * k));
        d[i * 4 + 1] = 255 * (1 - Math.exp(-g * k));
        d[i * 4 + 2] = 255 * (1 - Math.exp(-b * k));
        d[i * 4 + 3] = 255;
      }
      offCtx.putImageData(imgData!, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);

      if (st.showArrows) {
        const dpr = canvas.width / canvas.getBoundingClientRect().width;
        ctx.save();
        ctx.scale(dpr, dpr);
        const rw = canvas.getBoundingClientRect().width;
        const rh = canvas.getBoundingClientRect().height;
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 0.8;
        const stepX = Math.max(6, Math.floor(sw / 34));
        for (let y = stepX; y < sh; y += stepX) {
          for (let x = stepX; x < sw; x += stepX) {
            const i = y * sw + x;
            const u = s.u[i], v = s.v[i];
            const mag = Math.hypot(u, v);
            if (mag < 0.05) continue;
            const px = (x / sw) * rw, py = (y / sh) * rh;
            const len = Math.min(stepX, 2 + mag * 1.6) * (rw / sw) * 1.4;
            const a = Math.atan2(v, u);
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len);
            ctx.stroke();
          }
        }
        ctx.restore();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [initSolver]);

  useEffect(() => {
    const s = solverRef.current;
    if (!s) return;
    if (obstacle) s.setObstacleCircle(s.w * 0.32, s.h * 0.5, s.h * 0.17);
    else s.solid.fill(0);
  }, [obstacle]);

  const toGrid = (e: React.PointerEvent) => {
    const s = solverRef.current;
    const canvas = canvasRef.current;
    if (!s || !canvas) return { x: 0, y: 0 };
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * s.w, y: ((e.clientY - r.top) / r.height) * s.h };
  };

  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const p = toGrid(e);
    const m = mouseRef.current;
    m.down = true; m.x = p.x; m.y = p.y; m.px = p.x; m.py = p.y; m.hue = Math.random();
  };
  const onMove = (e: React.PointerEvent) => {
    const p = toGrid(e);
    const m = mouseRef.current;
    m.x = p.x; m.y = p.y;
  };
  const onUp = () => { mouseRef.current.down = false; };

  const surprise = () => {
    const s = solverRef.current;
    if (!s) return;
    for (let i = 0; i < 14; i++) {
      const col = paletteColor(Math.random());
      s.splat(
        Math.random() * s.w, Math.random() * s.h,
        6 + Math.random() * 14,
        (Math.random() - 0.5) * 22, (Math.random() - 0.5) * 22,
        col.map((c) => c * 1.6) as [number, number, number], 0.4
      );
    }
  };

  return (
    <WonderShell w={W}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 296px', gap: 16 }} className="fluid-layout">
        <div className="stack" style={{ gap: 12 }}>
          <div className="panel" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
            <canvas
              ref={canvasRef}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerLeave={onUp}
              style={{ width: '100%', aspectRatio: '16/9', display: 'block', cursor: 'crosshair', background: '#06060a' }}
            />
            <div style={{ position: 'absolute', top: 12, left: 12 }} className="row">
              <span className={`chip ${paused ? '' : 'chip-live'}`}>
                {paused ? 'PAUSED' : <><span className="dot" /> SOLVING</>}
              </span>
              <span className="chip">{fps} fps</span>
              <span className="chip">{grid.w}×{grid.h}</span>
            </div>
            <div style={{ position: 'absolute', bottom: 12, left: 12, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
              drag to inject dye &amp; momentum
            </div>
          </div>

          <div className="row">
            <Segmented
              value={mode}
              options={[
                { id: 'paint', label: 'Paint' },
                { id: 'wind', label: 'Wind' },
                { id: 'smoke', label: 'Smoke' },
              ]}
              onChange={(v) => setMode(v as Mode)}
            />
            <Segmented
              value={viz}
              options={[
                { id: 'dye', label: 'Dye' },
                { id: 'speed', label: 'Speed' },
                { id: 'vorticity', label: 'Vorticity' },
                { id: 'pressure', label: 'Pressure' },
              ]}
              onChange={(v) => setViz(v as Viz)}
            />
            <button className="btn btn-sm" onClick={surprise}>✦ Burst</button>
            <button className="btn btn-sm btn-ghost" onClick={() => solverRef.current?.clear()}>Clear</button>
            <button className="btn btn-sm btn-ghost" onClick={() => setPaused((p) => !p)}>{paused ? '▶' : '❚❚'}</button>
          </div>

          <div className="row" style={{ gap: 8 }}>
            <Stat label="Kinetic energy" value={energy.toFixed(1)} />
            <Stat label="Grid cells" value={(grid.w * grid.h).toLocaleString()} />
            <Stat label="Jacobi iters" value={pressureIters} sub="pressure solve" />
            <Stat label="Vorticity ε" value={(vorticity * 0.1).toFixed(1)} />
            <div className="panel" style={{ padding: '14px 16px', flex: 1.4, minWidth: 150 }}>
              <div className="eyebrow" style={{ fontSize: 9.5 }}>Live physics</div>
              <div style={{ fontSize: 11, color: 'var(--txt-2)', marginTop: 6, lineHeight: 1.5 }}>
                advection → forces → vorticity → pressure → projection, 60×/sec
              </div>
            </div>
          </div>
        </div>

        <div className="stack" style={{ gap: 14 }}>
          <div className="panel panel-pad stack" style={{ gap: 14 }}>
            <div className="section-title" style={{ margin: 0 }}>Solver</div>
            <Slider label="Vorticity confinement" value={vorticity} min={0} max={60} step={1} onChange={(v) => setVorticity(Math.round(v))} />
            <Slider label="Dye diffusion" value={viscosity} min={0} max={1} onChange={setViscosity} fmt={(v) => v.toFixed(2)} />
            <Slider label="Pressure iterations" value={pressureIters} min={4} max={48} step={1} onChange={(v) => setPressureIters(Math.round(v))} />
            <Slider label="Wind force" value={windSpeed} min={0.1} max={3} onChange={setWindSpeed} fmt={(v) => v.toFixed(1)} />
            <div style={{ height: 1, background: 'var(--line)' }} />
            <Toggle label="Obstacle (cylinder)" on={obstacle} onChange={setObstacle} />
            <Toggle label="Velocity field" on={showArrows} onChange={setShowArrows} />
            <Toggle label="Paused" on={paused} onChange={setPaused} />
            <div style={{ height: 1, background: 'var(--line)' }} />
            <Slider label="Dye palette shift" value={palette} min={0} max={1} onChange={setPalette} fmt={(v) => (v * 100).toFixed(0)} suffix="%" />
          </div>

          <div className="panel panel-pad">
            <div className="section-title">Presets</div>
            <div className="stack" style={{ gap: 7 }}>
              {[
                { n: '🜁 Von Kármán street', f: () => { setObstacle(true); setMode('wind'); setVorticity(30); setWindSpeed(1.6); setViz('vorticity'); } },
                { n: '🌪 Turbulent plume', f: () => { setObstacle(false); setMode('smoke'); setVorticity(24); setViz('dye'); } },
                { n: '🌀 Kaleidoscope', f: () => { setObstacle(false); setMode('paint'); setVorticity(8); setViz('dye'); setViscosity(0.4); surprise(); } },
                { n: '🔬 Pressure field', f: () => { setViz('pressure'); setMode('paint'); setObstacle(true); } },
              ].map((p) => (
                <button key={p.n} className="btn btn-sm btn-ghost" style={{ justifyContent: 'flex-start' }} onClick={p.f}>{p.n}</button>
              ))}
            </div>
          </div>

          <div className="panel panel-pad">
            <div className="note">
              This is a real incompressible fluid solver: each frame it advects velocity through itself, re-injects
              vorticity that numerical diffusion destroys, then solves a Poisson equation by Jacobi iteration so the
              field is divergence-free. Change the pressure iterations and watch the physics degrade in real time.
            </div>
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 980px) { .fluid-layout { grid-template-columns: 1fr !important; } }`}</style>
    </WonderShell>
  );
}
