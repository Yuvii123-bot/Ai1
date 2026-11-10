import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WonderShell, Slider, Stat, Segmented } from '../../lib/ui';
import { WONDER_META } from '../meta';
import {
  generateDataset, scoreDataset, evaluateModel, moneySaved, buildGraph, findRings,
  Scored, Dataset, GraphNode, GraphEdge,
} from './engine';
import { download } from '../../lib/math';

const W = WONDER_META.find((w) => w.slug === 'fabric')!;

export default function FabricPage() {
  const [seed, setSeed] = useState(42);
  const [size, setSize] = useState(1400);
  const [threshold, setThreshold] = useState(0.62);
  const [selected, setSelected] = useState<Scored | null>(null);
  const [tab, setTab] = useState<'queue' | 'graph' | 'metrics'>('queue');
  const [filter, setFilter] = useState<'all' | 'block' | 'review' | 'low'>('review');
  const [sortBy, setSortBy] = useState<'score' | 'amount'>('score');
  const [hoverNode, setHoverNode] = useState<string | null>(null);

  const ds: Dataset = useMemo(() => generateDataset(seed, size, 0.055), [seed, size]);
  const { scored, sharedDeviceCounts } = useMemo(() => scoreDataset(ds), [ds]);
  const metrics = useMemo(() => evaluateModel(scored, threshold), [scored, threshold]);
  const money = useMemo(() => moneySaved(scored, threshold), [scored, threshold]);
  const graph = useMemo(() => buildGraph(ds.txns, sharedDeviceCounts), [ds, sharedDeviceCounts]);
  const rings = useMemo(() => findRings(graph), [graph]);

  const graphCanvas = useRef<HTMLCanvasElement>(null);
  const roiCanvas = useRef<HTMLCanvasElement>(null);

  /* -------- queue -------- */
  const queue = useMemo(() => {
    let q = scored.filter((s) => {
      if (filter === 'block') return s.score >= 0.86;
      if (filter === 'review') return s.score >= threshold;
      if (filter === 'low') return s.score < threshold;
      return true;
    });
    q = [...q].sort((a, b) => (sortBy === 'score' ? b.score - a.score : b.txn.amount - a.txn.amount));
    return q.slice(0, 90);
  }, [scored, filter, sortBy, threshold]);

  /* -------- graph drawing -------- */
  useEffect(() => {
    if (tab !== 'graph') return;
    const canvas = graphCanvas.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const W_ = rect.width, H_ = rect.height;
    // deterministic force layout
    const nodes = graph.nodes;
    const pos = new Map<string, { x: number; y: number; vx: number; vy: number }>();
    let s0 = 12345;
    const rnd = () => { s0 = (s0 * 1103515245 + 12345) & 0x7fffffff; return s0 / 0x7fffffff; };
    for (const n of nodes) {
      pos.set(n.id, { x: W_ / 2 + (rnd() - 0.5) * W_ * 0.7, y: H_ / 2 + (rnd() - 0.5) * H_ * 0.7, vx: 0, vy: 0 });
    }
    const adj = new Map<string, string[]>();
    for (const n of nodes) adj.set(n.id, []);
    for (const e of graph.edges) { adj.get(e.a)?.push(e.b); adj.get(e.b)?.push(e.a); }

    for (let iter = 0; iter < 260; iter++) {
      const alpha = 1 - iter / 260;
      // repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = pos.get(nodes[i].id)!, b = pos.get(nodes[j].id)!;
          let dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy + 0.01;
          if (d2 > 40000) continue;
          const f = 900 / d2;
          const d = Math.sqrt(d2);
          dx /= d; dy /= d;
          a.vx += dx * f * alpha; a.vy += dy * f * alpha;
          b.vx -= dx * f * alpha; b.vy -= dy * f * alpha;
        }
      }
      // springs
      for (const e of graph.edges) {
        const a = pos.get(e.a)!, b = pos.get(e.b)!;
        let dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) + 0.01;
        const f = (d - 62) * 0.012 * alpha;
        dx /= d; dy /= d;
        a.vx += dx * f * 60; a.vy += dy * f * 60;
        b.vx -= dx * f * 60; b.vy -= dy * f * 60;
      }
      for (const n of nodes) {
        const p = pos.get(n.id)!;
        p.vx += (W_ / 2 - p.x) * 0.0016;
        p.vy += (H_ / 2 - p.y) * 0.0016;
        p.x += Math.max(-14, Math.min(14, p.vx));
        p.y += Math.max(-14, Math.min(14, p.vy));
        p.vx *= 0.72; p.vy *= 0.72;
        p.x = Math.max(18, Math.min(W_ - 18, p.x));
        p.y = Math.max(18, Math.min(H_ - 18, p.y));
      }
    }

    // draw edges
    ctx.lineWidth = 0.7;
    for (const e of graph.edges) {
      const a = pos.get(e.a)!, b = pos.get(e.b)!;
      const hot = hoverNode && (e.a === hoverNode || e.b === hoverNode);
      ctx.strokeStyle = hot ? 'rgba(163,255,18,0.6)' : 'rgba(255,255,255,0.09)';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // draw nodes
    for (const n of nodes) {
      const p = pos.get(n.id)!;
      const isAccount = n.kind === 'account';
      const r = isAccount ? 3.5 + Math.min(6, n.degree * 0.8) : 3 + Math.min(4, n.degree * 0.5);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = isAccount ? 'rgba(139,108,255,0.95)' : n.kind === 'device' ? 'rgba(255,92,174,0.95)' : n.kind === 'ip' ? 'rgba(34,211,238,0.9)' : 'rgba(255,181,69,0.9)';
      ctx.fill();
      if (hoverNode === n.id) {
        ctx.strokeStyle = '#a3ff12';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillText(n.id, p.x + 8, p.y - 6);
      }
    }
    (canvas as any)._positions = pos;
  }, [graph, tab, hoverNode]);

  /* -------- ROC curve -------- */
  useEffect(() => {
    if (tab !== 'metrics') return;
    const c = roiCanvas.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = c.getBoundingClientRect();
    c.width = r.width * dpr;
    c.height = r.height * dpr;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, r.width, r.height);
    const pad = 26;
    const w = r.width - pad * 2, h = r.height - pad * 2;
    // grid
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(pad, pad + (h * i) / 4); ctx.lineTo(pad + w, pad + (h * i) / 4); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pad + (w * i) / 4, pad); ctx.lineTo(pad + (w * i) / 4, pad + h); ctx.stroke();
    }
    // ROC from thresholds
    const pts: { x: number; y: number; t: number }[] = [];
    const pos = scored.filter((s) => s.txn.isFraud);
    const neg = scored.filter((s) => !s.txn.isFraud);
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      const tp = pos.filter((s) => s.score >= t).length;
      const fp = neg.filter((s) => s.score >= t).length;
      pts.push({ x: fp / Math.max(1, neg.length), y: tp / Math.max(1, pos.length), t });
    }
    // diagonal
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pad, pad + h); ctx.lineTo(pad + w, pad); ctx.stroke();
    ctx.setLineDash([]);
    // curve
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = pad + p.x * w, y = pad + h - p.y * h;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#a3ff12';
    ctx.lineWidth = 2;
    ctx.stroke();
    // current operating point
    const op = pts[Math.round(threshold * 100)];
    ctx.beginPath();
    ctx.arc(pad + op.x * w, pad + h - op.y * h, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillText('false positive rate →', pad, r.height - 8);
    ctx.save();
    ctx.translate(11, pad + h);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('true positive rate →', 0, 0);
    ctx.restore();
  }, [tab, scored, threshold]);

  const exportJson = () => {
    const rows = scored.filter((s) => s.score >= threshold).map((s) => ({
      id: s.txn.id, account: s.txn.account, amount: s.txn.amount, score: +s.score.toFixed(4),
      band: s.band, reasons: s.reasons.map((r) => r.detail),
    }));
    download(`fabric-alerts-${seed}.json`, JSON.stringify(rows, null, 2), 'application/json');
  };

  const exportCsv = () => {
    const head = 'txn_id,account,merchant,amount,country,category,score,band,top_reason\n';
    const rows = scored.filter((s) => s.score >= threshold).map((s) =>
      [s.txn.id, s.txn.account, `"${s.txn.merchant}"`, s.txn.amount, s.txn.country, s.txn.category,
       s.score.toFixed(4), s.band, `"${s.reasons[0]?.detail.replace(/"/g, "'") ?? ''}"`].join(',')
    ).join('\n');
    download(`fabric-alerts-${seed}.csv`, head + rows, 'text/csv');
  };

  const hoverGraph = (e: React.MouseEvent) => {
    const canvas = graphCanvas.current;
    if (!canvas) return;
    const pos = (canvas as any)._positions as Map<string, { x: number; y: number }> | undefined;
    if (!pos) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    let best: string | null = null;
    let bestD = 14;
    for (const [id, p] of pos) {
      const d = Math.hypot(p.x - mx, p.y - my);
      if (d < bestD) { bestD = d; best = id; }
    }
    setHoverNode(best);
  };

  return (
    <WonderShell w={W}>
      <div className="row" style={{ marginBottom: 14, gap: 8 }}>
        <Segmented
          value={tab}
          options={[
            { id: 'queue', label: 'Alert queue' },
            { id: 'graph', label: 'Collusion graph' },
            { id: 'metrics', label: 'Model quality' },
          ]}
          onChange={(v) => setTab(v as any)}
        />
        <div className="row" style={{ gap: 6, marginLeft: 'auto' }}>
          <button className="btn btn-sm btn-ghost" onClick={() => setSeed(Math.floor(Math.random() * 99999))}>🎲 New dataset</button>
          <button className="btn btn-sm btn-ghost" onClick={exportCsv}>↓ CSV alerts</button>
          <button className="btn btn-sm btn-ghost" onClick={exportJson}>↓ JSON</button>
        </div>
      </div>

      {tab === 'queue' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 16 }} className="fab-layout">
          <div className="stack" style={{ gap: 12 }}>
            <div className="row" style={{ gap: 8 }}>
              <Stat label="Transactions" value={size.toLocaleString()} />
              <Stat label="Fraud in data" value={ds.fraudCount} sub={`${((ds.fraudCount / ds.txns.length) * 100).toFixed(1)}%`} />
              <Stat label="Flagged" value={scored.filter((s) => s.score >= threshold).length} />
              <Stat label="Saved" value={`$${(money.caught / 1000).toFixed(0)}k`} sub="fraud blocked" />
              <Stat label="Precision" value={`${(metrics.precision * 100).toFixed(0)}%`} sub="of alerts" />
            </div>

            <div className="panel" style={{ overflow: 'hidden' }}>
              <div className="row" style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
                <Segmented
                  value={filter}
                  options={[
                    { id: 'review', label: `Above threshold (${scored.filter((s) => s.score >= threshold).length})` },
                    { id: 'block', label: 'Auto-block' },
                    { id: 'all', label: 'Everything' },
                  ]}
                  onChange={(v) => setFilter(v as any)}
                />
                <button className="btn btn-sm btn-ghost" onClick={() => setSortBy((s) => (s === 'score' ? 'amount' : 'score'))}>
                  sort: {sortBy}
                </button>
              </div>
              <div style={{ maxHeight: 520, overflowY: 'auto' }}>
                {queue.map((s) => (
                  <div
                    key={s.txn.id}
                    onClick={() => setSelected(s)}
                    style={{
                      display: 'grid', gridTemplateColumns: '78px 1fr 92px 62px',
                      gap: 10, alignItems: 'center', padding: '9px 12px',
                      borderBottom: '1px solid rgba(255,255,255,0.045)',
                      cursor: 'pointer', fontSize: 12,
                      background: selected?.txn.id === s.txn.id ? 'rgba(139,108,255,0.1)' : 'transparent',
                    }}
                  >
                    <span className="mono" style={{ fontSize: 10.5, color: 'var(--txt-3)' }}>{s.txn.id}</span>
                    <div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontWeight: 500 }}>{s.txn.merchant}</span>
                        <span style={{ fontSize: 10, color: 'var(--txt-3)' }}>{s.txn.account} · {s.txn.country}</span>
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--txt-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 330 }}>
                        {s.reasons[0]?.detail ?? 'no strong signals'}
                      </div>
                    </div>
                    <span className="mono" style={{ textAlign: 'right' }}>${s.txn.amount.toFixed(2)}</span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        display: 'inline-block', padding: '2px 7px', borderRadius: 5, fontSize: 10.5,
                        fontFamily: 'var(--mono)',
                        background: s.band === 'block' ? 'rgba(255,92,110,0.18)' : s.band === 'review' ? 'rgba(255,181,69,0.16)' : 'rgba(163,255,18,0.1)',
                        color: s.band === 'block' ? '#ff7b8a' : s.band === 'review' ? '#ffc978' : '#b8ff5f',
                      }}>
                        {(s.score * 100).toFixed(0)}
                      </div>
                    </div>
                  </div>
                ))}
                {queue.length === 0 && (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--txt-3)', fontSize: 12 }}>
                    Nothing above the threshold with this filter — lower it or generate a new dataset.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="stack" style={{ gap: 14 }}>
            <div className="panel panel-pad stack" style={{ gap: 12 }}>
              <div className="section-title" style={{ margin: 0 }}>Decision threshold</div>
              <Slider label="Flag above" value={threshold} min={0.2} max={0.95} onChange={setThreshold} fmt={(v) => (v * 100).toFixed(0)} suffix="/100" />
              <div className="row" style={{ gap: 6 }}>
                <Stat label="Precision" value={`${(metrics.precision * 100).toFixed(0)}%`} />
                <Stat label="Recall" value={`${(metrics.recall * 100).toFixed(0)}%`} />
                <Stat label="AUC" value={metrics.auc.toFixed(3)} />
              </div>
            </div>

            {selected ? (
              <div className="panel panel-pad stack" style={{ gap: 11 }}>
                <div className="spread">
                  <div className="section-title" style={{ margin: 0 }}>{selected.txn.id}</div>
                  <span className="chip" style={{
                    color: selected.band === 'block' ? '#ff7b8a' : selected.band === 'review' ? '#ffc978' : '#b8ff5f',
                    borderColor: 'currentColor',
                  }}>{selected.band}</span>
                </div>
                <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em' }}>${selected.txn.amount.toFixed(2)}</div>
                <div style={{ fontSize: 11.5, color: 'var(--txt-2)', lineHeight: 1.6 }}>
                  {selected.txn.merchant} · {selected.txn.category} · {selected.txn.country}<br />
                  {selected.txn.account} · {String(selected.txn.hour).padStart(2, '0')}:00
                </div>
                <div style={{ height: 1, background: 'var(--line)' }} />
                <div className="section-title" style={{ margin: 0, fontSize: 11 }}>Why — every point accounted for</div>
                {selected.reasons.length ? selected.reasons.map((r, i) => (
                  <div key={i}>
                    <div className="spread" style={{ marginBottom: 3 }}>
                      <span style={{ fontSize: 11.5 }}>{r.label}</span>
                      <span className="mono" style={{ fontSize: 10.5, color: r.contribution > 0.12 ? '#ff8f9b' : 'var(--txt-3)' }}>
                        +{(r.contribution * 100).toFixed(1)}
                      </span>
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--txt-3)', lineHeight: 1.5 }}>{r.detail}</div>
                    <div style={{ height: 3, borderRadius: 99, background: 'rgba(255,255,255,0.07)', marginTop: 5 }}>
                      <div style={{ height: '100%', width: `${Math.min(100, r.contribution * 330)}%`, borderRadius: 99, background: 'linear-gradient(90deg,#8b6cff,#ff5cae)' }} />
                    </div>
                  </div>
                )) : <div style={{ fontSize: 11.5, color: 'var(--txt-3)' }}>No feature crossed its signal threshold — this looks like normal behaviour.</div>}
                <div style={{ height: 1, background: 'var(--line)' }} />
                <div className="kv"><span>Model score</span><span>{(selected.score * 100).toFixed(1)} / 100</span></div>
                {selected.txn.isFraud !== undefined && (
                  <div className="kv"><span>Ground truth (held out)</span><span style={{ color: selected.txn.isFraud ? '#ff8f9b' : '#b8ff5f' }}>{selected.txn.isFraud ? `fraud · ${selected.txn.fraudType}` : 'legitimate'}</span></div>
                )}
              </div>
            ) : (
              <div className="panel panel-pad" style={{ fontSize: 12.5, color: 'var(--txt-3)', lineHeight: 1.6 }}>
                Select any transaction to see its exact score decomposition — each feature's contribution, in points,
                with the sentence that explains it.
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'graph' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 16 }} className="fab-layout">
          <div className="panel" style={{ padding: 10, position: 'relative' }}>
            <canvas
              ref={graphCanvas}
              onMouseMove={hoverGraph}
              onMouseLeave={() => setHoverNode(null)}
              style={{ width: '100%', height: 540, display: 'block', borderRadius: 10, background: 'radial-gradient(60% 60% at 50% 45%, #12121c, #08080e)' }}
            />
            <div style={{ position: 'absolute', top: 20, left: 20 }} className="row">
              <span className="chip"><span style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--violet)' }} /> account</span>
              <span className="chip"><span style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--pink)' }} /> device</span>
              <span className="chip"><span style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--cyan)' }} /> IP</span>
            </div>
          </div>
          <div className="stack" style={{ gap: 14 }}>
            <div className="panel panel-pad stack" style={{ gap: 10 }}>
              <div className="section-title" style={{ margin: 0 }}>Collusion rings detected</div>
              <div style={{ fontSize: 11.5, color: 'var(--txt-3)' }}>Label propagation over the shared-attribute graph.</div>
              {rings.slice(0, 6).map((r, i) => (
                <div key={i} className="panel" style={{ padding: '9px 11px', background: 'rgba(139,108,255,0.07)' }}>
                  <div className="spread">
                    <span style={{ fontSize: 12, fontWeight: 500 }}>Ring #{i + 1}</span>
                    <span className="mono" style={{ fontSize: 10.5, color: 'var(--txt-3)' }}>{r.size} nodes</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--txt-3)', marginTop: 3 }}>
                    {r.accounts.length} accounts · {r.devices.length} shared devices
                  </div>
                </div>
              ))}
              {rings.length === 0 && <div style={{ fontSize: 11.5, color: 'var(--txt-3)' }}>No dense communities in this dataset.</div>}
            </div>
            <div className="panel panel-pad">
              <div className="note">
                Rings are detected structurally, not by labels: the graph is built from attributes reused across
                accounts, then communities are found by label propagation. This is how real AML teams catch
                organised groups that individually look unremarkable.
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'metrics' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 16 }} className="fab-layout">
          <div className="stack" style={{ gap: 12 }}>
            <div className="panel panel-pad">
              <div className="section-title">ROC curve — at the current threshold</div>
              <canvas ref={roiCanvas} style={{ width: '100%', height: 300, display: 'block' }} />
            </div>
            <div className="row" style={{ gap: 8 }}>
              <Stat label="True positives" value={metrics.tp} />
              <Stat label="False positives" value={metrics.fp} />
              <Stat label="False negatives" value={metrics.fn} />
              <Stat label="True negatives" value={metrics.tn} />
            </div>
            <div className="panel panel-pad">
              <div className="section-title">Fraud types in this dataset</div>
              <div className="stack" style={{ gap: 6 }}>
                {Object.entries(ds.types).map(([k, v]) => (
                  <div key={k} className="spread" style={{ fontSize: 12 }}>
                    <span style={{ color: 'var(--txt-2)' }}>{k}</span>
                    <span className="mono">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="stack" style={{ gap: 14 }}>
            <div className="panel panel-pad stack" style={{ gap: 10 }}>
              <div className="section-title" style={{ margin: 0 }}>Honest numbers</div>
              <Stat label="Precision" value={`${(metrics.precision * 100).toFixed(1)}%`} sub="share of alerts that are real" />
              <Stat label="Recall" value={`${(metrics.recall * 100).toFixed(1)}%`} sub="share of fraud caught" />
              <Stat label="F1" value={`${(metrics.f1 * 100).toFixed(1)}%`} />
              <Stat label="AUC" value={metrics.auc.toFixed(3)} sub="ranking quality" />
              <Stat label="Fraud blocked" value={`$${(money.caught / 1000).toFixed(1)}k`} />
              <Stat label="Fraud missed" value={`$${(money.missed / 1000).toFixed(1)}k`} />
              <Stat label="Friction cost" value={`$${(money.falsePositiveValue / 1000).toFixed(1)}k`} sub="value wrongly held" />
            </div>
            <div className="panel panel-pad">
              <div className="note">
                The generator plants five fraud archetypes including a deliberately stealthy one (22% of cases) that
                mimics the account's normal behaviour. That hidden slice is why recall is realistically below 100% —
                a perfect score here would mean the demo was rigged.
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`@media (max-width: 980px) { .fab-layout { grid-template-columns: 1fr !important; } }`}</style>
    </WonderShell>
  );
}
