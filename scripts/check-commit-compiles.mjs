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
import { resolvingNodeModules } from './lib/resolve-node-modules.mjs';

// ── config ────────────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Heavy and/or compilation-irrelevant directories excluded from the git
// archive to keep extraction fast.
//
// Remotion / video/* factory retired 2026-08-18.
const ARCHIVE_EXCLUDES = [
  // Root-level heavy dirs (GBs of compiled video, images, docs)
  'public',
  'out',
  'design_system',
  'docs',
  'listing_video_v4',
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
    // Stream git-archive into tar. Buffering the archive in node (spawnSync
    // maxBuffer) then feeding tar's stdin deadlocks: tar's close() waits for
    // EOF while node waits for tar to exit. Hit on a ~480MB filtered tree.
    const piped = spawnSync(
      'sh',
      ['-c', 'git archive HEAD -- "$@" | tar -x -C "$0"', TMP, ...excludeArgs],
      { cwd: REPO_ROOT, stdio: ['ignore', 'inherit', 'inherit'] },
    );
    if (piped.status !== 0) {
      console.error('FAIL\n' + (piped.stderr?.toString() ?? `git archive | tar exited ${piped.status}`));
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
//
// Not REPO_ROOT/node_modules: in a git worktree that is a stub and imports
// resolve by walking up to the main checkout. The materialized tree in
// os.tmpdir() has no such upward path, so `npx tsc` fell through to the
// squatter `tsc` package (observed 2026-08-21). Link the directory Node
// actually resolves typescript from.

const srcModules = resolvingNodeModules();
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
// out/ remains excluded.

// Incremental cache: tsbuildinfo persists across runs in ~/.cache so a push
// that changed 3 files typechecks in seconds, not 60-80s. Correct on a fresh
// materialized tree because tsbuildinfo validates by file CONTENT hash — any
// drifted file is fully re-checked, and cached semantic diagnostics replay for
// unchanged ones. Backstops if the cache ever lied: the same tsc runs fresh in
// CI, and a broken commit fails the Vercel build with deploy:verify going red.
// COMMIT_COMPILES_NO_CACHE=1 forces a from-scratch check.
const CACHE_DIR = path.join(os.homedir(), '.cache', 'rr-commit-check');
const CACHE_BUILDINFO = path.join(CACHE_DIR, 'tsbuildinfo');
const TMP_BUILDINFO = path.join(TMP, '.tsbuildinfo.check');
const useCache = process.env.COMMIT_COMPILES_NO_CACHE !== '1';
if (useCache && fs.existsSync(CACHE_BUILDINFO)) {
  try { fs.copyFileSync(CACHE_BUILDINFO, TMP_BUILDINFO); } catch { /* cold run */ }
}

const wrapperTsconfig = {
  extends: './tsconfig.json',
  compilerOptions: {
    incremental: true,
    tsBuildInfoFile: './.tsbuildinfo.check',
    baseUrl: '.',
    paths: {
      '@/*': ['./*'],
    },
  },
  // The base include pulls in `.next/types/**/*.ts` and `.next/dev/types/**/*.ts`
  // which don't exist in the commit tree.  Replicate the meaningful parts
  // without those.  `**/*.ts` and `**/*.tsx` already cover the source tree.
  include: ['**/*.ts', '**/*.tsx', '**/*.mts'],
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

const tscT0 = Date.now();
const tscResult = spawnSync(
  npxBin,
  ['tsc', '--noEmit', '-p', path.join(TMP, 'tsconfig.check.json')],
  {
    cwd: TMP,
    encoding: 'utf8',
    // Give tsc up to 15 minutes — correctness wins over speed per spec.
    // Raised from 5 min on 2026-08-26: the repo outgrew that budget the same way
    // it outgrew Node's default heap (see the NODE_OPTIONS note below). A COLD
    // run — which is what you get right after a rebase invalidates the cached
    // buildinfo — measured 317s and 370s on an otherwise idle machine, so the
    // gate reported INCONCLUSIVE on every push and could not recover: the
    // buildinfo below is only persisted when tsc finishes WITHOUT a signal, so
    // one timeout guarantees the next run is cold too. A budget the gate cannot
    // meet is not a safety property, it is a wedge.
    timeout: 900_000,
    maxBuffer: 10 * 1024 * 1024,
    // The repo outgrew Node's default heap: without the same 8GB every other
    // tsc invocation here gets (pre-push build, ci scripts), tsc dies with
    // SIGABRT ~50s in and the gate reports INCONCLUSIVE on every push
    // (observed live 2026-08-05, three consecutive pushes).
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=8192' },
  }
);

const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
const tscSecs = ((Date.now() - tscT0) / 1000).toFixed(1);

// Persist the buildinfo for the next run — on failure too: diagnostics for
// unchanged files replay from it, and fixed files re-check by content hash.
if (useCache && !tscResult.signal && !tscResult.error && fs.existsSync(TMP_BUILDINFO)) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.copyFileSync(TMP_BUILDINFO, CACHE_BUILDINFO);
  } catch { /* cache is a convenience */ }
}

if (tscResult.status === 0) {
  console.log(`PASS  (${elapsed}s, tsc ${tscSecs}s${useCache ? ', incremental' : ''})\n`);
  console.log('✓  COMMIT IS SELF-CONTAINED — all referenced symbols exist in the committed tree.\n');
  process.exit(0);
} else {
  console.log(`FAIL  (${elapsed}s)\n`);

  const output = (tscResult.stdout ?? '') + (tscResult.stderr ?? '');
  const lines = output.split('\n').filter(Boolean);

  // A killed/timed-out tsc is NOT a self-containment verdict. Without this
  // branch a 300s timeout printed the "NOT SELF-CONTAINED" banner with an
  // EMPTY error list (observed 2026-07-17: load avg ~90 from a concurrent
  // session's tsc starved this one) — a misleading failure that reads like a
  // real gate hit. Report it as inconclusive-but-blocking with the real cause.
  if (tscResult.signal || tscResult.error) {
    console.error('════════════════════════════════════════════════════════════════════');
    console.error(`  INCONCLUSIVE — tsc did not finish (${tscResult.signal ?? tscResult.error?.code ?? 'unknown'})`);
    console.error('  This is a timeout/kill, NOT a self-containment verdict. Likely the');
    console.error('  machine is under heavy load (another build/session). Re-run when');
    console.error('  load drops. The gate still blocks: an unverified commit must not ship.');
    console.error('════════════════════════════════════════════════════════════════════');
    process.exit(1);
  }

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
