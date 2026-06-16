#!/usr/bin/env node
// render-listing-reels.mjs — Tumalo open house + Impala for-sale vertical reels.
// Mirrors render-reels.mjs exactly: dash-ban guard + SingleImageReel render +
// first-frame ship-blocker. Only the REELS data differs. 1080x1920, 9s, 30fps.

import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, '../out/listing-reels');
const PROPS_DIR = resolve(OUT_DIR, 'props');
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(PROPS_DIR, { recursive: true });

const BANNED_DASHES = /[–—―⸺⸻]/g;
function assertNoDashes(text, source) {
  if (typeof text !== 'string') return;
  BANNED_DASHES.lastIndex = 0;
  const m = text.match(BANNED_DASHES);
  if (m) throw new Error(`Banned dash in ${source}: ${JSON.stringify(m)} — ${JSON.stringify(text)}`);
}

const REELS = [
  {
    id: 'tumalo-open-house',
    props: {
      layout: 's2',
      photoPath: 'reels-photos/tumalo-oh.jpg',
      eyebrow: 'OPEN HOUSE  ·  SATURDAY JUNE 20',
      bigWords: ['Open', 'House'],
      sub: '11 am to 2 pm  ·  $1,225,000',
      address: '19496 TUMALO RESERVOIR RD  ·  BEND, OREGON',
      bigWordSize: 220,
    },
  },
  {
    id: 'impala-for-sale',
    props: {
      layout: 's2',
      photoPath: 'reels-photos/impala.jpg',
      eyebrow: 'FOR SALE  ·  REDMOND',
      bigWords: ['3.36', 'Acres'],
      sub: '2 irrigated  ·  $634,999',
      address: '5663 IMPALA RD  ·  REDMOND, OREGON',
      bigWordSize: 230,
    },
  },
];

for (const r of REELS) {
  const p = r.props;
  if (p.eyebrow) assertNoDashes(p.eyebrow, `${r.id}.eyebrow`);
  if (p.bigWords) p.bigWords.forEach((w, i) => assertNoDashes(w, `${r.id}.bigWords[${i}]`));
  if (p.sub) assertNoDashes(p.sub, `${r.id}.sub`);
  if (p.address) assertNoDashes(p.address, `${r.id}.address`);
}
console.log('[guard] Both listing reels passed dash-ban validation.');

for (const r of REELS) {
  const propsPath = resolve(PROPS_DIR, `${r.id}.json`);
  const outPath = resolve(OUT_DIR, `${r.id}.mp4`);
  writeFileSync(propsPath, JSON.stringify(r.props, null, 2));
  console.log(`\n[render] ${r.id} -> ${outPath}`);
  const cmd = [
    'npx', 'remotion', 'render', 'src/index.ts', 'SingleImageReel',
    JSON.stringify(outPath), `--props=${JSON.stringify(propsPath)}`,
    '--codec', 'h264', '--concurrency', '1', '--crf', '22',
    '--image-format=jpeg', '--jpeg-quality=92',
  ].join(' ');
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' });

  const REPO_ROOT = resolve(ROOT, '..');
  const checkScript = resolve(REPO_ROOT, 'scripts/check_first_frame.py');
  try {
    execSync(`python3 ${checkScript} ${outPath}`, { cwd: REPO_ROOT, stdio: 'inherit' });
    console.log(`  [first-frame] ok ${r.id}`);
  } catch {
    console.error(`SHIP-BLOCKER: first-frame check failed for ${r.id}.`);
    process.exit(1);
  }
}
console.log('\n[done] listing reels rendered to', OUT_DIR);
