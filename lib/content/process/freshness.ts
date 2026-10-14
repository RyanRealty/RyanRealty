/**
 * lib/content/process/freshness.ts - `npm run studio` refuses to run on a
 * checkout that is behind main (docs/plans/CONTENT_PROCESS.md, "No stale
 * copies"): a bot on an old checkout holds old rules.
 *
 * The test is ancestry: origin/main must be an ancestor of HEAD (or HEAD itself).
 * `git merge-base --is-ancestor refs/remotes/origin/main HEAD` answers it:
 * exit 0 means HEAD has everything main has, exit 1 means main has commits HEAD
 * lacks (behind, or diverged), any other result means git could not tell. When
 * git cannot tell, the run is refused, never allowed.
 *
 * The CLI fetches first, with a short timeout. Tests never fetch: they build a
 * temp repo and pass its environment (every inherited GIT_* variable removed,
 * GIT_DIR, GIT_WORK_TREE and GIT_INDEX_FILE set), so no test can touch the
 * checkout it runs in. This file never runs `git config`.
 */
import { spawnSync } from 'node:child_process'

/** The variables that decide WHICH repository git works on. A child must not inherit them from a hook or a parent git. */
const REPO_LOCATION_VARS = [
  'GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_COMMON_DIR',
  'GIT_NAMESPACE', 'GIT_PREFIX', 'GIT_CEILING_DIRECTORIES', 'GIT_DISCOVERY_ACROSS_FILESYSTEM', 'GIT_QUARANTINE_PATH', 'GIT_INTERNAL_SUPER_PREFIX',
]

/** The environment with the variables that pick a repository removed (the CLI keeps auth and proxy settings). */
export function withoutRepoLocation(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = { ...env }
  for (const k of REPO_LOCATION_VARS) delete out[k]
  return out
}

/** The environment with EVERY GIT_* variable removed (what a hermetic test starts from). */
export function withoutAnyGitVar(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const out = {} as NodeJS.ProcessEnv
  for (const [k, v] of Object.entries(env)) if (!k.startsWith('GIT_')) out[k] = v
  return out
}

export type GitRun = { status: number | null; stdout: string; stderr: string }

export type GitRunner = (args: string[]) => GitRun

/** A runner for one repository: `git -C <cwd>` unless the environment names the repository itself. */
export function gitRunner(opts: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number } = {}): GitRunner {
  const env = opts.env ?? withoutRepoLocation()
  return (args) => {
    const r = spawnSync('git', opts.cwd && !env.GIT_DIR ? ['-C', opts.cwd, ...args] : args, { encoding: 'utf8', env, timeout: opts.timeoutMs ?? 20_000, stdio: ['ignore', 'pipe', 'pipe'] })
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
  }
}

export type Freshness = { ok: true; head: string; main: string } | { ok: false; problem: string }

const MAIN = 'refs/remotes/origin/main'

/**
 * Is this checkout level with or ahead of origin/main? Compares HEAD with the
 * LOCAL remote-tracking ref; it does not fetch (the CLI does, before calling).
 */
export function checkFreshness(git: GitRunner): Freshness {
  const head = git(['rev-parse', '--verify', '-q', 'HEAD'])
  if (head.status !== 0 || !head.stdout.trim()) return { ok: false, problem: 'git could not read HEAD, so the checkout cannot be compared with origin/main; run from the repository' }
  const main = git(['rev-parse', '--verify', '-q', MAIN])
  if (main.status !== 0 || !main.stdout.trim()) return { ok: false, problem: `there is no ${MAIN} here, so the checkout cannot be compared with main; fetch origin first` }
  const sha = { head: head.stdout.trim(), main: main.stdout.trim() }
  const anc = git(['merge-base', '--is-ancestor', MAIN, 'HEAD'])
  if (anc.status === 0) return { ok: true, ...sha }
  if (anc.status === 1) {
    const behind = git(['rev-list', '--count', `HEAD..${MAIN}`])
    const n = behind.status === 0 ? behind.stdout.trim() : 'some'
    return { ok: false, problem: `this checkout is behind origin/main (main has ${n} commit(s) HEAD does not): update the branch from main before running the studio, so it holds today's rules` }
  }
  return { ok: false, problem: `git could not tell whether this checkout is behind origin/main (${(anc.stderr || 'no message').trim().split('\n')[0]}), so the run is refused` }
}

/** The CLI's check: fetch main with a short timeout, then compare. A fetch that fails is a refusal: stale refs cannot say. */
export function fetchAndCheckFreshness(cwd: string, opts: { fetchTimeoutMs?: number; env?: NodeJS.ProcessEnv } = {}): Freshness {
  const fetch = gitRunner({ cwd, env: opts.env, timeoutMs: opts.fetchTimeoutMs ?? 20_000 })(['fetch', '--quiet', 'origin', 'main'])
  if (fetch.status !== 0) {
    return { ok: false, problem: `git could not fetch origin/main (${(fetch.stderr || 'timed out or no network').trim().split('\n')[0]}), so it cannot tell whether this checkout is behind main; the run is refused` }
  }
  return checkFreshness(gitRunner({ cwd, env: opts.env }))
}
