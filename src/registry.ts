import type React from 'react';
import VoicePage from './wonders/voice/VoicePage';
import RayPage from './wonders/raytrace/RayPage';
import FluidPage from './wonders/fluid/FluidPage';
import ChessPage from './wonders/chess/ChessPage';
import WorldPage from './wonders/worldmodel/WorldPage';
import InpaintPage from './wonders/inpaint/InpaintPage';
import AuroraPage from './wonders/aurora/AuroraPage';
import AlchemyPage from './wonders/alchemy/AlchemyPage';
import MeshPage from './wonders/mesh/MeshPage';
import FabricPage from './wonders/fabric/FabricPage';

export type Wonder = {
  slug: string;
  short: string;
  title: string;
  tag: string;
  blurb: string;
  glyph: string;
  accent: string;
  stack: string[];
  component: React.ComponentType;
  potential: string;
};

export const WONDERS: Wonder[] = [
  {
    slug: 'voice',
    short: 'Voice',
    title: 'Singer — a neural voice, grown from nothing',
    tag: 'Speech synthesis',
    blurb:
      'Type words, pick a melody, and a voice sings them. Under the hood: a from-scratch source-filter vocoder with a formant-aware neural excitation, glottal pulse shaping, legato phrasing and real reverb — no samples, no cloud TTS, no API key.',
    glyph: '◍',
    accent: '#8b6cff',
    stack: ['Web Audio', 'Formant synthesis', 'DSP', '0 samples shipped'],
    component: VoicePage,
    potential: 'Audiobooks, unlimited jingles, accessible reading, dubbing, game NPC dialogue — $0 marginal cost per minute.',
  },
  {
    slug: 'raytrace',
    short: 'Raytracer',
    title: 'Photon — a path tracer in your browser',
    tag: 'Rendering',
    blurb:
      'Physically based light transport: real global illumination, soft shadows, metals, glass with refraction, depth of field and progressive denoising — computed live on your CPU, one photon at a time.',
    glyph: '✦',
    accent: '#ffb545',
    stack: ['Path tracing', 'BVH-free analytic', 'PBR', 'Multithreaded'],
    component: RayPage,
    potential: 'Product visuals, archviz, game lighting previews — rendering that normally costs GPU dollars, running free on the client.',
  },
  {
    slug: 'fluid',
    short: 'Fluids',
    title: 'Storm — a wind tunnel you can paint',
    tag: 'Simulation',
    blurb:
      'Navier–Stokes on a GPU-style grid: curl, vorticity confinement, pressure projection, dye advection. Paint heat, drop obstacles, and watch turbulence become visible in real time.',
    glyph: '≋',
    accent: '#22d3ee',
    stack: ['Navier–Stokes', 'Jacobi pressure solve', 'Vorticity confinement', '60 fps'],
    component: FluidPage,
    potential: 'Wind-tunnel prototyping, VFX previz, teaching physics — a lab that used to need a cluster, now an open tab.',
  },
  {
    slug: 'chess',
    short: 'Chess',
    title: 'Oracle — a chess engine with a soul',
    tag: 'Game AI',
    blurb:
      'Alpha–beta search with iterative deepening, transposition tables, killer moves, quiescence and a hand-tuned evaluation. It explains every move it considers, in plain English, while it thinks.',
    glyph: '♞',
    accent: '#a3ff12',
    stack: ['Alpha–beta', 'Zobrist hashing', 'Quiescence', 'Explainable'],
    component: ChessPage,
    potential: 'Coaching, training apps, tournament analysis — a tutor that shows its reasoning instead of just a number.',
  },
  {
    slug: 'world',
    short: 'World model',
    title: 'Daydream — an AI that imagines physics',
    tag: 'World models',
    blurb:
      'A JEPA-style latent world model learns from scratch, live, in front of you. It watches a bouncing world in pixels, compresses it to a thought, and predicts the future in latent space — then proves it by decoding the dream.',
    glyph: '◈',
    accent: '#ff5cae',
    stack: ['JEPA', 'Latent prediction', 'Contrastive learning', 'Trains live'],
    component: WorldPage,
    potential: 'Robot planning, autonomous driving simulation, cheaper agents — the architecture behind the next wave of AI, in a browser tab.',
  },
  {
    slug: 'inpaint',
    short: 'Inpaint',
    title: 'Restore — delete anything from a photo',
    tag: 'Generative vision',
    blurb:
      'Brush over something unwanted and it vanishes. Diffusion-style inpainting with structure-aware propagation, texture synthesis and Poisson blending — entirely local, entirely offline.',
    glyph: '◐',
    accent: '#22d3ee',
    stack: ['Inpainting', 'Texture synthesis', 'Poisson blend', 'Offline'],
    component: InpaintPage,
    potential: 'E-commerce cleanup, real-estate photos, personal photo repair — a paid SaaS feature, running for free on-device.',
  },
  {
    slug: 'aurora',
    short: 'Aurora',
    title: 'Aurora — a generative art engine with a soul',
    tag: 'Creative AI',
    blurb:
      'A flow-field painter that composes like a designer: it chooses a palette by colour theory, picks a composition by rule, and paints strokes with real bristle physics. Every seed is a one-of-one.',
    glyph: '❋',
    accent: '#8b6cff',
    stack: ['Flow fields', 'Colour theory', 'Bristle physics', 'SVG/PNG export'],
    component: AuroraPage,
    potential: 'Print-on-demand art, album covers, NFT drops, brand textures — infinite original artwork with zero marginal cost.',
  },
  {
    slug: 'alchemy',
    short: 'Alchemy',
    title: 'Alchemy — hear any molecule, see any molecule',
    tag: 'Science',
    blurb:
      'A working chemistry toolkit: it parses SMILES, lays out the 2D structure with a real force-directed layout, computes molecular mass and formula, and synthesises a spectrum you can actually listen to.',
    glyph: '⚗',
    accent: '#ffb545',
    stack: ['SMILES parser', 'Force layout', 'Cheminformatics', 'Sonification'],
    component: AlchemyPage,
    potential: 'Chemistry education, drug-discovery triage, patent review — a lab notebook that anyone can read.',
  },
  {
    slug: 'mesh',
    short: 'Mesh',
    title: 'Loom — text becomes a 3D object',
    tag: '3D generation',
    blurb:
      'Describe a shape and it is born: signed-distance fields, marching cubes, Laplacian smoothing and PBR shading. Download the STL and print it — a real 3D model from a sentence.',
    glyph: '⬢',
    accent: '#a3ff12',
    stack: ['SDF', 'Marching cubes', 'Laplacian smoothing', 'STL export'],
    component: MeshPage,
    potential: '3D printing, game props, AR filters, jewellery design — text-to-object without a render farm.',
  },
  {
    slug: 'fabric',
    short: 'Fabric',
    title: 'Fabric — a self-auditing ledger that cannot lie',
    tag: 'Fintech',
    blurb:
      'A fraud-detection engine with a transparent brain: it scores transactions with an explainable model, finds rings of collusion on a live graph, and never reports a number it cannot justify.',
    glyph: '⛓',
    accent: '#ff5cae',
    stack: ['Anomaly detection', 'Graph rings', 'Explainability', 'SQL-ready'],
    component: FabricPage,
    potential: 'Fintech fraud ops, expense auditing, AML compliance — the highest-ROI AI in any payments company.',
  },
];

export const wonderBySlug = (slug: string) => WONDERS.find((w) => w.slug === slug);
