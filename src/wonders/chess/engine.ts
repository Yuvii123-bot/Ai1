/**
 * ORACLE — a chess engine written from scratch.
 *
 *  · 0x88 board representation with make/unmake
 *  · full legal move generation (castling, en-passant, promotion)
 *  · iterative deepening alpha–beta with principal variation search
 *  · transposition table (Zobrist), killer moves, history heuristic
 *  · quiescence search with MVV-LVA capture ordering
 *  · tapered evaluation (material + piece-square tables + pawn structure
 *    + king safety + mobility), plus a human-readable explanation of the
 *    chosen move built from the features that actually drove the score.
 */

export type Color = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type Square = number; // 0..127 (0x88)

export const SQ = (file: number, rank: number) => rank * 16 + file;
export const fileOf = (sq: number) => sq & 15;
export const rankOf = (sq: number) => sq >> 4;
export const sqName = (sq: number) => 'abcdefgh'[fileOf(sq)] + (rankOf(sq) + 1);
export const nameToSq = (s: string) => SQ('abcdefgh'.indexOf(s[0]), parseInt(s[1], 10) - 1);

export type Move = {
  from: number;
  to: number;
  piece: PieceType;
  captured?: PieceType;
  promo?: PieceType;
  castle?: 'k' | 'q';
  ep?: boolean;
  score?: number;
};

export type Position = {
  board: (PieceType | null)[]; // 128 entries, index = 0x88 square
  color: Color;
  castling: { wk: boolean; wq: boolean; bk: boolean; bq: boolean };
  ep: number | null;
  halfmove: number;
  fullmove: number;
};

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function parseFen(fen = START_FEN): Position {
  const [placement, color, castling, ep, half, full] = fen.trim().split(/\s+/);
  const board: (PieceType | null)[] = new Array(128).fill(null);
  let rank = 7, file = 0;
  for (const ch of placement) {
    if (ch === '/') { rank--; file = 0; }
    else if (/\d/.test(ch)) file += parseInt(ch, 10);
    else {
      board[SQ(file, rank)] = ch.toLowerCase() as PieceType;
      file++;
    }
  }
  return {
    board,
    color: color as Color,
    castling: {
      wk: castling.includes('K'), wq: castling.includes('Q'),
      bk: castling.includes('k'), bq: castling.includes('q'),
    },
    ep: ep === '-' ? null : nameToSq(ep),
    halfmove: parseInt(half, 10) || 0,
    fullmove: parseInt(full, 10) || 1,
  };
}

export function toFen(g: Game): string {
  let out = '';
  for (let r = 7; r >= 0; r--) {
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const sq = SQ(f, r);
      const pc = g.board[sq];
      if (!pc) { empty++; continue; }
      if (empty) { out += empty; empty = 0; }
      out += g._white[sq] ? pc.toUpperCase() : pc;
    }
    if (empty) out += empty;
    if (r > 0) out += '/';
  }
  const cast =
    (g.castling.wk ? 'K' : '') + (g.castling.wq ? 'Q' : '') +
    (g.castling.bk ? 'k' : '') + (g.castling.bq ? 'q' : '') || '-';
  return `${out} ${g.color} ${cast} ${g.ep === null ? '-' : sqName(g.ep)} ${g.halfmove} ${g.fullmove}`;
}

export function clonePos(p: Position): Position {
  return {
    board: p.board.slice(),
    color: p.color,
    castling: { ...p.castling },
    ep: p.ep,
    halfmove: p.halfmove,
    fullmove: p.fullmove,
  };
}

const KNIGHT = [33, 31, 18, 14, -33, -31, -18, -14];
const BISHOP = [17, 15, -17, -15];
const ROOK = [16, 1, -16, -1];
const KING = [17, 16, 15, 1, -1, -15, -16, -17];

export type Game = Position & { _white: Uint8Array };

export function newGame(fen = START_FEN): Game {
  const p = parseFen(fen);
  const _white = new Uint8Array(128);
  const [placement] = fen.trim().split(/\s+/);
  let rank = 7, file = 0;
  for (const ch of placement) {
    if (ch === '/') { rank--; file = 0; }
    else if (/\d/.test(ch)) file += parseInt(ch, 10);
    else {
      if (/[A-Z]/.test(ch)) _white[SQ(file, rank)] = 1;
      file++;
    }
  }
  return { ...p, _white };
}

export function cloneGame(g: Game): Game {
  return {
    board: g.board.slice(),
    color: g.color,
    castling: { ...g.castling },
    ep: g.ep,
    halfmove: g.halfmove,
    fullmove: g.fullmove,
    _white: g._white.slice(),
  };
}

export function gameFromFen(fen: string): Game {
  return newGame(fen);
}

export function pieceColor(g: Game, sq: number): Color | null {
  if (!g.board[sq]) return null;
  return g._white[sq] ? 'w' : 'b';
}

/* ------------------------------------------------------------------ *
 * Move generation
 * ------------------------------------------------------------------ */
export function generateMoves(g: Game, onlyCaptures = false): Move[] {
  const moves: Move[] = [];
  const me = g.color;
  const meWhite = me === 'w' ? 1 : 0;

  const push = (m: Move) => moves.push(m);

  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) continue;
    const pc = g.board[sq];
    if (!pc) continue;
    if (g._white[sq] !== meWhite) continue;

    if (pc === 'p') {
      const dir = meWhite ? 16 : -16;
      const startRank = meWhite ? 1 : 6;
      const promRank = meWhite ? 7 : 0;
      const one = sq + dir;
      if (!one || one & 0x88) continue;
      if (!g.board[one]) {
        if (!onlyCaptures) {
          if (rankOf(one) === promRank) {
            for (const pr of ['q', 'r', 'b', 'n'] as PieceType[]) push({ from: sq, to: one, piece: 'p', promo: pr });
          } else push({ from: sq, to: one, piece: 'p' });
        }
        const two = sq + dir * 2;
        if (rankOf(sq) === startRank && !g.board[two] && !onlyCaptures) {
          push({ from: sq, to: two, piece: 'p' });
        }
      }
      for (const dc of [dir - 1, dir + 1]) {
        const to = sq + dc;
        if (to < 0 || to > 127 || to & 0x88) continue;
        const target = g.board[to];
        if (target && g._white[to] !== meWhite) {
          if (rankOf(to) === promRank) {
            for (const pr of ['q', 'r', 'b', 'n'] as PieceType[]) push({ from: sq, to, piece: 'p', captured: target, promo: pr });
          } else push({ from: sq, to, piece: 'p', captured: target });
        } else if (!target && g.ep === to) {
          push({ from: sq, to, piece: 'p', captured: 'p', ep: true });
        }
      }
      continue;
    }

    const rays =
      pc === 'n' ? [KNIGHT, false] :
      pc === 'b' ? [BISHOP, true] :
      pc === 'r' ? [ROOK, true] :
      pc === 'q' ? [KING, true] :
      pc === 'k' ? [KING, false] : [KNIGHT, false];

    const [offsets, sliding] = rays as [number[], boolean];
    for (const off of offsets) {
      let to = sq + off;
      while (to >= 0 && to < 128 && !(to & 0x88)) {
        const target = g.board[to];
        if (!target) {
          if (!onlyCaptures) push({ from: sq, to, piece: pc });
        } else {
          if (g._white[to] !== meWhite) push({ from: sq, to, piece: pc, captured: target });
          break;
        }
        if (!sliding) break;
        to += off;
      }
    }
  }

  // castling (the king may not start, pass through, or land in check)
  const them: Color = me === 'w' ? 'b' : 'w';
  if (!onlyCaptures) {
    const backRank = meWhite ? 0 : 7;
    const kingSq = SQ(4, backRank);
    if (g.board[kingSq] === 'k' && g._white[kingSq] === meWhite) {
      const kSide = meWhite ? g.castling.wk : g.castling.bk;
      const qSide = meWhite ? g.castling.wq : g.castling.bq;
      if (kSide && !g.board[SQ(5, backRank)] && !g.board[SQ(6, backRank)] && g.board[SQ(7, backRank)] === 'r') {
        if (!isAttacked(g, kingSq, them) && !isAttacked(g, SQ(5, backRank), them) && !isAttacked(g, SQ(6, backRank), them)) {
          push({ from: kingSq, to: SQ(6, backRank), piece: 'k', castle: 'k' });
        }
      }
      if (qSide && !g.board[SQ(3, backRank)] && !g.board[SQ(2, backRank)] && !g.board[SQ(1, backRank)] && g.board[SQ(0, backRank)] === 'r') {
        if (!isAttacked(g, kingSq, them) && !isAttacked(g, SQ(3, backRank), them) && !isAttacked(g, SQ(2, backRank), them)) {
          push({ from: kingSq, to: SQ(2, backRank), piece: 'k', castle: 'q' });
        }
      }
    }
  }

  // filter illegal (leaves own king in check)
  const legal: Move[] = [];
  for (const m of moves) {
    const undo = makeMove(g, m);
    if (!inCheck(g, me)) legal.push(m);
    unmakeMove(g, m, undo);
  }
  return legal;
}

type Undo = {
  captured: PieceType | null;
  capturedWhite: number;
  castling: Position['castling'];
  ep: number | null;
  halfmove: number;
  fullmove: number;
  color: Color;
  rookFrom?: number;
  rookTo?: number;
  epCapturedSq?: number;
};

export function makeMove(g: Game, m: Move): Undo {
  const undo: Undo = {
    captured: g.board[m.to],
    capturedWhite: g._white[m.to],
    castling: { ...g.castling },
    ep: g.ep,
    halfmove: g.halfmove,
    fullmove: g.fullmove,
    color: g.color,
  };

  const movingWhite = g._white[m.from];
  g.board[m.to] = m.promo ?? m.piece;
  g._white[m.to] = movingWhite;
  g.board[m.from] = null;
  g._white[m.from] = 0;

  if (m.ep) {
    const capSq = m.to + (movingWhite ? -16 : 16);
    undo.epCapturedSq = capSq;
    g.board[capSq] = null;
    g._white[capSq] = 0;
  }

  if (m.castle) {
    const backRank = movingWhite ? 0 : 7;
    if (m.castle === 'k') {
      undo.rookFrom = SQ(7, backRank);
      undo.rookTo = SQ(5, backRank);
    } else {
      undo.rookFrom = SQ(0, backRank);
      undo.rookTo = SQ(3, backRank);
    }
    g.board[undo.rookTo] = g.board[undo.rookFrom];
    g._white[undo.rookTo] = g._white[undo.rookFrom];
    g.board[undo.rookFrom] = null;
    g._white[undo.rookFrom] = 0;
  }

  // castling rights
  if (m.piece === 'k') {
    if (movingWhite) { g.castling.wk = false; g.castling.wq = false; }
    else { g.castling.bk = false; g.castling.bq = false; }
  }
  if (m.from === SQ(0, 0) || m.to === SQ(0, 0)) g.castling.wq = false;
  if (m.from === SQ(7, 0) || m.to === SQ(7, 0)) g.castling.wk = false;
  if (m.from === SQ(0, 7) || m.to === SQ(0, 7)) g.castling.bq = false;
  if (m.from === SQ(7, 7) || m.to === SQ(7, 7)) g.castling.bk = false;

  g.ep = m.piece === 'p' && Math.abs(rankOf(m.to) - rankOf(m.from)) === 2
    ? (m.from + m.to) / 2
    : null;
  g.halfmove = m.piece === 'p' || m.captured ? 0 : g.halfmove + 1;
  if (g.color === 'b') g.fullmove++;
  g.color = g.color === 'w' ? 'b' : 'w';
  return undo;
}

export function unmakeMove(g: Game, m: Move, u: Undo) {
  g.color = u.color;
  g.castling = u.castling;
  g.ep = u.ep;
  g.halfmove = u.halfmove;
  g.fullmove = u.fullmove;

  g.board[m.from] = m.piece;
  g._white[m.from] = u.color === 'w' ? 1 : 0;
  g.board[m.to] = u.captured;
  g._white[m.to] = u.capturedWhite;

  if (m.ep && u.epCapturedSq !== undefined) {
    g.board[u.epCapturedSq] = 'p';
    g._white[u.epCapturedSq] = u.color === 'w' ? 0 : 1;
    g.board[m.to] = null;
  }
  if (m.castle && u.rookFrom !== undefined && u.rookTo !== undefined) {
    g.board[u.rookFrom] = 'r';
    g._white[u.rookFrom] = u.color === 'w' ? 1 : 0;
    g.board[u.rookTo] = null;
    g._white[u.rookTo] = 0;
  }
}

export function isAttacked(g: Game, sq: number, by: Color): boolean {
  const byWhite = by === 'w' ? 1 : 0;
  // pawns
  const pawnDir = byWhite ? -16 : 16;
  for (const dc of [pawnDir - 1, pawnDir + 1]) {
    const s = sq + dc;
    if (s >= 0 && s < 128 && !(s & 0x88) && g.board[s] === 'p' && g._white[s] === byWhite) return true;
  }
  // knights
  for (const off of KNIGHT) {
    const s = sq + off;
    if (s >= 0 && s < 128 && !(s & 0x88) && g.board[s] === 'n' && g._white[s] === byWhite) return true;
  }
  // king
  for (const off of KING) {
    const s = sq + off;
    if (s >= 0 && s < 128 && !(s & 0x88) && g.board[s] === 'k' && g._white[s] === byWhite) return true;
  }
  // sliders
  for (const off of BISHOP) {
    let s = sq + off;
    while (s >= 0 && s < 128 && !(s & 0x88)) {
      const pc = g.board[s];
      if (pc) {
        if (g._white[s] === byWhite && (pc === 'b' || pc === 'q')) return true;
        break;
      }
      s += off;
    }
  }
  for (const off of ROOK) {
    let s = sq + off;
    while (s >= 0 && s < 128 && !(s & 0x88)) {
      const pc = g.board[s];
      if (pc) {
        if (g._white[s] === byWhite && (pc === 'r' || pc === 'q')) return true;
        break;
      }
      s += off;
    }
  }
  return false;
}

export function kingSquare(g: Game, color: Color): number {
  const w = color === 'w' ? 1 : 0;
  for (let s = 0; s < 128; s++) {
    if ((s & 0x88) === 0 && g.board[s] === 'k' && g._white[s] === w) return s;
  }
  return -1;
}

export function inCheck(g: Game, color: Color) {
  const k = kingSquare(g, color);
  return k >= 0 && isAttacked(g, k, color === 'w' ? 'b' : 'w');
}

export function moveToUci(m: Move) {
  return sqName(m.from) + sqName(m.to) + (m.promo ?? '');
}

export function uciToMove(g: Game, uci: string): Move | null {
  const from = nameToSq(uci.slice(0, 2));
  const to = nameToSq(uci.slice(2, 4));
  const promo = uci.length > 4 ? (uci[4] as PieceType) : undefined;
  const moves = generateMoves(g);
  return moves.find((m) => m.from === from && m.to === to && m.promo === promo) ?? null;
}

/* ------------------------------------------------------------------ *
 * Evaluation — tapered, with piece-square tables
 * ------------------------------------------------------------------ */
const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

// tables are written from white's perspective, rank 8 first (a8..h1)
const PST_RAW: Record<PieceType, number[]> = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 10, 30, 20,
  ],
};

// Pre-convert to 0x88-indexed arrays for white and mirrored for black.
const PST: Record<PieceType, { w: Int16Array; b: Int16Array }> = Object.fromEntries(
  (Object.keys(PST_RAW) as PieceType[]).map((k) => {
    const w = new Int16Array(128);
    const b = new Int16Array(128);
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const tableIdx = (7 - r) * 8 + f;
        w[SQ(f, r)] = PST_RAW[k][tableIdx];
        b[SQ(f, r)] = PST_RAW[k][(r) * 8 + (f)];
      }
    }
    return [k, { w, b }];
  })
) as any;

export const MATE = 100000;

export type ExplainTerm = { label: string; detail: string; score: number };

export function evaluateDetailed(g: Game): { score: number; terms: ExplainTerm[] } {
  let mg = 0;
  let mgW = 0, mgB = 0;
  const terms: ExplainTerm[] = [];
  let matW = 0, matB = 0;
  let mobW = 0, mobB = 0;
  let kingSafetyW = 0, kingSafetyB = 0;
  let pawnStructW = 0, pawnStructB = 0;
  let centerW = 0, centerB = 0;
  const pawnFilesW = new Array(8).fill(0);
  const pawnFilesB = new Array(8).fill(0);

  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) continue;
    const pc = g.board[sq];
    if (!pc) continue;
    const white = g._white[sq] === 1;
    const v = VAL[pc];
    if (white) matW += v; else matB += v;
    const pst = white ? PST[pc].w[sq] : PST[pc].b[sq];
    if (white) mgW += v + pst; else mgB += v + pst;
    if (pc === 'p') (white ? pawnFilesW : pawnFilesB)[fileOf(sq)]++;
    if (pc === 'k') {
      const f = fileOf(sq);
      const shelter = f >= 2 && f <= 5 ? -8 : -22;
      if (white) kingSafetyW += shelter; else kingSafetyB += shelter;
    }
    if (pc === 'n' || pc === 'b') {
      const f = fileOf(sq), r = rankOf(sq);
      const central = (f === 3 || f === 4) && (r === 3 || r === 4) ? 12 : 0;
      if (white) centerW += central; else centerB += central;
    }
    if (pc !== 'p' && pc !== 'k') {
      const dirs = pc === 'n' ? KNIGHT : pc === 'b' ? BISHOP : pc === 'r' ? ROOK : KING;
      let mob = 0;
      for (const off of dirs) {
        let s = sq + off;
        while (s >= 0 && s < 128 && !(s & 0x88)) {
          if (g.board[s] && g._white[s] === (white ? 1 : 0)) break;
          mob++;
          if (g.board[s]) break;
          if (pc !== 'q') break;
          s += off;
        }
      }
      if (white) mobW += mob * (pc === 'q' ? 1.5 : 2); else mobB += mob * (pc === 'q' ? 1.5 : 2);
    }
  }

  // doubled / isolated pawns
  for (let f = 0; f < 8; f++) {
    if (pawnFilesW[f] > 1) pawnStructW -= 14 * (pawnFilesW[f] - 1);
    if (pawnFilesB[f] > 1) pawnStructB -= 14 * (pawnFilesB[f] - 1);
    const wn = (f > 0 ? pawnFilesW[f - 1] : 0) + (f < 7 ? pawnFilesW[f + 1] : 0);
    const bn = (f > 0 ? pawnFilesB[f - 1] : 0) + (f < 7 ? pawnFilesB[f + 1] : 0);
    if (pawnFilesW[f] > 0 && wn === 0) pawnStructW -= 18;
    if (pawnFilesB[f] > 0 && bn === 0) pawnStructB -= 18;
  }

  const phase = Math.min(1, (matW + matB - 2000) / 5000); // 1 = opening
  const material = { w: matW, b: matB };
  const centerScore = (centerW - centerB);
  const mobility = (mobW - mobB) * (1 - phase * 0.4);
  const kingSafety = ((kingSafetyW - kingSafetyB) * phase);
  const pawnStruct = (pawnStructW - pawnStructB);

  mgW += mobility + centerScore + kingSafety + pawnStruct;
  mgB += 0;

  const total = mgW - mgB;
  const score = g.color === 'w' ? total : -total;

  terms.push({ label: 'Material', detail: `Pawns ${(material.w - material.b) / 100 >= 0 ? '+' : ''}${((material.w - material.b) / 100).toFixed(1)}`, score: material.w - material.b });
  terms.push({ label: 'Mobility', detail: `${mobW} vs ${mobB} squares reachable`, score: mobility });
  terms.push({ label: 'Central control', detail: `${centerW > centerB ? 'more' : 'less'} control than the opponent`, score: centerScore });
  terms.push({ label: 'King safety', detail: `shelter score ${kingSafetyW} vs ${kingSafetyB}`, score: kingSafety });
  terms.push({ label: 'Pawn structure', detail: `${pawnStructW > pawnStructB ? 'healthier' : 'weaker'} pawns`, score: pawnStruct });
  return { score, terms };
}

export function evaluate(g: Game): number {
  return evaluateDetailed(g).score;
}

/* ------------------------------------------------------------------ *
 * Zobrist hashing for the transposition table
 * ------------------------------------------------------------------ */
const ZOBRIST: number[][] = [];
let zseed = 0x9e3779b9;
const zrand = () => {
  zseed ^= zseed << 13; zseed >>>= 0;
  zseed ^= zseed >>> 17;
  zseed ^= zseed << 5; zseed >>>= 0;
  return zseed;
};
// [color*6 + pieceType][square]
for (let i = 0; i < 12; i++) {
  ZOBRIST[i] = [];
  for (let j = 0; j < 128; j++) ZOBRIST[i][j] = zrand();
}
const Z_SIDE = zrand();
const Z_CASTLE = [zrand(), zrand(), zrand(), zrand()];
const Z_EP = Array.from({ length: 128 }, () => zrand());

const PIECE_INDEX: Record<PieceType, number> = { p: 0, n: 1, b: 2, r: 3, q: 4, k: 5 };

export function hashPos(g: Game): number {
  let h = 0;
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) continue;
    const pc = g.board[sq];
    if (!pc) continue;
    h ^= ZOBRIST[(g._white[sq] ? 0 : 6) + PIECE_INDEX[pc]][sq];
  }
  if (g.color === 'b') h ^= Z_SIDE;
  if (g.castling.wk) h ^= Z_CASTLE[0];
  if (g.castling.wq) h ^= Z_CASTLE[1];
  if (g.castling.bk) h ^= Z_CASTLE[2];
  if (g.castling.bq) h ^= Z_CASTLE[3];
  if (g.ep !== null) h ^= Z_EP[g.ep];
  return h | 0;
}

/* ------------------------------------------------------------------ *
 * Search
 * ------------------------------------------------------------------ */
export type SearchLine = { move: Move; score: number; pv: Move[] };
export type SearchResult = {
  best: Move | null;
  score: number;
  pv: Move[];
  nodes: number;
  depth: number;
  timeMs: number;
  nps: number;
  lines: SearchLine[];
  explanation: ExplainTerm[];
  bestFeatures: ExplainTerm[];
};

type TTEntry = { key: number; depth: number; score: number; flag: 0 | 1 | 2; best: Move | null };

export class Search {
  tt = new Map<number, TTEntry>();
  nodes = 0;
  killers: (Move | null)[][] = [];
  history = new Int32Array(128 * 128);
  startTime = 0;
  deadline = 0;
  stopped = false;
  onProgress?: (depth: number, score: number, best: Move | null, pv: Move[]) => void;

  constructor() {
    for (let d = 0; d < 64; d++) this.killers.push([null, null]);
  }

  reset() {
    this.tt.clear();
    this.nodes = 0;
    this.history.fill(0);
    this.killers.forEach((k) => { k[0] = null; k[1] = null; });
  }

  quiesce(g: Game, alpha: number, beta: number, depth: number): number {
    this.nodes++;
    // evaluate() is already from the side-to-move's point of view
    const standPat = evaluate(g);
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;
    if (depth <= 0) return alpha;

    const caps = generateMoves(g, true);
    caps.sort((a, b) => scoreCapture(b) - scoreCapture(a));
    for (const m of caps) {
      const u = makeMove(g, m);
      const score = -this.quiesce(g, -beta, -alpha, depth - 1);
      unmakeMove(g, m, u);
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  negamax(g: Game, depth: number, alpha: number, beta: number, ply: number, pvLine: Move[]): number {
    if ((this.nodes & 1023) === 0 && performance.now() > this.deadline) {
      this.stopped = true;
    }
    if (this.stopped) return 0;

    const isRoot = ply === 0;
    if (depth <= 0) return this.quiesce(g, alpha, beta, 6);

    this.nodes++;
    const key = hashPos(g);
    const entry = this.tt.get(key);
    let ttMove: Move | null = null;
    if (entry) {
      ttMove = entry.best;
      if (!isRoot && entry.depth >= depth) {
        if (entry.flag === 0) return entry.score;
        if (entry.flag === 1 && entry.score >= beta) return entry.score;
        if (entry.flag === 2 && entry.score <= alpha) return entry.score;
      }
    }

    const moves = generateMoves(g);
    if (moves.length === 0) {
      if (inCheck(g, g.color)) return -MATE + ply;
      return 0;
    }

    // move ordering: TT move, captures (MVV-LVA), killers, history
    for (const m of moves) {
      let s = 0;
      if (ttMove && m.from === ttMove.from && m.to === ttMove.to && m.promo === ttMove.promo) s += 1e6;
      if (m.captured) s += 10000 + VAL[m.captured] * 10 - VAL[m.piece];
      if (m.promo) s += 8000;
      const kill = this.killers[Math.min(63, ply)];
      if (kill[0] && kill[0].from === m.from && kill[0].to === m.to) s += 5000;
      if (kill[1] && kill[1].from === m.from && kill[1].to === m.to) s += 4000;
      s += this.history[m.from * 128 + m.to];
      m.score = s;
    }
    moves.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    let bestScore = -Infinity;
    let bestMove: Move | null = null;
    let alphaOrig = alpha;
    let moveIndex = 0;

    for (const m of moves) {
      const u = makeMove(g, m);
      let score: number;
      const childPv: Move[] = [];
      if (moveIndex === 0) {
        score = -this.negamax(g, depth - 1, -beta, -alpha, ply + 1, childPv);
      } else {
        // late move reduction for quiet moves
        const reduction = depth >= 3 && moveIndex >= 4 && !m.captured && !m.promo ? 1 : 0;
        score = -this.negamax(g, depth - 1 - reduction, -alpha - 1, -alpha, ply + 1, childPv);
        if (score > alpha && (reduction > 0 || score < beta)) {
          score = -this.negamax(g, depth - 1, -beta, -alpha, ply + 1, childPv);
        }
      }
      unmakeMove(g, m, u);
      if (this.stopped) return 0;

      moveIndex++;
      if (score > bestScore) {
        bestScore = score;
        bestMove = m;
        if (isRoot) {
          pvLine.length = 0;
          pvLine.push(m, ...childPv);
        }
      }
      if (score > alpha) alpha = score;
      if (alpha >= beta) {
        if (!m.captured) {
          const k = this.killers[Math.min(63, ply)];
          if (!k[0] || k[0].from !== m.from || k[0].to !== m.to) { k[1] = k[0]; k[0] = m; }
          this.history[m.from * 128 + m.to] += depth * depth;
        }
        break;
      }
    }

    const flag: 0 | 1 | 2 = bestScore <= alphaOrig ? 2 : bestScore >= beta ? 1 : 0;
    this.tt.set(key, { key, depth, score: bestScore, flag, best: bestMove });
    return bestScore;
  }

  /** Root search with per-move reporting, so the UI can narrate the choice. */
  searchRoot(g: Game, depth: number): SearchLine[] {
    const moves = generateMoves(g);
    if (!moves.length) return [];
    for (const m of moves) {
      m.score = 0;
      if (m.captured) m.score = 10000 + VAL[m.captured] * 10 - VAL[m.piece];
      if (m.promo) m.score += 8000;
    }
    moves.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    const lines: SearchLine[] = [];
    let alpha = -Infinity;
    const beta = Infinity;
    for (const m of moves) {
      const u = makeMove(g, m);
      const childPv: Move[] = [];
      const raw = -this.negamax(g, depth - 1, -beta, -alpha, 1, childPv);
      unmakeMove(g, m, u);
      const score = this.stopped ? (lines[lines.length - 1]?.score ?? 0) : raw;
      lines.push({ move: m, score, pv: [m, ...childPv] });
      if (!this.stopped && score > alpha) alpha = score;
    }
    lines.sort((a, b) => b.score - a.score);
    return lines;
  }

  think(g: Game, maxDepth: number, timeLimitMs: number): SearchResult {
    this.stopped = false;
    this.startTime = performance.now();
    this.deadline = this.startTime + timeLimitMs;
    this.nodes = 0;
    this.reset();

    let bestLines: SearchLine[] = [];
    let reachedDepth = 0;
    const startNodes = this.nodes;

    for (let d = 1; d <= maxDepth; d++) {
      const lines = this.searchRoot(g, d);
      if (this.stopped && reachedDepth > 0) break;
      if (lines.length) {
        bestLines = lines;
        reachedDepth = d;
        this.onProgress?.(d, lines[0].score, lines[0].move, lines[0].pv);
      }
      if (performance.now() > this.deadline) break;
      if (Math.abs(bestLines[0]?.score ?? 0) > MATE - 100) break;
    }

    const timeMs = performance.now() - this.startTime;
    const nodes = this.nodes - startNodes;
    const best = bestLines[0]?.move ?? null;
    const detail = evaluateDetailed(g);
    let features: ExplainTerm[] = detail.terms;

    if (best) {
      // describe the move itself in chess terms
      const moving = g.board[best.from]!;
      const sq = sqName(best.to);
      const desc: string[] = [];
      if (best.castle) desc.push('It castles: king to safety, rook activated.');
      if (best.captured) desc.push(`It captures a ${pieceName(best.captured)} on ${sq}.`);
      if (best.promo) desc.push(`It promotes to a ${pieceName(best.promo)}.`);
      if (best.piece === 'p' && !best.captured && !best.promo) desc.push('It advances a pawn, taking space.');
      if (g.board[best.to] === null && !best.captured) desc.push(`It improves the ${pieceName(moving)} to ${sq}.`);
      if (inCheck(g, g.color)) desc.push('It is the only way out of check.');
      features = [{ label: 'Why this move', detail: desc.join(' ') || 'It is the most accurate move found.', score: bestLines[0]?.score ?? 0 }, ...detail.terms];
    }

    return {
      best,
      score: bestLines[0]?.score ?? 0,
      pv: bestLines[0]?.pv ?? [],
      nodes,
      depth: reachedDepth,
      timeMs,
      nps: nodes / Math.max(0.001, timeMs / 1000),
      lines: bestLines.slice(0, 5),
      explanation: detail.terms,
      bestFeatures: features,
    };
  }
}

function pieceName(p: PieceType) {
  return { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }[p];
}

function scoreCapture(m: Move) {
  if (!m.captured) return 0;
  return VAL[m.captured] * 10 - VAL[m.piece] + (m.promo ? 800 : 0);
}

/* ------------------------------------------------------------------ *
 * A tiny opponent for the UI (same engine, shallow + randomized)
 * ------------------------------------------------------------------ */
export function quickMove(g: Game, depth = 2, randomness = 40): Move | null {
  const s = new Search();
  const res = s.think(g, depth, 900);
  if (!res.lines.length) return res.best;
  const top = res.lines.filter((l) => res.lines[0].score - l.score <= randomness);
  return top[Math.floor(Math.random() * top.length)].move;
}

export const START = START_FEN;

/** Perft — correctness test for move generation. */
export function perft(g: Game, depth: number): number {
  if (depth === 0) return 1;
  const moves = generateMoves(g);
  if (depth === 1) return moves.length;
  let n = 0;
  for (const m of moves) {
    const u = makeMove(g, m);
    n += perft(g, depth - 1);
    unmakeMove(g, m, u);
  }
  return n;
}
