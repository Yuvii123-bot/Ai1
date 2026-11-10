/**
 * STORM — incompressible Navier–Stokes on a staggered-in-time Eulerian grid.
 *
 * Implemented from the classic "Stable Fluids" scheme (Stam 1999) plus:
 *   · semi-Lagrangian advection with bilinear sampling
 *   · Jacobi pressure projection (incompressibility)
 *   · vorticity confinement (re-injects the swirl numerical diffusion eats)
 *   · buoyancy from a temperature field
 *   · solid obstacle masks with velocity clamping
 *
 * All fields are stored as flat Float32Arrays for cache-friendly access.
 */

export class FluidSolver {
  w: number;
  h: number;
  u: Float32Array;
  v: Float32Array;
  u0: Float32Array;
  v0: Float32Array;
  dye: Float32Array;
  dye0: Float32Array;
  temp: Float32Array;
  temp0: Float32Array;
  curl: Float32Array;
  pressure: Float32Array;
  div: Float32Array;
  solid: Uint8Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    const n = w * h;
    this.u = new Float32Array(n);
    this.v = new Float32Array(n);
    this.u0 = new Float32Array(n);
    this.v0 = new Float32Array(n);
    this.dye = new Float32Array(n * 3);
    this.dye0 = new Float32Array(n * 3);
    this.temp = new Float32Array(n);
    this.temp0 = new Float32Array(n);
    this.curl = new Float32Array(n);
    this.pressure = new Float32Array(n);
    this.div = new Float32Array(n);
    this.solid = new Uint8Array(n);
  }

  idx(x: number, y: number) {
    return y * this.w + x;
  }

  /** Bilinear sample of a scalar field at fractional grid position. */
  sample(field: Float32Array, x: number, y: number) {
    const { w, h } = this;
    x = Math.max(0.5, Math.min(w - 1.5, x));
    y = Math.max(0.5, Math.min(h - 1.5, y));
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const x1 = x0 + 1, y1 = y0 + 1;
    const sx = x - x0, sy = y - y0;
    const i00 = y0 * w + x0, i10 = y0 * w + x1, i01 = y1 * w + x0, i11 = y1 * w + x1;
    const a = field[i00] * (1 - sx) + field[i10] * sx;
    const b = field[i01] * (1 - sx) + field[i11] * sx;
    return a * (1 - sy) + b * sy;
  }

  /** Semi-Lagrangian advection of velocity and dye. */
  advect(dt: number) {
    const { w, h, u, v, u0, v0, dye, dye0, temp, temp0, solid } = this;
    u0.set(u);
    v0.set(v);
    dye0.set(dye);
    temp0.set(temp);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (solid[i]) { u[i] = 0; v[i] = 0; continue; }
        const px = x - u0[i] * dt;
        const py = y - v0[i] * dt;
        u[i] = this.sample(u0, px, py);
        v[i] = this.sample(v0, px, py);
        dye[i * 3] = this.sampleChannel(dye0, px, py, 0);
        dye[i * 3 + 1] = this.sampleChannel(dye0, px, py, 1);
        dye[i * 3 + 2] = this.sampleChannel(dye0, px, py, 2);
        temp[i] = this.sample(temp0, px, py);
      }
    }
  }

  sampleChannel(field: Float32Array, x: number, y: number, ch: number) {
    const { w, h } = this;
    x = Math.max(0.5, Math.min(w - 1.5, x));
    y = Math.max(0.5, Math.min(h - 1.5, y));
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const x1 = x0 + 1, y1 = y0 + 1;
    const sx = x - x0, sy = y - y0;
    const a = field[(y0 * w + x0) * 3 + ch] * (1 - sx) + field[(y0 * w + x1) * 3 + ch] * sx;
    const b = field[(y1 * w + x0) * 3 + ch] * (1 - sx) + field[(y1 * w + x1) * 3 + ch] * sx;
    return a * (1 - sy) + b * sy;
  }

  addForces(dt: number, buoyancy: number, gravity: number) {
    const { w, h, u, v, temp } = this;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const t = temp[i];
        v[i] += (t * buoyancy - gravity) * dt;
        v[i] *= 0.999;
        u[i] *= 0.999;
      }
    }
  }

  /** Compute curl (scalar z-component of vorticity). */
  computeCurl() {
    const { w, h, u, v, curl } = this;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        curl[i] = (v[i + 1] - v[i - 1] - (u[i + w] - u[i - w])) * 0.5;
      }
    }
  }

  /** Vorticity confinement: adds artificial force that keeps eddies alive. */
  vorticityConfinement(dt: number, eps: number) {
    if (eps <= 0) return;
    const { w, h, u, v, curl } = this;
    this.computeCurl();
    for (let y = 2; y < h - 2; y++) {
      for (let x = 2; x < w - 2; x++) {
        const i = y * w + x;
        let dx = (Math.abs(curl[i + 1]) - Math.abs(curl[i - 1])) * 0.5;
        let dy = (Math.abs(curl[i + w]) - Math.abs(curl[i - w])) * 0.5;
        const len = Math.hypot(dx, dy) + 1e-5;
        dx /= len; dy /= len;
        const c = curl[i];
        u[i] += eps * dt * dy * c;
        v[i] += eps * dt * -dx * c;
      }
    }
  }

  project(iterations: number) {
    const { w, h, u, v, pressure, div, solid } = this;
    const inv = 1 / 1; // grid spacing = 1
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        div[i] = -0.5 * inv * (u[i + 1] - u[i - 1] + v[i + w] - v[i - w]);
        pressure[i] = 0;
      }
    }
    for (let k = 0; k < iterations; k++) {
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (solid[i]) continue;
          pressure[i] = (div[i] + pressure[i - 1] + pressure[i + 1] + pressure[i - w] + pressure[i + w]) * 0.25;
        }
      }
    }
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (solid[i]) continue;
        u[i] -= 0.5 * (pressure[i + 1] - pressure[i - 1]);
        v[i] -= 0.5 * (pressure[i + w] - pressure[i - w]);
      }
    }
    // zero velocity inside solids + at borders
    for (let i = 0; i < w * h; i++) if (solid[i]) { u[i] = 0; v[i] = 0; }
    for (let x = 0; x < w; x++) { u[x] = 0; v[x] = 0; u[(h - 1) * w + x] = 0; v[(h - 1) * w + x] = 0; }
    for (let y = 0; y < h; y++) { u[y * w] = 0; v[y * w] = 0; u[y * w + w - 1] = 0; v[y * w + w - 1] = 0; }
  }

  diffuseDye(dt: number, amount: number) {
    if (amount <= 0) return;
    const { w, h, dye, dye0 } = this;
    dye0.set(dye);
    const a = Math.min(0.24, amount * dt);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        for (let c = 0; c < 3; c++) {
          const k = i * 3 + c;
          dye[k] = dye0[k] + a * (dye0[(i + 1) * 3 + c] + dye0[(i - 1) * 3 + c] + dye0[(i + w) * 3 + c] + dye0[(i - w) * 3 + c] - 4 * dye0[k]);
        }
      }
    }
  }

  /** Add a radial velocity + dye splat. */
  splat(gx: number, gy: number, radius: number, fx: number, fy: number, color: [number, number, number], heat = 0) {
    const { w, h, u, v, dye, temp, solid } = this;
    const r = Math.ceil(radius);
    const x0 = Math.max(1, Math.floor(gx - r));
    const x1 = Math.min(w - 2, Math.ceil(gx + r));
    const y0 = Math.max(1, Math.floor(gy - r));
    const y1 = Math.min(h - 2, Math.ceil(gy + r));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * w + x;
        if (solid[i]) continue;
        const dx = x - gx, dy = y - gy;
        const d2 = dx * dx + dy * dy;
        if (d2 > radius * radius) continue;
        const f = Math.exp(-d2 / (radius * radius * 0.35));
        u[i] += fx * f;
        v[i] += fy * f;
        dye[i * 3] += color[0] * f;
        dye[i * 3 + 1] += color[1] * f;
        dye[i * 3 + 2] += color[2] * f;
        temp[i] = Math.min(2.2, temp[i] + heat * f);
      }
    }
  }

  step(dt: number, opts: { pressureIters: number; vorticity: number; dyeDiffusion: number; buoyancy: number; cooling: number }) {
    this.advect(dt);
    this.addForces(dt, opts.buoyancy, 0);
    this.vorticityConfinement(dt, opts.vorticity);
    this.project(opts.pressureIters);
    this.diffuseDye(dt, opts.dyeDiffusion);
    if (opts.cooling > 0) {
      const k = Math.min(1, opts.cooling * dt);
      for (let i = 0; i < this.temp.length; i++) this.temp[i] *= 1 - k;
    }
  }

  clear() {
    this.u.fill(0); this.v.fill(0); this.dye.fill(0); this.temp.fill(0);
  }

  setObstacleCircle(cx: number, cy: number, r: number) {
    const { w, h, solid } = this;
    solid.fill(0);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy < r * r) solid[y * w + x] = 1;
      }
    }
  }

  /** Kinetic energy — used for the live readout. */
  energy() {
    let e = 0;
    for (let i = 0; i < this.u.length; i++) e += this.u[i] * this.u[i] + this.v[i] * this.v[i];
    return e / this.u.length;
  }
}

/** Colour helpers for the dye palette. */
export function paletteColor(t: number): [number, number, number] {
  const stops: [number, number, number][] = [
    [0.15, 0.35, 1.0],
    [0.3, 0.9, 1.0],
    [0.75, 1.0, 0.6],
    [1.0, 0.75, 0.25],
    [1.0, 0.3, 0.45],
  ];
  const x = Math.max(0, Math.min(0.999, t)) * (stops.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = stops[i], b = stops[Math.min(stops.length - 1, i + 1)];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
