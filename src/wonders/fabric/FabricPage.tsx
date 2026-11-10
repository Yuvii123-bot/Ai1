import { WonderShell } from '../../lib/ui';
import { wonderBySlug } from '../../registry';
const W = wonderBySlug('fabric')!;
export default function FabricPage() {
  return <WonderShell w={W}><div className="panel panel-pad">Building…</div></WonderShell>;
}
