import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { WonderMeta } from '../wonders/meta';

export function WonderShell({ w, children }: { w: WonderMeta; children: React.ReactNode }) {
  return (
    <div className="fade-in">
      <div className="wrap wp-head">
        <Link to="/" className="back-link">← ALL WONDERS</Link>
        <div className="row" style={{ gap: 12 }}>
          <span className="chip chip-live"><span className="dot" /> LIVE IN YOUR BROWSER</span>
          <span className="chip">{w.tag}</span>
        </div>
        <h1 className="wp-title">{w.title}</h1>
        <p className="wp-desc">{w.blurb}</p>
        <div className="wp-meta">
          {w.stack.map((s) => (
            <span key={s} className="chip" style={{ textTransform: 'none', letterSpacing: 0 }}>
              {s}
            </span>
          ))}
        </div>
      </div>
      <div className="wrap" style={{ paddingBottom: 80 }}>{children}</div>
    </div>
  );
}

export function Slider({
  label, value, min, max, step = 0.01, onChange, suffix = '', fmt,
}: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; suffix?: string; fmt?: (v: number) => string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div className="spread">
        <label>{label}</label>
        <span className="mono" style={{ fontSize: 11.5, color: 'var(--txt)' }}>
          {fmt ? fmt(value) : value}{suffix}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="panel" style={{ padding: '14px 16px', flex: 1, minWidth: 110 }}>
      <div className="eyebrow" style={{ fontSize: 9.5 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 600, marginTop: 5, letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: 'var(--txt-3)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="spread" style={{ cursor: 'pointer' }} onClick={() => onChange(!on)}>
      <label style={{ cursor: 'pointer' }}>{label}</label>
      <div
        style={{
          width: 36, height: 20, borderRadius: 99, position: 'relative',
          background: on ? 'var(--accent)' : 'rgba(255,255,255,0.14)',
          transition: '0.18s',
        }}
      >
        <div
          style={{
            position: 'absolute', top: 2, left: on ? 18 : 2, width: 16, height: 16,
            borderRadius: '50%', background: on ? '#0a0f00' : '#fff',
            transition: '0.18s cubic-bezier(.2,.7,.3,1)',
          }}
        />
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  options, value, onChange,
}: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div
      style={{
        display: 'flex', gap: 3, padding: 3, borderRadius: 11,
        background: 'rgba(0,0,0,0.35)', border: '1px solid var(--line)',
      }}
    >
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className="btn btn-sm"
          style={{
            flex: 1,
            background: value === o.id ? 'var(--panel-2)' : 'transparent',
            border: '1px solid',
            borderColor: value === o.id ? 'var(--line-2)' : 'transparent',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Animated number that eases to target. */
export function useAnimatedNumber(target: number, speed = 0.15) {
  const [val, setVal] = useState(target);
  const ref = useRef(target);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const d = target - ref.current;
      if (Math.abs(d) < 0.01) { ref.current = target; setVal(target); return; }
      ref.current += d * speed;
      setVal(ref.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, speed]);
  return val;
}

export function useRafLoop(cb: (dt: number, t: number) => void, active = true) {
  const cbRef = useRef(cb);
  cbRef.current = cb;
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    const start = last;
    const loop = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      cbRef.current(dt / 1000, (now - start) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}

export function useCanvas(draw: (ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number) => void, deps: any[] = []) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      sizeRef.current = { w: Math.max(1, r.width), h: Math.max(1, r.height), dpr };
      canvas.width = Math.floor(r.width * dpr);
      canvas.height = Math.floor(r.height * dpr);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawRef.current(ctx, r.width, Math.max(1, r.height), dpr);
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);
  const paint = useCallback(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, dpr } = sizeRef.current;
    drawRef.current(ctx, w, h, dpr);
  }, []);
  useEffect(() => { paint(); }, deps);
  return { ref, paint };
}

export function Meters({ items }: { items: { label: string; v: number; color?: string }[] }) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      {items.map((it) => (
        <div key={it.label}>
          <div className="spread" style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 11.5, color: 'var(--txt-2)' }}>{it.label}</span>
            <span className="mono" style={{ fontSize: 10.5, color: 'var(--txt-3)' }}>{(it.v * 100).toFixed(0)}%</span>
          </div>
          <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, it.v * 100)}%`, background: it.color || 'var(--accent)', borderRadius: 99, transition: 'width 0.3s' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="center" style={{ padding: '46px 20px', flexDirection: 'column', gap: 10, opacity: 0.6 }}>
      <div style={{ fontSize: 30 }}>{icon}</div>
      <div style={{ fontSize: 13, color: 'var(--txt-2)', textAlign: 'center', maxWidth: 320 }}>{text}</div>
    </div>
  );
}
