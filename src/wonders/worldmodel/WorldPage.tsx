import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WonderShell, Slider, Stat, Segmented } from '../../lib/ui';
import { wonderBySlug } from '../../registry';
import {
  makeModel, Model, encode, predict, decode, trainStep, mulberry32, makeWorld, stepWorld,
  renderWorld, WorldState, Sample, evaluate, ModelConfig,
} from './model';

const W = wonderBySlug('world')!;
const FS = 22;
const ACTION = new Float32Array([0.14, 0.14, 0.14, 0.14]);

type Frame = { px: Float32Array };

function frameToCanvas(px: Float32Array, size: number, ctx: CanvasRenderingContext2D, x0: number, y0: number, scale: number) {
  const n = size * size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const r = Math.max(0, Math.min(1, px[i]));
      const g = Math.max(0, Math.min(1, px[n + i]));
      const b = Math.max(0, Math.min(1, px[2 * n + i]));
      ctx.fillStyle = `rgb(${(r * 255) | 0},${(g * 255) | 0},${(b * 255) | 0})`;
      ctx.fillRect(x0 + x * scale, y0 + y * scale, scale, scale);
    }
  }
}

export default function WorldPage() {
  const [model, setModel] = useState<Model>(() => makeModel({ frameSize: FS, latent: 24, actionDim: 4 }, 7));
  const [training, setTraining] = useState(false);
  const [iter, setIter] = useState(0);
  const [loss, setLoss] = useState<number | null>(null);
  const [recLoss, setRecLoss] = useState<number | null>(null);
  const [acc, setAcc] = useState<number | null>(null);
  const [speed, setSpeed] = useState(8);
  const [latentDim, setLatentDim] = useState(24);
  const [seq, setSeq] = useState(0);
  const [dreamLen, setDreamLen] = useState(10);
  const [tab, setTab] = useState<'real' | 'dream' | 'latent'>('real');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lossCanvasRef = useRef<HTMLCanvasElement>(null);
  const lossHistory = useRef<{ loss: number; rec: number }[]>([]);
  const datasetRef = useRef<Sample[]>([]);
  const testRef = useRef<Sample[]>([]);
  const worldRef = useRef<WorldState | null>(null);
  const liveFramesRef = useRef<Float32Array[]>([]);
  const randRef = useRef(mulberry32(99));
  const dreamRef = useRef<Float32Array[]>([]);
  const modelRef = useRef(model);
  modelRef.current = model;

  /* ---- build the dataset once (episodes of real physics) ---- */
  useEffect(() => {
    const rand = mulberry32(1234);
    const eps: Float32Array[][] = [];
    for (let e = 0; e < 64; e++) {
      let w = makeWorld(3, rand);
      const frames: Float32Array[] = [];
      for (let t = 0; t < 14; t++) {
        frames.push(renderWorld(w, FS));
        stepWorld(w);
      }
      eps.push(frames);
    }
    const train: Sample[] = [];
    const test: Sample[] = [];
    for (let e = 0; e < 64; e++) {
      for (let t = 0; t < 13; t++) {
        const s = { frame: eps[e][t], next: eps[e][t + 1], action: ACTION };
        (e < 52 ? train : test).push(s);
      }
    }
    datasetRef.current = train;
    testRef.current = test.slice(0, 40);
    worldRef.current = makeWorld(3, mulberry32(555));
  }, []);

  /* ---- training loop (one optimizer step per rAF) ---- */
  const trainOnce = useCallback(() => {
    const m = modelRef.current;
    const ds = datasetRef.current;
    if (!ds.length) return;
    const B = 8;
    const batch: Sample[] = [];
    const rand = randRef.current;
    for (let i = 0; i < B; i++) batch.push(ds[Math.floor(rand() * ds.length)]);
    const r = trainStep(m, batch, { lr: 0.0035, temperature: 0.15 });
    setLoss(r.loss);
    setRecLoss(r.recLoss);
    setIter((i) => i + 1);
    lossHistory.current.push({ loss: r.loss, rec: r.recLoss });
    if (lossHistory.current.length > 400) lossHistory.current.shift();
  }, []);

  useEffect(() => {
    if (!training) return;
    let raf = 0;
    let budget = 0;
    const loop = () => {
      budget += speed;
      let n = 0;
      while (budget >= 1 && n < speed) { trainOnce(); budget -= 1; n++; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [training, speed, trainOnce]);

  useEffect(() => {
    if (iter > 0 && iter % 120 === 0) {
      setAcc(evaluate(modelRef.current, testRef.current));
    }
  }, [iter]);

  /* ---- which frames to show ---- */
  const frames = useMemo(() => {
    const ds = datasetRef.current;
    if (!ds.length) return [];
    const start = (seq * 7) % Math.max(1, ds.length - dreamLen - 2);
    return Array.from({ length: dreamLen + 1 }, (_, i) => ds[Math.min(ds.length - 1, start + i)].frame);
  }, [seq, dreamLen]);

  /* ---- run the world model forward in latent space ---- */
  const dream = useMemo(() => {
    if (!frames.length) return [];
    const m = modelRef.current;
    let z = encode(m, frames[0]).z;
    const out: { px: Float32Array; z: Float32Array }[] = [{ px: frames[0], z }];
    for (let i = 1; i <= dreamLen; i++) {
      z = predict(m, z, ACTION).z;
      const { px } = decode(m, z);
      out.push({ px, z });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frames, iter === 0 ? 0 : Math.floor(iter / 40), dreamLen]);

  /* ---- draw ---- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#08080e';
    ctx.fillRect(0, 0, rect.width, rect.height);

    const cols = 6;
    const rows = Math.ceil((dreamLen + 1) / cols);
    const pad = 6;
    const cell = Math.min((rect.width - pad * (cols + 1)) / cols, (rect.height - pad * (rows + 1)) / rows);
    const scale = cell / FS;

    for (let i = 0; i <= dreamLen; i++) {
      const cx = pad + (i % cols) * (cell + pad);
      const cy = pad + Math.floor(i / cols) * (cell + pad);
      // real frame
      const px = frames[i] ?? frames[frames.length - 1];
      const pred = dream[i]?.px ?? px;
      const show = tab === 'dream' ? pred : px;
      if (!show) continue;
      frameToCanvas(show, FS, ctx, cx, cy, scale);
      // frame border
      ctx.strokeStyle = tab === 'dream' ? 'rgba(255,92,174,0.5)' : 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx + 0.5, cy + 0.5, cell - 1, cell - 1);
      if (tab === 'dream') {
        // ghost of truth underneath, to show drift honestly
        ctx.globalAlpha = 0.28;
        frameToCanvas(px, FS, ctx, cx, cy, scale);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(cx + 2, cy + 2, 26, 12);
      ctx.fillStyle = tab === 'dream' ? '#ff5cae' : 'rgba(255,255,255,0.75)';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillText(`t+${i}`, cx + 5, cy + 11);
    }
    // caption
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText(
      tab === 'dream' ? 'predicted in latent space — faint ghost is the real frame' : 'ground-truth physics (never seen by the model)',
      pad, rect.height - 4
    );
  }, [frames, dream, tab, dreamLen]);

  /* ---- loss chart ---- */
  useEffect(() => {
    const c = lossCanvasRef.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = c.getBoundingClientRect();
    c.width = r.width * dpr;
    c.height = r.height * dpr;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, r.width, r.height);
    const h = lossHistory.current;
    if (h.length < 2) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText('press Train to start learning', 8, r.height / 2);
      return;
    }
    const maxLoss = 3.2;
    const draw = (key: 'loss' | 'rec', color: string, norm: number) => {
      ctx.beginPath();
      h.forEach((p, i) => {
        const x = (i / (h.length - 1)) * r.width;
        const y = r.height - Math.min(1, p[key] / norm) * (r.height - 6) - 3;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };
    draw('loss', '#ff5cae', maxLoss);
    draw('rec', '#22d3ee', 120);
    // baseline
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    const yb = r.height - (Math.log(8) / maxLoss) * (r.height - 6) - 3;
    ctx.moveTo(0, yb); ctx.lineTo(r.width, yb); ctx.stroke();
    ctx.setLineDash([]);
  }, [iter]);

  /* ---- live physics window ---- */
  const liveRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const c = liveRef.current;
      const w = worldRef.current;
      if (!c || !w) return;
      stepWorld(w, 0.6);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = 220 * dpr; c.height = 220 * dpr;
      const ctx = c.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, 220, 220);
      const px = renderWorld(w, FS);
      frameToCanvas(px, FS, ctx, 0, 0, 220 / FS);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const reset = () => {
    setModel(makeModel({ frameSize: FS, latent: latentDim, actionDim: 4 }, Math.floor(Math.random() * 10000)));
    lossHistory.current = [];
    setIter(0); setLoss(null); setRecLoss(null); setAcc(null); setTraining(false);
  };

  const randomBaseline = Math.log(8);

  return (
    <WonderShell w={W}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 16 }} className="wm-layout">
        <div className="stack" style={{ gap: 12 }}>
          <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: 340, display: 'block' }} />
            <div className="row" style={{ padding: '10px 12px', borderTop: '1px solid var(--line)' }}>
              <Segmented
                value={tab}
                options={[
                  { id: 'real', label: 'Reality' },
                  { id: 'dream', label: 'Dream' },
                ]}
                onChange={(v) => setTab(v as any)}
              />
              <button className="btn btn-sm btn-ghost" onClick={() => setSeq((w) => w + 1)}>↻ New sequence</button>
              <span style={{ fontSize: 11, color: 'var(--txt-3)', marginLeft: 'auto' }}>
                {tab === 'dream' ? 'the model imagines forward with no access to the world' : 'true simulated physics'}
              </span>
            </div>
          </div>

          <div className="row" style={{ gap: 8 }}>
            <Stat label="Iterations" value={iter.toLocaleString()} />
            <Stat label="Latent loss" value={loss !== null ? loss.toFixed(3) : '—'} sub={`random ${randomBaseline.toFixed(2)}`} />
            <Stat label="Reconstruction" value={recLoss !== null ? recLoss.toFixed(1) : '—'} />
            <Stat label="Retrieval acc" value={acc !== null ? `${(acc * 100).toFixed(0)}%` : '—'} sub="latent next-frame" />
            <Stat label="Params" value={(model.enc1.w.length + model.enc2.w.length + model.pred1.w.length + model.pred2.w.length + model.dec1.w.length + model.dec2.w.length).toLocaleString()} />
          </div>

          <div className="panel panel-pad">
            <div className="spread" style={{ marginBottom: 8 }}>
              <div className="section-title" style={{ margin: 0 }}>Learning curve</div>
              <div className="row" style={{ gap: 12, fontSize: 10.5, fontFamily: 'var(--mono)' }}>
                <span style={{ color: '#ff5cae' }}>— InfoNCE loss</span>
                <span style={{ color: '#22d3ee' }}>— pixel MSE</span>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>-- chance</span>
              </div>
            </div>
            <canvas ref={lossCanvasRef} style={{ width: '100%', height: 96, display: 'block' }} />
          </div>
        </div>

        <div className="stack" style={{ gap: 14 }}>
          <div className="panel panel-pad stack" style={{ gap: 12 }}>
            <button
              className={`btn ${training ? '' : 'btn-primary'}`}
              onClick={() => setTraining((t) => !t)}
              style={{ padding: '13px' }}
            >
              {training ? '❚❚ Pause training' : iter === 0 ? '▶ Train the world model' : '▶ Resume training'}
            </button>
            <Slider label="Steps per frame" value={speed} min={1} max={16} step={1} onChange={(v) => setSpeed(Math.round(v))} />
            <Slider label="Dream horizon" value={dreamLen} min={3} max={16} step={1} onChange={(v) => setDreamLen(Math.round(v))} suffix=" frames" />
            <Slider label="Latent size (requires reset)" value={latentDim} min={8} max={64} step={8} onChange={(v) => setLatentDim(Math.round(v))} />
            <button className="btn btn-sm btn-ghost" onClick={reset}>↺ Reset model</button>
          </div>

          <div className="panel panel-pad">
            <div className="section-title">Live world (unseen)</div>
            <canvas ref={liveRef} style={{ width: '100%', aspectRatio: '1', display: 'block', borderRadius: 10, border: '1px solid var(--line)' }} />
            <div style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 8 }}>
              Ground truth physics, running continuously. The model has never seen this trajectory.
            </div>
          </div>

          <div className="panel panel-pad">
            <div className="note">
              <strong style={{ color: 'var(--txt)' }}>What makes this a world model?</strong> The predictor never sees
              pixels — it is trained only to land in the right <em>place in latent space</em> (InfoNCE against the
              encoder's embedding of the real future). The decoder exists purely so you can look inside that thought.
              When the dream drifts from reality, you're seeing the model's beliefs diverge — exactly the failure mode
              researchers study in JEPA and Dreamer.
            </div>
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 980px) { .wm-layout { grid-template-columns: 1fr !important; } }`}</style>
    </WonderShell>
  );
}
