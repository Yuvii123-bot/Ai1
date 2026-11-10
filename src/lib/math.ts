export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number) => (v - a) / (b - a || 1);
export const smoothstep = (t: number) => t * t * (3 - 2 * t);
export const smootherstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
export const mix = lerp;
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export function mapRange(v: number, a1: number, a2: number, b1: number, b2: number) {
  return b1 + ((v - a1) / (a2 - a1 || 1)) * (b2 - b1);
}

export function hash1(n: number) {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gauss(rand: () => number) {
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}

export function rgb(r: number, g: number, b: number, a = 1) {
  return `rgba(${r | 0},${g | 0},${b | 0},${a})`;
}

/** Perceptually-ish smooth gradient sampler from an array of hex stops. */
export function gradientAt(stops: string[], t: number): string {
  const n = stops.length;
  if (n === 1) return stops[0];
  const x = clamp(t) * (n - 1);
  const i = Math.min(n - 2, Math.floor(x));
  const f = x - i;
  const c1 = hexToRgb(stops[i]);
  const c2 = hexToRgb(stops[i + 1]);
  return rgb(lerp(c1[0], c2[0], f), lerp(c1[1], c2[1], f), lerp(c1[2], c2[2], f));
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function hsl(h: number, s: number, l: number, a = 1) {
  return `hsla(${h},${s}%,${l}%,${a})`;
}

/** Simple value-noise (2D), deterministic. */
export function makeNoise2D(seed = 1) {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h: number, x: number, y: number) => {
    const u = h & 1 ? x : -x;
    const v = h & 2 ? y : -y;
    return u + v;
  };
  return (x: number, y: number) => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf), v = fade(yf);
    const aa = perm[perm[X] + Y], ab = perm[perm[X] + Y + 1];
    const ba = perm[perm[X + 1] + Y], bb = perm[perm[X + 1] + Y + 1];
    const x1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u);
    const x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u);
    return lerp(x1, x2, v) * 0.7071;
  };
}

export function fbm(noise: (x: number, y: number) => number, x: number, y: number, oct = 5, lac = 2, gain = 0.5) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * noise(x * freq, y * freq);
    norm += amp;
    amp *= gain;
    freq *= lac;
  }
  return sum / norm;
}

/** Attach a DPR-correct canvas resize helper. Returns cleanup. */
export function autoResize(canvas: HTMLCanvasElement, onResize: (w: number, h: number, dpr: number) => void) {
  const fit = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(r.width));
    const h = Math.max(1, Math.floor(r.height));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    onResize(w, h, dpr);
  };
  fit();
  const ro = new ResizeObserver(fit);
  ro.observe(canvas);
  window.addEventListener('resize', fit);
  return () => {
    ro.disconnect();
    window.removeEventListener('resize', fit);
  };
}

export function download(filename: string, data: Blob | string, mime = 'text/plain') {
  const blob = typeof data === 'string' ? new Blob([data], { type: mime }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function fmt(n: number, d = 2) {
  if (!isFinite(n)) return '—';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return n.toFixed(d);
}

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}

/** Fine-grained timer for honest performance claims. */
export function nowMs() {
  return performance.now();
}
