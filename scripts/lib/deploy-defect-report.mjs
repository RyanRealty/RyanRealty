/**
 * deploy-defect-report.mjs — deploy:verify's side of "a deploy-found defect is one
 * claimable work node" (Matt 2026-10-14).
 *
 * WHY. On 2026-10-14 two sessions both saw `npm run deploy:verify` flag the same
 * noindex sitemap URLs and both built a fix. The check now hands each failure, and
 * each pass, to the work graph through ONE child process (scripts/deploy-defects.ts,
 * under tsx --conditions=react-server, because the work-graph DAL is server-only
 * TypeScript and deploy:verify is plain node). The rules (fingerprint, idempotent
 * filing, who holds a node, closing on a pass) are lib/data/loop/deploy-defects.ts;
 * this file collects results and carries them across the process boundary.
 *
 * NEVER FATAL. Filing is a courtesy on top of the verdict: a missing tsx, an
 * unreachable database, a timeout or garbage on stdout returns lines saying so, and
 * deploy:verify prints its failures and exits with the code it always did.
 * `write: false` (`--no-file` or DEPLOY_VERIFY_NO_FILE=1) reads and prints, and the
 * child refuses every write.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const FILER_SCRIPT = 'scripts/deploy-defects.ts'
export const FILE_TIMEOUT_MS = 90_000
export const READ_TIMEOUT_MS = 45_000

/** `npm run deploy:verify -- --no-file`, or DEPLOY_VERIFY_NO_FILE=1: read, print, write nothing. */
export function noFileRequested(argv, env = process.env) {
  return argv.includes('--no-file') || env.DEPLOY_VERIFY_NO_FILE === '1'
}

/** Run the filer. Returns spawnSync's shape; `spawn` is injectable for tests. */
export function runFiler(args, input, { timeoutMs = FILE_TIMEOUT_MS, spawn = spawnSync, cwd = REPO } = {}) {
  const local = join(cwd, 'node_modules/.bin/tsx')
  const [cmd, pre] = existsSync(local) ? [local, []] : ['npx', ['--no-install', 'tsx']]
  return spawn(cmd, [...pre, '--conditions=react-server', FILER_SCRIPT, ...args], {
    cwd,
    input,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
    env: process.env,
  })
}

/** The filer prints one JSON line last; tsx may print warnings before it. */
export function parseFilerJson(stdout) {
  const last = String(stdout ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .pop()
  if (!last) return null
  try {
    return JSON.parse(last)
  } catch {
    return null
  }
}

function why(r) {
  if (r.error) return r.error.code === 'ETIMEDOUT' ? 'timed out' : String(r.error.message ?? r.error).slice(0, 120)
  if (r.signal) return `killed by ${r.signal}`
  const tail = String(r.stderr ?? '').trim().split('\n').filter(Boolean).pop()
  return `exit ${r.status}${tail ? `: ${tail.slice(0, 140)}` : ''}`
}

/**
 * One deploy:verify run's results. `record` as each check finishes, `flush` once
 * before exit. Both are safe to call on any path and never throw.
 *
 * @param {{ sha: string, at?: string, write?: boolean, run?: typeof runFiler }} opts
 */
export function createDefectReport({ sha, at = new Date().toISOString(), write = true, run = runFiler }) {
  /** @type {object[]} */
  const results = []
  /** @type {{ nodes: Array<{ gap: string, family: string | null, state: string, owner: string | null, paths: string[] }> } | null} */
  let active = null

  return {
    results,
    write,

    /** A check finished: { family, status: 'fail'|'pass'|'skipped', keys?, lines?, evidence?, scope? }. */
    record(result) {
      results.push(result)
    },

    /**
     * The URLs the open deploy-found nodes of a check name, so a capped sitemap walk
     * fetches them and a pass means something. Empty when the graph is unreachable.
     */
    priorityPaths(family) {
      if (!active) {
        try {
          const r = run(['--read'], undefined, { timeoutMs: READ_TIMEOUT_MS })
          active = r.status === 0 ? parseFilerJson(r.stdout) : null
        } catch {
          active = null
        }
        if (!Array.isArray(active?.nodes)) active = { nodes: [] }
      }
      return [...new Set(active.nodes.filter((n) => n.family === family).flatMap((n) => n.paths ?? []))]
    },

    /** File what failed, close what passed. Returns the lines deploy:verify prints. */
    flush() {
      if (!results.some((r) => r.status === 'fail' || r.status === 'pass')) return { lines: [], outcomes: [] }
      const failed = results.filter((r) => r.status === 'fail').length
      try {
        const args = ['--file', ...(write ? [] : ['--dry-run'])]
        const r = run(args, JSON.stringify({ sha, at, write, results }), { timeoutMs: FILE_TIMEOUT_MS })
        const parsed = r.status === 0 ? parseFilerJson(r.stdout) : null
        if (parsed && Array.isArray(parsed.lines)) return { lines: parsed.lines, outcomes: parsed.outcomes ?? [] }
        return {
          lines: failed
            ? [
                `deploy-defect filing unavailable (${why(r)}): ${failed} failing check(s) NOT filed. Look for an existing DEPLOY- node (npx tsx scripts/loop-brief.ts) before you start a fix.`,
              ]
            : [],
          outcomes: [],
        }
      } catch (e) {
        return {
          lines: failed ? [`deploy-defect filing unavailable (${String(e?.message ?? e).slice(0, 120)}): ${failed} failing check(s) NOT filed.`] : [],
          outcomes: [],
        }
      }
    },
  }
}
