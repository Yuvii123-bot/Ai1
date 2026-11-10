/* ============================================================
   build.js — the entire build step.
   There is no bundler, no minifier and no dependencies: this
   copies the static site into dist/ so Vercel (or any host that
   expects an output directory) can serve it.

   Run: node build.js
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

/* everything a visitor can reach. .git, dist and node_modules
   are never copied. */
const INCLUDE = ['index.html', 'assets', 'exhibits', 'data', 'README.md'];
const SKIP = new Set(['.git', 'dist', 'node_modules', '.DS_Store', '.vercel']);

function copy(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      if (SKIP.has(name)) continue;
      copy(path.join(src, name), path.join(dest, name));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push([p, st.size]);
  }
  return out;
}

/* ---- clean ---- */
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

/* ---- copy ---- */
let copied = 0;
for (const entry of INCLUDE) {
  const src = path.join(ROOT, entry);
  if (!fs.existsSync(src)) continue;
  copy(src, path.join(DIST, entry));
  copied++;
}

/* ---- verify the things that actually must exist ---- */
const REQUIRED = [
  'index.html',
  'assets/app.js',
  'assets/style.css',
  'exhibits/10-orrery/index.html',
  'exhibits/03-truesize/index.html',
  'exhibits/07-darkforest/index.html',
  'exhibits/04-lifeseed/index.html',
  'exhibits/01-nepal/index.html',
  'exhibits/01-nepal/app.js',
  'exhibits/06-cartographer/index.html',
  'exhibits/05-decoder/index.html',
  'exhibits/02-leak/index.html',
  'exhibits/08-meter/index.html',
  'exhibits/09-cabinet/index.html',
  'exhibits/09-cabinet/scan.js',
];

let missing = 0;
for (const rel of REQUIRED) {
  if (!fs.existsSync(path.join(DIST, rel))) {
    console.error(`  MISSING  ${rel}`);
    missing++;
  }
}

const files = walk(DIST);
const bytes = files.reduce((s, [, b]) => s + b, 0);

console.log('');
console.log('  The Cabinet of Ten Wonders — build');
console.log('  ' + '-'.repeat(46));
console.log(`  entries copied : ${copied}`);
console.log(`  files in dist  : ${files.length}`);
console.log(`  total size     : ${(bytes / 1024).toFixed(1)} KB`);
console.log(`  exhibits       : ${REQUIRED.filter(r => r.includes('/index.html') && r.startsWith('exhibits/')).length} verified present`);
console.log('');

if (missing) {
  console.error(`  build FAILED: ${missing} required file(s) missing.`);
  process.exit(1);
}
console.log('  build OK');
