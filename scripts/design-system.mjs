#!/usr/bin/env node
/* ============================================================
   design-system.mjs — cross-platform wrapper around the
   in-repo UI/UX Pro Max skill search engine.

   Usage:
     npm run design:system -- "saas dashboard" --design-system
     npm run design:system -- "focus not obscured" --domain ux
     npm run design:system -- "chip badge overflow" --stack html-tailwind

   Tries python3, then python. Passes all args through to
   .agents/skills/ui-ux-pro-max/scripts/search.py (stdlib-only,
   offline). The mirror at .claude/skills/ is identical.
   ============================================================ */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const script = join(root, '.agents', 'skills', 'ui-ux-pro-max', 'scripts', 'search.py');

if (!existsSync(script)) {
  console.error(`[design-system] skill search.py not found at ${script}`);
  console.error('[design-system] reinstall with: uipro init --ai universal');
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: npm run design:system -- "<query>" [--design-system|--domain <d>|--stack <s>] [-p "Name"]');
  process.exit(2);
}

for (const bin of ['python3', 'python']) {
  const probe = spawnSync(bin, ['--version'], { stdio: 'ignore' });
  if (probe.status === 0) {
    const run = spawnSync(bin, [script, ...args], { stdio: 'inherit' });
    process.exit(run.status ?? 1);
  }
}
console.error('[design-system] Python 3 not found on PATH. Install Python 3 (stdlib only needed), then retry.');
process.exit(1);
