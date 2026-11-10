import type React from 'react';
import { WONDER_META, type Wonder } from './wonders/meta';
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

export type { Wonder };

const COMPONENTS: Record<string, React.ComponentType> = {
  voice: VoicePage,
  raytrace: RayPage,
  fluid: FluidPage,
  chess: ChessPage,
  world: WorldPage,
  inpaint: InpaintPage,
  aurora: AuroraPage,
  alchemy: AlchemyPage,
  mesh: MeshPage,
  fabric: FabricPage,
};

export const WONDERS: Wonder[] = WONDER_META.map((m) => ({ ...m, component: COMPONENTS[m.slug] }));

export const wonderBySlug = (slug: string) => WONDERS.find((w) => w.slug === slug);
