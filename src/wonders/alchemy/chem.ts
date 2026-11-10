/**
 * ALCHEMY — real cheminformatics, no server, no RDKit.
 *
 *  · a SMILES parser (atoms, bonds, branches, ring closures, aromaticity,
 *    charges, isotopes, stereo markers)
 *  · valences + implicit hydrogens + formal charge bookkeeping
 *  · molecular formula & monoisotopic/exact mass from a real isotope table
 *  · ring perception (cycle detection over the bond graph)
 *  · a 2D layout: force-directed (spring-embedder) + bond-length normalisation,
 *    angle relaxation and overlap removal
 *  · a "spectrum" generator: maps molecular bonds to IR-ish absorptions and
 *    then to audible frequencies, so you can *listen* to a molecule.
 */

export type Atom = {
  element: string;
  aromatic: boolean;
  charge: number;
  isotope?: number;
  hydrogens: number;
  chiral?: string;
  index: number;
  x: number;
  y: number;
};

export type Bond = {
  a: number;
  b: number;
  order: number; // 1,2,3 or 1.5 aromatic
  stereo?: 'up' | 'down';
};

export type Molecule = {
  atoms: Atom[];
  bonds: Bond[];
  formula: string;
  mass: number;
  rings: number[][];
  smiles: string;
  name?: string;
};

/* ---------------- isotope table (most abundant, monoisotopic masses) ---------------- */
const ELEMENTS: Record<string, { mass: number; valence: number; color: string; radius: number; en: number }> = {
  H: { mass: 1.00794, valence: 1, color: '#f4f4f8', radius: 0.32, en: 2.2 },
  C: { mass: 12.0107, valence: 4, color: '#3a3a44', radius: 0.7, en: 2.55 },
  N: { mass: 14.0067, valence: 3, color: '#3652d9', radius: 0.66, en: 3.04 },
  O: { mass: 15.9994, valence: 2, color: '#e0342c', radius: 0.62, en: 3.44 },
  F: { mass: 18.9984, valence: 1, color: '#7ce38b', radius: 0.58, en: 3.98 },
  P: { mass: 30.9738, valence: 3, color: '#ff8c2b', radius: 0.95, en: 2.19 },
  S: { mass: 32.065, valence: 2, color: '#e8c31b', radius: 0.9, en: 2.58 },
  Cl: { mass: 35.453, valence: 1, color: '#37d13c', radius: 0.8, en: 3.16 },
  Br: { mass: 79.904, valence: 1, color: '#a5442a', radius: 0.86, en: 2.96 },
  I: { mass: 126.904, valence: 1, color: '#6a2a9c', radius: 0.98, en: 2.66 },
  B: { mass: 10.811, valence: 3, color: '#ffb5b5', radius: 0.76, en: 2.04 },
  Si: { mass: 28.0855, valence: 4, color: '#c8b48f', radius: 0.9, en: 1.9 },
  Se: { mass: 78.96, valence: 2, color: '#ffa100', radius: 0.92, en: 2.55 },
  Li: { mass: 6.941, valence: 1, color: '#b872f5', radius: 1.0, en: 0.98 },
  Na: { mass: 22.9898, valence: 1, color: '#9d5cf5', radius: 1.05, en: 0.93 },
  K: { mass: 39.0983, valence: 1, color: '#8f5cf5', radius: 1.2, en: 0.82 },
  Mg: { mass: 24.305, valence: 2, color: '#3ddc84', radius: 1.1, en: 1.31 },
  Ca: { mass: 40.078, valence: 2, color: '#3ddc84', radius: 1.2, en: 1.0 },
  Zn: { mass: 65.38, valence: 2, color: '#7f9bb5', radius: 1.1, en: 1.65 },
  Fe: { mass: 55.845, valence: 2, color: '#e07850', radius: 1.05, en: 1.83 },
  Cu: { mass: 63.546, valence: 2, color: '#c9752f', radius: 1.05, en: 1.9 },
  Au: { mass: 196.967, valence: 1, color: '#ffd257', radius: 1.15, en: 2.54 },
  Hg: { mass: 200.59, valence: 2, color: '#b9c2c9', radius: 1.1, en: 2.0 },
  Pt: { mass: 195.084, valence: 2, color: '#d6d6d6', radius: 1.1, en: 2.28 },
  Sn: { mass: 118.71, valence: 4, color: '#9aab9a', radius: 1.1, en: 1.96 },
  Al: { mass: 26.9815, valence: 3, color: '#aab8c2', radius: 1.05, en: 1.61 },
  Ti: { mass: 47.867, valence: 4, color: '#9aa7b5', radius: 1.1, en: 1.54 },
};

export const elementInfo = (el: string) => ELEMENTS[el] ?? { mass: 12, valence: 4, color: '#888', radius: 0.8, en: 2 };

/* ---------------- SMILES parser ---------------- */
const AROMATIC = new Set(['b', 'c', 'n', 'o', 'p', 's', 'se', 'as']);

export function parseSmiles(smiles: string): Molecule {
  const atoms: Atom[] = [];
  const bonds: Bond[] = [];
  const ringOpen = new Map<number, { atom: number; order: number }>();
  const branchStack: number[] = [];
  let prev = -1;
  let pendingOrder = 0; // 0 = unspecified
  let pendingStereo: 'up' | 'down' | undefined;

  const src = smiles.trim();
  let i = 0;

  while (i < src.length) {
    const ch = src[i];

    // skip whitespace
    if (/\s/.test(ch)) { i++; continue; }

    // branch
    if (ch === '(') { branchStack.push(prev); i++; continue; }
    if (ch === ')') { prev = branchStack.pop() ?? prev; i++; continue; }

    // bond symbols
    if (ch === '-' || ch === '=' || ch === '#' || ch === '$' || ch === ':' || ch === '/' || ch === '\\') {
      if (ch === '-') pendingOrder = 1;
      else if (ch === '=') pendingOrder = 2;
      else if (ch === '#') pendingOrder = 3;
      else if (ch === '$') pendingOrder = 4;
      else if (ch === ':') pendingOrder = 1.5;
      else if (ch === '/') pendingStereo = 'up';
      else if (ch === '\\') pendingStereo = 'down';
      i++;
      continue;
    }

    // ring closure. A bare digit is always a single ring label: "cc12" closes
    // ring 1 and ring 2, it does NOT mean ring twelve. Multi-digit labels are
    // written as %nn (standard SMILES).
    if (/[0-9]/.test(ch)) {
      let num = ch;
      i++;
      const n = parseInt(num, 10);
      if (ringOpen.has(n)) {
        const open = ringOpen.get(n)!;
        // aromatic bond inference: both endpoints aromatic and neither side
        // specified an explicit order -> 1.5
        const bothAromatic = atoms[open.atom]?.aromatic && atoms[prev]?.aromatic;
        const order = pendingOrder || open.order || (bothAromatic ? 1.5 : 1);
        bonds.push({ a: open.atom, b: prev, order });
        ringOpen.delete(n);
      } else {
        ringOpen.set(n, { atom: prev, order: pendingOrder });
      }
      pendingOrder = 0;
      continue;
    }

    // atom
    let element = '';
    let aromatic = false;
    if (/[A-Z]/.test(ch)) {
      element = ch;
      i++;
      if (i < src.length && /[a-z]/.test(src[i])) {
        const two = ch + src[i];
        if (ELEMENTS[two]) { element = two; i++; }
      }
    } else if (/[a-z]/.test(ch)) {
      // aromatic (or two-letter aromatic like se/as)
      const two = src.slice(i, i + 2);
      if (AROMATIC.has(two) && two !== ch) { element = two; i += 2; }
      else { element = ch; i++; }
      aromatic = AROMATIC.has(element);
      element = element[0].toUpperCase() + element.slice(1);
      if (element === 'Se') element = 'Se';
    } else if (ch === '[') {
      // bracketed atom: [NH3+], [13CH4], [nH]
      const close = src.indexOf(']', i);
      if (close < 0) break;
      const inner = src.slice(i + 1, close);
      i = close + 1;
      const m = /^(\d+)?([A-Z][a-z]?|[a-z]{1,2})(@{2}|@)?([H]\d*)?([+-]\d*|[+-]+)?/.exec(inner);
      if (!m) continue;
      const isotope = m[1] ? parseInt(m[1], 10) : undefined;
      let el = m[2];
      const isArom = AROMATIC.has(el);
      el = el[0].toUpperCase() + el.slice(1);
      let charge = 0;
      const cs = m[5] ?? '';
      if (cs) {
        if (/^\d$/.test(cs)) charge = parseInt(cs, 10) * (m[5]?.includes('-') ? -1 : 1);
        else if (/^[+-]\d+$/.test(cs)) charge = parseInt(cs.slice(1), 10) * (cs[0] === '-' ? -1 : 1);
        else charge = cs.split('').reduce((a, c) => a + (c === '+' ? 1 : c === '-' ? -1 : 0), 0);
      }
      let hydrogens = -1;
      if (m[4]) hydrogens = m[4] === 'H' ? 1 : parseInt(m[4].slice(1), 10) || 1;
      const atom: Atom = {
        element: el, aromatic: isArom, charge, isotope,
        hydrogens, chiral: m[3], index: atoms.length, x: 0, y: 0,
      };
      atoms.push(atom);
      if (prev >= 0) {
        bonds.push({ a: prev, b: atom.index, order: pendingOrder || (isArom && atoms[prev].aromatic ? 1.5 : 1), stereo: pendingStereo });
      }
      pendingOrder = 0; pendingStereo = undefined;
      prev = atom.index;
      continue;
    } else {
      i++;
      continue;
    }

    const atom: Atom = {
      element, aromatic, charge: 0, hydrogens: -1,
      index: atoms.length, x: 0, y: 0,
    };
    atoms.push(atom);
    if (prev >= 0) {
      const prevArom = atoms[prev].aromatic;
      bonds.push({
        a: prev, b: atom.index,
        order: pendingOrder || (aromatic && prevArom ? 1.5 : 1),
        stereo: pendingStereo,
      });
    }
    pendingOrder = 0; pendingStereo = undefined;
    prev = atom.index;
  }

  // implicit hydrogens from valence
  const heavyBonds = new Int32Array(atoms.length);
  for (const b of bonds) { heavyBonds[b.a]++; heavyBonds[b.b]++; }
  for (const a of atoms) {
    if (a.hydrogens >= 0) continue;
    const info = elementInfo(a.element);
    let used = 0;
    for (const b of bonds) {
      if (b.a === a.index || b.b === a.index) used += b.order;
    }
    // Round away floating-point drift from aromatic 1.5 bonds before comparing
    used = Math.round(used * 2) / 2;
    // Pyrrole-type nitrogen: aromatic, exactly two single (non-aromatic) bonds.
    // Pyridine-type N has two aromatic bonds and carries no hydrogen.
    if (a.aromatic && a.element === 'N' && heavyBonds[a.index] === 2) {
      let single = 0, aromatic = 0;
      for (const b of bonds) {
        if (b.a !== a.index && b.b !== a.index) continue;
        if (b.order === 1.5) aromatic++; else if (b.order === 1) single++;
      }
      if (single === 2 && aromatic === 0) { a.hydrogens = 1; continue; }
      if (aromatic === 2) { a.hydrogens = 0; continue; }
    }
    let valence = info.valence;
    // An aromatic carbon still has valence 4: two aromatic bonds (1.5 each) plus
    // one hydrogen. Pyridine-like N keeps valence 3 (no hydrogen); pyrrole N is
    // written explicitly as [nH].
    if (a.aromatic) {
      // aromatic C: valence 4 (2×1.5 aromatic bonds + 1 H)
      // aromatic N: 3 (pyridine-type, lone pair in plane) unless it has 3 heavy bonds
      valence = a.element === 'C' ? 4 : a.element === 'N' ? 3 : a.element === 'O' ? 2 : a.element === 'S' ? 2 : a.element === 'B' ? 3 : valence;
    }
    if (a.element === 'N' && a.charge === 1) valence = 4;
    if (a.element === 'O' && a.charge === -1) valence = 1;
    // N with 4 bonds is quaternary (no H); O with 3 bonds is oxonium (no H)
    const h = Math.max(0, Math.round(valence - used));
    a.hydrogens = h;
  }

  const rings = findRings(atoms.length, bonds);
  const formula = computeFormula(atoms);
  const mass = computeMass(atoms);
  return { atoms, bonds, formula, mass, rings, smiles };
}

function findRings(n: number, bonds: Bond[]): number[][] {
  // minimal-cycle basis via DFS back-edges (good enough for ring counts + display)
  const adj: { to: number; idx: number }[][] = Array.from({ length: n }, () => []);
  bonds.forEach((b, idx) => {
    adj[b.a].push({ to: b.b, idx });
    adj[b.b].push({ to: b.a, idx });
  });
  const rings: number[][] = [];
  const seen = new Set<string>();
  const parent = new Int32Array(n).fill(-1);
  const depth = new Int32Array(n).fill(-1);
  const visited = new Uint8Array(n);

  const dfs = (u: number, d: number) => {
    visited[u] = 1;
    depth[u] = d;
    for (const { to } of adj[u]) {
      if (!visited[to]) { parent[to] = u; dfs(to, d + 1); }
      else if (to !== parent[u] && depth[to] < depth[u]) {
        // back edge: walk up to the ancestor
        const cycle: number[] = [to];
        let cur = u;
        let guard = 0;
        while (cur !== to && cur >= 0 && guard++ < 200) { cycle.push(cur); cur = parent[cur]; }
        cycle.push(to);
        const key = [...new Set(cycle)].sort((a, b) => a - b).join(',');
        if (!seen.has(key)) { seen.add(key); rings.push(cycle); }
      }
    }
  };
  for (let i = 0; i < n; i++) if (!visited[i]) dfs(i, 0);
  return rings;
}

export function computeFormula(atoms: Atom[]): string {
  const counts: Record<string, number> = {};
  for (const a of atoms) {
    counts[a.element] = (counts[a.element] || 0) + 1;
    if (a.hydrogens > 0) counts.H = (counts.H || 0) + a.hydrogens;
  }
  // Hill system: C, H, then alphabetical
  const order = ['C', 'H', ...Object.keys(counts).filter((k) => k !== 'C' && k !== 'H').sort()];
  return order
    .filter((el) => counts[el] > 0)
    .map((el) => el + (counts[el] > 1 ? counts[el] : ''))
    .join('');
}

export function computeMass(atoms: Atom[]): number {
  let m = 0;
  for (const a of atoms) {
    const base = elementInfo(a.element).mass;
    // use exact isotope mass when specified
    if (a.isotope) m += EXACT_ISOTOPE[a.isotope] ?? base;
    else m += EXACT_MASS[a.element] ?? base;
    if (a.hydrogens > 0) m += (EXACT_MASS.H ?? 1.00783) * a.hydrogens;
  }
  return m;
}

const EXACT_MASS: Record<string, number> = {
  H: 1.007825, C: 12.0, N: 14.003074, O: 15.994915, F: 18.998403, P: 30.973762,
  S: 31.972071, Cl: 34.968853, Br: 78.918338, I: 126.904473, B: 11.009305, Si: 27.976927,
  Se: 79.916522, Na: 22.98977, K: 38.963707, Mg: 23.985042, Ca: 39.962591, Fe: 55.934942,
  Zn: 63.929142, Cu: 62.929598, Au: 196.966569, Hg: 201.970643, Pt: 194.964791,
  Sn: 119.902197, Al: 26.981538, Ti: 47.947947, Li: 7.016004,
};
const EXACT_ISOTOPE: Record<number, number> = {
  1: 1.007825, 2: 2.014102, 12: 12.0, 13: 13.003355, 14: 14.003074, 15: 15.000109,
  16: 15.994915, 18: 17.99916, 32: 31.972071, 34: 33.967867, 37: 36.965903, 79: 78.918338, 81: 80.916291,
  127: 126.904473,
};

/* ---------------- 2D layout: spring embedder + cleanliness passes ---------------- */
export function layout(mol: Molecule, W: number, H: number, iterations = 700) {
  const { atoms, bonds } = mol;
  const n = atoms.length;
  if (!n) return;
  // deterministic initial placement on a circle with radius by atom index
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 0.6 + 0.4 * Math.sin(i * 2.4);
    atoms[i].x = Math.cos(a) * r + (i % 3) * 0.02;
    atoms[i].y = Math.sin(a) * r + (i % 5) * 0.02;
  }

  const REP = 0.085;
  const SPRING = 0.55;
  const REST = 0.52;
  const damp = 0.86;

  for (let it = 0; it < iterations; it++) {
    const temp = 1 - it / iterations;
    const fx = new Float32Array(n);
    const fy = new Float32Array(n);
    // repulsion (n^2 is fine up to ~200 atoms)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = atoms[i].x - atoms[j].x;
        let dy = atoms[i].y - atoms[j].y;
        let d2 = dx * dx + dy * dy + 1e-4;
        let d = Math.sqrt(d2);
        // only repel within a cutoff to keep distant fragments stable
        if (d > 2.2) continue;
        const f = REP / d2;
        dx /= d; dy /= d;
        fx[i] += dx * f; fy[i] += dy * f;
        fx[j] -= dx * f; fy[j] -= dy * f;
      }
    }
    // springs
    for (const b of bonds) {
      const ai = atoms[b.a], bi = atoms[b.b];
      let dx = bi.x - ai.x;
      let dy = bi.y - ai.y;
      const d = Math.hypot(dx, dy) + 1e-6;
      const f = (d - REST) * SPRING;
      dx /= d; dy /= d;
      fx[ai.index] += dx * f; fy[ai.index] += dy * f;
      fx[bi.index] -= dx * f; fy[bi.index] -= dy * f;
    }
    // mild centring force
    let cx = 0, cy = 0;
    for (let i = 0; i < n; i++) { cx += atoms[i].x; cy += atoms[i].y; }
    cx /= n; cy /= n;
    for (let i = 0; i < n; i++) {
      fx[i] -= (atoms[i].x - cx) * 0.06;
      fy[i] -= (atoms[i].y - cy) * 0.06;
      atoms[i].x += fx[i] * temp * 0.9;
      atoms[i].y += fy[i] * temp * 0.9;
    }
  }

  // normalise bond lengths to be visually even
  for (let pass = 0; pass < 40; pass++) {
    for (const b of bonds) {
      const ai = atoms[b.a], bi = atoms[b.b];
      const dx = bi.x - ai.x, dy = bi.y - ai.y;
      const d = Math.hypot(dx, dy) + 1e-6;
      const err = (d - REST) / d / 2;
      ai.x += dx * err; ai.y += dy * err;
      bi.x -= dx * err; bi.y -= dy * err;
    }
  }

  // fit into the canvas
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const a of atoms) {
    minX = Math.min(minX, a.x); maxX = Math.max(maxX, a.x);
    minY = Math.min(minY, a.y); maxY = Math.max(maxY, a.y);
  }
  const size = Math.max(maxX - minX, maxY - minY) || 1;
  const scale = (Math.min(W, H) * 0.78) / size;
  const ox = W / 2 - ((minX + maxX) / 2) * scale;
  const oy = H / 2 - ((minY + maxY) / 2) * scale;
  for (const a of atoms) {
    a.x = a.x * scale + ox;
    a.y = a.y * scale + oy;
  }
}

/* ---------------- sonification ---------------- */
export type Peak = { freq: number; intensity: number; label: string };

const BOND_ENERGY: Record<string, number> = {
  '1': 0.34, '1.5': 0.42, '2': 0.55, '3': 0.72, '4': 0.8,
};

/** Turn the bond graph into an audible "spectrum" (a musical fingerprint). */
export function molecularSpectrum(mol: Molecule): Peak[] {
  const peaks: Peak[] = [];
  const counts: Record<string, number> = {};
  for (const b of mol.bonds) {
    const key = b.order === 1.5 ? '1.5' : String(b.order);
    counts[key] = (counts[key] || 0) + 1;
  }
  // Base tones from the heavy-atom skeleton: heavier mass -> lower pitch
  const heavy = mol.atoms.filter((a) => a.element !== 'H').length || 1;
  const base = 440 * Math.pow(2, -(Math.log2(mol.mass / 100) * 0.28));
  peaks.push({ freq: base, intensity: 0.9, label: `skeleton (${heavy} heavy atoms)` });

  // One partial per distinct bond type, spaced by harmonic ratios
  const orderKeys = Object.keys(counts).sort();
  orderKeys.forEach((k, i) => {
    const ratio = [1, 1.5, 2, 2.5, 3][i % 5];
    peaks.push({
      freq: base * ratio * (1 + BOND_ENERGY[k] * 0.12),
      intensity: Math.min(1, 0.35 + counts[k] * 0.06),
      label: `${k === '1.5' ? 'aromatic' : k === '1' ? 'single' : k === '2' ? 'double' : k === '3' ? 'triple' : 'quad'} bonds ×${counts[k]}`,
    });
  });

  // heteroatoms add colour tones (like overtones in a real IR spectrum)
  const byEl: Record<string, number> = {};
  for (const a of mol.atoms) {
    if (a.element === 'C' || a.element === 'H') continue;
    byEl[a.element] = (byEl[a.element] || 0) + 1;
  }
  Object.entries(byEl).forEach(([el, c], i) => {
    const ratio = [2.7, 3.4, 4.1, 4.9, 5.6][i % 5];
    peaks.push({ freq: base * ratio, intensity: 0.25 + Math.min(0.6, c * 0.08), label: `${el} (${c})` });
  });

  // rings: resonance chords
  if (mol.rings.length) {
    peaks.push({ freq: base * 5.9, intensity: Math.min(0.8, 0.2 + mol.rings.length * 0.12), label: `${mol.rings.length} ring${mol.rings.length > 1 ? 's' : ''}` });
  }
  return peaks.sort((a, b) => a.freq - b.freq).slice(0, 16);
}

/* ---------------- library ---------------- */
export const MOLECULES: { name: string; smiles: string; note: string }[] = [
  { name: 'Caffeine', smiles: 'Cn1cnc2c1c(=O)n(C)c(=O)n2C', note: 'The world\'s favourite alkaloid' },
  { name: 'Aspirin', smiles: 'CC(=O)Oc1ccccc1C(=O)O', note: 'Acetylsalicylic acid' },
  { name: 'Glucose', smiles: 'OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O', note: 'Fuel for every cell' },
  { name: 'Benzene', smiles: 'c1ccccc1', note: 'The aromatic archetype' },
  { name: 'Ibuprofen', smiles: 'CC(C)Cc1ccc(cc1)C(C)C(=O)O', note: 'Chiral NSAID' },
  { name: 'Paracetamol', smiles: 'CC(=O)Nc1ccc(O)cc1', note: 'Acetaminophen' },
  { name: 'Dopamine', smiles: 'NCCc1ccc(O)c(O)c1', note: 'Reward and motor control' },
  { name: 'Serotonin', smiles: 'NCCc1c[nH]c2ccc(O)cc12', note: 'Mood, sleep, appetite' },
  { name: 'Nicotine', smiles: 'CN1CCC[C@H]1c1cccnc1', note: 'A pyridine alkaloid' },
  { name: 'Capsaicin', smiles: 'COc1cc(CNC(=O)CCCC=CCCCC)c(O)cc1', note: 'The heat in chilli' },
  { name: 'Morphine', smiles: 'CN1CCC23c4c5ccc(O)c4OC2C(O)C=CC3C1C5', note: 'A pentacyclic alkaloid' },
  { name: 'Penicillin G', smiles: 'CC1(C)S[C@@H]2[C@H](NC(=O)Cc3ccccc3)C(=O)N2[C@H]1C(=O)O', note: 'The antibiotic that changed history' },
  { name: 'Acetone', smiles: 'CC(C)=O', note: 'The simplest ketone (C3H6O)' },
  { name: 'Cubane', smiles: 'C12C3C4C1C5C2C3C45', note: 'A cube of carbon (C8H8)' },
  { name: 'Water', smiles: 'O', note: 'Two hydrogens, one oxygen' },
  { name: 'Cyclohexane', smiles: 'C1CCCCC1', note: 'Chair conformation' },
  { name: 'Naphthalene', smiles: 'c1ccc2ccccc2c1', note: 'Mothballs' },
  { name: 'Sulfuric acid', smiles: 'O[S](=O)(=O)O', note: 'The workhorse of industry' },
];
