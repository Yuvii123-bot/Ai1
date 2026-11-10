import { Vec3, Obj, Scene, Material } from './trace';

const mat = (p: Partial<Material>): Material => ({
  albedo: [0.8, 0.8, 0.8],
  rough: 0.5,
  metal: 0,
  ior: 1,
  emissive: [0, 0, 0],
  ...p,
});

export type SceneId = 'studio' | 'sunset' | 'cornell' | 'mirror' | 'planet';

export const SCENES: { id: SceneId; name: string; hint: string }[] = [
  { id: 'studio', name: 'Studio', hint: 'Three glass balls and a softbox — classic PBR test' },
  { id: 'sunset', name: 'Sunset Field', hint: 'Long shadows, warm sky, checker floor' },
  { id: 'cornell', name: 'Cornell Box', hint: 'The 40-year-old lighting benchmark' },
  { id: 'mirror', name: 'Infinity', hint: 'Two facing mirrors: light bounces forever' },
  { id: 'planet', name: 'Planet', hint: 'A ring, a sphere, and a sky you can see through' },
];

export function buildScene(id: SceneId): Scene {
  const objs: Obj[] = [];
  let sky = { top: [0.22, 0.42, 0.85] as Vec3, bottom: [0.95, 0.93, 0.88] as Vec3, sun: [0.4, 0.75, 0.5] as Vec3, sunPower: 22 };
  let light: { c: Vec3; r: number } | undefined = { c: [0, 5.6, 1.4], r: 0.55 };
  let exposure = 1.0;

  // ground
  objs.push({
    t: 'p', n: [0, 1, 0], d: 0,
    mat: mat({ albedo: [0.62, 0.62, 0.66], rough: 0.75, checker: 1.2 }),
  });

  if (id === 'studio') {
    objs[0] = { t: 'p', n: [0, 1, 0], d: 0, mat: mat({ albedo: [0.5, 0.5, 0.55], rough: 0.85, checker: 0.9 }) };
    objs.push({ t: 's', c: [-1.35, 0.85, 1.1], r: 0.85, mat: mat({ albedo: [0.98, 0.98, 0.98], rough: 0, ior: 1.52 }) });
    objs.push({ t: 's', c: [0.05, 0.8, 0.6], r: 0.8, mat: mat({ albedo: [0.95, 0.77, 0.32], metal: 1, rough: 0.08 }) });
    objs.push({ t: 's', c: [1.45, 0.75, 1.25], r: 0.75, mat: mat({ albedo: [0.88, 0.28, 0.32], rough: 0.18 }) });
    objs.push({ t: 'b', min: [-0.5, 0, 2.6], max: [0.5, 1.7, 3.0], mat: mat({ albedo: [0.85, 0.85, 0.88], rough: 0.5 }) });
    objs.push({ t: 's', c: [0, 5.2, 1.0], r: 1.5, mat: mat({ emissive: [7.5, 7.2, 6.6], albedo: [1, 1, 1], rough: 1 }) });
    light = { c: [0, 5.2, 1.0], r: 1.5 };
    sky = { top: [0.12, 0.14, 0.22], bottom: [0.26, 0.28, 0.36], sun: [0, 1, 0], sunPower: 0 };
    exposure = 1.0;
  }

  if (id === 'sunset') {
    sky = { top: [0.09, 0.13, 0.42], bottom: [1.15, 0.55, 0.2], sun: [0.62, 0.09, -0.78], sunPower: 90 };
    objs[0] = { t: 'p', n: [0, 1, 0], d: 0, mat: mat({ albedo: [0.55, 0.5, 0.42], rough: 0.9, checker: 1.6 }) };
    objs.push({ t: 's', c: [-1.8, 0.9, 0.4], r: 0.9, mat: mat({ albedo: [0.3, 0.55, 0.95], metal: 1, rough: 0.12 }) });
    objs.push({ t: 's', c: [0.3, 0.55, 1.6], r: 0.55, mat: mat({ albedo: [1, 1, 1], rough: 0.02, ior: 1.7 }) });
    objs.push({ t: 'b', min: [1.1, 0, -0.4], max: [2.1, 2.4, 0.6], mat: mat({ albedo: [0.85, 0.4, 0.28], rough: 0.65 }) });
    objs.push({ t: 's', c: [-3.1, 0.35, -1.9], r: 0.35, mat: mat({ albedo: [0.95, 0.9, 0.85], rough: 0.6 }) });
    light = undefined;
    exposure = 0.85;
  }

  if (id === 'cornell') {
    // classic Cornell box: white floor/ceiling, red wall, green wall
    objs.length = 0;
    objs.push({ t: 'p', n: [0, 1, 0], d: 0, mat: mat({ albedo: [0.73, 0.73, 0.73], rough: 0.9 }) });
    objs.push({ t: 'p', n: [0, -1, 0], d: -3.2, mat: mat({ albedo: [0.75, 0.75, 0.75], rough: 0.9 }) });
    objs.push({ t: 'p', n: [1, 0, 0], d: 2.0, mat: mat({ albedo: [0.75, 0.13, 0.11], rough: 0.9 }) });
    objs.push({ t: 'p', n: [-1, 0, 0], d: 2.0, mat: mat({ albedo: [0.12, 0.66, 0.18], rough: 0.9 }) });
    objs.push({ t: 'p', n: [0, 0, 1], d: 2.6, mat: mat({ albedo: [0.75, 0.75, 0.75], rough: 0.9 }) });
    objs.push({ t: 's', c: [-0.55, 0.62, 0.55], r: 0.6, mat: mat({ albedo: [0.85, 0.86, 0.9], rough: 0.06, metal: 0.9 }) });
    objs.push({ t: 'b', min: [0.3, 0, 0.25], max: [1.2, 1.25, 1.15], mat: mat({ albedo: [0.74, 0.74, 0.72], rough: 0.85 }) });
    objs.push({ t: 's', c: [0, 2.75, 0.5], r: 0.85, mat: mat({ emissive: [9, 8.2, 6.6], albedo: [1, 1, 1], rough: 1 }) });
    light = { c: [0, 2.75, 0.5], r: 0.85 };
    sky = { top: [0, 0, 0], bottom: [0, 0, 0], sun: [0, 1, 0], sunPower: 0 };
    exposure = 1.6;
  }

  if (id === 'mirror') {
    objs.length = 0;
    objs.push({ t: 'p', n: [0, 1, 0], d: 0, mat: mat({ albedo: [0.35, 0.36, 0.42], rough: 0.3, metal: 0.8 }) });
    // two large mirrors facing each other -> infinite reflections
    objs.push({ t: 'p', n: [0, 0, 1], d: -3.4, mat: mat({ albedo: [0.96, 0.97, 1.0], rough: 0.01, metal: 1 }) });
    objs.push({ t: 'p', n: [0, 0, -1], d: 6.4, mat: mat({ albedo: [0.96, 0.97, 1.0], rough: 0.01, metal: 1 }) });
    objs.push({ t: 's', c: [0, 1.15, 1.5], r: 1.1, mat: mat({ albedo: [0.9, 0.55, 0.95], metal: 0.2, rough: 0.06, ior: 1.45 }) });
    objs.push({ t: 's', c: [-1.6, 0.45, 0.2], r: 0.45, mat: mat({ albedo: [0.9, 0.75, 0.3], metal: 1, rough: 0.15 }) });
    objs.push({ t: 's', c: [1.55, 0.4, -0.6], r: 0.4, mat: mat({ albedo: [0.25, 0.7, 1], metal: 1, rough: 0.05 }) });
    objs.push({ t: 's', c: [0.2, 4.2, 1.4], r: 1.2, mat: mat({ emissive: [7, 7.5, 10], rough: 1 }) });
    light = { c: [0.2, 4.2, 1.4], r: 1.2 };
    sky = { top: [0.03, 0.03, 0.07], bottom: [0.1, 0.09, 0.16], sun: [0, 1, 0], sunPower: 0 };
    exposure = 1.2;
  }

  if (id === 'planet') {
    objs.length = 0;
    // a planet resting on a glossy dark plane, ring of small spheres
    objs.push({ t: 'p', n: [0, 1, 0], d: 0, mat: mat({ albedo: [0.06, 0.07, 0.1], rough: 0.06, metal: 0.55 }) });
    objs.push({ t: 's', c: [0, 1.5, 0.6], r: 1.5, mat: mat({ albedo: [0.35, 0.5, 0.95], rough: 0.35, metal: 0.15 }) });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      objs.push({
        t: 's',
        c: [Math.cos(a) * 2.8, 0.18, 0.6 + Math.sin(a) * 2.8],
        r: 0.18,
        mat: mat({ albedo: [0.95, 0.6 + i * 0.04, 0.25], metal: 0.7, rough: 0.1 }),
      });
    }
    objs.push({ t: 's', c: [-3, 5.5, -2.5], r: 2.0, mat: mat({ emissive: [7, 6.4, 5.6], rough: 1 }) });
    light = { c: [-3, 5.5, -2.5], r: 2.0 };
    sky = { top: [0.03, 0.04, 0.12], bottom: [0.14, 0.07, 0.2], sun: [-0.45, 0.55, -0.35], sunPower: 6 };
    exposure = 1.35;
  }

  return { objs, sky, light, exposure };
}

export const SCENE_ACCENT: Record<SceneId, string> = {
  studio: '#ffb545',
  sunset: '#ff8a3d',
  cornell: '#a3ff12',
  mirror: '#8b6cff',
  planet: '#22d3ee',
};

export type CameraPreset = {
  id: string;
  name: string;
  pos: Vec3;
  target: Vec3;
  fov: number;
};

export const CAMERAS: CameraPreset[] = [
  { id: 'hero', name: 'Hero', pos: [0, 1.7, -5.2], target: [0, 0.85, 0.8], fov: 40 },
  { id: 'low', name: 'Low', pos: [-2.2, 0.55, -4.0], target: [0.2, 0.9, 1.0], fov: 48 },
  { id: 'top', name: 'Overhead', pos: [0.4, 5.2, -3.4], target: [0, 0.5, 0.8], fov: 42 },
  { id: 'macro', name: 'Macro', pos: [-0.9, 0.9, -2.0], target: [0, 0.8, 0.9], fov: 30 },
];
