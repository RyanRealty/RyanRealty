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
 *      On the shared box, wrap that command in heavy.sh so only one heavy
 *      job runs at a time. Spawn is detached so the gate can kill the whole
 *      process tree on timeout / signal / error.
 *   5. Exit 0 clean / exit 1 with headline + first 30 error lines.
 *   6. Trap cleans $TMP and the tsc process group on any exit.
 */

import { execSync, spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvingNodeModules } from './lib/resolve-node-modules.mjs';

// ── config ────────────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const __filename = fileURLToPath(import.meta.url);

/** Shared-box mutex. One heavy compile/render at a time when this wrapper exists. */
export const HEAVY_SH = '/home/box/agent-data/tools/heavy.sh';

/** ~10 minutes. Override with COMMIT_COMPILES_TIMEOUT_MS (milliseconds). */
export const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

/** After SIGTERM, give the group this long before SIGKILL. */
export const KILL_GRACE_MS = 5_000;

export const COMMIT_CHECK_TMP_PREFIX = 'rr-commit-check-';

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

/**
 * @param {{ npxBin: string, tsconfigPath: string, heavyShExists?: boolean, heavySh?: string }} opts
 * @returns {{ command: string, args: string[] }}
 */
export function resolveTscCommand({
  npxBin,
  tsconfigPath,
  heavyShExists,
  heavySh = HEAVY_SH,
}) {
  const tscArgs = [npxBin, 'tsc', '--noEmit', '-p', tsconfigPath];
  const useHeavy = heavyShExists ?? fs.existsSync(heavySh);
  if (useHeavy) {
    return { command: heavySh, args: tscArgs };
  }
  return { command: npxBin, args: tscArgs.slice(1) };
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {number}
 */
export function parseTimeoutMs(env = process.env) {
  const raw = env.COMMIT_COMPILES_TIMEOUT_MS;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return n;
  return DEFAULT_TIMEOUT_MS;
}

/** True while spawn() has a live pid that still belongs to this child. */
export function childStillRunning(child) {
  return Boolean(child?.pid) && child.exitCode == null && child.signalCode == null;
}

/**
 * SIGTERM the process group. `pid` is the group leader (spawn detached:true).
 * @param {number | null | undefined} pid
 * @param {{ kill?: typeof process.kill }} [deps]
 * @returns {boolean} whether the signal was sent
 */
export function killProcessGroup(pid, { kill } = {}) {
  if (!pid || pid <= 0) return false;
  try {
    if (kill) kill(-pid, 'SIGTERM');
    else process.kill(-pid, 'SIGTERM');
    return true;
  } catch {
    return false;
  }
}

/**
 * Detached delayed SIGKILL so the tree still dies if this process is exiting.
 * @param {number | null | undefined} pid
 * @param {{ spawnFn?: typeof spawn, execPath?: string, graceMs?: number }} [deps]
 * @returns {import('node:child_process').ChildProcess | null}
 */
export function spawnDetachedSigkill(pid, {
  spawnFn = spawn,
  execPath = process.execPath,
  graceMs = KILL_GRACE_MS,
} = {}) {
  if (!pid || pid <= 0) return null;
  const group = -Number(pid);
  const delay = Number(graceMs);
  const child = spawnFn(
    execPath,
    ['-e', `setTimeout(()=>{try{process.kill(${group},'SIGKILL')}catch{}},${delay})`],
    { detached: true, stdio: 'ignore' },
  );
  child.unref();
  return child;
}

/**
 * @param {string | null | undefined} dir
 * @param {{ rmSync?: typeof fs.rmSync }} [deps]
 */
export function cleanupCommitCheckDir(dir, { rmSync = fs.rmSync } = {}) {
  if (!dir) return;
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // best-effort
  }
}

/**
 * Kill the tsc process tree and drop the materialized /tmp/rr-commit-check-* dir.
 * SIGTERM now; detached SIGKILL after ~5s so the tree dies even if we are exiting.
 * @param {number | null | undefined} pid
 * @param {string | null | undefined} dir
 * @param {object} [deps]
 */
export function reapCommitCheckChild(pid, dir, deps = {}) {
  killProcessGroup(pid, deps);
  spawnDetachedSigkill(pid, deps);
  cleanupCommitCheckDir(dir, deps);
}

/**
 * Spawn tsc (optionally via heavy.sh) in its own process group and wait.
 * @param {{
 *   command: string,
 *   args: string[],
 *   cwd: string,
 *   env: NodeJS.ProcessEnv,
 *   timeoutMs: number,
 *   onSpawn?: (child: import('node:child_process').ChildProcess) => void,
 *   spawnFn?: typeof spawn,
 *   reap?: typeof reapCommitCheckChild,
 *   graceMs?: number,
 * }} opts
 */
export function runTscDetached({
  command,
  args,
  cwd,
  env,
  timeoutMs,
  onSpawn,
  spawnFn = spawn,
  reap = reapCommitCheckChild,
  graceMs = KILL_GRACE_MS,
}) {
  return new Promise((resolve) => {
    const child = spawnFn(command, args, {
      cwd,
      env,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    onSpawn?.(child);

    let stdout = '';
    let stderr = '';
    const cap = 10 * 1024 * 1024;
    const take = (chunk, acc) => {
      if (acc.length >= cap) return acc;
      const s = String(chunk);
      return acc.length + s.length > cap ? acc + s.slice(0, cap - acc.length) : acc + s;
    };
    child.stdout?.on('data', (c) => { stdout = take(c, stdout); });
    child.stderr?.on('data', (c) => { stderr = take(c, stderr); });

    let settled = false;
    let timedOut = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ...result,
        timedOut,
        error: timedOut
          ? (result.error ?? Object.assign(new Error(`tsc timed out after ${timeoutMs}ms`), { code: 'ETIMEDOUT' }))
          : result.error,
      });
    };

    const timer = setTimeout(() => {
      timedOut = true;
      reap(child.pid, null, { graceMs });
      setTimeout(() => {
        finish({
          status: null,
          signal: 'SIGTERM',
          error: Object.assign(new Error(`tsc timed out after ${timeoutMs}ms`), { code: 'ETIMEDOUT' }),
          stdout,
          stderr,
        });
      }, graceMs);
    }, timeoutMs);

    child.on('error', (error) => {
      finish({ status: null, signal: null, error, stdout, stderr });
    });
    child.on('close', (status, signal) => {
      finish({ status, signal, error: null, stdout, stderr });
    });
  });
}

// ── CLI + process-tree trap (only when executed as the gate) ──────────────────

let TMP = null;
/** @type {import('node:child_process').ChildProcess | null} */
let tscChild = null;
let reaped = false;

function liveChildPid() {
  return childStillRunning(tscChild) ? tscChild.pid : null;
}

function reapLiveChild() {
  if (reaped) {
    cleanupCommitCheckDir(TMP);
    return;
  }
  reaped = true;
  reapCommitCheckChild(liveChildPid(), TMP);
}

async function abortNonZero(code) {
  const pid = liveChildPid();
  reapLiveChild();
  if (pid) {
    await new Promise((r) => setTimeout(r, KILL_GRACE_MS));
    try { process.kill(-pid, 'SIGKILL'); } catch { /* already gone */ }
  }
  process.exit(code);
}

function registerTraps() {
  process.on('exit', () => {
    reapLiveChild();
  });
  process.on('SIGINT', () => { void abortNonZero(130); });
  process.on('SIGTERM', () => { void abortNonZero(143); });
  process.on('uncaughtException', (err) => {
    console.error('[check-commit-compiles]', err);
    void abortNonZero(1);
  });
  process.on('unhandledRejection', (err) => {
    console.error('[check-commit-compiles]', err);
    void abortNonZero(1);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args.includes('--staged') ? 'staged' : 'head';

  console.log(`\n▶  G46 commit self-containment — mode: ${mode}`);

  const t0 = Date.now();

  TMP = fs.mkdtempSync(path.join(os.tmpdir(), COMMIT_CHECK_TMP_PREFIX));
  registerTraps();

  // ── 1. materialize the target tree ───────────────────────────────────────────

  if (mode === 'head') {
    // Build the git archive command with pathspec exclusions.
    // ':!path' syntax tells git to exclude that path from the tree.
    const excludeArgs = ARCHIVE_EXCLUDES.map(p => `:!${p}`);

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
  // Whether a buildinfo was ACTUALLY loaded — not merely whether caching is on.
  // The PASS line used to print ", incremental" off useCache alone, so a cold run
  // reported itself as incremental and made the 641s it took look inexplicable.
  let warmStart = false;
  if (useCache && fs.existsSync(CACHE_BUILDINFO)) {
    try {
      fs.copyFileSync(CACHE_BUILDINFO, TMP_BUILDINFO);
      warmStart = true;
    } catch { /* cold run */ }
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

  const tsconfigPath = path.join(TMP, 'tsconfig.check.json');
  const { command, args: tscArgs } = resolveTscCommand({
    npxBin,
    tsconfigPath,
    heavyShExists: fs.existsSync(HEAVY_SH),
  });

  const timeoutMs = parseTimeoutMs();
  const tscT0 = Date.now();
  const tscResult = await runTscDetached({
    command,
    args: tscArgs,
    cwd: TMP,
    // The repo outgrew Node's default heap: without a raised ceiling tsc dies
    // with SIGABRT ~50s in and the gate reports INCONCLUSIVE on every push
    // (observed live 2026-08-05, three consecutive pushes).
    //
    // Raised 8GB -> 12GB on 2026-08-26. Measured that day, on this repo: a
    // bare `tsc --noEmit` at Node's 4GB default spent 300s in Mark-Compact
    // and died "allocation failure"; at 8GB it was SIGKILLed; at 12GB it
    // completed with 0 errors. This is the honest kind of widening: the
    // verdict at 12GB is a real type-check, where the verdict at 8GB was no
    // verdict at all.
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=12288' },
    timeoutMs,
    onSpawn: (child) => { tscChild = child; },
  });

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const tscSecs = ((Date.now() - tscT0) / 1000).toFixed(1);

  // Persist the buildinfo for the next run — on failure too: diagnostics for
  // unchanged files replay from it, and fixed files re-check by content hash.
  if (useCache && !tscResult.signal && !tscResult.error && !tscResult.timedOut && fs.existsSync(TMP_BUILDINFO)) {
    try {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.copyFileSync(TMP_BUILDINFO, CACHE_BUILDINFO);
    } catch { /* cache is a convenience */ }
  }

  if (tscResult.status === 0) {
    console.log(`PASS  (${elapsed}s, tsc ${tscSecs}s, ${warmStart ? 'incremental' : 'cold'})\n`);
    console.log('✓  COMMIT IS SELF-CONTAINED — all referenced symbols exist in the committed tree.\n');
    process.exit(0);
  } else {
    console.log(`FAIL  (${elapsed}s)\n`);

    const output = (tscResult.stdout ?? '') + (tscResult.stderr ?? '');
    const lines = output.split('\n').filter(Boolean);

    // A killed/timed-out tsc is NOT a self-containment verdict. Without this
    // branch a timeout printed the "NOT SELF-CONTAINED" banner with an
    // EMPTY error list (observed 2026-07-17: load avg ~90 from a concurrent
    // session's tsc starved this one) — a misleading failure that reads like a
    // real gate hit. Report it as inconclusive-but-blocking with the real cause.
    if (tscResult.timedOut || tscResult.signal || tscResult.error) {
      console.error('════════════════════════════════════════════════════════════════════');
      if (tscResult.timedOut) {
        console.error(`  INCONCLUSIVE — tsc timed out after ${Math.round(timeoutMs / 1000)}s`);
        console.error(`  Override with COMMIT_COMPILES_TIMEOUT_MS (milliseconds).`);
      } else {
        console.error(`  INCONCLUSIVE — tsc did not finish (${tscResult.signal ?? tscResult.error?.code ?? 'unknown'})`);
      }
      console.error('  This is a timeout/kill, NOT a self-containment verdict. Likely the');
      console.error('  machine is under heavy load (another build/session). Re-run when');
      console.error('  load drops. The gate still blocks: an unverified commit must not ship.');
      console.error(`  This run was ${warmStart ? 'warm' : 'cold'}. A kill leaves no buildinfo, so the next run`);
      console.error('  starts cold. The default budget is 10 min (COMMIT_COMPILES_TIMEOUT_MS).');
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
}

const invokedDirectly = (() => {
  try {
    return Boolean(process.argv[1]) && fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(__filename);
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  main().catch((err) => {
    console.error('[check-commit-compiles]', err);
    void abortNonZero(1);
  });
}
