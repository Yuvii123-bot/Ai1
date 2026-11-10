/**
 * PHOTON — a physically based path tracer.
 *
 * Real light transport:
 *   · cosine-weighted diffuse BSDF sampling
 *   · Fresnel dielectrics with refraction (glass) and rough metals
 *   · solid-angle next-event estimation for the spherical area light (MIS-lite)
 *   · Russian roulette termination
 *   · thin-lens depth of field
 *
 * Everything is analytic (sphere / plane / box), so the speed comes from tight
 * inner loops and many cores rather than an acceleration structure.
 */

export type Vec3 = [number, number, number];
export type Material = {
  albedo: Vec3;
  rough: number;      // 0 mirror .. 1 rough
  metal: number;      // 0 dielectric .. 1 metal
  ior: number;        // refractive index (1 = opaque)
  emissive: Vec3;
  checker?: number;
};
export type Obj =
  | { t: 's'; c: Vec3; r: number; mat: Material }
  | { t: 'p'; n: Vec3; d: number; mat: Material }
  | { t: 'b'; min: Vec3; max: Vec3; mat: Material };

export type Camera = {
  pos: Vec3; target: Vec3; fov: number; aperture: number; focus: number; up?: Vec3;
};

export type Scene = {
  objs: Obj[];
  sky: { top: Vec3; bottom: Vec3; sun: Vec3; sunPower: number };
  light?: { c: Vec3; r: number };
  exposure: number;
};

export type RenderOpts = {
  width: number;
  height: number;
  rowStart: number;
  rowEnd: number;
  sampleOffset: number;
  samplesPerPixel: number;
  maxBounces: number;
  camera: Camera;
  scene: Scene;
  seed: number;
};

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const mulv = (a: Vec3, b: Vec3): Vec3 => [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const reflect = (d: Vec3, n: Vec3): Vec3 => sub(d, mul(n, 2 * dot(d, n)));
const luminance = (c: Vec3) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return (s >>> 0) / 4294967296;
  };
}

type Hit = { t: number; n: Vec3; mat: Material; p: Vec3; emissive: boolean; objIndex: number } | null;

function intersectSphere(o: Vec3, d: Vec3, c: Vec3, r: number): number {
  const ox = o[0] - c[0], oy = o[1] - c[1], oz = o[2] - c[2];
  const b = ox * d[0] + oy * d[1] + oz * d[2];
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return -1;
  const sq = Math.sqrt(disc);
  const t0 = -b - sq;
  if (t0 > 1e-4) return t0;
  const t1 = -b + sq;
  return t1 > 1e-4 ? t1 : -1;
}

function intersectBox(o: Vec3, d: Vec3, bmin: Vec3, bmax: Vec3): number {
  let tmin = -1e9, tmax = 1e9;
  for (let a = 0; a < 3; a++) {
    const inv = 1 / (d[a] || 1e-12);
    let t1 = (bmin[a] - o[a]) * inv;
    let t2 = (bmax[a] - o[a]) * inv;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmax < tmin) return -1;
  }
  return tmin < 1e9 && tmin > 1e-4 ? tmin : -1;
}

function hitScene(o: Vec3, d: Vec3, objs: Obj[]): Hit {
  let best = 1e9;
  let bi = -1;
  for (let i = 0; i < objs.length; i++) {
    const ob = objs[i];
    let t = -1;
    if (ob.t === 's') t = intersectSphere(o, d, ob.c, ob.r);
    else if (ob.t === 'b') t = intersectBox(o, d, ob.min, ob.max);
    else {
      const dn = dot(d, ob.n);
      if (Math.abs(dn) < 1e-9) continue;
      t = (ob.d - dot(o, ob.n)) / dn;
      if (t < 1e-4) t = -1;
    }
    if (t > 0 && t < best) { best = t; bi = i; }
  }
  if (bi < 0) return null;
  const ob = objs[bi];
  const p: Vec3 = add(o, mul(d, best));
  let n: Vec3;
  if (ob.t === 's') n = norm(sub(p, ob.c));
  else if (ob.t === 'p') n = ob.n;
  else {
    const cx = (ob.min[0] + ob.max[0]) / 2, cy = (ob.min[1] + ob.max[1]) / 2, cz = (ob.min[2] + ob.max[2]) / 2;
    const lx = Math.abs(p[0] - cx) / ((ob.max[0] - ob.min[0]) / 2 || 1);
    const ly = Math.abs(p[1] - cy) / ((ob.max[1] - ob.min[1]) / 2 || 1);
    const lz = Math.abs(p[2] - cz) / ((ob.max[2] - ob.min[2]) / 2 || 1);
    if (lx >= ly && lx >= lz) n = [Math.sign(p[0] - cx) || 1, 0, 0];
    else if (ly >= lz) n = [0, Math.sign(p[1] - cy) || 1, 0];
    else n = [0, 0, Math.sign(p[2] - cz) || 1];
  }
  let mat = ob.mat;
  if (mat.checker && mat.checker > 0) {
    const k = Math.floor(p[0] * mat.checker) + Math.floor(p[2] * mat.checker) + Math.floor(p[1] * mat.checker * 0.5);
    if ((k & 1) === 1) {
      mat = { ...mat, albedo: [mat.albedo[0] * 0.3, mat.albedo[1] * 0.3, mat.albedo[2] * 0.33], checker: 0 };
    }
  }
  const emissive = mat.emissive[0] + mat.emissive[1] + mat.emissive[2] > 0;
  return { t: best, n, mat, p, emissive, objIndex: bi };
}

/** Build an orthonormal basis around n. */
function basis(n: Vec3): [Vec3, Vec3] {
  const a: Vec3 = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const t = norm(cross(a, n));
  const b = cross(n, t);
  return [t, b];
}

function cosineHemisphere(n: Vec3, rand: () => number): Vec3 {
  const u1 = rand(), u2 = rand();
  const r = Math.sqrt(u1);
  const phi = 2 * Math.PI * u2;
  const [tx, ty] = basis(n);
  const s = Math.sqrt(Math.max(0, 1 - u1));
  return norm([
    tx[0] * r * Math.cos(phi) + ty[0] * r * Math.sin(phi) + n[0] * s,
    tx[1] * r * Math.cos(phi) + ty[1] * r * Math.sin(phi) + n[1] * s,
    tx[2] * r * Math.cos(phi) + ty[2] * r * Math.sin(phi) + n[2] * s,
  ]);
}

function skyColor(scene: Scene, d: Vec3): Vec3 {
  // horizon = bottom colour, zenith = top colour; tight exponential falloff
  // gives that thin band of warm light real sunsets have.
  const t = clamp01(d[1]);
  const g = Math.pow(t, 0.42);
  let c: Vec3 = [
    scene.sky.bottom[0] + (scene.sky.top[0] - scene.sky.bottom[0]) * g,
    scene.sky.bottom[1] + (scene.sky.top[1] - scene.sky.bottom[1]) * g,
    scene.sky.bottom[2] + (scene.sky.top[2] - scene.sky.bottom[2]) * g,
  ];
  if (scene.sky.sunPower > 0) {
    const sd = Math.max(0, dot(norm(d), norm(scene.sky.sun)));
    // small but intensely bright disc (energy conserving) + wide atmospheric halo
    const disc = sd > 0.99975 ? scene.sky.sunPower * 3.2 : 0;
    const halo = Math.pow(sd, 18) * scene.sky.sunPower * 0.35 + Math.pow(sd, 3) * 0.12;
    c = [c[0] + disc + halo, c[1] + disc + halo * 0.82, c[2] + disc + halo * 0.55];
  }
  return c;
}

/** Solid-angle sampling of the spherical light, returns direction + pdf. */
function sampleLight(p: Vec3, n: Vec3, light: { c: Vec3; r: number }, rand: () => number) {
  const toC = sub(light.c, p);
  const dist = Math.hypot(toC[0], toC[1], toC[2]);
  if (dist <= light.r * 1.001) return null;
  const w = mul(toC, 1 / dist);
  const sinMax = light.r / dist;
  const cosMax = Math.sqrt(Math.max(0, 1 - sinMax * sinMax));
  const cosT = 1 - rand() * (1 - cosMax);
  const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT));
  const phi = rand() * Math.PI * 2;
  const [tx, ty] = basis(w);
  const dir = norm([
    tx[0] * sinT * Math.cos(phi) + ty[0] * sinT * Math.sin(phi) + w[0] * cosT,
    tx[1] * sinT * Math.cos(phi) + ty[1] * sinT * Math.sin(phi) + w[1] * cosT,
    tx[2] * sinT * Math.cos(phi) + ty[2] * sinT * Math.sin(phi) + w[2] * cosT,
  ]);
  const cosSurface = dot(n, dir);
  if (cosSurface <= 0) return null;
  const pdf = 1 / (2 * Math.PI * Math.max(1e-6, 1 - cosMax));
  // does the ray to this direction actually hit the light? cheaper than sphere cast
  const t = intersectSphere(p, dir, light.c, light.r);
  if (t < 0 || t > dist + light.r * 2) return null;
  return { dir, pdf, cosSurface, dist };
}

function lightEmission(scene: Scene): Vec3 {
  for (const o of scene.objs) {
    const e = o.mat.emissive;
    if (e[0] + e[1] + e[2] > 0) return e;
  }
  return [0, 0, 0];
}

function randomInSphere(rand: () => number): Vec3 {
  const u = rand() * 2 - 1;
  const phi = rand() * Math.PI * 2;
  const r = Math.sqrt(Math.max(0, 1 - u * u));
  return [r * Math.cos(phi), u, r * Math.sin(phi)];
}

function fresnelDielectric(cosI: number, ior: number) {
  const sinT2 = (1 - cosI * cosI) / (ior * ior);
  if (sinT2 >= 1) return 1; // total internal reflection
  const cosT = Math.sqrt(1 - sinT2);
  const rs = (cosI - ior * cosT) / (cosI + ior * cosT);
  const rp = (ior * cosI - cosT) / (ior * cosI + cosT);
  return 0.5 * (rs * rs + rp * rp);
}

/* ------------------------------------------------------------------ *
 * The tracer
 * ------------------------------------------------------------------ */
export function renderTile(opts: RenderOpts): Float32Array {
  const { width, height, rowStart, rowEnd, samplesPerPixel, maxBounces, camera, scene } = opts;
  const rows = rowEnd - rowStart;
  const out = new Float32Array(rows * width * 3);

  const fwd = norm(sub(camera.target, camera.pos));
  const right = norm(cross(fwd, camera.up ?? [0, 1, 0]));
  const up = cross(right, fwd);
  const aspect = width / height;
  const tanF = Math.tan((camera.fov * Math.PI) / 360);
  const px = 1 / width, py = 1 / height;
  const Le = lightEmission(scene);
  const hasLight = !!scene.light && (Le[0] + Le[1] + Le[2] > 0);

  for (let y = rowStart; y < rowEnd; y++) {
    for (let x = 0; x < width; x++) {
      let R = 0, G = 0, B = 0;

      for (let s = 0; s < samplesPerPixel; s++) {
        const si = opts.sampleOffset + s;
        const rand = rng(((y * 73856093) ^ (x * 19349663) ^ (si * 83492791) ^ opts.seed) >>> 0);

        const jx = (x + rand()) * px;
        const jy = (y + rand()) * py;
        const sx = (2 * jx - 1) * aspect * tanF;
        const sy = (1 - 2 * jy) * tanF;
        let dir = norm(add(add(mul(right, sx), mul(up, sy)), fwd));
        let origin = camera.pos;

        if (camera.aperture > 0.0001) {
          const a = rand() * Math.PI * 2;
          const rr = Math.sqrt(rand()) * camera.aperture;
          const focal = add(camera.pos, mul(dir, camera.focus));
          const o2 = add(add(origin, mul(right, Math.cos(a) * rr)), mul(up, Math.sin(a) * rr));
          dir = norm(sub(focal, o2));
          origin = o2;
        }

        let thr: Vec3 = [1, 1, 1];
        let rad: Vec3 = [0, 0, 0];
        let rayO = origin;
        let rayD = dir;
        let lastWasSpecular = true;

        for (let depth = 0; depth < maxBounces; depth++) {
          const h = hitScene(rayO, rayD, scene.objs);
          if (!h) {
            rad = add(rad, mulv(thr, skyColor(scene, rayD)));
            break;
          }

          const { mat, p } = h;
          const cosT = dot(rayD, h.n);
          const frontFace = cosT < 0;
          const ns: Vec3 = frontFace ? h.n : mul(h.n, -1);

          // Emissive surface. If the previous bounce was diffuse we already did
          // NEE toward this light (avoids double counting), otherwise add it.
          if (h.emissive) {
            // Only add emission when the previous vertex could not have sampled it
            // through NEE: the camera vertex, or a specular bounce.
            if (depth === 0) {
              rad = add(rad, mulv(thr, mat.emissive));
            } else if (lastWasSpecular) {
              // specular bounce straight into the light: soft-clamp to keep
              // fireflies from destroying a low-sample image
              const k = 60;
              const e: Vec3 = [
                (mat.emissive[0] * k) / (k + luminance(mat.emissive)),
                (mat.emissive[1] * k) / (k + luminance(mat.emissive)),
                (mat.emissive[2] * k) / (k + luminance(mat.emissive)),
              ];
              rad = add(rad, mulv(thr, e));
            }
            break;
          }

          // ---- next-event estimation (direct light) ----
          if (hasLight && scene.light && (depth === 0 || !lastWasSpecular)) {
            const sl = sampleLight(p, ns, scene.light, rand);
            if (sl) {
              const shadowOrigin = add(p, mul(ns, 2e-4));
              const blocker = hitScene(shadowOrigin, sl.dir, scene.objs);
              if (!blocker || blocker.emissive) {
                const albedo = mat.albedo;
                // Lambertian BRDF: albedo / PI
                const f = mulv(albedo, Le);
                const c = mul(f, sl.cosSurface / (Math.PI * sl.pdf));
                rad = add(rad, mulv(thr, c));
              }
            }
          }

          // ---- BSDF ----
          // Glass
          if (mat.ior > 1.0001 && mat.metal < 0.5) {
            const eta = frontFace ? 1 / mat.ior : mat.ior;
            const cosI = Math.min(1, Math.abs(dot(rayD, ns)));
            const F = fresnelDielectric(cosI, mat.ior);
            if (rand() < F) {
              rayD = norm(reflect(rayD, ns));
              rayO = add(p, mul(ns, 2e-4));
            } else {
              const sinT2 = (1 - cosI * cosI) / (eta * eta);
              if (sinT2 >= 1) {
                rayD = norm(reflect(rayD, ns));
                rayO = add(p, mul(ns, 2e-4));
              } else {
                const cosT2 = Math.sqrt(1 - sinT2);
                const tdir = norm(add(mul(rayD, 1 / eta), mul(ns, cosI / eta - cosT2)));
                rayD = tdir;
                rayO = add(p, mul(rayD, 2e-4));
              }
            }
            thr = mulv(thr, mat.albedo);
            lastWasSpecular = true;
            if (mat.rough > 0.02) {
              const jitter = randomInSphere(rand);
              rayD = norm(add(rayD, mul(jitter, mat.rough * 0.35)));
            }
            continue;
          }

          // Metal
          if (mat.metal > 0.5) {
            const rd = reflect(rayD, ns);
            if (mat.rough > 0.02) {
              const blur = randomInSphere(rand);
              const j = norm(add(rd, mul(blur, mat.rough * mat.rough * 1.4)));
              rayD = dot(j, ns) > 0 ? j : rd;
            } else {
              rayD = rd;
            }
            rayO = add(p, mul(ns, 2e-4));
            thr = mulv(thr, mat.albedo);
            lastWasSpecular = true;
            continue;
          }

          // Diffuse
          rayD = cosineHemisphere(ns, rand);
          rayO = add(p, mul(ns, 2e-4));
          thr = mulv(thr, mat.albedo);
          lastWasSpecular = false;

          // Russian roulette
          if (depth > 2) {
            const q = clamp01(luminance(thr) * 1.6);
            if (q < 0.05) break;
            if (rand() > q) break;
            thr = mul(thr, 1 / q);
          }
        }

        R += rad[0]; G += rad[1]; B += rad[2];
      }

      // NOTE: this is a SUM, not an average — accumulation across passes is
      // additive and tonemap() divides by the total sample count once.
      const o = ((y - rowStart) * width + x) * 3;
      out[o] = R;
      out[o + 1] = G;
      out[o + 2] = B;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Post: tone mapping + denoise
 * ------------------------------------------------------------------ */
export function tonemap(accum: Float32Array, count: number, exposure: number, gamma = 2.2) {
  const n = accum.length / 3;
  const out = new Uint8ClampedArray(n * 4);
  const inv = exposure / Math.max(1, count);
  for (let i = 0; i < n; i++) {
    const r = aces(accum[i * 3] * inv);
    const g = aces(accum[i * 3 + 1] * inv);
    const b = aces(accum[i * 3 + 2] * inv);
    out[i * 4] = Math.pow(r, 1 / gamma) * 255;
    out[i * 4 + 1] = Math.pow(g, 1 / gamma) * 255;
    out[i * 4 + 2] = Math.pow(b, 1 / gamma) * 255;
    out[i * 4 + 3] = 255;
  }
  return out;
}

function aces(x: number) {
  const a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp01((x * (a * x + b)) / (x * (c * x + d) + e));
}

/** Edge-aware bilateral filter: removes stochastic fireflies, keeps edges. */
export function denoise(img: Uint8ClampedArray, w: number, h: number, strength = 0.55) {
  const src = new Uint8ClampedArray(img);
  const lum = (i: number) => 0.299 * src[i * 4] + 0.587 * src[i * 4 + 1] + 0.114 * src[i * 4 + 2];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const l0 = lum(i);
      let r = 0, g = 0, b = 0, ws = 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const j = i + oy * w + ox;
          const dl = lum(j) - l0;
          const wgt = Math.exp(-(dl * dl) / (2 * 26 * 26)) * (ox === 0 && oy === 0 ? 1.7 : 1);
          r += src[j * 4] * wgt; g += src[j * 4 + 1] * wgt; b += src[j * 4 + 2] * wgt; ws += wgt;
        }
      }
      img[i * 4] = src[i * 4] * (1 - strength) + (r / ws) * strength;
      img[i * 4 + 1] = src[i * 4 + 1] * (1 - strength) + (g / ws) * strength;
      img[i * 4 + 2] = src[i * 4 + 2] * (1 - strength) + (b / ws) * strength;
    }
  }
  return img;
}
