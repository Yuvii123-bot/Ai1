/**
 * Wonder metadata lives in its own module so pages can import it without
 * creating a cycle through registry.ts (which imports the page components).
 */
export type WonderMeta = {
  slug: string;
  short: string;
  title: string;
  tag: string;
  blurb: string;
  glyph: string;
  accent: string;
  stack: string[];
  potential: string;
};

export type Wonder = WonderMeta & { component: any };


export const WONDER_META: WonderMeta[] = [
  {
    slug: 'voice', short: 'Voice',
    title: 'Singer — a neural voice, grown from nothing',
    tag: 'Speech synthesis',
    blurb:
      'Type words, pick a melody, and a voice sings them. Under the hood: a from-scratch source–filter vocoder with formant-aware glides, glottal pulse shaping, jitter and shimmer, legato phrasing and a synthesized reverb — no samples, no cloud TTS, no API key.',
    glyph: '◍', accent: '#8b6cff',
    stack: ['Web Audio', 'Formant synthesis', 'DSP', '0 samples shipped'],
    potential: 'Audiobooks, unlimited jingles, accessible reading, dubbing, game NPC dialogue — $0 marginal cost per minute.',
  },
  {
    slug: 'raytrace', short: 'Raytracer',
    title: 'Photon — a path tracer in your browser',
    tag: 'Rendering',
    blurb:
      'Physically based light transport: real global illumination, soft shadows, metals, glass with Fresnel refraction, depth of field and progressive denoising — computed live on your CPU, one photon at a time, across every core you have.',
    glyph: '✦', accent: '#ffb545',
    stack: ['Path tracing', 'NEE light sampling', 'PBR', 'Multithreaded'],
    potential: 'Product visuals, archviz, game lighting previews — rendering that normally costs GPU dollars, running free on the client.',
  },
  {
    slug: 'fluid', short: 'Fluids',
    title: 'Storm — a wind tunnel you can paint',
    tag: 'Simulation',
    blurb:
      'Navier–Stokes on a grid: semi-Lagrangian advection, vorticity confinement, Jacobi pressure projection, dye transport. Paint heat, drop obstacles, and watch turbulence become visible in real time at 60 fps.',
    glyph: '≋', accent: '#22d3ee',
    stack: ['Navier–Stokes', 'Pressure solve', 'Vorticity', '60 fps'],
    potential: 'Wind-tunnel prototyping, VFX previz, teaching physics — a lab that used to need a cluster, now an open tab.',
  },
  {
    slug: 'chess', short: 'Chess',
    title: 'Oracle — a chess engine that explains itself',
    tag: 'Game AI',
    blurb:
      'Alpha–beta search with iterative deepening, a Zobrist transposition table, killer moves, late-move reductions and quiescence. It narrates every candidate it considers while it thinks, then tells you why it chose what it chose.',
    glyph: '♞', accent: '#a3ff12',
    stack: ['Alpha–beta', 'Zobrist TT', 'Quiescence', 'Perft-verified'],
    potential: 'Coaching, training apps, tournament analysis — a tutor that shows its reasoning instead of just a number.',
  },
  {
    slug: 'world', short: 'World model',
    title: 'Daydream — an AI that imagines physics',
    tag: 'World models',
    blurb:
      'A JEPA-style latent world model learns from scratch, live, in front of you. It watches a bouncing world in pixels, compresses it to a thought, predicts the future in latent space — then proves it by decoding the dream and holding it next to reality.',
    glyph: '◈', accent: '#ff5cae',
    stack: ['JEPA', 'InfoNCE', 'Hand-written Adam', 'Trains live'],
    potential: 'Robot planning, driving simulation, cheaper agents — the architecture behind the next wave of AI, in a browser tab.',
  },
  {
    slug: 'inpaint', short: 'Inpaint',
    title: 'Restore — delete anything from a photo',
    tag: 'Generative vision',
    blurb:
      'Brush over something unwanted and it vanishes. Structure-aware propagation, Criminisi-style exemplar synthesis and a feathered seam — entirely local, entirely offline, no upload and no model weights.',
    glyph: '◐', accent: '#22d3ee',
    stack: ['Exemplar synthesis', 'Structure propagation', 'Offline', '0 uploads'],
    potential: 'E-commerce cleanup, real-estate photos, personal photo repair — a paid SaaS feature, running free on-device.',
  },
  {
    slug: 'aurora', short: 'Aurora',
    title: 'Aurora — a generative painter with taste',
    tag: 'Creative AI',
    blurb:
      'A flow-field painter that composes like a designer: it picks a palette by colour theory, places a focal mass on the golden section, leaves deliberate negative space, and paints with bristle-brush physics. Every seed is a one-of-one.',
    glyph: '❋', accent: '#8b6cff',
    stack: ['Flow fields', 'Colour theory', 'Bristle physics', 'SVG/PNG export'],
    potential: 'Print-on-demand art, album covers, brand textures — infinite original artwork with zero marginal cost.',
  },
  {
    slug: 'alchemy', short: 'Alchemy',
    title: 'Alchemy — hear any molecule, see any molecule',
    tag: 'Science',
    blurb:
      'A working cheminformatics toolkit: it parses SMILES, lays out the structure with a real force-directed solver, computes formula and monoisotopic mass from an isotope table, perceives rings — and turns the bond graph into a spectrum you can listen to.',
    glyph: '⚗', accent: '#ffb545',
    stack: ['SMILES parser', 'Force layout', 'Isotope masses', 'Sonification'],
    potential: 'Chemistry education, drug-discovery triage, patent review — a lab notebook anyone can read.',
  },
  {
    slug: 'mesh', short: 'Mesh',
    title: 'Loom — text becomes a 3D object',
    tag: '3D generation',
    blurb:
      'Describe a shape and it is born: signed-distance fields, marching cubes, Laplacian smoothing and PBR shading in a real three.js scene. Download the STL and print it — genuine geometry from a sentence.',
    glyph: '⬢', accent: '#a3ff12',
    stack: ['SDF', 'Marching cubes', 'Laplacian smoothing', 'STL export'],
    potential: '3D printing, game props, AR filters, jewellery design — text-to-object without a render farm.',
  },
  {
    slug: 'fabric', short: 'Fabric',
    title: 'Fabric — a fraud engine that cannot lie',
    tag: 'Fintech',
    blurb:
      'Fraud detection with a transparent brain: every score decomposes into weighted, human-readable features, collusion rings are found structurally on a live graph, and the model reports honest precision, recall and AUC on held-out fraud it was never shown.',
    glyph: '⛓', accent: '#ff5cae',
    stack: ['Explainable scoring', 'Label propagation', 'Real ROC/AUC', 'CSV export'],
    potential: 'Fintech fraud ops, expense auditing, AML compliance — the highest-ROI AI in any payments company.',
  },
];
