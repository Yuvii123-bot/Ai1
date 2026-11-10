import { WonderShell } from '../../lib/ui';
import { wonderBySlug } from '../../registry';
const W = wonderBySlug('worldmodel')!;
export default function WorldPage() {
  return <WonderShell w={W}><div className="panel panel-pad">Building…</div></WonderShell>;
}
