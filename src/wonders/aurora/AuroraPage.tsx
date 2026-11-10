import { WonderShell } from '../../lib/ui';
import { wonderBySlug } from '../../registry';
const W = wonderBySlug('aurora')!;
export default function AuroraPage() {
  return <WonderShell w={W}><div className="panel panel-pad">Building…</div></WonderShell>;
}
