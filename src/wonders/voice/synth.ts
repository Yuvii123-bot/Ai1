/**
 * SINGER — a from-scratch singing-voice synthesizer.
 *
 * Pipeline (source–filter model, the way real vocal tracts work):
 *   1. LYRICS → syllables → phonemes           (G2P, rule based)
 *   2. PHONEMES → target formant trajectories (F1..F5 + bandwidths)
 *   3. GLOTTAL SOURCE: band-limited pulse w/ jitter, shimmer, breath noise
 *   4. VOCAL TRACT: cascade of 2-pole resonators, gliding between targets
 *   5. PROSODY: legato pitch glide, delayed vibrato, consonant transients
 *   6. SPACE: synthesized impulse response, stereo convolution
 *
 * No samples, no models, no dependencies. Pure DSP.
 */

export type Note = { midi: number; beats: number; start?: number; syllable?: string };
export type Preset = {
  id: string;
  name: string;
  notes: [string, number][]; // [note name, beats]
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export function noteName(midi: number) {
  return NOTE_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
}
export function midiFromName(s: string): number {
  const m = /^([A-G]#?)(-?\d)$/.exec(s.trim());
  if (!m) return 60;
  const idx = NOTE_NAMES.indexOf(m[1]);
  return (parseInt(m[2]) + 1) * 12 + idx;
}

/* ------------------------------------------------------------------ *
 * 1. G2P — English letters to a singable phoneme stream
 * ------------------------------------------------------------------ */

export type Phoneme = { type: 'vowel' | 'consonant'; sym: string };

// Vowel formant targets  F1  F2  F3  F4   (Hz, adult "neutral" tenor-ish)
const VOWELS: Record<string, [number, number, number, number]> = {
  a: [730, 1090, 2440, 3400],   // father
  ae: [660, 1720, 2410, 3400],  // cat
  e: [530, 1840, 2480, 3400],   // bed
  i: [270, 2290, 3010, 3600],   // see
  o: [570, 840, 2410, 3200],    // law
  u: [300, 870, 2240, 3200],    // boot
  uh: [640, 1190, 2390, 3300],  // cup
  er: [490, 1350, 1690, 3300],  // bird
  schwa: [500, 1500, 2500, 3300],
};

// vowel letter → phoneme, depends on following letter (very small but effective ruleset)
function vowelFor(ch: string, next: string): string {
  const n = next || '';
  switch (ch) {
    case 'a': return n === 'r' ? 'a' : n === 'i' ? 'e' : 'a';
    case 'e': return n === 'r' ? 'er' : 'e';
    case 'i': return n === 'r' ? 'er' : 'i';
    case 'o': return n === 'o' ? 'u' : n === 'u' ? 'u' : 'o';
    case 'u': return n === 'r' ? 'er' : 'u';
    case 'y': return 'i';
    default: return 'schwa';
  }
}

// consonant → articulation descriptor
// voicing: 0 unvoiced, 1 voiced · place: 0 labial,1 alveolar,2 velar,3 palatal
const CONS: Record<string, { voicing: number; place: number; burst: number; fric: number }> = {
  p: { voicing: 0, place: 0, burst: 0.9, fric: 0.1 },
  b: { voicing: 1, place: 0, burst: 0.7, fric: 0.1 },
  t: { voicing: 0, place: 1, burst: 0.9, fric: 0.2 },
  d: { voicing: 1, place: 1, burst: 0.7, fric: 0.2 },
  k: { voicing: 0, place: 2, burst: 0.8, fric: 0.2 },
  g: { voicing: 1, place: 2, burst: 0.6, fric: 0.2 },
  f: { voicing: 0, place: 0, burst: 0, fric: 0.6 },
  v: { voicing: 1, place: 0, burst: 0, fric: 0.5 },
  s: { voicing: 0, place: 1, burst: 0, fric: 0.95 },
  z: { voicing: 1, place: 1, burst: 0, fric: 0.8 },
  sh: { voicing: 0, place: 3, burst: 0, fric: 0.9 },
  j: { voicing: 1, place: 3, burst: 0.4, fric: 0.6 },
  h: { voicing: 0, place: 2, burst: 0, fric: 0.45 },
  m: { voicing: 1, place: 0, burst: 0.2, fric: 0 },
  n: { voicing: 1, place: 1, burst: 0.2, fric: 0 },
  ng: { voicing: 1, place: 2, burst: 0.15, fric: 0 },
  l: { voicing: 1, place: 1, burst: 0.3, fric: 0 },
  r: { voicing: 1, place: 3, burst: 0.35, fric: 0 },
  w: { voicing: 1, place: 0, burst: 0.2, fric: 0 },
  th: { voicing: 0, place: 1, burst: 0, fric: 0.5 },
};

const isVowelChar = (c: string) => 'aeiouy'.indexOf(c) >= 0;

/** Split an English word into singable syllables (onset/Nucleus/Coda rules). */
const ONSETS = new Set([
  'bl','br','ch','cl','cr','dr','dw','fl','fr','gl','gr','ph','pl','pr','sc','sh','sk','sl','sm','sn','sp','st','sw','th','tr','tw','wh','wr','qu','kn','gn','ps',
  'scr','spr','spl','str','thr','shr','sch',
]);

export function syllabify(word: string): string[] {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return [];
  // collapse doubled consonants: "happy" -> "hapy" (singers articulate them once)
  w = w.replace(/([bcdfgklmnprstvz])\1/g, '$1');
  // silent final e ("shine" -> "shin", "time" -> "tim") but never on "the/he/she/be"
  const nV = [...w].filter(isVowelChar).length;
  const SILENT_E_OK = /(?:[aeiouy][^aeiouy]|l|r)$/; // a consonant that can precede silent e
  if (w.length > 3 && w.endsWith('e') && nV > 1 && !isVowelChar(w[w.length - 2]) && SILENT_E_OK.test(w.slice(0, -1))) {
    w = w.slice(0, -1);
  }

  // mark vowel-group nuclei
  const isV = (c: string) => isVowelChar(c);
  const nuclei: Array<[number, number]> = [];
  for (let i = 0; i < w.length; i++) {
    if (!isV(w[i])) continue;
    let j = i;
    while (j + 1 < w.length && isV(w[j + 1])) j++;
    nuclei.push([i, j]);
    i = j;
  }
  if (!nuclei.length) return [w];

  const cuts: number[] = [];
  for (let k = 0; k < nuclei.length - 1; k++) {
    const cStart = nuclei[k][1] + 1;
    const cEnd = nuclei[k + 1][0]; // exclusive
    const cluster = w.slice(cStart, cEnd);
    if (!cluster) { cuts.push(cStart); continue; }
    if (cluster.length === 1) {
      cuts.push(cStart); // single consonant goes to the next onset: "o-pen"
    } else if (ONSETS.has(cluster)) {
      cuts.push(cStart); // legal cluster stays together: "se-cret"
    } else if (cluster.length === 2) {
      // Never split a consonant pair that acts as one sound: "fireflies"
      // must be fi-re-flies, not fi-ref-lies.
      const pair = cluster;
      const DIGRAPHS = ['ph', 'sh', 'ch', 'th', 'wh', 'gh', 'ck', 'ng', 'qu', 'kn', 'wr', 'gn', 'mb', 'mn', 'ps', 'pn'];
      cuts.push(DIGRAPHS.includes(pair) ? cStart : cStart + 1);
    } else {
      // keep the last two as onset, rest as coda
      const tail = cluster.slice(-2);
      cuts.push(ONSETS.has(tail) ? cEnd - 2 : cEnd - 1);
    }
  }

  const out: string[] = [];
  let prev = 0;
  for (const c of cuts) {
    if (c > prev) { out.push(w.slice(prev, c)); prev = c; }
  }
  out.push(w.slice(prev));
  // strip any syllable with no vowel by merging into the previous
  const merged: string[] = [];
  for (const syl of out) {
    if (![...syl].some(isV) && merged.length) merged[merged.length - 1] += syl;
    else merged.push(syl);
  }
  return merged.length ? merged : [w];
}

/** Convert one syllable to phonemes. */
export function syllableToPhonemes(syl: string): Phoneme[] {
  const out: Phoneme[] = [];
  const s = syl.replace(/[^a-z]/g, '');
  let i = 0;
  let sawVowel = false;
  while (i < s.length) {
    const c = s[i];
    const next = s[i + 1] || '';
    // digraphs
    const dig = s.slice(i, i + 2);
    if (dig === 'sh' || dig === 'ch' || dig === 'th' || dig === 'ng' || dig === 'ph') {
      const sym = dig === 'ch' ? 'sh' : dig === 'ph' ? 'f' : dig;
      out.push({ type: 'consonant', sym });
      i += 2;
      continue;
    }
    if (isVowelChar(c)) {
      // vowel digraph
      let len = 1;
      let phon = vowelFor(c, next);
      if (next && isVowelChar(next)) {
        const pair = c + next;
        if (pair === 'ee' || pair === 'ea' || pair === 'ie' || pair === 'ey') phon = 'i';
        else if (pair === 'oo' || pair === 'ou' || pair === 'ue') phon = 'u';
        else if (pair === 'ai' || pair === 'ay') phon = 'e';
        else if (pair === 'au' || pair === 'aw') phon = 'o';
        else if (pair === 'oi' || pair === 'oy') phon = 'o';
        len = 2;
      }
      out.push({ type: 'vowel', sym: phon });
      sawVowel = true;
      i += len;
      continue;
    }
    out.push({ type: 'consonant', sym: CONS[c] ? c : 'h' });
    i += 1;
  }
  if (!sawVowel) out.push({ type: 'vowel', sym: 'schwa' });
  return out;
}

/** Full text → syllable chunks (each becomes one sung note). */
export function textToSyllables(text: string): string[] {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const w of words) {
    const sy = syllabify(w);
    if (!sy.length) continue;
    // consonant-only word like "hmm" -> make it singable
    if (![...w].some(isVowelChar)) out.push(sy[0] + 'uh');
    else out.push(...sy);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 2. Synthesis
 * ------------------------------------------------------------------ */

export type VoicePreset = 'tenor' | 'alto' | 'soprano' | 'bass' | 'child';

const VOICE_TILT: Record<VoicePreset, { formantScale: number; f0Scale: number; tilt: number }> = {
  bass: { formantScale: 0.86, f0Scale: 0.5, tilt: 0.92 },
  tenor: { formantScale: 1.0, f0Scale: 1.0, tilt: 1.0 },
  alto: { formantScale: 1.12, f0Scale: 1.32, tilt: 1.04 },
  soprano: { formantScale: 1.19, f0Scale: 1.72, tilt: 1.06 },
  child: { formantScale: 1.25, f0Scale: 2.0, tilt: 1.08 },
};

export type SynthOptions = {
  bpm: number;
  voice: VoicePreset;
  vibrato: number;     // 0..1
  breath: number;      // 0..1
  brightness: number;  // 0..1  (formant gain tilt)
  reverb: number;      // 0..1
  harmony: number;     // 0..1 amount of a third above
  legato: number;      // 0..1 portamento amount
  sampleRate?: number;
};

type Seg = {
  f0Start: number; f0End: number; t0: number; t1: number;
  formants: [number, number, number, number];
  cons: { voicing: number; place: number; burst: number; fric: number } | null;
  consAt: number;
  energy: number;
};

/** One 2-pole resonator (formant). */
function resonator(x: number, f: number, bw: number, sr: number) {
  const r = Math.exp((-Math.PI * bw) / sr);
  const theta = (2 * Math.PI * f) / sr;
  const b1 = 2 * r * Math.cos(theta);
  const b2 = -r * r;
  const a0 = 1 - r;
  return { a0, b1, b2 };
}

export function synthesize(notes: Note[], text: string, opt: SynthOptions) {
  const sr = opt.sampleRate ?? 44100;
  // Normalise loosely-typed options: a missing or malformed value must never
  // propagate into the plan as NaN (which would yield a silent buffer).
  const num = (v: unknown, fallback: number, lo: number, hi: number) => {
    const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
    return Math.min(hi, Math.max(lo, n));
  };
  opt = {
    ...opt,
    bpm: num((opt as any).bpm ?? (opt as any).tempo, 100, 40, 260),
    vibrato: num(opt.vibrato, 0.4, 0, 1),
    breath: num(opt.breath, 0.18, 0, 1),
    brightness: num(opt.brightness, 0.5, 0, 1),
    reverb: num(opt.reverb, 0.3, 0, 1),
    harmony: num(opt.harmony, 0, 0, 1),
    legato: num(opt.legato, 0.5, 0, 1),
    voice: VOICE_TILT[opt.voice] ? opt.voice : 'tenor',
  };
  const safeNotes = (Array.isArray(notes) ? notes : []).filter(
    (n) => n && Number.isFinite(n.midi) && Number.isFinite(n.beats) && n.beats > 0
  );
  if (!safeNotes.length) {
    return { L: new Float32Array(0), R: new Float32Array(0), sampleRate: sr, duration: 0 };
  }
  notes = safeNotes;
  const syl = textToSyllables(text);
  const tilt = VOICE_TILT[opt.voice];
  const beat = 60 / opt.bpm;

  // --- build the phoneme/scheduling plan -------------------------------
  const plan: Seg[] = [];
  let t = 0.12;
  const ordered = notes
    .map((n, i) => ({ n, i }))
    .sort((a, b) => (a.n.start ?? a.i) - (b.n.start ?? b.i));
  for (let k = 0; k < ordered.length; k++) {
    const n = ordered[k].n;
    const i = ordered[k].i;
    const word = syl[i % Math.max(1, syl.length)] || 'a';
    const ph = syllableToPhonemes(word);
    const vowel = [...ph].reverse().find((p) => p.type === 'vowel')?.sym || 'a';
    const onset = ph[0] && ph[0].type === 'consonant' ? CONS[ph[0].sym] ?? CONS.h : null;
    const dur = Math.max(0.09, n.beats * beat);
    // Human voices are never perfectly periodic: add slow pitch drift (shimmer
    // is applied per-note here; jitter lives in the glottal pulse).
    const drift = 1 + 0.0035 * Math.sin(k * 2.399963);
    const f0 = midiToHz(n.midi * tilt.f0Scale) * drift;
    const prev = plan[plan.length - 1];
    const startT = Math.max(t, 0.12 + (n.start ?? 0) * beat);
    const fv = VOWELS[vowel] || VOWELS.a;
    const formants: [number, number, number, number] = [
      fv[0] * tilt.formantScale,
      fv[1] * tilt.formantScale,
      fv[2] * tilt.formantScale,
      fv[3] * tilt.formantScale,
    ];
    plan.push({
      f0Start: prev ? prev.f0End : f0,
      f0End: f0,
      t0: startT,
      t1: startT + dur,
      formants,
      cons: onset,
      consAt: startT,
      energy: 1,
    });
    t = Math.max(t, startT + dur);
  }
  const total = t + 0.35 + 2.2; // tail for reverb
  const n = Math.ceil(total * sr);
  const L = new Float32Array(n);
  const R = new Float32Array(n);

  // --- excitation + vocal tract ----------------------------------------
  let phase = 0;
  let jitter = 0;
  let segIdx = 0;
  // smooth formant state (glide toward targets: this is what makes it "sing")
  const fstate = [700, 1200, 2500, 3400];
  const bw = [80, 95, 130, 170];
  let noiseState = 1234567;

  const rnd = () => {
    noiseState ^= noiseState << 13; noiseState ^= noiseState >>> 17; noiseState ^= noiseState << 5;
    return ((noiseState >>> 0) / 4294967296) * 2 - 1;
  };

  // formant filters
  let f1y1 = 0, f1y2 = 0, f2y1 = 0, f2y2 = 0, f3y1 = 0, f3y2 = 0, f4y1 = 0, f4y2 = 0;

  for (let i = 0; i < n; i++) {
    const time = i / sr;

    // advance segment
    while (segIdx < plan.length - 1 && time > plan[segIdx].t1) segIdx++;
    const seg = plan[segIdx];
    if (!seg) break;
    const local = Math.max(0, time - seg.t0);
    const segDur = Math.max(1e-3, seg.t1 - seg.t0);
    const prog = Math.min(1, Math.max(0, local / segDur));

    // ---- pitch: glide in, vibrato with delayed onset, slight drift ----
    const glideAmt = Math.min(1, local / 0.075);
    let f0 = seg.f0Start + (seg.f0End - seg.f0Start) * (glideAmt * glideAmt * (3 - 2 * glideAmt));
    const vibDelay = Math.min(1, Math.max(0, (local - 0.11) / 0.3));
    const vib = Math.sin(2 * Math.PI * 5.4 * time + Math.sin(2 * Math.PI * 0.7 * time) * 0.8);
    f0 *= 1 + vib * 0.017 * opt.vibrato * vibDelay;
    jitter = jitter * 0.86 + rnd() * 0.14;
    f0 *= 1 + jitter * 0.006 * (0.4 + opt.breath);

    // ---- glottal source: shaped pulse (approx. Rosenberg) -------------
    phase += f0 / sr;
    if (phase >= 1) phase -= 1;
    // open quotient widens with breathiness → softer, airier voice
    const oq = 0.55 + opt.breath * 0.28;
    let pulse: number;
    if (phase < oq * 0.62) {
      const x = phase / (oq * 0.62);
      pulse = Math.sin(Math.PI * x) ** 1.6;          // opening phase
    } else if (phase < oq) {
      const x = (phase - oq * 0.62) / (oq * 0.38);
      pulse = Math.cos((Math.PI / 2) * x) ** 1.4 * 0.55; // closing phase (main excitation)
    } else {
      pulse = 0;                                      // closed phase
    }
    // derivative emphasises the closing edge → brighter, more "sung"
    const exc = pulse - (phase < oq * 0.62 ? 0 : 0.35) * pulse;

    // aspiration noise (breath) + consonant noise
    let noise = rnd() * (0.045 + opt.breath * 0.16);

    // ---- consonant articulation --------------------------------------
    let consGain = 0;
    if (seg.cons && local < 0.14) {
      const c = seg.cons;
      const env = Math.exp(-local * 34);
      // burst: broadband click at place-dependent centre
      const centre = [700, 2200, 1700, 3200][c.place] ?? 1500;
      // simple 1-pole band-emphasis via differentiated noise
      noise += rnd() * c.burst * env * 2.4;
      if (c.fric > 0) {
        const fric = rnd() * c.fric * env * 1.5;
        // high-passed fricative energy
        noise += fric * (centre > 1800 ? 1.4 : 0.6);
      }
      consGain = c.voicing * env * 0.5;
      if (c.voicing === 0) noise += rnd() * env * 0.4; // aspiration of unvoiced stops
      noise += Math.sin(2 * Math.PI * centre * time) * c.burst * env * 0.25;
    }
    const source = exc + noise;

    // ---- formant glide (perceptual: faster for F1) -------------------
    const k = 1 - Math.exp(-1 / (0.028 * sr / 1000));
    fstate[0] += (seg.formants[0] - fstate[0]) * k * 1.5;
    fstate[1] += (seg.formants[1] - fstate[1]) * k * 1.1;
    fstate[2] += (seg.formants[2] - fstate[2]) * k * 0.9;
    fstate[3] += (seg.formants[3] - fstate[3]) * k * 0.7;

    // ---- cascade of resonators ---------------------------------------
    const bright = 0.55 + opt.brightness * 0.9;
    let x = source;
    let y = 0;

    let r1 = resonator(x, fstate[0], bw[0], sr);
    let v = r1.a0 * x + r1.b1 * f1y1 + r1.b2 * f1y2;
    f1y2 = f1y1; f1y1 = v;
    y += v * 1.0;

    let r2 = resonator(v, fstate[1], bw[1], sr);
    v = r2.a0 * v + r2.b1 * f2y1 + r2.b2 * f2y2;
    f2y2 = f2y1; f2y1 = v;
    y += v * 0.72 * bright;

    let r3 = resonator(v, fstate[2], bw[2], sr);
    v = r3.a0 * v + r3.b1 * f3y1 + r3.b2 * f3y2;
    f3y2 = f3y1; f3y1 = v;
    y += v * 0.42 * bright * bright;

    let r4 = resonator(v, fstate[3], bw[3], sr);
    v = r4.a0 * v + r4.b1 * f4y1 + r4.b2 * f4y2;
    f4y2 = f4y1; f4y1 = v;
    y += v * 0.2 * bright * bright;

    // mix source (for consonants/breath) back in — real voices leak this
    y = y * tilt.tilt + source * (0.12 + consGain * 0.5);

    // ---- amplitude envelope ------------------------------------------
    const attack = Math.min(1, local / 0.022);
    const release = Math.min(1, (segDur - local) / 0.05);
    const env = Math.min(attack, Math.max(0, release));
    y *= 0.9 * env;

    L[i] += y;
    R[i] += y * (0.985 + 0.015 * Math.sin(time * 1.7)); // micro stereo width
  }

  // ---- harmony: a third above, quieter, delayed ------------------------
  if (opt.harmony > 0.01) {
    const hNotes = notes.map((nn) => {
      const third = [3, 4, 3, 4][((-nn.midi % 12) + 12) % 12 % 4];
      return { ...nn, midi: nn.midi + (third ?? 3) };
    });
    const h = synthesize(hNotes, text, { ...opt, harmony: 0, vibrato: opt.vibrato * 0.8, sampleRate: sr });
    const g = opt.harmony * 0.42;
    const off = Math.floor(0.012 * sr);
    for (let i = 0; i < n; i++) {
      const a = h.L[i - off] || 0;
      const b = h.R[i - off] || 0;
      L[i] += a * g;
      R[i] += b * g;
    }
  }

  // ---- reverb: synthesized impulse response, stereo convolution -------
  if (opt.reverb > 0.01) {
    const irLen = Math.floor(sr * (1.6 + opt.reverb * 2.2));
    const irL = new Float32Array(irLen);
    const irR = new Float32Array(irLen);
    let s = 98765;
    const rr = () => {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
      return ((s >>> 0) / 4294967296) * 2 - 1;
    };
    for (let i = 0; i < irLen; i++) {
      const t = i / sr;
      const decay = Math.exp(-t * (2.4 - opt.reverb * 1.3));
      // early reflections + diffuse tail
      const er = i % Math.floor(sr * 0.011) < 3 ? 0.7 : 1;
      irL[i] = rr() * decay * er * (t < 0.02 ? 0.4 : 1);
      irR[i] = rr() * decay * er * (t < 0.02 ? 0.4 : 1);
    }
    const wetL = fftConvolve(L, irL, sr);
    const wetR = fftConvolve(R, irR, sr);
    const wet = opt.reverb * 0.5;
    const len = Math.max(wetL.length, n);
    const outL = new Float32Array(len);
    const outR = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      outL[i] = (L[i] || 0) * (1 - wet * 0.3) + (wetL[i] || 0) * wet;
      outR[i] = (R[i] || 0) * (1 - wet * 0.3) + (wetR[i] || 0) * wet;
    }
    return finalize(outL, outR, sr);
  }
  return finalize(L, R, sr);
}

function midiToHz(m: number) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

/**
 * Slow automatic gain control: a singer holds a phrase at roughly constant
 * loudness, but different vowels excite the formant cascade by very different
 * amounts (a vowel whose F1 sits on the fundamental can be 15 dB louder than
 * one that doesn't). This measures short-time RMS and eases each region toward
 * the median level, bounded to +/-7 dB so intentional dynamics survive.
 */
function autoLevel(L: Float32Array, R: Float32Array, sr: number) {
  const n = L.length;
  const win = 1024;
  const frames = Math.max(1, Math.floor(n / win));
  const rms = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let acc = 0;
    const s = f * win;
    for (let i = s; i < s + win && i < n; i++) acc += L[i] * L[i];
    rms[f] = Math.sqrt(acc / win);
  }
  // median of the *voiced* frames only
  const voiced = Array.from(rms).filter((v) => v > 1e-4).sort((a, b) => a - b);
  if (voiced.length < 4) return;
  const target = voiced[Math.floor(voiced.length * 0.55)];
  // one-pole smoothing of the gain (tau ~ 60 ms)
  const a = 1 - Math.exp(-1 / ((0.06 * sr) / win));
  let g = 1;
  for (let f = 0; f < frames; f++) {
    const want = rms[f] > 1e-4 ? Math.min(2.24, Math.max(0.45, target / rms[f])) : g;
    g += (want - g) * a;
    const s = f * win;
    for (let i = s; i < s + win && i < n; i++) { L[i] *= g; R[i] *= g; }
  }
}

function finalize(L: Float32Array, R: Float32Array, sr: number) {
  autoLevel(L, R, sr);
  // normalise to -1 dBFS, gentle soft-clip, fade edges
  let peak = 0;
  for (let i = 0; i < L.length; i++) {
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  }
  const g = peak > 1e-6 ? 0.89 / peak : 1;
  const fade = Math.floor(sr * 0.01);
  for (let i = 0; i < L.length; i++) {
    let a = L[i] * g;
    let b = R[i] * g;
    if (i < fade) { const f = i / fade; a *= f; b *= f; }
    const tail = L.length - i;
    if (tail < fade) { const f = tail / fade; a *= f; b *= f; }
    L[i] = Math.tanh(a * 1.08) * 0.92;
    R[i] = Math.tanh(b * 1.08) * 0.92;
  }
  return { L, R, sampleRate: sr, duration: L.length / sr };
}

/** Overlap-add FFT convolution (power-of-two partitions). */
function fftConvolve(x: Float32Array, h: Float32Array, sr: number) {
  void sr;
  const N = 1 << Math.ceil(Math.log2(x.length + h.length));
  const a = new Float32Array(N);
  const b = new Float32Array(N);
  a.set(x);
  b.set(h);
  fft(a, false);
  fft(b, false);
  for (let i = 0; i < N; i++) {
    const re = a[i * 2] * b[i * 2] - a[i * 2 + 1] * b[i * 2 + 1];
    const im = a[i * 2] * b[i * 2 + 1] + a[i * 2 + 1] * b[i * 2];
    a[i * 2] = re;
    a[i * 2 + 1] = im;
  }
  fft(a, true);
  const out = new Float32Array(x.length);
  for (let i = 0; i < out.length; i++) out[i] = a[i * 2];
  return out;
}

/** In-place iterative radix-2 FFT on interleaved complex data. */
function fft(buf: Float32Array, inverse: boolean) {
  const n = buf.length / 2;
  // bit reversal
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = buf[i * 2]; buf[i * 2] = buf[j * 2]; buf[j * 2] = t;
      t = buf[i * 2 + 1]; buf[i * 2 + 1] = buf[j * 2 + 1]; buf[j * 2 + 1] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = buf[(i + k) * 2], ui = buf[(i + k) * 2 + 1];
        const vr = buf[(i + k + len / 2) * 2] * cr - buf[(i + k + len / 2) * 2 + 1] * ci;
        const vi = buf[(i + k) * 2] * ci + buf[(i + k + len / 2) * 2 + 1] * cr;
        buf[(i + k) * 2] = ur + vr;
        buf[(i + k) * 2 + 1] = ui + vi;
        buf[(i + k + len / 2) * 2] = ur - vr;
        buf[(i + k + len / 2) * 2 + 1] = ui - vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < buf.length; i++) buf[i] /= n;
  }
}

/** Windowed STFT magnitude for the spectrogram view. */
export function spectrogram(sig: Float32Array, sampleRate: number, bins = 128, cols = 220) {
  const win = 1024;
  const hop = Math.max(1, Math.floor((sig.length - win) / cols));
  const out = new Float32Array(cols * bins);
  const frame = new Float32Array(2048); // interleaved complex, size win
  for (let c = 0; c < cols; c++) {
    const start = c * hop;
    frame.fill(0);
    for (let i = 0; i < win; i++) {
      const s = i < sig.length ? sig[start + i] : 0;
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (win - 1));
      frame[i * 2] = s * w;
    }
    fft(frame, false);
    for (let b = 0; b < bins; b++) {
      // log-frequency mapping 60 Hz .. 8 kHz
      const f = 60 * Math.pow(8000 / 60, b / (bins - 1));
      const idx = Math.min(win / 2 - 1, Math.round((f / sampleRate) * win));
      const re = frame[idx * 2], im = frame[idx * 2 + 1];
      out[c * bins + b] = Math.sqrt(re * re + im * im);
    }
  }
  // normalise in log domain
  let max = 1e-6;
  for (let i = 0; i < out.length; i++) {
    out[i] = Math.log10(1 + out[i] * 40);
    max = Math.max(max, out[i]);
  }
  for (let i = 0; i < out.length; i++) out[i] /= max;
  return { data: out, cols, bins };
}

/** WAV encoder for download. */
export function toWav(L: Float32Array, R: Float32Array, sampleRate: number) {
  const n = L.length;
  const buffer = new ArrayBuffer(44 + n * 4);
  const view = new DataView(buffer);
  const w = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  w(0, 'RIFF');
  view.setUint32(4, 36 + n * 4, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  w(36, 'data');
  view.setUint32(40, n * 4, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    view.setInt16(o, Math.max(-1, Math.min(1, L[i])) * 32767, true);
    o += 2;
    view.setInt16(o, Math.max(-1, Math.min(1, R[i])) * 32767, true);
    o += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

/* ------------------------------------------------------------------ *
 * 3. Melodies
 * ------------------------------------------------------------------ */

const P = (...items: [string, number][]): [string, number][] => items;

export const PRESETS: Preset[] = [
  {
    id: 'twinkle',
    name: 'Twinkle',
    notes: P(['C4', 1], ['C4', 1], ['G4', 1], ['G4', 1], ['A4', 1], ['A4', 1], ['G4', 2], ['F4', 1], ['F4', 1], ['E4', 1], ['E4', 1], ['D4', 1], ['D4', 1], ['C4', 2]),
  },
  {
    id: 'birthday',
    name: 'Happy Birthday',
    notes: P(['G4', 0.5], ['G4', 0.5], ['A4', 1], ['G4', 1], ['C5', 1], ['B4', 2], ['G4', 0.5], ['G4', 0.5], ['A4', 1], ['G4', 1], ['D5', 1], ['C5', 2]),
  },
  {
    id: 'ode',
    name: 'Ode to Joy',
    notes: P(['E4', 1], ['E4', 1], ['F4', 1], ['G4', 1], ['G4', 1], ['F4', 1], ['E4', 1], ['D4', 1], ['C4', 1], ['C4', 1], ['D4', 1], ['E4', 1], ['E4', 1.5], ['D4', 0.5], ['D4', 2]),
  },
  {
    id: 'amazing',
    name: 'Amazing Grace',
    notes: P(['D4', 2], ['G4', 2], ['B4', 1.5], ['G4', 0.5], ['B4', 2], ['A4', 2], ['G4', 2], ['E4', 2], ['D4', 3]),
  },
  {
    id: 'greensleeves',
    name: 'Greensleeves',
    notes: P(['A4', 1.5], ['C5', 0.5], ['D5', 1], ['E5', 1.5], ['F5', 0.5], ['E5', 1], ['D5', 1], ['B4', 1.5], ['G4', 1.5], ['A4', 1], ['B4', 1], ['C5', 1.5], ['A4', 1.5], ['A4', 1], ['G#4', 1], ['A4', 2]),
  },
  {
    id: 'rise',
    name: 'Epic Rise',
    notes: P(['C4', 0.5], ['E4', 0.5], ['G4', 0.5], ['C5', 0.5], ['E5', 1], ['D5', 0.5], ['C5', 0.5], ['A4', 1], ['C5', 1], ['E5', 1], ['G5', 2], ['E5', 1], ['C5', 2]),
  },
];

export function presetToNotes(p: Preset): Note[] {
  return p.notes.map(([name, beats]) => ({ midi: midiFromName(name), beats }));
}

/** Detect the pitch of a hummed/recorded signal (autocorrelation) — used by the "hum to melody" input. */
export function detectPitch(buf: Float32Array, sampleRate: number): number {
  const SIZE = buf.length;
  const c = new Float32Array(SIZE);
  for (let i = 0; i < SIZE; i++) {
    for (let j = 0; j < SIZE - i; j++) c[i] += buf[j] * buf[j + i];
  }
  let d = 0;
  while (d < SIZE - 1 && c[d] > c[d + 1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = d; i < SIZE; i++) {
    if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
  }
  let T0 = maxpos;
  const x1 = c[T0 - 1] || 0, x2 = c[T0], x3 = c[T0 + 1] || 0;
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a) T0 = T0 - b / (2 * a);
  void sampleRate;
  return sampleRate / T0;
}
