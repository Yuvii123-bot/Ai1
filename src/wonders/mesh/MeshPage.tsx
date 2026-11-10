import { WonderShell } from '../../lib/ui';
import { wonderBySlug } from '../../registry';
const W = wonderBySlug('mesh')!;
export default function MeshPage() {
  return <WonderShell w={W}><div className="panel panel-pad">Building…</div></WonderShell>;
}
