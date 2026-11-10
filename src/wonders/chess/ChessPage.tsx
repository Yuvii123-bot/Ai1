import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WonderShell, Slider, Stat, Segmented } from '../../lib/ui';
import { WONDER_META } from '../meta';
import {
  Game, Move, Search, newGame, generateMoves, makeMove, sqName, inCheck, toFen, kingSquare,
  gameFromFen, MATE, cloneGame,
} from './engine';

const W = WONDER_META.find((w) => w.slug === 'chess')!;

const GLYPH: Record<string, string> = {
  wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
  bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟',
};

type HistoryEntry = { move: Move; san: string; fen: string; uci: string };

const FILES = 'abcdefgh';

function sanFor(g: Game, m: Move, legal: Move[]): string {
  if (m.castle) return m.castle === 'k' ? 'O-O' : 'O-O-O';
  let san = '';
  const piece = m.piece;
  if (piece !== 'p') {
    san += piece.toUpperCase();
    // disambiguation
    const sameTarget = legal.filter((x) => x.to === m.to && x.piece === piece && x.from !== m.from);
    if (sameTarget.length) {
      const sameFile = sameTarget.some((x) => (x.from & 15) === (m.from & 15));
      const sameRank = sameTarget.some((x) => (x.from >> 4) === (m.from >> 4));
      if (!sameFile) san += FILES[m.from & 15];
      else if (!sameRank) san += ((m.from >> 4) + 1);
      else san += sqName(m.from);
    }
  } else if (m.captured) {
    san += FILES[m.from & 15];
  }
  if (m.captured) san += 'x';
  san += sqName(m.to);
  if (m.promo) san += '=' + m.promo.toUpperCase();
  // check / mate — work on a throwaway copy; callers pass the live position
  const probe = cloneGame(g);
  makeMove(probe, m);
  const opp = probe.color;
  const oppMoves = generateMoves(probe);
  if (inCheck(probe, opp)) san += oppMoves.length === 0 ? '#' : '+';
  return san;
}

type ChessState = { game: Game; history: HistoryEntry[] };

export default function ChessPage() {
  // One immutable state object for the whole game tree. Keeping game+history in
  // a single state means an update never mutates a live object that effects or
  // event handlers still hold a reference to.
  const [state, setState] = useState<ChessState>(() => ({ game: newGame(), history: [] }));
  const game = state.game;
  const history = state.history;
  const [selected, setSelected] = useState<number | null>(null);
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>('w');
  const [strength, setStrength] = useState(4);
  const [thinking, setThinking] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [liveDepth, setLiveDepth] = useState(0);
  const [liveScore, setLiveScore] = useState(0);
  const [livePv, setLivePv] = useState<string>('');
  const [lastMove, setLastMove] = useState<{ from: number; to: number } | null>(null);
  const [status, setStatus] = useState('');
  const searchRef = useRef<Search | null>(null);
  const [autoExplain, setAutoExplain] = useState(true);
  const [thinkingLog, setThinkingLog] = useState<string[]>([]);

  const moves = useMemo(() => generateMoves(game), [game]);
  const checkSq = inCheck(game, game.color) ? kingSquare(game, game.color) : -1;
  const over = moves.length === 0;

  const applyMove = useCallback((m: Move) => {
    setState((prev) => {
      const g = cloneGame(prev.game);
      const legal = generateMoves(g);
      const san = sanFor(g, m, legal);
      makeMove(g, m);
      const nextMoves = generateMoves(g);
      const side = g.color;
      if (nextMoves.length === 0) {
        setStatus(inCheck(g, side) ? `${side === 'w' ? 'Black' : 'White'} wins by checkmate` : 'Draw by stalemate');
      } else if (inCheck(g, side)) {
        setStatus(`${side === 'w' ? 'White' : 'Black'} is in check`);
      } else {
        setStatus('');
      }
      setLastMove({ from: m.from, to: m.to });
      setSelected(null);
      return {
        game: g,
        history: [...prev.history, { move: m, san, fen: toFen(g), uci: sqName(m.from) + sqName(m.to) + (m.promo ?? '') }],
      };
    });
  }, []);

  /* ---------------- engine turn ---------------- */
  const engineBusy = useRef(false);
  useEffect(() => {
    if (over || game.color === playerColor || engineBusy.current) return;
    let cancelled = false;
    engineBusy.current = true;
    setThinking(true);
    setThinkingLog([]);
    const s = new Search();
    searchRef.current = s;
    s.onProgress = (d, score, best, pv) => {
      if (cancelled) return;
      setLiveDepth(d);
      setLiveScore(score);
      setLivePv(pv.map((m) => sqName(m.from) + sqName(m.to)).join(' '));
      setThinkingLog((log) => {
        const entry = `depth ${d}: ${best ? sqName(best.from) + '→' + sqName(best.to) : '—'}  eval ${(score / 100).toFixed(2)}`;
        return [entry, ...log].slice(0, 6);
      });
    };
    const timer = setTimeout(() => {
      const res = s.think(game, Math.max(2, strength), 200 + strength * 420);
      if (cancelled) return;
      setThinking(false);
      setAnalysis(res);
      engineBusy.current = false;
      if (res.best) applyMove(res.best);
    }, 120);
    return () => {
      cancelled = true;
      s.stopped = true;
      clearTimeout(timer);
      engineBusy.current = false;
      setThinking(false);
    };
  }, [game, playerColor, strength, over, applyMove]);

  const onSquare = (sq: number) => {
    if (thinking && game.color !== playerColor) return;
    if (game.color !== playerColor) return;
    const piece = game.board[sq];
    if (selected !== null) {
      const m = moves.find((x) => x.from === selected && x.to === sq);
      if (m) {
        // promotion: default to queen
        const promo = moves.filter((x) => x.from === selected && x.to === sq && x.promo);
        applyMove(promo.length ? promo.find((p) => p.promo === 'q')! : m);
        return;
      }
      if (piece && game._white[sq] === (game.color === 'w' ? 1 : 0)) { setSelected(sq); return; }
      setSelected(null);
      return;
    }
    if (piece && game._white[sq] === (game.color === 'w' ? 1 : 0)) setSelected(sq);
  };

  const legalTargets = selected !== null ? moves.filter((m) => m.from === selected).map((m) => m.to) : [];
  const newGameClick = (color: 'w' | 'b') => {
    setPlayerColor(color);
    setState({ game: newGame(), history: [] });
    setSelected(null);
    setLastMove(null);
    setStatus('');
    setAnalysis(null);
    setThinkingLog([]);
    engineBusy.current = false;
  };

  const undo = () => {
    if (history.length < 1) return;
    // step back two plies (engine + player) when possible
    const back = history.length >= 2 ? 2 : 1;
    const target = history[history.length - back];
    if (!target) return;
    const g = gameFromFen(target.fen);
    setState({ game: g, history: history.slice(0, history.length - back) });
    setLastMove(null);
    setSelected(null);
    setStatus('');
    engineBusy.current = false;
  };

  const evalBar = useMemo(() => {
    const s = analysis?.score ?? liveScore;
    const clamped = Math.max(-800, Math.min(800, s));
    return 0.5 + clamped / 1600;
  }, [analysis, liveScore]);

  return (
    <WonderShell w={W}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 560px) minmax(0,1fr)', gap: 18 }} className="chess-layout">
        {/* board */}
        <div className="panel panel-pad stack" style={{ gap: 14 }}>
          <div className="spread">
            <div className="row" style={{ gap: 6 }}>
              <button className="btn btn-sm" onClick={() => newGameClick('w')}>You: White</button>
              <button className="btn btn-sm" onClick={() => newGameClick('b')}>You: Black</button>
            </div>
            <span className="chip">{history.length} plies</span>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ width: 8, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', display: 'flex', flexDirection: 'column-reverse' }}>
              <div style={{ height: `${evalBar * 100}%`, background: 'linear-gradient(180deg,#fff,#b9a5ff)', transition: 'height 0.5s cubic-bezier(.2,.7,.3,1)' }} />
            </div>
            <div
              style={{
                flex: 1, position: 'relative', display: 'grid',
                gridTemplateColumns: 'repeat(8, 1fr)', aspectRatio: '1/1',
                borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line-2)',
                transform: playerColor === 'b' ? 'rotate(180deg)' : 'none',
              }}
            >
              {Array.from({ length: 64 }).map((_, i) => {
                const v = i;
                const f = v % 8;
                const r = Math.floor(v / 8);
                const sq = r * 16 + f;
                const dark = (f + r) % 2 === 0;
                const isSel = selected === sq;
                const isTarget = legalTargets.includes(sq);
                const isLast = lastMove && (lastMove.from === sq || lastMove.to === sq);
                const pc = game.board[sq];
                const col = pc ? (game._white[sq] ? 'w' : 'b') : '';
                const isCheck = checkSq === sq;
                return (
                  <div
                    key={sq}
                    onClick={() => onSquare(sq)}
                    style={{
                      position: 'relative', background: dark ? '#2b2b38' : '#3c3c4c',
                      display: 'grid', placeItems: 'center', cursor: 'pointer',
                      boxShadow: isLast ? 'inset 0 0 0 2px rgba(163,255,18,0.55)' : undefined,
                      transition: 'background 0.12s',
                    }}
                  >
                    {isCheck && <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle, rgba(255,60,60,0.75), transparent 70%)' }} />}
                    {isSel && <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 0 3px var(--accent)' }} />}
                    {pc && (
                      <span style={{
                        fontSize: 'clamp(20px,5.4vw,38px)', lineHeight: 1,
                        color: col === 'w' ? '#f4f4fa' : '#12121a',
                        textShadow: col === 'w' ? '0 1px 3px rgba(0,0,0,0.7)' : '0 1px 0 rgba(255,255,255,0.18)',
                        transform: playerColor === 'b' ? 'rotate(180deg)' : 'none',
                        userSelect: 'none', pointerEvents: 'none',
                      }}>
                        {GLYPH[col + pc]}
                      </span>
                    )}
                    {isTarget && !pc && (
                      <div style={{ position: 'absolute', width: '26%', height: '26%', borderRadius: '50%', background: 'rgba(163,255,18,0.55)' }} />
                    )}
                    {isTarget && pc && (
                      <div style={{ position: 'absolute', inset: 3, borderRadius: '50%', border: '3px solid rgba(163,255,18,0.75)' }} />
                    )}
                    {f === 0 && (
                      <span style={{ position: 'absolute', top: 2, left: 3, fontSize: 8, color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--mono)' }}>{r + 1}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="row">
            <button className="btn btn-sm" onClick={undo} disabled={!history.length}>↶ Undo</button>
            <button className="btn btn-sm btn-ghost" onClick={() => { navigator.clipboard?.writeText(toFen(game)); }}>Copy FEN</button>
            <span style={{ fontSize: 11.5, color: 'var(--txt-2)', marginLeft: 'auto' }}>
              {over ? (status || 'Game over') : thinking ? 'Oracle is thinking…' : status || (game.color === playerColor ? 'Your move' : '…')}
            </span>
          </div>

          <div>
            <div className="section-title">Moves</div>
            <div className="scroll-x" style={{ maxHeight: 92, overflowY: 'auto', fontFamily: 'var(--mono)', fontSize: 11.5, lineHeight: 1.9 }}>
              {history.length === 0 && <span style={{ color: 'var(--txt-3)' }}>no moves yet</span>}
              {history.map((h, i) => (
                <span key={i} style={{ marginRight: 10, color: i % 2 ? 'var(--txt-2)' : 'var(--txt)' }}>
                  {i % 2 === 0 && <span style={{ color: 'var(--txt-3)' }}>{Math.floor(i / 2) + 1}. </span>}
                  {h.san}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* engine panel */}
        <div className="stack" style={{ gap: 14 }}>
          <div className="panel panel-pad stack" style={{ gap: 12 }}>
            <div className="spread">
              <div className="section-title" style={{ margin: 0 }}>Oracle is thinking</div>
              <span className={`chip ${thinking ? 'chip-live' : ''}`}>{thinking ? <><span className="dot" /> SEARCHING</> : 'IDLE'}</span>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <Stat label="Depth" value={liveDepth} />
              <Stat label="Eval" value={((analysis?.score ?? liveScore) / 100).toFixed(2)} sub="pawns, + = white" />
              <Stat label="Nodes" value={(analysis?.nodes ?? 0) > 1000 ? `${((analysis?.nodes ?? 0) / 1000).toFixed(0)}k` : analysis?.nodes ?? 0} />
              <Stat label="kNPS" value={((analysis?.nps ?? 0) / 1000).toFixed(0)} />
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--txt-3)', minHeight: 16 }}>
              PV: {livePv || '—'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--txt-3)' }}>
              {thinkingLog.map((l, i) => (
                <div key={i} style={{ opacity: 1 - i * 0.15 }}>› {l}</div>
              ))}
            </div>
          </div>

          <div className="panel panel-pad">
            <div className="section-title">Why that move?</div>
            {analysis?.bestFeatures ? (
              <div className="stack" style={{ gap: 9 }}>
                <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>{analysis.bestFeatures[0].detail}</div>
                <div style={{ height: 1, background: 'var(--line)', margin: '3px 0' }} />
                {analysis.bestFeatures.slice(1).map((t: any) => (
                  <div key={t.label} className="spread" style={{ fontSize: 12 }}>
                    <span style={{ color: 'var(--txt-2)' }}>{t.label}</span>
                    <span className="mono" style={{ color: t.score >= 0 ? 'var(--accent)' : '#ff7b7b' }}>
                      {t.score >= 0 ? '+' : ''}{Math.round(t.score)}
                    </span>
                  </div>
                ))}
                {analysis.lines?.length > 1 && (
                  <>
                    <div style={{ height: 1, background: 'var(--line)', margin: '3px 0' }} />
                    <div className="section-title" style={{ margin: 0, fontSize: 11 }}>Candidates considered</div>
                    {analysis.lines.slice(0, 4).map((l: any, i: number) => (
                      <div key={i} className="spread" style={{ fontSize: 11.5, fontFamily: 'var(--mono)' }}>
                        <span style={{ color: i === 0 ? 'var(--accent)' : 'var(--txt-2)' }}>
                          {sqName(l.move.from)}{sqName(l.move.to)}{l.move.promo ?? ''}
                        </span>
                        <span style={{ color: 'var(--txt-3)' }}>{Math.abs(l.score) > MATE - 1000 ? (l.score > 0 ? '#' : '-#') : (l.score / 100).toFixed(2)}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: 'var(--txt-3)' }}>
                Make a move — Oracle will choose a reply and explain exactly which features of the position drove it.
              </div>
            )}
          </div>

          <div className="panel panel-pad stack" style={{ gap: 12 }}>
            <div className="section-title" style={{ margin: 0 }}>Strength</div>
            <Slider label="Search depth" value={strength} min={1} max={6} step={1} onChange={(v) => setStrength(Math.round(v))} suffix=" ply" />
            <div style={{ fontSize: 11, color: 'var(--txt-3)', lineHeight: 1.5 }}>
              Depth 1–2 plays like a beginner; depth 5–6 finds tactics a club player would miss. The search always
              finishes within its time budget, so the UI never freezes.
            </div>
          </div>

          <div className="panel panel-pad">
            <div className="note">
              Full alpha–beta with iterative deepening, a Zobrist transposition table, killer/history move ordering,
              late-move reductions and quiescence search. Move generation is verified against the standard perft
              counts (start position, Kiwipete: 20 · 400 · 8,902 · 197,281 / 48 · 2,039 · 97,862).
            </div>
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 980px) { .chess-layout { grid-template-columns: 1fr !important; } }`}</style>
    </WonderShell>
  );
}
