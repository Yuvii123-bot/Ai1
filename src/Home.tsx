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
      <div>
        <div className="wc-foot">
          {w.stack.slice(0, 3).map((s) => (
            <span key={s} className="chip" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 9.5 }}>{s}</span>
          ))}
        </div>
        <div style={{
          marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.07)',
          fontSize: 10.5, lineHeight: 1.5, color: 'var(--txt-3)',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          <span style={{ color: w.accent, fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.08em' }}>REVENUE </span>
          {w.potential.split(' — ')[0]}
        </div>
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

      <div className="spread" style={{ margin: '8px 0 16px', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="eyebrow">The collection</div>
          <h2 style={{ fontSize: 22, margin: '6px 0 0', letterSpacing: '-0.02em' }}>
            Ten working products. Ten addressable markets.
          </h2>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--txt-3)', maxWidth: 340, lineHeight: 1.55 }}>
          Every card below runs entirely on your machine. Click one — it is not a mockup, it is the product.
        </div>
      </div>

      <div className="grid-home">
        {WONDERS.map((w, i) => (
          <Card key={w.slug} w={w} i={i} />
        ))}
      </div>

      <div className="panel panel-pad" style={{ marginTop: 26 }}>
        <div className="spread" style={{ flexWrap: 'wrap', gap: 16 }}>
          <div style={{ maxWidth: 520 }}>
            <div className="eyebrow">Why this matters</div>
            <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--txt-2)', marginTop: 8 }}>
              Each of these normally implies a GPU bill, a vendor contract, or an upload of your private data.
              Here they are deterministic code that runs on hardware you already own. That is the whole business
              model: <span style={{ color: 'var(--txt)' }}>zero marginal cost per user</span>.
            </div>
          </div>
          <div className="row" style={{ gap: 18 }}>
            <div><div className="stat-n">0</div><div className="stat-l">Servers</div></div>
            <div><div className="stat-n">0</div><div className="stat-l">Uploads</div></div>
            <div><div className="stat-n">∞</div><div className="stat-l">Generations</div></div>
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: '34px 0 20px', fontSize: 11, color: 'var(--txt-3)', fontFamily: 'var(--mono)', letterSpacing: '0.08em' }}>
        BUILT FROM FIRST PRINCIPLES · NO SDKs · NO API KEYS · NO MODEL FILES
      </div>
    </div>
  );
}
