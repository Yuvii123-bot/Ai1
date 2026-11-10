import { WonderShell } from '../../lib/ui';
import { wonderBySlug } from '../../registry';
const W = wonderBySlug('alchemy')!;
export default function AlchemyPage() {
  return <WonderShell w={W}><div className="panel panel-pad">Building…</div></WonderShell>;
}
