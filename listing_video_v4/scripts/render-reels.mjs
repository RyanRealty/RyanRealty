#!/usr/bin/env node
// render-reels.mjs — Validate props, render 4 SingleImageReel videos.
//
// Validates every burned-in text string against the em-dash ban via a small
// inline port of lib/punctuation-guard.ts (so this script has no TS
// dependency). The repo's TS guard is the source of truth; this is a literal
// mirror — keep them in sync.
//
// Usage:
//   node scripts/render-reels.mjs

import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(
  ROOT,
  '../out/proof/2026-05-14/rendered/reels',
);
const PROPS_DIR = resolve(OUT_DIR, 'props');
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(PROPS_DIR, { recursive: true });

// ── Mirror of lib/punctuation-guard.ts. Em/en/horizontal-bar/two-em/three-em.
const BANNED_DASHES = /[–—―⸺⸻]/g;
function assertNoDashes(text, source) {
  if (text == null) return;
  if (typeof text !== 'string') return;
  BANNED_DASHES.lastIndex = 0;
  const m = text.match(BANNED_DASHES);
  if (m) {
    throw new Error(
      `Banned dash character in ${source}. Found: ${JSON.stringify(m)}. Text: ${JSON.stringify(text)}`,
    );
  }
}

// ── The 4 reels.
const REELS = [
  {
    id: 'schoolhouse',
    props: {
      layout: 's2',
      photoPath: 'reels-photos/schoolhouse.jpg',
      bigWords: ['Sold'],
      sub: 'Off-market  ·  $3,025,000',
      address: '56111 SCHOOL HOUSE RD  ·  VANDEVERT RANCH  ·  BEND, OREGON',
      bigWordSize: 260,
    },
  },
  {
    id: 'beaumont',
    props: {
      layout: 's2',
      photoPath: 'reels-photos/beaumont.jpg',
      eyebrow: 'RYAN REALTY  ·  REPRESENTED THE SELLER',
      bigWords: ['Under', 'Contract'],
      sub: '$525,000  ·  3 BD  ·  2 BA  ·  1,803 SQFT',
      address: '20702 BEAUMONT DR  ·  NORTHPOINTE  ·  BEND, OREGON',
      subColor: 'rgb(240, 230, 210)',
      addressColor: 'rgb(220, 210, 180)',
      bigWordSize: 200,
    },
  },
  {
    id: 'saghali',
    props: {
      layout: 'pattern-b',
      photoPath: 'reels-photos/saghali.jpg',
      headline: [
        'A Half-Acre Cul-de-Sac',
        'in Tillicum Village',
        'Under Contract',
      ],
      price: 'Listed at $670,000.',
    },
  },
  {
    id: 'simpson',
    props: {
      layout: 's2',
      photoPath: 'reels-photos/simpson.jpg',
      eyebrow: 'RYAN REALTY  ·  REPRESENTED THE BUYERS',
      bigWords: ['Sold'],
      sub: 'Broken Top  ·  $735,000',
      address: '19571 SW SIMPSON AVENUE  ·  BEND, OREGON',
      bigWordSize: 260,
    },
  },
];

// ── Validate every string field.
for (const r of REELS) {
  const p = r.props;
  if (p.eyebrow) assertNoDashes(p.eyebrow, `${r.id}.eyebrow`);
  if (p.bigWords) p.bigWords.forEach((w, i) => assertNoDashes(w, `${r.id}.bigWords[${i}]`));
  if (p.sub) assertNoDashes(p.sub, `${r.id}.sub`);
  if (p.address) assertNoDashes(p.address, `${r.id}.address`);
  if (p.headline) p.headline.forEach((l, i) => assertNoDashes(l, `${r.id}.headline[${i}]`));
  if (p.price) assertNoDashes(p.price, `${r.id}.price`);
}
console.log('[guard] All 4 reels passed dash-ban validation.');

// ── Render loop.
for (const r of REELS) {
  const propsPath = resolve(PROPS_DIR, `${r.id}.json`);
  const outPath = resolve(OUT_DIR, `${r.id}.mp4`);
  writeFileSync(propsPath, JSON.stringify(r.props, null, 2));

  console.log(`\n[render] ${r.id} → ${outPath}`);
  const cmd = [
    'npx',
    'remotion',
    'render',
    'src/index.ts',
    'SingleImageReel',
    JSON.stringify(outPath),
    `--props=${JSON.stringify(propsPath)}`,
    '--codec', 'h264',
    '--concurrency', '1',
    '--crf', '22',
    '--image-format=jpeg',
    '--jpeg-quality=92',
  ].join(' ');
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' });

  // First-frame thumbnail gate (ship-blocker, locked 2026-05-20).
  const REPO_ROOT = resolve(ROOT, '..');
  const checkScript = resolve(REPO_ROOT, 'scripts/check_first_frame.py');
  console.log(`  [first-frame] checking ${outPath}`);
  try {
    execSync(`python3 ${checkScript} ${outPath}`, { cwd: REPO_ROOT, stdio: 'inherit' });
    console.log(`  [first-frame] ✓ passed for ${r.id}`);
  } catch {
    console.error(`\nSHIP-BLOCKER: first-frame check failed for ${r.id}. Fix the opening frame before publishing.`);
    process.exit(1);
  }
}

console.log('\n[done] 4 reels rendered to', OUT_DIR);
