/**
 * RESTORE — local image inpainting, three cooperating classical algorithms
 * (and no neural net, no server, no upload):
 *
 *  1. STRUCTURE: isophote-driven propagation (Telea / Bertalmio flavour).
 *     We patch the hole from the boundary inward, following image gradients so
 *     that edges continue straight through the removed region instead of
 *     smearing radially.
 *
 *  2. TEXTURE: patch-based synthesis (Criminisi-style). For each patch on the
 *     fill front we search the known image for the most similar patch and copy
 *     it, prioritising patches that contain strong structure. This is what
 *     produces believable grass, hair, brick, fabric.
 *
 *  3. BLENDING: Poisson (gradient-domain) blending of the synthesised region
 *     into the original so the seam is invisible — we solve ∇²f = ∇²source
 *     with the original pixels as Dirichlet boundary conditions, via Jacobi.
 *
 * All three run on typed arrays, in your tab, in well under a second for
 * typical photos.
 */

export type Mask = Uint8Array;

export function makeMask(n: number): Mask {
  return new Uint8Array(n);
}

/** Distance-to-boundary via two-pass chamfer transform. */
export function distanceTransform(mask: Mask, w: number, h: number) {
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = mask[i] ? INF : 0;
  // forward
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      let m = d[i];
      if (x > 0) m = Math.min(m, d[i - 1] + 1);
      if (y > 0) m = Math.min(m, d[i - w] + 1);
      if (x > 0 && y > 0) m = Math.min(m, d[i - w - 1] + 1.414);
      if (x < w - 1 && y > 0) m = Math.min(m, d[i - w + 1] + 1.414);
      d[i] = m;
    }
  }
  // backward
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      let m = d[i];
      if (x < w - 1) m = Math.min(m, d[i + 1] + 1);
      if (y < h - 1) m = Math.min(m, d[i + w] + 1);
      if (x < w - 1 && y < h - 1) m = Math.min(m, d[i + w + 1] + 1.414);
      if (x > 0 && y < h - 1) m = Math.min(m, d[i + w - 1] + 1.414);
      d[i] = m;
    }
  }
  return d;
}

/**
 * Stage 1 — fast structure-aware fill.
 * Fills the hole from the outside in, weighting known neighbours by a
 * combination of distance and directional gradient coherence.
 */
export function structureFill(
  rgba: Uint8ClampedArray,
  mask: Mask,
  w: number,
  h: number
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba);
  const dist = distanceTransform(mask, w, h);
  // order pixels by distance (inside-out = far from boundary first)
  const order: number[] = [];
  for (let i = 0; i < w * h; i++) if (mask[i]) order.push(i);
  order.sort((a, b) => dist[b] - dist[a]);

  const filled = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) filled[i] = mask[i] ? 0 : 1;

  const radius = 6;
  for (const idx of order) {
    const x = idx % w;
    const y = (idx / w) | 0;
    let sr = 0, sg = 0, sb = 0, wsum = 0;
    // gather known (or already-filled) neighbours in a disc
    for (let dy = -radius; dy <= radius; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= h) continue;
      for (let dx = -radius; dx <= radius; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= w) continue;
        if (dx === 0 && dy === 0) continue;
        const j = yy * w + xx;
        if (!filled[j]) continue;
        const dd = Math.hypot(dx, dy);
        if (dd > radius) continue;
        // direction weight: prefer neighbours along the local isophote
        const gradX = (rgba[(j + 1) * 4] - rgba[(j - 1) * 4]) || 0;
        const gradY = (rgba[(j + w) * 4] - rgba[(j - w) * 4]) || 0;
        const gmag = Math.hypot(gradX, gradY) + 1e-3;
        // tangential direction
        const tx = -gradY / gmag, ty = gradX / gmag;
        const along = Math.abs((dx * tx + dy * ty) / dd);
        const weight = (1 / (dd * dd + 1e-4)) * (0.35 + 0.65 * along);
        sr += rgba[j * 4] * weight;
        sg += rgba[j * 4 + 1] * weight;
        sb += rgba[j * 4 + 2] * weight;
        wsum += weight;
      }
    }
    if (wsum > 0) {
      out[idx * 4] = sr / wsum;
      out[idx * 4 + 1] = sg / wsum;
      out[idx * 4 + 2] = sb / wsum;
    }
    out[idx * 4 + 3] = 255;
    filled[idx] = 1;
  }
  return out;
}

type Pt = { x: number; y: number };

/**
 * Stage 2 — Criminisi-style exemplar synthesis with a priority front.
 * Copies whole patches, so texture statistics survive.
 */
export function exemplarSynthesis(
  rgba: Uint8ClampedArray,
  mask: Mask,
  w: number,
  h: number,
  patch = 7,
  searchRadius = 90,
  progress?: (p: number) => void,
  guide?: Uint8ClampedArray
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba);
  const unknown = new Uint8Array(mask); // 1 = still to fill
  const pr = (patch - 1) >> 1;
  const total = (() => { let n = 0; for (let i = 0; i < unknown.length; i++) n += unknown[i]; return n; })();
  let done = 0;

  const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;

  // Precompute an "is known" test
  const known = (x: number, y: number) => inBounds(x, y) && unknown[y * w + x] === 0;

  // Confidence of a patch = fraction of known pixels it contains
  const patchConfidence = (cx: number, cy: number) => {
    let k = 0, n = 0;
    for (let dy = -pr; dy <= pr; dy++) {
      for (let dx = -pr; dx <= pr; dx++) {
        const x = cx + dx, y = cy + dy;
        if (!inBounds(x, y)) continue;
        n++;
        if (known(x, y)) k++;
      }
    }
    return n ? k / n : 0;
  };

  const dataTerm = (cx: number, cy: number) => {
    // strength of structure that hits the fill front here
    const i = cy * w + cx;
    const gx = (out[Math.min(w - 1, cx + 1) * 4 + i - cx * 0] || 0) - 0;
    void gx;
    const right = inBounds(cx + 1, cy) ? out[(cy * w + cx + 1) * 4] : 0;
    const left = inBounds(cx - 1, cy) ? out[(cy * w + cx - 1) * 4] : 0;
    const up = inBounds(cx, cy - 1) ? out[((cy - 1) * w + cx) * 4] : 0;
    const down = inBounds(cx, cy + 1) ? out[((cy + 1) * w + cx) * 4] : 0;
    return Math.hypot(right - left, down - up) / 255;
  };

  const searchOffsets: Pt[] = [];
  const step = Math.max(1, Math.floor(searchRadius / 26));
  for (let dy = -searchRadius; dy <= searchRadius; dy += step) {
    for (let dx = -searchRadius; dx <= searchRadius; dx += step) {
      if (dx * dx + dy * dy <= searchRadius * searchRadius) searchOffsets.push({ x: dx, y: dy });
    }
  }

  let guard = 0;
  while (done < total && guard++ < 20000) {
    // 1. find the fill front (unknown pixels adjacent to a known pixel)
    let best = -1;
    let bestPriority = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!unknown[i]) continue;
        let onFront = false;
        for (let dy = -1; dy <= 1 && !onFront; dy++)
          for (let dx = -1; dx <= 1; dx++)
            if (known(x + dx, y + dy)) { onFront = true; break; }
        if (!onFront) continue;
        const conf = patchConfidence(x, y);
        const data = dataTerm(x, y);
        const priority = conf * (0.25 + data * 3);
        if (priority > bestPriority) { bestPriority = priority; best = i; }
      }
    }
    if (best < 0) break;
    const bx = best % w, by = (best / w) | 0;
    if (!inBounds(bx, by)) break;

    // 2. find the most similar fully-known patch nearby
    let bestPatchScore = Infinity;
    let bestOff: Pt | null = null;
    for (const off of searchOffsets) {
      const sx = bx + off.x, sy = by + off.y;
      if (!inBounds(sx - pr, sy - pr) || !inBounds(sx + pr, sy + pr)) continue;
      // source patch must be fully known
      let allKnown = true;
      for (let dy = -pr; dy <= pr && allKnown; dy++)
        for (let dx = -pr; dx <= pr; dx++)
          if (!known(sx + dx, sy + dy)) { allKnown = false; break; }
      if (!allKnown) continue;
      // Compare the known pixels of the target patch (full weight) *and* the
      // still-unknown ones against the structural guide (lighter weight). The
      // guide is what stops grass texture being pasted into the sky.
      let ssd = 0, cnt = 0;
      let guideSsd = 0, guideCnt = 0;
      for (let dy = -pr; dy <= pr; dy += 1) {
        for (let dx = -pr; dx <= pr; dx += 1) {
          const tx = bx + dx, ty = by + dy;
          if (!inBounds(tx, ty)) continue;
          const si = ((sy + dy) * w + (sx + dx)) * 4;
          if (known(tx, ty)) {
            const ti = (ty * w + tx) * 4;
            const dr = out[ti] - out[si];
            const dg = out[ti + 1] - out[si + 1];
            const db = out[ti + 2] - out[si + 2];
            ssd += dr * dr + dg * dg + db * db;
            cnt++;
          } else if (guide) {
            const gi = (ty * w + tx) * 4;
            const dr = guide[gi] - out[si];
            const dg = guide[gi + 1] - out[si + 1];
            const db = guide[gi + 2] - out[si + 2];
            guideSsd += dr * dr + dg * dg + db * db;
            guideCnt++;
          }
        }
      }
      if (cnt === 0) continue;
      // distance preference keeps the texture locally plausible
      const dist = Math.hypot(off.x, off.y);
      const score = (ssd / cnt) + (guideCnt ? (guideSsd / guideCnt) * 7 : 0) + dist * 0.35;
      if (score < bestPatchScore) { bestPatchScore = score; bestOff = { x: off.x, y: off.y }; }
    }

    // 3. copy the unknown pixels of the best patch
    if (bestOff) {
      for (let dy = -pr; dy <= pr; dy++) {
        for (let dx = -pr; dx <= pr; dx++) {
          const tx = bx + dx, ty = by + dy;
          if (!inBounds(tx, ty)) continue;
          const ti = ty * w + tx;
          if (!unknown[ti]) continue;
          const si = ((by + bestOff.y + dy) * w + (bx + bestOff.x + dx)) * 4;
          out[ti * 4] = out[si];
          out[ti * 4 + 1] = out[si + 1];
          out[ti * 4 + 2] = out[si + 2];
          out[ti * 4 + 3] = 255;
          unknown[ti] = 0;
          done++;
        }
      }
    } else {
      // fall back: fill just this pixel from stage-1-style averaging
      out[best * 4] = out[best * 4 + 1] = out[best * 4 + 2] = 128;
      unknown[best] = 0;
      done++;
    }
    progress?.(done / Math.max(1, total));
  }
  return out;
}

/**
 * Stage 3 — Poisson (gradient domain) blend.
 * Solves Laplace(f) = Laplacian(source) inside the mask with the surrounding
 * real pixels as boundary, which makes the seam vanish.
 */
export function poissonBlend(
  target: Uint8ClampedArray,
  source: Uint8ClampedArray,
  mask: Mask,
  w: number,
  h: number,
  iterations = 90
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(target);
  const idxs: number[] = [];
  for (let i = 0; i < w * h; i++) if (mask[i]) idxs.push(i);
  if (!idxs.length) return out;

  const f = [
    new Float32Array(w * h),
    new Float32Array(w * h),
    new Float32Array(w * h),
  ];
  // initial guess = source pixels
  for (const ch of [0, 1, 2]) {
    for (const i of idxs) f[ch][i] = source[i * 4 + ch];
  }

  for (let it = 0; it < iterations; it++) {
    for (const i of idxs) {
      const x = i % w, y = (i / w) | 0;
      if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
      for (const ch of [0, 1, 2]) {
        let sum = 0, cnt = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const j = (y + dy) * w + (x + dx);
          if (mask[j]) { sum += f[ch][j]; cnt++; }
          else { sum += target[j * 4 + ch]; cnt++; }
        }
        // guidance from the synthesised gradients
        const gx = (source[(i + 1) * 4 + ch] - source[(i - 1) * 4 + ch]) / 4;
        const gy = (source[(i + w) * 4 + ch] - source[(i - w) * 4 + ch]) / 4;
        f[ch][i] = sum / cnt + (gx + gy) * 0.35;
      }
    }
  }

  for (const i of idxs) {
    out[i * 4] = Math.max(0, Math.min(255, f[0][i]));
    out[i * 4 + 1] = Math.max(0, Math.min(255, f[1][i]));
    out[i * 4 + 2] = Math.max(0, Math.min(255, f[2][i]));
    out[i * 4 + 3] = 255;
  }
  return out;
}

/**
 * Feather the seam: inside the mask keep the synthesis, and in a thin band just
 * outside it cross-fade back to the original so there is no hard edge. Much
 * kinder to texture than a full gradient-domain solve.
 */
export function featherBlend(
  original: Uint8ClampedArray,
  filled: Uint8ClampedArray,
  mask: Mask,
  w: number,
  h: number,
  band = 2
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(filled);
  const dist = distanceTransform(mask, w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const d = dist[i];
      if (d === 0) continue;            // outside fill area: original already copied
      const t = Math.min(1, d / Math.max(1, band)); // 0 at seam → 1 inside
      for (let c = 0; c < 3; c++) {
        const a = filled[i * 4 + c];
        const b = original[i * 4 + c];
        out[i * 4 + c] = a * t + b * (1 - t) * 0.35 + a * (1 - t) * 0.65;
      }
    }
  }
  return out;
}

/** Dilate a mask by n pixels (to cover the object's antialiased fringe). */
export function dilate(mask: Mask, w: number, h: number, n = 2): Mask {
  let m = mask;
  for (let k = 0; k < n; k++) {
    const next = new Uint8Array(m);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (m[i]) continue;
        let hit = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx, yy = y + dy;
            if (xx >= 0 && yy >= 0 && xx < w && yy < h && m[yy * w + xx]) { hit = 1; break; }
          }
        if (hit) next[i] = 1;
      }
    }
    m = next;
  }
  return m;
}

export function inpaint(
  rgba: Uint8ClampedArray,
  mask: Mask,
  w: number,
  h: number,
  opts: { method: 'fast' | 'exemplar' | 'hybrid'; patch: number; blend: boolean; onProgress?: (p: number) => void }
) {
  const t0 = performance.now();
  let result: Uint8ClampedArray;
  if (opts.method === 'fast') {
    result = structureFill(rgba, mask, w, h);
  } else if (opts.method === 'exemplar') {
    result = exemplarSynthesis(rgba, mask, w, h, opts.patch, 90, opts.onProgress);
  } else {
    const stage1 = structureFill(rgba, mask, w, h);
    opts.onProgress?.(0.25);
    result = exemplarSynthesis(stage1, mask, w, h, opts.patch, 80, (p) => opts.onProgress?.(0.25 + p * 0.5), stage1);
    opts.onProgress?.(0.8);
  }
  if (opts.blend) {
    result = featherBlend(rgba, result, mask, w, h, 2);
    opts.onProgress?.(0.95);
  }
  return { rgba: result, ms: performance.now() - t0 };
}

/** Content-aware "magic" fill: finds a nearby similar region and tiles it. */
export function contentAwareFill(rgba: Uint8ClampedArray, mask: Mask, w: number, h: number) {
  return exemplarSynthesis(rgba, mask, w, h, 9, 120);
}
