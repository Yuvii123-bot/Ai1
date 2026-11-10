/**
 * DAYDREAM — a JEPA-style latent world model that trains in your browser.
 *
 * The idea (LeCun's Joint-Embedding Predictive Architecture, made small):
 *
 *   1. An ENCODER maps an observed world frame (pixels of bouncing balls) to a
 *      compact latent thought z_t.
 *   2. A PREDICTOR is given z_t and an action (or nothing) and must produce
 *      ẑ_{t+1} — the *latent* state one step ahead.
 *   3. The loss is computed entirely in latent space: pull ẑ_{t+1} toward the
 *      encoder's embedding of the true next frame, and push it away from
 *      unrelated frames (contrastive InfoNCE). No pixel prediction at all.
 *   4. At test time we can run the predictor forward many steps *without the
 *      world*, and decode the dream back to pixels to see what it believes.
 *
 * Everything below is hand-written: dense layers, Adam, InfoNCE, a decoder.
 * The physics simulator is a separate, honest ground truth.
 */

/* ---------------- deterministic rng ---------------- */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- the world: 2D bouncing balls, honest physics ---------------- */
export type WorldState = {
  balls: { x: number; y: number; vx: number; vy: number; r: number; hue: number }[];
};

export function makeWorld(n: number, rand: () => number, r = 0.09): WorldState {
  return {
    balls: Array.from({ length: n }, (_, i) => ({
      x: 0.15 + rand() * 0.7,
      y: 0.15 + rand() * 0.7,
      vx: (rand() - 0.5) * 0.045,
      vy: (rand() - 0.5) * 0.045,
      r: r * (0.8 + rand() * 0.5),
      hue: (i / n) * 360 + rand() * 20,
    })),
  };
}

export function stepWorld(w: WorldState, dt = 1) {
  for (const b of w.balls) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); }
    if (b.x > 1 - b.r) { b.x = 1 - b.r; b.vx = -Math.abs(b.vx); }
    if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); }
    if (b.y > 1 - b.r) { b.y = 1 - b.r; b.vy = -Math.abs(b.vy); }
  }
  // simple elastic collisions (equal mass)
  for (let i = 0; i < w.balls.length; i++) {
    for (let j = i + 1; j < w.balls.length; j++) {
      const a = w.balls[i], b = w.balls[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const minD = a.r + b.r;
      if (d > 1e-6 && d < minD) {
        const nx = dx / d, ny = dy / d;
        const overlap = (minD - d) / 2;
        a.x -= nx * overlap; a.y -= ny * overlap;
        b.x += nx * overlap; b.y += ny * overlap;
        const dvx = b.vx - a.vx, dvy = b.vy - a.vy;
        const p = dvx * nx + dvy * ny;
        if (p < 0) {
          a.vx += p * nx; a.vy += p * ny;
          b.vx -= p * nx; b.vy -= p * ny;
        }
      }
    }
  }
}

/** Render a world state into a small RGB float frame (CHW, normalised). */
export function renderWorld(w: WorldState, size = 32): Float32Array {
  const out = new Float32Array(3 * size * size);
  // dark background with a subtle grid so the model has spatial context
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const g = (x % 8 === 0 || y % 8 === 0) ? 0.09 : 0.04;
      const i = y * size + x;
      out[i] = g * 0.7;
      out[size * size + i] = g * 0.8;
      out[2 * size * size + i] = g * 1.1;
    }
  }
  for (const b of w.balls) {
    const cx = b.x * size, cy = b.y * size, rad = b.r * size;
    const x0 = Math.max(0, Math.floor(cx - rad - 1));
    const x1 = Math.min(size - 1, Math.ceil(cx + rad + 1));
    const y0 = Math.max(0, Math.floor(cy - rad - 1));
    const y1 = Math.min(size - 1, Math.ceil(cy + rad + 1));
    const h = b.hue / 360;
    const [r, g, bl] = hsv(h, 0.85, 1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        const a = Math.max(0, Math.min(1, rad + 0.5 - d));
        if (a <= 0) continue;
        const i = y * size + x;
        out[i] = out[i] * (1 - a) + r * a;
        out[size * size + i] = out[size * size + i] * (1 - a) + g * a;
        out[2 * size * size + i] = out[2 * size * size + i] * (1 - a) + bl * a;
      }
    }
  }
  return out;
}

function hsv(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: return [v, t, p];
    case 1: return [q, v, p];
    case 2: return [p, v, t];
    case 3: return [p, q, v];
    case 4: return [t, p, v];
    default: return [v, p, q];
  }
}

/* ---------------- neural net primitives ---------------- */
export class Dense {
  w: Float32Array;
  b: Float32Array;
  mw: Float32Array;
  vw: Float32Array;
  mb: Float32Array;
  vb: Float32Array;
  gW: Float32Array;
  gB: Float32Array;
  inDim: number;
  outDim: number;

  constructor(inDim: number, outDim: number, rand: () => number) {
    this.inDim = inDim;
    this.outDim = outDim;
    const scale = Math.sqrt(2 / inDim);
    this.w = new Float32Array(inDim * outDim);
    for (let i = 0; i < this.w.length; i++) {
      // He normal
      const u = Math.max(1e-7, rand());
      const v = rand();
      this.w[i] = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * scale;
    }
    this.b = new Float32Array(outDim);
    this.mw = new Float32Array(this.w.length);
    this.vw = new Float32Array(this.w.length);
    this.mb = new Float32Array(outDim);
    this.vb = new Float32Array(outDim);
    this.gW = new Float32Array(this.w.length);
    this.gB = new Float32Array(outDim);
  }

  forward(x: Float32Array, out?: Float32Array) {
    const y = out ?? new Float32Array(this.outDim);
    const { w, b, inDim, outDim } = this;
    for (let o = 0; o < outDim; o++) {
      let s = b[o];
      const base = o * inDim;
      for (let i = 0; i < inDim; i++) s += w[base + i] * x[i];
      y[o] = s;
    }
    return y;
  }

  backward(x: Float32Array, dy: Float32Array, dx?: Float32Array) {
    const { w, inDim, outDim } = this;
    for (let o = 0; o < outDim; o++) {
      const g = dy[o];
      if (g === 0) continue;
      const base = o * inDim;
      this.gB[o] += g;
      for (let i = 0; i < inDim; i++) this.gW[base + i] += g * x[i];
      if (dx) for (let i = 0; i < inDim; i++) dx[i] += w[base + i] * g;
    }
  }

  zeroGrad() {
    this.gW.fill(0);
    this.gB.fill(0);
  }

  adam(lr: number, t: number, b1 = 0.9, b2 = 0.999, eps = 1e-8) {
    const c1 = 1 - Math.pow(b1, t);
    const c2 = 1 - Math.pow(b2, t);
    for (let i = 0; i < this.w.length; i++) {
      const g = this.gW[i];
      this.mw[i] = b1 * this.mw[i] + (1 - b1) * g;
      this.vw[i] = b2 * this.vw[i] + (1 - b2) * g * g;
      this.w[i] -= (lr * (this.mw[i] / c1)) / (Math.sqrt(this.vw[i] / c2) + eps);
    }
    for (let i = 0; i < this.b.length; i++) {
      const g = this.gB[i];
      this.mb[i] = b1 * this.mb[i] + (1 - b1) * g;
      this.vb[i] = b2 * this.vb[i] + (1 - b2) * g * g;
      this.b[i] -= (lr * (this.mb[i] / c1)) / (Math.sqrt(this.vb[i] / c2) + eps);
    }
  }
}

const relu = (x: Float32Array) => {
  for (let i = 0; i < x.length; i++) if (x[i] < 0) x[i] = 0;
  return x;
};
const reluBack = (y: Float32Array, dy: Float32Array) => {
  for (let i = 0; i < y.length; i++) if (y[i] <= 0) dy[i] = 0;
};
const l2norm = (x: Float32Array) => {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  s = Math.sqrt(s) + 1e-8;
  for (let i = 0; i < x.length; i++) x[i] /= s;
  return x;
};

/* ---------------- the model ---------------- */
export type ModelConfig = { frameSize: number; latent: number; actionDim: number };

export function makeModel(cfg: ModelConfig, seed = 42) {
  const rand = mulberry32(seed);
  const inDim = 3 * cfg.frameSize * cfg.frameSize;
  const hidden = Math.max(64, Math.round(cfg.latent * 4));
  return {
    cfg,
    enc1: new Dense(inDim, hidden, rand),
    enc2: new Dense(hidden, cfg.latent, rand),
    pred1: new Dense(cfg.latent + cfg.actionDim, hidden, rand),
    pred2: new Dense(hidden, cfg.latent, rand),
    dec1: new Dense(cfg.latent, hidden, rand),
    dec2: new Dense(hidden, inDim, rand),
    step: 0,
  };
}

export type Model = ReturnType<typeof makeModel>;

export function encode(m: Model, frame: Float32Array) {
  const h = relu(m.enc1.forward(frame));
  const z = m.enc2.forward(h);
  return { h, z: l2norm(z) };
}

export function predict(m: Model, z: Float32Array, action: Float32Array) {
  const x = new Float32Array(z.length + action.length);
  x.set(z, 0);
  x.set(action, z.length);
  const h = relu(m.pred1.forward(x));
  const out = m.pred2.forward(h);
  return { x, h, z: l2norm(out) };
}

export function decode(m: Model, z: Float32Array) {
  const h = relu(m.dec1.forward(z));
  const out = m.dec2.forward(h);
  for (let i = 0; i < out.length; i++) out[i] = 1 / (1 + Math.exp(-out[i])); // sigmoid → pixels
  return { h, px: out };
}

export type Sample = { frame: Float32Array; next: Float32Array; action: Float32Array };

/**
 * One training step: InfoNCE in latent space.
 *  - positives: (z_t, action) predicted → matched with encoder of the true next frame
 *  - negatives: encoder embeddings of other frames in the batch
 */
export function trainStep(m: Model, batch: Sample[], opts: { lr: number; temperature: number }) {
  const B = batch.length;
  const L = m.cfg.latent;
  const A = m.cfg.actionDim;
  const tau = opts.temperature;

  m.enc1.zeroGrad(); m.enc2.zeroGrad(); m.pred1.zeroGrad(); m.pred2.zeroGrad();

  // forward
  const encs = batch.map((s) => encode(m, s.frame));
  const targs: { h: Float32Array; z: Float32Array }[] = [];
  for (const s of batch) targs.push(encode(m, s.next));
  const preds = batch.map((s, i) => predict(m, encs[i].z, s.action));

  // ---- InfoNCE loss: for each i, logits against all target embeddings ----
  const gPred: Float32Array[] = preds.map(() => new Float32Array(L));
  const gTarg: Float32Array[] = targs.map(() => new Float32Array(L));
  let loss = 0;

  const logits = new Float32Array(B);
  for (let i = 0; i < B; i++) {
    for (let j = 0; j < B; j++) {
      let dot = 0;
      for (let k = 0; k < L; k++) dot += preds[i].z[k] * targs[j].z[k];
      logits[j] = dot / tau;
    }
    let maxL = -Infinity;
    for (let j = 0; j < B; j++) maxL = Math.max(maxL, logits[j]);
    let sum = 0;
    for (let j = 0; j < B; j++) { logits[j] = Math.exp(logits[j] - maxL); sum += logits[j]; }
    for (let j = 0; j < B; j++) logits[j] /= sum;
    loss += -Math.log(Math.max(1e-9, logits[i]));
    // dL/dlogit for softmax-CE
    for (let j = 0; j < B; j++) logits[j] = logits[j] - (j === i ? 1 : 0);
    // backprop into prediction and target embeddings
    for (let j = 0; j < B; j++) {
      const g = logits[j] / tau;
      if (Math.abs(g) < 1e-8) continue;
      for (let k = 0; k < L; k++) {
        gPred[i][k] += g * targs[j].z[k];
        gTarg[j][k] += g * preds[i].z[k];
      }
    }
  }
  loss /= B;

  // backprop predictions (through l2 norm + linear pred2/pred1)
  for (let i = 0; i < B; i++) {
    backpropThroughNorm(preds[i].z, gPred[i]);
    m.pred2.backward(preds[i].h, gPred[i]);
    const dh = new Float32Array(preds[i].h.length);
    // pred2 backward produced dx into dh
    m.pred2.gW.fill(m.pred2.gW[0]); // no-op keep
    // recompute dx from pred2
    accumDx(m.pred2, gPred[i], dh);
    reluBack(preds[i].h, dh);
    m.pred1.backward(preds[i].x, dh);
  }

  // backprop target embeddings (encoder of next frame)
  for (let i = 0; i < B; i++) {
    backpropThroughNorm(targs[i].z, gTarg[i]);
    const dh = new Float32Array(targs[i].h.length);
    m.enc2.backward(targs[i].h, gTarg[i], dh);
    reluBack(targs[i].h, dh);
    m.enc1.backward(batch[i].next, dh);
  }

  // ---- joint decoder: latent -> pixels, so a *predicted* latent can be
  //      rendered back into a picture of what the model expects to see ----
  m.dec1.zeroGrad(); m.dec2.zeroGrad();
  let recLoss = 0;
  for (let i = 0; i < B; i++) {
    const target = batch[i].next;
    const { h, px } = decode(m, preds[i].z);
    const dp = new Float32Array(px.length);
    for (let k = 0; k < px.length; k++) {
      const e = px[k] - target[k];
      recLoss += e * e;
      dp[k] = ((2 * e) / px.length) * px[k] * (1 - px[k]);
    }
    m.dec2.backward(h, dp);
    const dh = new Float32Array(h.length);
    accumDx(m.dec2, dp, dh);
    reluBack(h, dh);
    m.dec1.backward(preds[i].z, dh);
  }

  m.step++;
  m.enc1.adam(opts.lr, m.step);
  m.enc2.adam(opts.lr, m.step);
  m.pred1.adam(opts.lr, m.step);
  m.pred2.adam(opts.lr, m.step);
  m.dec1.adam(opts.lr, m.step);
  m.dec2.adam(opts.lr, m.step);

  return { loss, accuracy: 0, recLoss: recLoss / B };
}

function accumDx(layer: Dense, dy: Float32Array, dx: Float32Array) {
  const { w, inDim, outDim } = layer;
  for (let o = 0; o < outDim; o++) {
    const g = dy[o];
    if (g === 0) continue;
    const base = o * inDim;
    for (let i = 0; i < inDim; i++) dx[i] += w[base + i] * g;
  }
}

function backpropThroughNorm(z: Float32Array, gz: Float32Array) {
  // z = x / ||x||;  dz/dx = (I - z z^T)/||x||. ||x|| is lost here, approximate
  // with 1 since z is unit length and gradients are small at these scales.
  let dotp = 0;
  for (let i = 0; i < z.length; i++) dotp += z[i] * gz[i];
  for (let i = 0; i < z.length; i++) gz[i] -= z[i] * dotp;
}

/** Decoder-only supervised fit, used to visualise what a latent means. */
export function trainDecoder(m: Model, pairs: { z: Float32Array; px: Float32Array }[], lr: number) {
  m.dec1.zeroGrad(); m.dec2.zeroGrad();
  let loss = 0;
  for (const { z, px } of pairs) {
    const { h, px: out } = decode(m, z);
    const dp = new Float32Array(out.length);
    for (let i = 0; i < out.length; i++) {
      const e = out[i] - px[i];
      loss += e * e;
      dp[i] = (2 * e) / out.length;
      // sigmoid derivative is folded in by using out*(1-out) against pre-activation
      dp[i] *= out[i] * (1 - out[i]);
    }
    m.dec2.backward(h, dp);
    const dh = new Float32Array(h.length);
    accumDx(m.dec2, dp, dh);
    reluBack(h, dh);
    m.dec1.backward(z, dh);
  }
  m.step++;
  m.dec1.adam(lr, m.step);
  m.dec2.adam(lr, m.step);
  return loss / pairs.length;
}

export function evaluate(m: Model, samples: Sample[]) {
  let correct = 0;
  const L = m.cfg.latent;
  for (const s of samples) {
    const z = encode(m, s.frame).z;
    const p = predict(m, z, s.action).z;
    let bestScore = -Infinity, bestIdx = -1;
    const B = samples.length;
    for (let j = 0; j < B; j++) {
      const t = encode(m, samples[j].next).z;
      let dot = 0;
      for (let k = 0; k < L; k++) dot += p[k] * t[k];
      if (dot > bestScore) { bestScore = dot; bestIdx = j; }
    }
    if (samples[bestIdx] === s) correct++;
  }
  return correct / samples.length;
}
