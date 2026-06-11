#!/usr/bin/env node
/**
 * G46 — commit self-containment gate
 *
 * Type-checks the committed (or staged) tree in isolation from the working
 * tree so that a commit referencing symbols that exist only in the
 * UNCOMMITTED working tree is caught before the push lands in CI.
 *
 * Two escape classes this closes:
 *   1. EventName union member added to an untracked enum but consumed by
 *      committed code  (broke deploy 2026-06-09 night, pass 1)
 *   2. lib/data/index.ts export added to the working tree but not staged
 *      while committed callers already imported it  (broke deploy 2026-06-09
 *      night, pass 2)
 *
 * File-existence checks can't catch either — the FILES were tracked; the
 * SYMBOLS were missing from the committed versions.
 *
 * Usage:
 *   node scripts/check-commit-compiles.mjs          # --head (default)
 *   node scripts/check-commit-compiles.mjs --head   # validate HEAD
 *   node scripts/check-commit-compiles.mjs --staged # validate the index
 *
 * Mechanism:
 *   1. Materialize the target tree into $TMP without touching the working tree.
 *      --head:   git archive HEAD | tar -x -C $TMP   (fastest; idiomatic)
 *      --staged: git checkout-index -a --prefix=$TMP/
 *   2. Symlink node_modules into $TMP (never copy).
 *   3. Write a thin tsconfig.json that EXTENDS the materialized one so we
 *      can patch paths + drop .next/dev/types (only exists after `next dev`
 *      and is not in the commit tree).
 *   4. npx tsc --noEmit -p $TMP/tsconfig.check.json
 *   5. Exit 0 clean / exit 1 with headline + first 30 error lines.
 *   6. Trap cleans $TMP on any exit.
 */

import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ── config ────────────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Heavy and/or compilation-irrelevant directories excluded from the git
// archive to keep extraction fast.
//
// WHY video/ needs special handling:
//   The top-level tsconfig has `"exclude": ["video"]` which prevents all
//   video/* files from being scanned as compilation roots.  However,
//   `lib/youtube-market-report/` imports types from
//   `video/market-report/src/VideoProps` — TypeScript follows that import
//   even though video/ is excluded from root scanning.  VideoProps.ts has
//   no external imports (pure type definitions), so it resolves fine via the
//   root node_modules.
//
//   All other video/* sub-packages (cascade-peaks, earnest, area_guides, etc.)
//   import package-specific deps (@remotion/cli, @react-three/fiber, three…)
//   that live only in their own per-package node_modules, not in the root.
//   If those files are included in the archive, they would be scanned as roots
//   and produce "cannot find module" false-positives.
//
//   Solution: include ONLY video/market-report/src/ (the one dir imported by
//   lib/) and exclude all other video/* sub-packages from the archive.
const ARCHIVE_EXCLUDES = [
  // Root-level heavy dirs (GBs of compiled video, images, docs)
  'public',
  'out',
  'design_system',
  'docs',
  // listing_video_v4 — its own Remotion project; not part of root tsconfig
  'listing_video_v4',
  // video/* sub-packages that use per-package deps not in root node_modules.
  // video/market-report/src/ is NOT excluded — it's imported by lib/.
  'video/area_guides',
  'video/avatar_market_update',
  'video/cascade-peaks',
  'video/data_viz_video',
  'video/earnest',
  'video/evergreen-education',
  'video/listing-tour',
  'video/listing_reveal',
  'video/map_route_video',
  'video/market-report-yt-long',
  'video/market-report/data',
  'video/market-report/node_modules',
  'video/market-report/out',
  'video/market-report/public',
  'video/market-report/remotion.config.ts',
  'video/market-report/scripts',
  'video/meme_content',
  'video/news_video',
  'video/news_video_avatar',
  'video/school_district_overlay',
  'video/tiktok_listing_tour',
  'video/tumalo-aerial',
  'video/walkability_overlay',
];

// ── CLI ───────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const mode = args.includes('--staged') ? 'staged' : 'head';

console.log(`\n▶  G46 commit self-containment — mode: ${mode}`);

const t0 = Date.now();

// ── temp dir + cleanup trap ───────────────────────────────────────────────────

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-commit-check-'));

function cleanup() {
  try {
    fs.rmSync(TMP, { recursive: true, force: true });
  } catch {
    // best-effort
  }
}

process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });
process.on('SIGTERM', () => { cleanup(); process.exit(143); });

// ── 1. materialize the target tree ───────────────────────────────────────────

if (mode === 'head') {
  // Build the git archive command with pathspec exclusions.
  // ':!path' syntax tells git to exclude that path from the tree.
  const excludeArgs = ARCHIVE_EXCLUDES.map(p => `:!${p}`);
  const archiveCmd = ['git', 'archive', 'HEAD', '--', ...excludeArgs];

  process.stdout.write('   Materializing HEAD tree... ');
  try {
    const archiveResult = spawnSync('git', ['archive', 'HEAD', '--', ...excludeArgs], {
      cwd: REPO_ROOT,
      maxBuffer: 512 * 1024 * 1024, // 512 MB — enough for the filtered tree
    });
    if (archiveResult.status !== 0) {
      console.error('FAIL\n' + (archiveResult.stderr?.toString() ?? ''));
      process.exit(1);
    }
    // Pipe archive output into tar
    const tarResult = spawnSync('tar', ['-x', '-C', TMP], {
      input: archiveResult.stdout,
      maxBuffer: 512 * 1024 * 1024,
    });
    if (tarResult.status !== 0) {
      console.error('FAIL\n' + (tarResult.stderr?.toString() ?? ''));
      process.exit(1);
    }
    console.log('done');
  } catch (e) {
    console.error('FAIL\n' + e.message);
    process.exit(1);
  }
} else {
  // --staged: materialize the git index (what would be committed)
  process.stdout.write('   Materializing staged (index) tree... ');
  const result = spawnSync(
    'git',
    ['checkout-index', '-a', '--prefix', TMP + '/'],
    { cwd: REPO_ROOT }
  );
  if (result.status !== 0) {
    console.error('FAIL\n' + (result.stderr?.toString() ?? ''));
    process.exit(1);
  }
  console.log('done');
}

// ── 2. symlink node_modules ───────────────────────────────────────────────────

const srcModules = path.join(REPO_ROOT, 'node_modules');
const dstModules = path.join(TMP, 'node_modules');
if (!fs.existsSync(dstModules)) {
  fs.symlinkSync(srcModules, dstModules);
}

// ── 3. write a thin wrapper tsconfig ─────────────────────────────────────────
//
// The materialized tsconfig.json has `"incremental": true` which writes a
// tsbuildinfo file — not harmful but noisy.  More importantly, it includes
// `.next/types/**/*.ts` and `.next/dev/types/**/*.ts` which only exist after
// `next dev` runs — they won't be in the commit tree.  We extend the
// materialized config and patch those refs out.
//
// We also clear `paths` so the `@/*` alias resolves relative to TMP, and
// set `baseUrl` explicitly for the same reason.
//
// The `exclude` list in the base config already covers scripts/, video/,
// listing_video_v4/, out/ — those remain excluded.

const wrapperTsconfig = {
  extends: './tsconfig.json',
  compilerOptions: {
    incremental: false,
    tsBuildInfoFile: undefined,
    baseUrl: '.',
    paths: {
      '@/*': ['./*'],
    },
  },
  // The base include pulls in `.next/types/**/*.ts` and `.next/dev/types/**/*.ts`
  // which don't exist in the commit tree.  Replicate the meaningful parts
  // without those.  `**/*.ts` and `**/*.tsx` already cover the source tree.
  include: ['**/*.ts', '**/*.tsx', '**/*.mts'],
  // Base exclude list — mirrors tsconfig.json's exclude plus a few additions.
  //
  // video/market-report/src/ is intentionally NOT excluded (unlike the base
  // tsconfig's blanket `"video"` exclusion) because lib/youtube-market-report/
  // imports types from that specific path and tsc must resolve them.  The other
  // video/* sub-packages ARE excluded to prevent them from being scanned as
  // roots (they have per-package deps not in root node_modules — the archive
  // didn't include those anyway).  .next/ is excluded entirely since it
  // doesn't exist in the commit tree.
  exclude: [
    'node_modules',
    '_style_backup',
    '_worktree_salvage',
    'scripts',
    'listing_video_v4',
    'out',
    'public',
    'public/producer-gallery-assets',
    '.next',
    // video sub-packages that use per-package deps (excluded from archive too)
    'video/area_guides',
    'video/avatar_market_update',
    'video/cascade-peaks',
    'video/data_viz_video',
    'video/earnest',
    'video/evergreen-education',
    'video/listing-tour',
    'video/listing_reveal',
    'video/map_route_video',
    'video/market-report-yt-long',
    'video/meme_content',
    'video/news_video',
    'video/news_video_avatar',
    'video/school_district_overlay',
    'video/tiktok_listing_tour',
    'video/tumalo-aerial',
    'video/walkability_overlay',
    // root-level config file of market-report package (uses @remotion/cli/config)
    'video/market-report/remotion.config.ts',
  ],
};

fs.writeFileSync(
  path.join(TMP, 'tsconfig.check.json'),
  JSON.stringify(wrapperTsconfig, null, 2)
);

// ── 4. run tsc ────────────────────────────────────────────────────────────────

process.stdout.write('   Running tsc --noEmit... ');

// Find npx in PATH
let npxBin = 'npx';
try {
  npxBin = execSync('which npx', { encoding: 'utf8' }).trim();
} catch { /* use 'npx' */ }

const tscResult = spawnSync(
  npxBin,
  ['tsc', '--noEmit', '-p', path.join(TMP, 'tsconfig.check.json')],
  {
    cwd: TMP,
    encoding: 'utf8',
    // Give tsc up to 5 minutes — correctness wins over speed per spec
    timeout: 300_000,
    maxBuffer: 10 * 1024 * 1024,
  }
);

const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

if (tscResult.status === 0) {
  console.log(`PASS  (${elapsed}s)\n`);
  console.log('✓  COMMIT IS SELF-CONTAINED — all referenced symbols exist in the committed tree.\n');
  process.exit(0);
} else {
  console.log(`FAIL  (${elapsed}s)\n`);

  const output = (tscResult.stdout ?? '') + (tscResult.stderr ?? '');
  const lines = output.split('\n').filter(Boolean);
  const firstThirty = lines.slice(0, 30).join('\n');

  console.error('════════════════════════════════════════════════════════════════════');
  console.error('  COMMIT IS NOT SELF-CONTAINED — it references symbols that exist');
  console.error('  only in your uncommitted working tree.');
  console.error('════════════════════════════════════════════════════════════════════');
  console.error('');
  console.error('First 30 errors:');
  console.error('');
  console.error(firstThirty);
  if (lines.length > 30) {
    console.error(`\n  … and ${lines.length - 30} more lines.`);
  }
  console.error('');
  console.error('Fix: stage or commit the missing symbols, then re-run.');
  console.error('');
  process.exit(1);
}
