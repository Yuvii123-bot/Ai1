import { useNavigate } from 'react-router-dom';
import { useRef } from 'react';
import { WONDERS } from './registry';

function Card({ w, i }: { w: (typeof WONDERS)[number]; i: number }) {
  const nav = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className="wonder-card"
      onClick={() => nav(`/${w.slug}`)}
      onMouseMove={(e) => {
        const r = ref.current!.getBoundingClientRect();
        ref.current!.style.setProperty('--mx', `${e.clientX - r.left}px`);
        ref.current!.style.setProperty('--my', `${e.clientY - r.top}px`);
      }}
    >
      <div className="wc-glow" style={{ background: w.accent }} />
      <div className="wc-top">
        <div className="wc-glyph" style={{ color: w.accent, borderColor: `${w.accent}44` }}>{w.glyph}</div>
        <div className="wc-num">{String(i + 1).padStart(2, '0')} / 10</div>
      </div>
      <div>
        <h3 className="wc-title">{w.title.split('—')[0].trim()}</h3>
        <p className="wc-tag" style={{ marginTop: 8 }}>{w.blurb.split('. ').slice(0, 2).join('. ')}</p>
      </div>
      <div className="wc-foot">
        {w.stack.slice(0, 3).map((s) => (
          <span key={s} className="chip" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 9.5 }}>{s}</span>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="wrap">
      <div className="hero">
        <div className="row" style={{ marginBottom: 22 }}>
          <span className="chip chip-live"><span className="dot" /> TEN WORKING PRODUCTS · NO API KEYS</span>
          <span className="chip">RUNS 100% IN YOUR TAB</span>
        </div>
        <h1 className="grad-text">
          Ten things that<br />shouldn't run<br />in a browser.<br />
          <span className="serif" style={{ fontStyle: 'italic', opacity: 0.85 }}>But do.</span>
        </h1>
        <p className="hero-sub">
          A neural singing voice. A real path tracer. Navier–Stokes in real time. A chess engine that explains itself.
          A world model that learns in front of you. Built from scratch, end to end —{' '}
          <span style={{ color: 'var(--txt)' }}>no cloud, no keys, no samples shipped.</span> Just mathematics, made useful.
        </p>
        <div className="hero-stats">
          <div><div className="stat-n">10</div><div className="stat-l">Products shipped</div></div>
          <div><div className="stat-n">0</div><div className="stat-l">API keys needed</div></div>
          <div><div className="stat-n">0</div><div className="stat-l">Models downloaded</div></div>
          <div><div className="stat-n">100%</div><div className="stat-l">Your hardware</div></div>
        </div>
      </div>

      <div className="grid-home">
        {WONDERS.map((w, i) => (
          <Card key={w.slug} w={w} i={i} />
        ))}
      </div>
    </div>
  );
}
