// The Vercel function uses only the Linux x64 CPU binding.
import { readdir, rm } from 'node:fs/promises';
const root = 'node_modules/@node-llama-cpp';
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (entry.isDirectory() && entry.name !== 'linux-x64') await rm(`${root}/${entry.name}`, { recursive: true, force: true });
}
