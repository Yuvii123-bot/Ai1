/**
 * LOOM — text → 3D geometry.
 *
 * The pipeline:
 *   1. TEXT → an SDF program. A small grammar understands shapes ("sphere",
 *      "cube", "torus", "cylinder", "cone", "capsule") with modifiers
 *      ("hollow", "twisted", "rounded", "smooth", "star", "gear", ...), boolean
 *      operators ("union", "minus", "intersect", "+", "-", "&"), repeats and
 *      arrays. It also knows how to turn a *word* into a shape signature, so any
 *      phrase produces something rather than an error.
 *   2. SDF → mesh: exact signed-distance evaluation on a grid, then marching
 *      cubes with linear interpolation on edges (real triangle soup).
 *   3. Mesh → clean geometry: Laplacian smoothing, vertex normal averaging, and
 *      an STL export you can put straight into a slicer.
 */

export type Vec3 = [number, number, number];

/* ---------------- vector + SDF primitives ---------------- */
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length = (a: Vec3) => Math.sqrt(dot(a, a));
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** polynomial smooth minimum — the heart of organic blending */
export const smin = (a: number, b: number, k: number) => {
  if (k <= 0) return Math.min(a, b);
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return mix(b, a, h) - k * h * (1 - h);
};
export const smax = (a: number, b: number, k: number) => -smin(-a, -b, k);

export type SDF = (p: Vec3) => number;

export const sphere = (r: number): SDF => (p) => length(p) - r;

export const box = (b: Vec3): SDF => (p) => {
  const q: [number, number, number] = [Math.abs(p[0]) - b[0], Math.abs(p[1]) - b[1], Math.abs(p[2]) - b[2]];
  const outside = length([Math.max(q[0], 0), Math.max(q[1], 0), Math.max(q[2], 0)]);
  const inside = Math.min(Math.max(q[0], Math.max(q[1], q[2])), 0);
  return outside + inside;
};

export const roundedBox = (b: Vec3, r: number): SDF => (p) => box([b[0] - r, b[1] - r, b[2] - r])(p) - r;

export const torus = (R: number, r: number): SDF => (p) => {
  const q = Math.hypot(p[0], p[2]) - R;
  return Math.hypot(q, p[1]) - r;
};

export const cylinder = (r: number, h: number): SDF => (p) => {
  const d = [Math.hypot(p[0], p[2]) - r, Math.abs(p[1]) - h];
  return Math.min(Math.max(d[0], d[1]), 0) + Math.hypot(Math.max(d[0], 0), Math.max(d[1], 0));
};

export const cone = (r: number, h: number): SDF => (p) => {
  // cone with apex at +h, base at -h
  const q: [number, number] = [Math.hypot(p[0], p[2]), p[1]];
  const tip = [0, h] as [number, number];
  const base = [r, -h] as [number, number];
  const e: [number, number] = [base[0] - tip[0], base[1] - tip[1]];
  const w: [number, number] = [q[0] - tip[0], q[1] - tip[1]];
  const t = clamp((w[0] * e[0] + w[1] * e[1]) / (e[0] * e[0] + e[1] * e[1]), 0, 1);
  const b: [number, number] = [w[0] - e[0] * t, w[1] - e[1] * t];
  const s = -e[1] * w[0] + e[0] * w[1] > 0 ? 1 : -1;
  const dist = Math.hypot(b[0], b[1]);
  return s * Math.min(dist, Math.hypot(w[0] - e[0], w[1] - e[1]));
};

export const capsule = (a: Vec3, b: Vec3, r: number): SDF => (p) => {
  const pa = sub(p, a);
  const ba = sub(b, a);
  const h = clamp(dot(pa, ba) / dot(ba, ba), 0, 1);
  return length(sub(pa, mul(ba, h))) - r;
};

export const union = (a: SDF, b: SDF, k = 0): SDF => (p) => smin(a(p), b(p), k);
export const intersect = (a: SDF, b: SDF, k = 0): SDF => (p) => smax(a(p), b(p), k);
export const subtract = (a: SDF, b: SDF, k = 0): SDF => (p) => smax(a(p), -b(p), k);

/** Twist a solid around the Y axis. */
export const twist = (f: SDF, amount: number): SDF => (p) => {
  const a = p[1] * amount;
  const c = Math.cos(a), s = Math.sin(a);
  return f([c * p[0] - s * p[2], p[1], s * p[0] + c * p[2]]);
};

/** Repeat a solid along an axis (infinite). */
export const repeatY = (f: SDF, spacing: number): SDF => (p) => {
  const q: Vec3 = [p[0], p[1] - Math.round(p[1] / spacing) * spacing, p[2]];
  return f(q);
};

/** Array a solid n times around Y. */
export const polarArray = (f: SDF, count: number, radius: number): SDF => (p) => {
  let best = 1e9;
  const ang = Math.atan2(p[2], p[0]);
  const seg = (Math.PI * 2) / count;
  for (let i = 0; i < count; i++) {
    const a = i * seg;
    const c = Math.cos(a), s = Math.sin(a);
    const q: Vec3 = [c * p[0] - s * p[2], p[1], s * p[0] + c * p[2]];
    best = Math.min(best, f(sub(q, [radius, 0, 0])));
  }
  return best;
};

/** Hollow a solid with a wall thickness. */
export const shell = (f: SDF, thickness: number): SDF => (p) => Math.abs(f(p)) - thickness;

/** Domain repetition + star fold, for gear-like objects. */
export const gear = (teeth: number, rOuter: number, rInner: number, h: number): SDF => (p) => {
  const seg = (Math.PI * 2) / teeth;
  const ang = Math.atan2(p[2], p[0]);
  const rad = Math.hypot(p[0], p[2]);
  // tooth profile: square wave in angle
  const local = ((ang % seg) + seg) % seg;
  const tooth = local < seg * 0.5 ? rOuter : rInner;
  const body = Math.max(rad - tooth, Math.abs(p[1]) - h);
  const hole = Math.max(Math.hypot(p[0], p[2]) - rInner * 0.28, Math.abs(p[1]) - h * 3);
  return Math.max(body, -hole);
};

/* ---------------- text → SDF grammar ---------------- */
type ShapeName = 'sphere' | 'cube' | 'box' | 'torus' | 'cylinder' | 'cone' | 'capsule' | 'gear' | 'crystal' | 'blob' | 'star' | 'ring' | 'pillar' | 'vase' | 'donut' | 'mushroom' | 'planet' | 'heart' | 'spiral' | 'tower';

const SYNONYMS: Record<string, ShapeName> = {
  sphere: 'sphere', ball: 'sphere', orb: 'sphere', globe: 'sphere', planet: 'planet', bubble: 'sphere',
  cube: 'cube', box: 'cube', block: 'cube', dice: 'cube', brick: 'cube',
  torus: 'torus', donut: 'donut', doughnut: 'donut', ring: 'ring', loop: 'torus',
  cylinder: 'cylinder', tube: 'cylinder', pipe: 'cylinder', pillar: 'pillar', column: 'pillar',
  cone: 'cone', pyramid: 'cone', spike: 'cone', horn: 'cone', hat: 'cone',
  capsule: 'capsule', pill: 'capsule',
  gear: 'gear', cog: 'gear', sprocket: 'gear',
  crystal: 'crystal', gem: 'crystal', diamond: 'crystal', jewel: 'crystal',
  blob: 'blob', cloud: 'blob', amoeba: 'blob', creature: 'blob', monster: 'blob',
  star: 'star', sun: 'star', snowflake: 'star',
  vase: 'vase', jar: 'vase', pot: 'vase', bottle: 'vase', urn: 'vase',
  mushroom: 'mushroom', tree: 'mushroom', fungus: 'mushroom',
  heart: 'heart', love: 'heart',
  spiral: 'spiral', helix: 'spiral', dna: 'spiral', spring: 'spiral', coil: 'spiral',
  tower: 'tower', building: 'tower', skyscraper: 'tower', castle: 'tower', temple: 'tower',
};

export type Program = { sdf: SDF; shape: ShapeName; ops: string[]; description: string };

/** Deterministic tiny hash so the same words always give the same object. */
function hashWords(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

export function compile(text: string, detail = 0.5): Program {
  const t = text.toLowerCase();
  const words = t.split(/[^a-z0-9]+/).filter(Boolean);
  const ops: string[] = [];

  // find the first shape word, else derive one from the hash
  let shape: ShapeName | null = null;
  for (const w of words) if (SYNONYMS[w]) { shape = SYNONYMS[w]; break; }
  const r = hashWords(t);
  if (!shape) {
    const list: ShapeName[] = ['crystal', 'blob', 'tower', 'vase', 'star', 'sphere', 'spiral', 'gear'];
    shape = list[Math.floor(r * list.length)];
    ops.push(`no known noun → chose "${shape}" from the phrase's hash`);
  }

  const hollow = /\bhollow|shell|cup|bowl\b/.test(t);
  const twisted = /\btwist|swirl|helix|spiral\b/.test(t);
  const rounded = /\bround|soft|smooth|organic|blob\b/.test(t);
  const spiky = /\bspik|thorn|star|needle|sharp\b/.test(t);
  const many = /\bmany|array|legion|swarm|cluster|thousand\b/.test(t);
  const cut = /\bcut|slice|half|broken|split\b/.test(t);
  const big = /\bbig|huge|giant|massive|colossal\b/.test(t);
  const tiny = /\btiny|small|mini|little\b/.test(t);

  const size = (big ? 1.35 : tiny ? 0.72 : 1) * (0.9 + r * 0.2);
  const R = 1.0 * size;
  let sdf: SDF;

  switch (shape) {
    case 'sphere': sdf = sphere(R); break;
    case 'planet': {
      sdf = union(sphere(R * 0.8), torus(R * 1.25, R * 0.09), 0);
      // tilt the ring
      sdf = (p: Vec3) => sdf([p[0], p[1] * 0.86 + p[2] * 0.5, p[2] * 0.86 - p[1] * 0.5]);
      ops.push('sphere + tilted torus ring');
      break;
    }
    case 'cube': sdf = roundedBox([R * 0.78, R * 0.78, R * 0.78], R * (rounded ? 0.24 : 0.04)); break;
    case 'torus': sdf = torus(R * 0.85, R * 0.3); break;
    case 'donut': {
      const d = torus(R * 0.85, R * 0.32);
      sdf = (p: Vec3) => d(p);
      // icing: a slightly larger torus clipped to the top
      sdf = union(d, (p: Vec3) => Math.max(torus(R * 0.85, R * 0.36)(p), -(p[1] - R * 0.1)), 0.06);
      ops.push('donut + icing shell');
      break;
    }
    case 'ring': sdf = torus(R * 0.76, R * 0.13); break;
    case 'cylinder': sdf = cylinder(R * 0.62, R * 0.8); break;
    case 'pillar': {
      sdf = union(cylinder(R * 0.36, R * 1.0), box([R * 0.55, R * 0.1, R * 0.55]), 0.05);
      ops.push('column + base slab');
      break;
    }
    case 'cone': sdf = cone(R * 0.9, R * 1.0); break;
    case 'capsule': sdf = capsule([0, -R * 0.65, 0], [0, R * 0.65, 0], R * 0.42); break;
    case 'gear': {
      sdf = gear(12, R * 1.0, R * 0.8, R * 0.22);
      ops.push('12-tooth involute-ish gear');
      break;
    }
    case 'crystal': {
      // octahedron-ish, elongated
      const oct = (p: Vec3) => (Math.abs(p[0]) + Math.abs(p[1]) + Math.abs(p[2]) - R) * 0.577;
      sdf = (p: Vec3) => oct([p[0], p[1] / 1.55, p[2]]);
      ops.push('stretched octahedron (quartz habit)');
      break;
    }
    case 'blob': {
      let b = sphere(R * 0.8);
      // metaball lumps
      const lumps: Vec3[] = [
        [R * 0.55, R * 0.2, 0], [-R * 0.6, -R * 0.1, R * 0.2], [R * 0.1, -R * 0.55, -R * 0.5],
      ];
      for (const l of lumps) b = union(b, (p) => sphere(R * 0.5)(sub(p, l)), R * 0.5);
      sdf = b;
      ops.push('smooth-union metaball cluster');
      break;
    }
    case 'star': {
      const points = 5;
      const base = sphere(R);
      sdf = (p: Vec3) => {
        const ang = Math.atan2(p[1], p[0]);
        const rad = Math.hypot(p[0], p[1]);
        const k = (Math.cos(ang * points) * 0.5 + 0.5) ** 1.2;
        const prof = R * (0.55 + k * 0.55);
        return Math.max(rad - prof, Math.abs(p[2]) - R * 0.28 * (1 - rad / (R * 1.2)));
      };
      void base;
      ops.push('5-point star profile, extruded');
      break;
    }
    case 'vase': {
      // A solid of revolution: radius is a smooth function of height, then the
      // shape is bounded by a slab. Using smax (a real intersection) keeps this
      // a valid distance field — a max() of a plateau would break marching cubes.
      const halfH = R * 1.15;
      sdf = (p: Vec3) => {
        const t = clamp(p[1] / halfH * 0.5 + 0.5, 0, 1);
        const prof = R * (0.34 + 0.62 * Math.sin(Math.PI * Math.pow(t, 0.9)) + 0.16 * Math.pow(t, 7));
        const body = Math.hypot(p[0], p[2]) - prof;
        const slab = Math.abs(p[1]) - halfH;
        return smax(body, slab, 0.03);
      };
      ops.push('vessel of revolution (smooth radius profile)');
      break;
    }
    case 'mushroom': {
      sdf = union(
        capsule([0, -R * 0.9, 0], [0, R * 0.25, 0], R * 0.24),
        (p: Vec3) => {
          // dome cap
          const d = sphere(R * 0.78)([p[0], p[1] - R * 0.45, p[2]]);
          return Math.max(d, -(p[1] - R * 0.3));
        },
        R * 0.22
      );
      ops.push('stem + clipped dome cap');
      break;
    }
    case 'heart': {
      sdf = (p: Vec3) => {
        const x = p[0] / R, y = p[1] / R, z = p[2] / R;
        const a = x * x + 2.25 * y * y + z * z - 1;
        const b = a * a * a - x * x * z * z * z - 0.1125 * y * y * z * z * z;
        return b * 0.5 * R;
      };
      ops.push('implicit heart surface');
      break;
    }
    case 'spiral': {
      sdf = (p: Vec3) => {
        const a = Math.atan2(p[2], p[0]);
        const rad = Math.hypot(p[0], p[2]);
        const turns = 4;
        const phase = (a / (Math.PI * 2) + 0.5) * 1;
        const h = (p[1] / (R * 0.16) + phase * turns * 2) % 2;
        const tube = Math.abs(h - 1) * R * 0.12;
        return Math.max(Math.abs(rad - R * 0.55) - R * 0.12, tube - R * 0.1);
      };
      ops.push('helical tube, 4 turns');
      break;
    }
    case 'tower': {
      // Five setbacks: each level is a box, unioned with a small smoothing.
      const levels = 5;
      sdf = (p: Vec3) => {
        let d = 1e9;
        for (let i = 0; i < levels; i++) {
          const y0 = -R + (i / levels) * R * 2;
          const y1 = y0 + (R * 2) / levels;
          const w = R * (0.78 - i * 0.115);
          const cy = (y0 + y1) / 2, hh = (y1 - y0) / 2;
          const b = box([w, hh, w])([p[0], p[1] - cy, p[2]]);
          d = smin(d, b, R * 0.03);
        }
        return d;
      };
      ops.push('5-setback tapered tower (smooth union)');
      break;
    }
    default: sdf = sphere(R);
  }

  if (twisted) {
    sdf = twist(sdf, 1.6 / R);
    ops.push('twisted 1.6 rad/unit around Y');
  }
  if (hollow) {
    sdf = shell(sdf, R * 0.07);
    ops.push('hollowed with 7% wall');
  }
  if (spiky) {
    const base = sdf;
    sdf = union(base, (p) => {
      // radial spikes
      const rad = Math.hypot(p[0], p[2]);
      const ang = Math.atan2(p[2], p[0]);
      const k = Math.abs(Math.cos(ang * 6));
      return Math.max(rad - R * (0.85 + k * 0.55), Math.abs(p[1]) - R * 0.16);
    }, R * 0.12);
    ops.push('6 radial spikes unioned smoothly');
  }
  if (cut) {
    const base = sdf;
    sdf = (p: Vec3) => Math.max(base(p), -p[1]);
    ops.push('cut on the Y plane');
  }
  if (many) {
    sdf = polarArray(sdf, 8, R * 1.35);
    ops.push('polar array ×8 around Y');
  }
  if (rounded && shape !== 'cube' && shape !== 'blob') {
    const base = sdf;
    sdf = (p: Vec3) => base(p) - R * 0.05;
    ops.push('inflated for softness');
  }
  void detail;

  return {
    sdf,
    shape,
    ops,
    description: `“${text}” → ${shape}${ops.length ? ' · ' + ops.join(' · ') : ''}`,
  };
}

/* ---------------- marching cubes ---------------- */
// Standard edge table. Kept for reference/documentation; polygonise derives
// the edges it needs directly from TRI_TABLE so the two can never drift apart.
const EDGE_TABLE = [
  0x0, 0x109, 0x203, 0x30a, 0x406, 0x50f, 0x605, 0x70c, 0x80c, 0x905, 0xa0f, 0xb06, 0xc0a, 0xd03, 0xe09, 0xf00,
  0x190, 0x99, 0x393, 0x29a, 0x596, 0x49f, 0x795, 0x69c, 0x99c, 0x895, 0xb9f, 0xa96, 0xd9a, 0xc93, 0xf99, 0xe90,
  0x230, 0x339, 0x33, 0x13a, 0x636, 0x73f, 0x435, 0x53c, 0xa3c, 0xb35, 0x83f, 0x936, 0xe3a, 0xf33, 0xc39, 0xd30,
  0x3a0, 0x2a9, 0x1a3, 0xaa, 0x7a6, 0x6af, 0x5a5, 0x4ac, 0xbac, 0xaa5, 0x9af, 0x8a6, 0xfaa, 0xea3, 0xda9, 0xca0,
  0x460, 0x569, 0x663, 0x76a, 0x66, 0x16f, 0x265, 0x36c, 0xc6c, 0xd65, 0xe6f, 0xf66, 0x86a, 0x963, 0xa69, 0xb60,
  0x5f0, 0x4f9, 0x7f3, 0x6fa, 0x1f6, 0xff, 0x3f5, 0x2fc, 0xdfc, 0xcf5, 0xfff, 0xef6, 0x9fa, 0x8f3, 0xbf9, 0xaf0,
  0x650, 0x759, 0x453, 0x55a, 0x256, 0x35f, 0x55, 0x15c, 0xe5c, 0xf55, 0xc5f, 0xd56, 0xa5a, 0xb53, 0x859, 0x950,
  0x7c0, 0x6c9, 0x5c3, 0x4ca, 0x3c6, 0x2cf, 0x1c5, 0xcc, 0xfcc, 0xec5, 0xdcf, 0xcc6, 0xbca, 0xac3, 0x9c9, 0x8c0,
  0x8c0, 0x9c9, 0xac3, 0xbca, 0xcc6, 0xdcf, 0xec5, 0xfcc, 0xcc, 0x1c5, 0x2cf, 0x3c6, 0x4ca, 0x5c3, 0x6c9, 0x7c0,
  0x950, 0x859, 0xb53, 0xa5a, 0xd56, 0xc5f, 0xf55, 0xe5c, 0x15c, 0x55, 0x35f, 0x256, 0x55a, 0x453, 0x759, 0x650,
  0xaf0, 0xbf9, 0x8f3, 0x9fa, 0xef6, 0xfff, 0xcf5, 0xdfc, 0x2fc, 0x3f5, 0xff, 0x1f6, 0x6fa, 0x7f3, 0x4f9, 0x5f0,
  0xb60, 0xa69, 0x963, 0x86a, 0xf66, 0xe6f, 0xd65, 0xc6c, 0x36c, 0x265, 0x16f, 0x66, 0x76a, 0x663, 0x569, 0x460,
  0xca0, 0xda9, 0xea3, 0xfaa, 0x8a6, 0x9af, 0xaa5, 0xbac, 0x4ac, 0x5a5, 0x6af, 0x7a6, 0xaa, 0x1a3, 0x2a9, 0x3a0,
  0xd30, 0xc39, 0xf33, 0xe3a, 0x936, 0x83f, 0xb35, 0xa3c, 0x53c, 0x435, 0x73f, 0x636, 0x13a, 0x33, 0x339, 0x230,
  0xe90, 0xf99, 0xc93, 0xd9a, 0xa96, 0xb9f, 0x895, 0x99c, 0x69c, 0x795, 0x49f, 0x596, 0x29a, 0x393, 0x99, 0x190,
  0xf00, 0xe09, 0xd03, 0xc0a, 0xb06, 0xa0f, 0x905, 0x80c, 0x70c, 0x605, 0x50f, 0x406, 0x30a, 0x203, 0x109, 0x0,
];

const TRI_TABLE: number[][] = [
  [],
  [0, 8, 3],
  [0, 1, 9],
  [1, 8, 3, 9, 8, 1],
  [1, 2, 10],
  [0, 8, 3, 1, 2, 10],
  [9, 2, 10, 0, 2, 9],
  [2, 8, 3, 2, 10, 8, 10, 9, 8],
  [3, 11, 2],
  [0, 11, 2, 8, 11, 0],
  [1, 9, 0, 2, 3, 11],
  [1, 11, 2, 1, 9, 11, 9, 8, 11],
  [3, 10, 1, 11, 10, 3],
  [0, 10, 1, 0, 8, 10, 8, 11, 10],
  [3, 9, 0, 3, 11, 9, 11, 10, 9],
  [9, 8, 10, 10, 8, 11],
  [4, 7, 8],
  [4, 3, 0, 7, 3, 4],
  [0, 1, 9, 8, 4, 7],
  [4, 1, 9, 4, 7, 1, 7, 3, 1],
  [1, 2, 10, 8, 4, 7],
  [3, 4, 7, 3, 0, 4, 1, 2, 10],
  [9, 2, 10, 9, 0, 2, 8, 4, 7],
  [2, 10, 9, 2, 9, 7, 2, 7, 3, 7, 9, 4],
  [8, 4, 7, 3, 11, 2],
  [11, 4, 7, 11, 2, 4, 2, 0, 4],
  [9, 0, 1, 8, 4, 7, 2, 3, 11],
  [4, 7, 11, 9, 4, 11, 9, 11, 2, 9, 2, 1],
  [3, 10, 1, 3, 11, 10, 7, 8, 4],
  [1, 11, 10, 1, 4, 11, 1, 0, 4, 7, 11, 4],
  [4, 7, 8, 9, 0, 11, 9, 11, 10, 11, 0, 3],
  [4, 7, 11, 4, 11, 9, 9, 11, 10],
  [9, 5, 4],
  [9, 5, 4, 0, 8, 3],
  [0, 5, 4, 1, 5, 0],
  [8, 5, 4, 8, 3, 5, 3, 1, 5],
  [1, 2, 10, 9, 5, 4],
  [3, 0, 8, 1, 2, 10, 4, 9, 5],
  [5, 2, 10, 5, 4, 2, 4, 0, 2],
  [2, 10, 5, 3, 2, 5, 3, 5, 4, 3, 4, 8],
  [9, 5, 4, 2, 3, 11],
  [0, 11, 2, 0, 8, 11, 4, 9, 5],
  [0, 5, 4, 0, 1, 5, 2, 3, 11],
  [2, 1, 5, 2, 5, 8, 2, 8, 11, 4, 8, 5],
  [10, 3, 11, 10, 1, 3, 9, 5, 4],
  [4, 9, 5, 0, 8, 1, 8, 10, 1, 8, 11, 10],
  [5, 4, 0, 5, 0, 11, 5, 11, 10, 11, 0, 3],
  [5, 4, 8, 5, 8, 10, 10, 8, 11],
  [9, 7, 8, 5, 7, 9],
  [9, 3, 0, 9, 5, 3, 5, 7, 3],
  [0, 7, 8, 0, 1, 7, 1, 5, 7],
  [1, 5, 3, 3, 5, 7],
  [9, 7, 8, 9, 5, 7, 10, 1, 2],
  [10, 1, 2, 9, 5, 0, 5, 3, 0, 5, 7, 3],
  [8, 0, 2, 8, 2, 5, 8, 5, 7, 10, 5, 2],
  [2, 10, 5, 2, 5, 3, 3, 5, 7],
  [7, 9, 5, 7, 8, 9, 3, 11, 2],
  [9, 5, 7, 9, 7, 2, 9, 2, 0, 2, 7, 11],
  [2, 3, 11, 0, 1, 8, 1, 7, 8, 1, 5, 7],
  [11, 2, 1, 11, 1, 7, 7, 1, 5],
  [9, 5, 8, 8, 5, 7, 10, 1, 3, 10, 3, 11],
  [5, 7, 0, 5, 0, 9, 7, 11, 0, 1, 0, 10, 11, 10, 0],
  [11, 10, 0, 11, 0, 3, 10, 5, 0, 8, 0, 7, 5, 7, 0],
  [11, 10, 5, 7, 11, 5],
  [10, 6, 5],
  [0, 8, 3, 5, 10, 6],
  [9, 0, 1, 5, 10, 6],
  [1, 8, 3, 1, 9, 8, 5, 10, 6],
  [1, 6, 5, 2, 6, 1],
  [1, 6, 5, 1, 2, 6, 3, 0, 8],
  [9, 6, 5, 9, 0, 6, 0, 2, 6],
  [5, 9, 8, 5, 8, 2, 5, 2, 6, 3, 2, 8],
  [2, 3, 11, 10, 6, 5],
  [11, 0, 8, 11, 2, 0, 10, 6, 5],
  [0, 1, 9, 2, 3, 11, 5, 10, 6],
  [5, 10, 6, 1, 9, 2, 9, 11, 2, 9, 8, 11],
  [6, 3, 11, 6, 5, 3, 5, 1, 3],
  [0, 8, 11, 0, 11, 5, 0, 5, 1, 5, 11, 6],
  [3, 11, 6, 0, 3, 6, 0, 6, 5, 0, 5, 9],
  [6, 5, 9, 6, 9, 11, 11, 9, 8],
  [5, 10, 6, 4, 7, 8],
  [4, 3, 0, 4, 7, 3, 6, 5, 10],
  [1, 9, 0, 5, 10, 6, 8, 4, 7],
  [10, 6, 5, 1, 9, 7, 1, 7, 3, 7, 9, 4],
  [6, 1, 2, 6, 5, 1, 4, 7, 8],
  [1, 2, 5, 5, 2, 6, 3, 0, 4, 3, 4, 7],
  [8, 4, 7, 9, 0, 5, 0, 6, 5, 0, 2, 6],
  [7, 3, 9, 7, 9, 4, 3, 2, 9, 5, 9, 6, 2, 6, 9],
  [3, 11, 2, 7, 8, 4, 10, 6, 5],
  [5, 10, 6, 4, 7, 2, 4, 2, 0, 2, 7, 11],
  [0, 1, 9, 4, 7, 8, 2, 3, 11, 5, 10, 6],
  [9, 2, 1, 9, 11, 2, 9, 4, 11, 7, 11, 4, 5, 10, 6],
  [8, 4, 7, 3, 11, 5, 3, 5, 1, 5, 11, 6],
  [5, 1, 11, 5, 11, 6, 1, 0, 11, 7, 11, 4, 0, 4, 11],
  [0, 5, 9, 0, 6, 5, 0, 3, 6, 11, 6, 3, 8, 4, 7],
  [6, 5, 9, 6, 9, 11, 4, 7, 9, 7, 11, 9],
  [10, 4, 9, 6, 4, 10],
  [4, 10, 6, 4, 9, 10, 0, 8, 3],
  [10, 0, 1, 10, 6, 0, 6, 4, 0],
  [8, 3, 1, 8, 1, 6, 8, 6, 4, 6, 1, 10],
  [1, 4, 9, 1, 2, 4, 2, 6, 4],
  [3, 0, 8, 1, 2, 9, 2, 4, 9, 2, 6, 4],
  [0, 2, 4, 4, 2, 6],
  [8, 3, 2, 8, 2, 4, 4, 2, 6],
  [10, 4, 9, 10, 6, 4, 11, 2, 3],
  [0, 8, 2, 2, 8, 11, 4, 9, 10, 4, 10, 6],
  [3, 11, 2, 0, 1, 6, 0, 6, 4, 6, 1, 10],
  [6, 4, 1, 6, 1, 10, 4, 8, 1, 2, 1, 11, 8, 11, 1],
  [9, 6, 4, 9, 3, 6, 9, 1, 3, 11, 6, 3],
  [8, 11, 1, 8, 1, 0, 11, 6, 1, 9, 1, 4, 6, 4, 1],
  [3, 11, 6, 3, 6, 0, 0, 6, 4],
  [6, 4, 8, 11, 6, 8],
  [7, 10, 6, 7, 8, 10, 8, 9, 10],
  [0, 7, 3, 0, 10, 7, 0, 9, 10, 6, 7, 10],
  [10, 6, 7, 1, 10, 7, 1, 7, 8, 1, 8, 0],
  [10, 6, 7, 10, 7, 1, 1, 7, 3],
  [1, 2, 6, 1, 6, 8, 1, 8, 9, 8, 6, 7],
  [2, 6, 9, 2, 9, 1, 6, 7, 9, 0, 9, 3, 7, 3, 9],
  [7, 8, 0, 7, 0, 6, 6, 0, 2],
  [7, 3, 2, 6, 7, 2],
  [2, 3, 11, 10, 6, 8, 10, 8, 9, 8, 6, 7],
  [2, 0, 7, 2, 7, 11, 0, 9, 7, 6, 7, 10, 9, 10, 7],
  [1, 8, 0, 1, 7, 8, 1, 10, 7, 6, 7, 10, 2, 3, 11],
  [11, 2, 1, 11, 1, 7, 10, 6, 1, 6, 7, 1],
  [8, 9, 6, 8, 6, 7, 9, 1, 6, 11, 6, 3, 1, 3, 6],
  [0, 9, 1, 11, 6, 7],
  [7, 8, 0, 7, 0, 6, 3, 11, 0, 11, 6, 0],
  [7, 11, 6],
  [],
  [0, 8, 3],
  [0, 1, 9],
  [1, 8, 3, 9, 8, 1],
  [1, 2, 10],
  [0, 8, 3, 1, 2, 10],
  [9, 2, 10, 0, 2, 9],
  [2, 8, 3, 2, 10, 8, 10, 9, 8],
  [3, 11, 2],
  [0, 11, 2, 8, 11, 0],
  [1, 9, 0, 2, 3, 11],
  [1, 11, 2, 1, 9, 11, 9, 8, 11],
  [3, 10, 1, 11, 10, 3],
  [0, 10, 1, 0, 8, 10, 8, 11, 10],
  [3, 9, 0, 3, 11, 9, 11, 10, 9],
  [9, 8, 10, 10, 8, 11],
  [4, 7, 8],
  [4, 3, 0, 7, 3, 4],
  [0, 1, 9, 8, 4, 7],
  [4, 1, 9, 4, 7, 1, 7, 3, 1],
  [1, 2, 10, 8, 4, 7],
  [3, 4, 7, 3, 0, 4, 1, 2, 10],
  [9, 2, 10, 9, 0, 2, 8, 4, 7],
  [2, 10, 9, 2, 9, 7, 2, 7, 3, 7, 9, 4],
  [8, 4, 7, 3, 11, 2],
  [11, 4, 7, 11, 2, 4, 2, 0, 4],
  [9, 0, 1, 8, 4, 7, 2, 3, 11],
  [4, 7, 11, 9, 4, 11, 9, 11, 2, 9, 2, 1],
  [3, 10, 1, 3, 11, 10, 7, 8, 4],
  [1, 11, 10, 1, 4, 11, 1, 0, 4, 7, 11, 4],
  [4, 7, 8, 9, 0, 11, 9, 11, 10, 11, 0, 3],
  [4, 7, 11, 4, 11, 9, 9, 11, 10],
  [9, 5, 4],
  [9, 5, 4, 0, 8, 3],
  [0, 5, 4, 1, 5, 0],
  [8, 5, 4, 8, 3, 5, 3, 1, 5],
  [1, 2, 10, 9, 5, 4],
  [3, 0, 8, 1, 2, 10, 4, 9, 5],
  [5, 2, 10, 5, 4, 2, 4, 0, 2],
  [2, 10, 5, 3, 2, 5, 3, 5, 4, 3, 4, 8],
  [9, 5, 4, 2, 3, 11],
  [0, 11, 2, 0, 8, 11, 4, 9, 5],
  [0, 5, 4, 0, 1, 5, 2, 3, 11],
  [2, 1, 5, 2, 5, 8, 2, 8, 11, 4, 8, 5],
  [10, 3, 11, 10, 1, 3, 9, 5, 4],
  [4, 9, 5, 0, 8, 1, 8, 10, 1, 8, 11, 10],
  [5, 4, 0, 5, 0, 11, 5, 11, 10, 11, 0, 3],
  [5, 4, 8, 5, 8, 10, 10, 8, 11],
  [9, 7, 8, 5, 7, 9],
  [9, 3, 0, 9, 5, 3, 5, 7, 3],
  [0, 7, 8, 0, 1, 7, 1, 5, 7],
  [1, 5, 3, 3, 5, 7],
  [9, 7, 8, 9, 5, 7, 10, 1, 2],
  [10, 1, 2, 9, 5, 0, 5, 3, 0, 5, 7, 3],
  [8, 0, 2, 8, 2, 5, 8, 5, 7, 10, 5, 2],
  [2, 10, 5, 2, 5, 3, 3, 5, 7],
  [7, 9, 5, 7, 8, 9, 3, 11, 2],
  [9, 5, 7, 9, 7, 2, 9, 2, 0, 2, 7, 11],
  [2, 3, 11, 0, 1, 8, 1, 7, 8, 1, 5, 7],
  [11, 2, 1, 11, 1, 7, 7, 1, 5],
  [9, 5, 8, 8, 5, 7, 10, 1, 3, 10, 3, 11],
  [5, 7, 0, 5, 0, 9, 7, 11, 0, 1, 0, 10, 11, 10, 0],
  [11, 10, 0, 11, 0, 3, 10, 5, 0, 8, 0, 7, 5, 7, 0],
  [11, 10, 5, 7, 11, 5],
  [10, 6, 5],
  [0, 8, 3, 5, 10, 6],
  [9, 0, 1, 5, 10, 6],
  [1, 8, 3, 1, 9, 8, 5, 10, 6],
  [1, 6, 5, 2, 6, 1],
  [1, 6, 5, 1, 2, 6, 3, 0, 8],
  [9, 6, 5, 9, 0, 6, 0, 2, 6],
  [5, 9, 8, 5, 8, 2, 5, 2, 6, 3, 2, 8],
  [2, 3, 11, 10, 6, 5],
  [11, 0, 8, 11, 2, 0, 10, 6, 5],
  [0, 1, 9, 2, 3, 11, 5, 10, 6],
  [5, 10, 6, 1, 9, 2, 9, 11, 2, 9, 8, 11],
  [6, 3, 11, 6, 5, 3, 5, 1, 3],
  [0, 8, 11, 0, 11, 5, 0, 5, 1, 5, 11, 6],
  [3, 11, 6, 0, 3, 6, 0, 6, 5, 0, 5, 9],
  [6, 5, 9, 6, 9, 11, 11, 9, 8],
  [5, 10, 6, 4, 7, 8],
  [4, 3, 0, 4, 7, 3, 6, 5, 10],
  [1, 9, 0, 5, 10, 6, 8, 4, 7],
  [10, 6, 5, 1, 9, 7, 1, 7, 3, 7, 9, 4],
  [6, 1, 2, 6, 5, 1, 4, 7, 8],
  [1, 2, 5, 5, 2, 6, 3, 0, 4, 3, 4, 7],
  [8, 4, 7, 9, 0, 5, 0, 6, 5, 0, 2, 6],
  [7, 3, 9, 7, 9, 4, 3, 2, 9, 5, 9, 6, 2, 6, 9],
  [3, 11, 2, 7, 8, 4, 10, 6, 5],
  [5, 10, 6, 4, 7, 2, 4, 2, 0, 2, 7, 11],
  [0, 1, 9, 4, 7, 8, 2, 3, 11, 5, 10, 6],
  [9, 2, 1, 9, 11, 2, 9, 4, 11, 7, 11, 4, 5, 10, 6],
  [8, 4, 7, 3, 11, 5, 3, 5, 1, 5, 11, 6],
  [5, 1, 11, 5, 11, 6, 1, 0, 11, 7, 11, 4, 0, 4, 11],
  [0, 5, 9, 0, 6, 5, 0, 3, 6, 11, 6, 3, 8, 4, 7],
  [6, 5, 9, 6, 9, 11, 4, 7, 9, 7, 11, 9],
  [10, 4, 9, 6, 4, 10],
  [4, 10, 6, 4, 9, 10, 0, 8, 3],
  [10, 0, 1, 10, 6, 0, 6, 4, 0],
  [8, 3, 1, 8, 1, 6, 8, 6, 4, 6, 1, 10],
  [1, 4, 9, 1, 2, 4, 2, 6, 4],
  [3, 0, 8, 1, 2, 9, 2, 4, 9, 2, 6, 4],
  [0, 2, 4, 4, 2, 6],
  [8, 3, 2, 8, 2, 4, 4, 2, 6],
  [10, 4, 9, 10, 6, 4, 11, 2, 3],
  [0, 8, 2, 2, 8, 11, 4, 9, 10, 4, 10, 6],
  [3, 11, 2, 0, 1, 6, 0, 6, 4, 6, 1, 10],
  [6, 4, 1, 6, 1, 10, 4, 8, 1, 2, 1, 11, 8, 11, 1],
  [9, 6, 4, 9, 3, 6, 9, 1, 3, 11, 6, 3],
  [8, 11, 1, 8, 1, 0, 11, 6, 1, 9, 1, 4, 6, 4, 1],
  [3, 11, 6, 3, 6, 0, 0, 6, 4],
  [6, 4, 8, 11, 6, 8],
  [7, 10, 6, 7, 8, 10, 8, 9, 10],
  [0, 7, 3, 0, 10, 7, 0, 9, 10, 6, 7, 10],
  [10, 6, 7, 1, 10, 7, 1, 7, 8, 1, 8, 0],
  [10, 6, 7, 10, 7, 1, 1, 7, 3],
  [1, 2, 6, 1, 6, 8, 1, 8, 9, 8, 6, 7],
  [2, 6, 9, 2, 9, 1, 6, 7, 9, 0, 9, 3, 7, 3, 9],
  [7, 8, 0, 7, 0, 6, 6, 0, 2],
  [7, 3, 2, 6, 7, 2],
  [2, 3, 11, 10, 6, 8, 10, 8, 9, 8, 6, 7],
  [2, 0, 7, 2, 7, 11, 0, 9, 7, 6, 7, 10, 9, 10, 7],
  [1, 8, 0, 1, 7, 8, 1, 10, 7, 6, 7, 10, 2, 3, 11],
  [11, 2, 1, 11, 1, 7, 10, 6, 1, 6, 7, 1],
  [8, 9, 6, 8, 6, 7, 9, 1, 6, 11, 6, 3, 1, 3, 6],
  [0, 9, 1, 11, 6, 7],
  [7, 8, 0, 7, 0, 6, 3, 11, 0, 11, 6, 0],
  [7, 11, 6],
];

// cube corner offsets, matching the classic ordering
const CORNER: Vec3[] = [
  [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
  [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
];
const EDGE_CORNERS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

export type Mesh = {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  bounds: { min: Vec3; max: Vec3 };
  triangles: number;
  vertices: number;
};

void EDGE_TABLE;

export function polygonise(sdf: SDF, res: number, bounds = 1.7): Mesh {
  const n = res;
  const step = (bounds * 2) / n;
  const field = new Float32Array((n + 1) * (n + 1) * (n + 1));
  const at = (x: number, y: number, z: number) => field[x + y * (n + 1) + z * (n + 1) * (n + 1)];

  for (let z = 0; z <= n; z++) {
    const pz = -bounds + z * step;
    for (let y = 0; y <= n; y++) {
      const py = -bounds + y * step;
      for (let x = 0; x <= n; x++) {
        const px = -bounds + x * step;
        field[x + y * (n + 1) + z * (n + 1) * (n + 1)] = sdf([px, py, pz]);
      }
    }
  }

  const verts: number[] = [];
  const tris: number[] = [];
  const vcache = new Map<string, number>();

  const vertexOnEdge = (key: string, x: number, y: number, z: number, e: number) => {
    const cached = vcache.get(key);
    if (cached !== undefined) return cached;
    const [c0, c1] = EDGE_CORNERS[e];
    const a = CORNER[c0], b = CORNER[c1];
    const v0 = at(x + a[0], y + a[1], z + a[2]);
    const v1 = at(x + b[0], y + b[1], z + b[2]);
    const t = Math.abs(v1 - v0) < 1e-9 ? 0.5 : (0 - v0) / (v1 - v0);
    const px = -bounds + (x + a[0] + (b[0] - a[0]) * t) * step;
    const py = -bounds + (y + a[1] + (b[1] - a[1]) * t) * step;
    const pz = -bounds + (z + a[2] + (b[2] - a[2]) * t) * step;
    const idx = verts.length / 3;
    verts.push(px, py, pz);
    vcache.set(key, idx);
    return idx;
  };

  for (let z = 0; z < n; z++) {
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        let cubeIndex = 0;
        for (let i = 0; i < 8; i++) {
          const c = CORNER[i];
          if (at(x + c[0], y + c[1], z + c[2]) < 0) cubeIndex |= 1 << i;
        }
        if (cubeIndex === 0 || cubeIndex === 255) continue;

        // Only the first 128 cases are tabulated. For the complementary
        // configuration we solve the inverted cube and flip the winding, which
        // is the standard trick and keeps the table consistent by construction.
        const invert = cubeIndex > 127;
        const row = TRI_TABLE[invert ? 255 - cubeIndex : cubeIndex];
        if (!row || !row.length) continue;

        for (let i = 0; i < row.length; i += 3) {
          const e0 = row[i], e1 = row[i + 1], e2 = row[i + 2];
          const a = vertexOnEdge(`${x},${y},${z},${e0}`, x, y, z, e0);
          const b = vertexOnEdge(`${x},${y},${z},${e1}`, x, y, z, e1);
          const c = vertexOnEdge(`${x},${y},${z},${e2}`, x, y, z, e2);
          if (invert) tris.push(a, c, b);
          else tris.push(a, b, c);
        }
      }
    }
  }

  return finalize(new Float32Array(verts), new Uint32Array(tris), sdf);
}

/** Recompute normals from the SDF gradient (smoother than face normals). */
function finalize(positions: Float32Array, indices: Uint32Array, sdf: SDF): Mesh {
  const n = positions.length / 3;
  const normals = new Float32Array(positions.length);
  const h = 0.004;
  for (let i = 0; i < n; i++) {
    const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    const gx = sdf([x + h, y, z]) - sdf([x - h, y, z]);
    const gy = sdf([x, y + h, z]) - sdf([x, y - h, z]);
    const gz = sdf([x, y, z + h]) - sdf([x, y, z - h]);
    const l = Math.hypot(gx, gy, gz) || 1;
    normals[i * 3] = gx / l;
    normals[i * 3 + 1] = gy / l;
    normals[i * 3 + 2] = gz / l;
  }
  const min: Vec3 = [1e9, 1e9, 1e9];
  const max: Vec3 = [-1e9, -1e9, -1e9];
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], positions[i * 3 + a]);
      max[a] = Math.max(max[a], positions[i * 3 + a]);
    }
  }
  return { positions, normals, indices, bounds: { min, max }, triangles: indices.length / 3, vertices: n };
}

/** Laplacian smoothing to remove marching-cubes stair-stepping. */
export function smoothMesh(mesh: Mesh, iterations = 1, lambda = 0.5): Mesh {
  const n = mesh.vertices;
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const a = mesh.indices[i], b = mesh.indices[i + 1], c = mesh.indices[i + 2];
    adj[a].push(b, c); adj[b].push(a, c); adj[c].push(a, b);
  }
  const pos = new Float32Array(mesh.positions);
  const tmp = new Float32Array(pos.length);
  for (let it = 0; it < iterations; it++) {
    tmp.set(pos);
    for (let i = 0; i < n; i++) {
      const nb = adj[i];
      if (!nb.length) continue;
      let sx = 0, sy = 0, sz = 0;
      for (const j of nb) { sx += tmp[j * 3]; sy += tmp[j * 3 + 1]; sz += tmp[j * 3 + 2]; }
      sx /= nb.length; sy /= nb.length; sz /= nb.length;
      pos[i * 3] = tmp[i * 3] + (sx - tmp[i * 3]) * lambda;
      pos[i * 3 + 1] = tmp[i * 3 + 1] + (sy - tmp[i * 3 + 1]) * lambda;
      pos[i * 3 + 2] = tmp[i * 3 + 2] + (sz - tmp[i * 3 + 2]) * lambda;
    }
  }
  // recompute normals by area-weighted averaging
  const normals = new Float32Array(pos.length);
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const a = mesh.indices[i] * 3, b = mesh.indices[i + 1] * 3, c = mesh.indices[i + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) { normals[k] += nx; normals[k + 1] += ny; normals[k + 2] += nz; }
  }
  for (let i = 0; i < n; i++) {
    const l = Math.hypot(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]) || 1;
    normals[i * 3] /= l; normals[i * 3 + 1] /= l; normals[i * 3 + 2] /= l;
  }
  return { ...mesh, positions: pos, normals };
}

/** Binary STL export — the format every slicer accepts. */
export function toStl(mesh: Mesh, scale = 25): ArrayBuffer {
  const tri = mesh.triangles;
  const buf = new ArrayBuffer(84 + tri * 50);
  const view = new DataView(buf);
  const header = 'LOOM / Ten Wonders — generated by an SDF path tracer-free geometry pipeline';
  for (let i = 0; i < Math.min(80, header.length); i++) view.setUint8(i, header.charCodeAt(i));
  view.setUint32(80, tri, true);
  let o = 84;
  const p = mesh.positions;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const a = mesh.indices[i] * 3, b = mesh.indices[i + 1] * 3, c = mesh.indices[i + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    for (const v of [nx, ny, nz]) { view.setFloat32(o, v, true); o += 4; }
    for (const k of [a, b, c]) {
      view.setFloat32(o, p[k] * scale, true); o += 4;
      view.setFloat32(o, p[k + 1] * scale, true); o += 4;
      view.setFloat32(o, p[k + 2] * scale, true); o += 4;
    }
    view.setUint16(o, 0, true); o += 2;
  }
  return buf;
}

/** OBJ export with normals. */
export function toObj(mesh: Mesh, scale = 25): string {
  const lines: string[] = ['# LOOM / Ten Wonders', `# ${mesh.triangles} triangles`];
  const p = mesh.positions, n = mesh.normals;
  for (let i = 0; i < mesh.vertices; i++) {
    lines.push(`v ${(p[i * 3] * scale).toFixed(5)} ${(p[i * 3 + 1] * scale).toFixed(5)} ${(p[i * 3 + 2] * scale).toFixed(5)}`);
  }
  for (let i = 0; i < mesh.vertices; i++) {
    lines.push(`vn ${n[i * 3].toFixed(4)} ${n[i * 3 + 1].toFixed(4)} ${n[i * 3 + 2].toFixed(4)}`);
  }
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const a = mesh.indices[i] + 1, b = mesh.indices[i + 1] + 1, c = mesh.indices[i + 2] + 1;
    lines.push(`f ${a}//${a} ${b}//${b} ${c}//${c}`);
  }
  return lines.join('\n');
}
