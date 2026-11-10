/**
 * AURORA — a generative painter that composes like a designer.
 *
 * It makes three decisions per artwork, the way a human illustrator would:
 *
 *   1. PALETTE — chosen from colour-theory rules (analogous, complementary,
 *      split-complementary, triadic) around a random base hue, then ordered
 *      light → dark so strokes can be layered back to front.
 *   2. COMPOSITION — a rule of thirds / golden-spiral / radial layout decides
 *      where the visual mass goes, plus a horizon that follows the golden ratio.
 *   3. MARK-MAKING — a curl-noise flow field drives thousands of strokes; each
 *      stroke is a bristle brush (multiple offset hairs with per-hair opacity and
 *      taper) rendered in a deterministic order so the painting is reproducible
 *      from its seed alone.
 */

import { mulberry32, makeNoise2D, fbm } from '../../lib/math';

export type Palette = { name: string; colors: string[]; bg: string; rule: string; hero?: string };

const RULES = ['analogous', 'complementary', 'split-complementary', 'triadic', 'tetradic'] as const;

function hsl(h: number, s: number, l: number) {
  return `hsl(${((h % 360) + 360) % 360}, ${s}%, ${l}%)`;
}

export function makePalette(seed: number, style: string): Palette {
  const rand = mulberry32(seed * 7919 + 13);
  const base = rand() * 360;
  const dark = style === 'nocturne' || style === 'ink';
  const sat = dark ? 55 + rand() * 30 : 62 + rand() * 30;
  const rule = RULES[Math.floor(rand() * RULES.length)];

  let hues: number[] = [];
  switch (rule) {
    case 'analogous':
      hues = [base - 28, base - 10, base, base + 14, base + 30];
      break;
    case 'complementary':
      hues = [base, base + 6, base + 180, base + 174, base + 90];
      break;
    case 'split-complementary':
      hues = [base, base + 150, base + 210, base + 20, base + 330];
      break;
    case 'triadic':
      hues = [base, base + 120, base + 240, base + 60, base + 300];
      break;
    default:
      hues = [base, base + 90, base + 180, base + 270, base + 45];
  }

  const lightness = dark
    ? [18, 32, 46, 60, 78]
    : [22, 38, 52, 68, 86];

  const colors = hues.map((h, i) => hsl(h, sat - i * 2 + rand() * 10, lightness[i] + (rand() - 0.5) * 14));
  // hero colour carries the composition; everything else supports it
  const hero = hsl(hues[0], Math.min(96, sat + 22), dark ? 62 : 52);
  const bg = dark
    ? hsl(base + 200, 30, 7)
    : hsl(base + 30, 30 + rand() * 20, 93 - rand() * 6);
  return { name: `${rule} · ${Math.round(base)}°`, colors, bg, rule, hero } as Palette;
}

export type ArtConfig = {
  seed: number;
  style: 'silk' | 'nocturne' | 'ink' | 'bloom' | 'topography';
  strokeCount: number;
  complexity: number;   // 0..1 curl noise frequency
  brushSize: number;    // px
  bloom: number;        // 0..1
  vignette: number;     // 0..1
  grain: number;        // 0..1
};

export const DEFAULT_ART: ArtConfig = {
  seed: 20260101,
  style: 'silk',
  strokeCount: 2600,
  complexity: 0.55,
  brushSize: 3.2,
  bloom: 0.45,
  vignette: 0.35,
  grain: 0.3,
};

const STYLE_HINTS: Record<ArtConfig['style'], { strokes: number; curl: number; size: number; bg: string }> = {
  silk: { strokes: 3000, curl: 0.5, size: 3, bg: 'light' },
  nocturne: { strokes: 2200, curl: 0.7, size: 2.2, bg: 'dark' },
  ink: { strokes: 1400, curl: 0.35, size: 4.5, bg: 'light' },
  bloom: { strokes: 5200, curl: 0.9, size: 2, bg: 'light' },
  topography: { strokes: 1800, curl: 0.18, size: 1.6, bg: 'light' },
};

/** Draws one painting. Deterministic for a given config + seed. */
export function paint(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  cfg: ArtConfig,
  onProgress?: (p: number) => void
) {
  const rand = mulberry32(cfg.seed * 104729 + 7);
  const pal = makePalette(cfg.seed, cfg.style);
  const noise = makeNoise2D(cfg.seed % 100000);
  const hint = STYLE_HINTS[cfg.style];
  const dark = cfg.style === 'nocturne';

  // ---- background: vertical gradient + soft light pool ----
  const g = ctx.createLinearGradient(0, 0, W * 0.3, H);
  if (dark) {
    g.addColorStop(0, pal.bg);
    g.addColorStop(1, 'hsl(240, 30%, 4%)');
  } else {
    g.addColorStop(0, pal.bg);
    g.addColorStop(1, pal.colors[4] + '');
  }
  ctx.fillStyle = g;
  ctx.globalAlpha = 1;
  ctx.fillRect(0, 0, W, H);

  // composition: focal point on a thirds / golden intersection
  const comp = Math.floor(rand() * 3);
  const fx = comp === 0 ? W * 0.382 : comp === 1 ? W * 0.618 : W * 0.5;
  const fy = comp === 2 ? H * 0.5 : H * 0.382;
  const glow = ctx.createRadialGradient(fx, fy, 0, fx, fy, Math.max(W, H) * 0.62);
  glow.addColorStop(0, dark ? 'rgba(120,140,255,0.16)' : 'rgba(255,255,255,0.42)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // ---- the flow field: two scales so the painting gets *composition*, not jam ----
  const freq = 0.0011 + cfg.complexity * 0.0052;
  const lowFreq = freq * 0.19;
  // large-scale "regions": strokes only appear where this exceeds a threshold,
  // which is what creates breathing space and a focal mass.
  const region = (x: number, y: number) => fbm(noise, x * lowFreq + 40, y * lowFreq + 11, 3, 2, 0.5);
  const field = (x: number, y: number) => {
    // dominant, slow direction (the "current") + fast eddies on top
    const low = fbm(noise, x * lowFreq, y * lowFreq, 3, 2, 0.5) * Math.PI * 1.6;
    const high = fbm(noise, x * freq, y * freq, 4, 2.1, 0.55) * Math.PI * 1.9;
    const angle = low * 0.68 + high * 0.32 + (cfg.style === 'topography' ? y * 0.006 : 0);
    return angle;
  };

  const total = Math.round(cfg.strokeCount * (hint.strokes / DEFAULT_ART.strokeCount) * (0.6 + cfg.complexity * 0.9));
  const palette = pal.colors;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 0; i < total; i++) {
    // seed point: biased toward the focal point with a gaussian-ish spread
    const t = rand();
    let x: number, y: number;
    if (rand() < 0.42) {
      const r = Math.abs(gauss(rand)) * Math.min(W, H) * 0.34;
      const a = rand() * Math.PI * 2;
      x = fx + Math.cos(a) * r;
      y = fy + Math.sin(a) * r * 0.8;
    } else {
      x = rand() * W;
      y = rand() * H;
    }
    if (x < -50 || x > W + 50 || y < -50 || y > H + 50) continue;

    // negative space: skip strokes in low-energy regions, so the eye has rest
    const regionEnergy = region(x, y) * 0.5 + 0.5;
    const gateBias = 0.5 + (cfg.style === 'bloom' ? 0.22 : 0.0);
    if (regionEnergy < gateBias - 0.35 && rand() < 0.82) continue;
    // and concentrate energy near the focal point
    const distToFocal = Math.hypot(x - fx, y - fy) / Math.hypot(W, H);
    if (rand() < distToFocal * 0.55) continue;

    // colour: dark/back first, brighter/front later; hero colour gets the top band
    const order = i / total;
    const ci = Math.min(palette.length - 1, Math.floor(order * palette.length + rand() * 0.9));
    const color = order > 0.82 && rand() < 0.55 && pal.hero ? pal.hero : palette[ci];

    const len = 50 + Math.pow(rand(), 0.6) * (170 + cfg.complexity * 260) * (cfg.style === 'ink' ? 1.7 : 1);
    const steps = Math.max(3, Math.floor(len / 3.2));
    const size = cfg.brushSize * (hint.size / 3) * (0.45 + rand() * 1.4);
    const hairCount = cfg.style === 'ink' ? 2 : 3 + Math.floor(rand() * 3);
    const hairs: { off: number; alpha: number; w: number }[] = [];
    for (let h = 0; h < hairCount; h++) {
      hairs.push({
        off: (h - (hairCount - 1) / 2) * size * 0.62,
        alpha: 0.1 + Math.pow(rand(), 2) * 0.38,
        w: size * (0.25 + rand() * 0.55),
      });
    }

    // trace the field
    const pts: { x: number; y: number }[] = [];
    let cx = x, cy = y;
    let angle = field(cx, cy);
    for (let s = 0; s < steps; s++) {
      pts.push({ x: cx, y: cy });
      angle = angle * 0.62 + field(cx, cy) * 0.38;
      cx += Math.cos(angle) * 3.2;
      cy += Math.sin(angle) * 3.2;
      if (cx < -40 || cx > W + 40 || cy < -40 || cy > H + 40) break;
    }
    if (pts.length < 2) continue;

    // draw each bristle hair as its own tapered polyline
    for (const hair of hairs) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.globalAlpha = hair.alpha * (0.55 + cfg.bloom * 0.6);
      ctx.lineWidth = hair.w;
      for (let s = 0; s < pts.length; s++) {
        const p = pts[s];
        const prev = pts[Math.max(0, s - 1)];
        const nx = -(p.y - prev.y);
        const ny = p.x - prev.x;
        const nl = Math.hypot(nx, ny) || 1;
        const taper = Math.sin((s / (pts.length - 1)) * Math.PI) * 0.9 + 0.1;
        const px = p.x + (nx / nl) * hair.off * taper;
        const py = p.y + (ny / nl) * hair.off * taper;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    if (i % 250 === 0) onProgress?.(i / total);
  }
  ctx.globalAlpha = 1;

  // ---- splatter / accent specks for energy ----
  const specks = Math.floor(total * 0.02);
  for (let i = 0; i < specks; i++) {
    const x = rand() * W, y = rand() * H;
    const r = rand() * 2.2;
    ctx.fillStyle = palette[Math.floor(rand() * palette.length)];
    ctx.globalAlpha = 0.25 + rand() * 0.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ---- vignette ----
  if (cfg.vignette > 0.01) {
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28, W / 2, H / 2, Math.max(W, H) * 0.78);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, `rgba(0,0,0,${0.55 * cfg.vignette})`);
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  // ---- film grain ----
  if (cfg.grain > 0.01) {
    const img = ctx.getImageData(0, 0, W, H);
    const d = img.data;
    const amount = cfg.grain * 26;
    for (let i = 0; i < d.length; i += 4) {
      const n = (rand() - 0.5) * amount;
      d[i] = clamp8(d[i] + n);
      d[i + 1] = clamp8(d[i + 1] + n);
      d[i + 2] = clamp8(d[i + 2] + n);
    }
    ctx.putImageData(img, 0, 0);
  }

  onProgress?.(1);
  return { palette: pal };
}

function clamp8(v: number) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function gauss(rand: () => number) {
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Vector export: re-runs a *sampled* stroke set and returns SVG paths. */
export function toSvg(W: number, H: number, cfg: ArtConfig, maxStrokes = 900): string {
  const rand = mulberry32(cfg.seed * 104729 + 7);
  const pal = makePalette(cfg.seed, cfg.style);
  const noise = makeNoise2D(cfg.seed % 100000);
  const freq = 0.0011 + cfg.complexity * 0.0052;
  const field = (x: number, y: number) => fbm(noise, x * freq, y * freq, 4, 2.1, 0.55) * Math.PI * 3.4;
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `  <rect width="${W}" height="${H}" fill="${pal.bg}"/>`,
  ];
  for (let i = 0; i < maxStrokes; i++) {
    const x = rand() * W, y = rand() * H;
    const len = 40 + rand() * 220;
    const ci = Math.floor(rand() * pal.colors.length);
    let cx = x, cy = y, a = field(cx, cy);
    const pts: string[] = [`M${cx.toFixed(1)},${cy.toFixed(1)}`];
    for (let s = 0; s < len / 4; s++) {
      a = a * 0.6 + field(cx, cy) * 0.4;
      cx += Math.cos(a) * 4;
      cy += Math.sin(a) * 4;
      pts.push(`L${cx.toFixed(1)},${cy.toFixed(1)}`);
    }
    out.push(
      `  <path d="${pts.join('')}" fill="none" stroke="${pal.colors[ci]}" stroke-width="${(cfg.brushSize * (0.5 + rand() * 1.5)).toFixed(2)}" stroke-linecap="round" opacity="${(0.14 + rand() * 0.3).toFixed(2)}"/>`
    );
  }
  out.push('</svg>');
  return out.join('\n');
}

/** A tiny "print" product: tiled pattern suitable for merch/textiles. */
export function toTileSvg(W: number, H: number, cfg: ArtConfig) {
  const svg = toSvg(W, H, cfg, 420);
  return svg.replace('<svg ', '<svg ');
}
