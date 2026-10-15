/**
 * deploy-verify-policy.mjs — skip / superseded / timeout rules for
 * `npm run deploy:verify` (scripts/check-vercel-deploy.mjs).
 *
 * Why: after local `next build` left the push path, verify is the net that
 * a production generate ERROR is not reported as “shipped.” A 5-minute cap
 * is shorter than queue + generate. A docs tip that Vercel ignoreCommand
 * skipped must not wait out the cap and exit 2. A CANCELED deploy that lost
 * to a newer production build is superseded, not a broken commit.
 */
import { classifyProductDiff, isVercelSkippable, listChangedFiles } from './product-diff.mjs'

export const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000
export const DEFAULT_SKIP_WAIT_MS = 45 * 1000

const ACTIVE_STATES = new Set(['READY', 'BUILDING', 'QUEUED', 'INITIALIZING', 'PENDING'])

/**
 * How the commit being verified classifies for Vercel's ignoreCommand: that
 * commit's own diff (a merge against its first parent), never the checkout's
 * HEAD. `deploy:verify <sha>` from a docs-only HEAD used to classify the docs
 * commit, so a product deploy Vercel had not listed within the SKIP window
 * printed SKIP and exited 0 (2026-10-09, the #424 squash merge read as
 * "skip, 1 file(s)").
 *
 * @param {string} sha
 * @param {{ cwd?: string, prev?: string }} [opts]  prev: as listChangedFiles (default: the env range)
 */
export function classifyTip(sha, opts = {}) {
  return classifyProductDiff(listChangedFiles({ head: sha, cwd: opts.cwd, prev: opts.prev }), {
    skippable: isVercelSkippable,
    head: sha,
    cwd: opts.cwd,
    prev: opts.prev,
  })
}

/**
 * @param {'unknown' | 'empty' | 'skip' | 'build'} status
 * @returns {boolean}
 */
export function isSkippableTip(status) {
  return status === 'skip' || status === 'empty'
}

/**
 * A newer production deployment in an active state means Vercel canceled
 * this SHA in favor of a later push — not that this tree failed to compile.
 *
 * @param {{ created?: number }} canceled
 * @param {Array<{ created?: number, state?: string, sha?: string, meta?: { githubCommitSha?: string }, id?: string, uid?: string }>} others
 * @param {string} ourSha
 * @returns {typeof others[number] | null}
 */
export function findSupersedingDeploy(canceled, others, ourSha) {
  const our = String(ourSha || '').toLowerCase()
  const t = Number(canceled?.created) || 0
  if (!Array.isArray(others) || others.length === 0) return null
  for (const d of others) {
    const st = String(d?.state || '').toUpperCase()
    if (!ACTIVE_STATES.has(st)) continue
    const created = Number(d?.created) || 0
    if (t && created && created <= t) continue
    const sha = String(d?.sha || d?.meta?.githubCommitSha || '').toLowerCase()
    if (sha && our && (sha === our || sha.startsWith(our) || our.startsWith(sha))) continue
    return d
  }
  return null
}

/**
 * The other production builds whose build window overlapped this one.
 *
 * The build telemetry tripwire in check-vercel-deploy.mjs (G70) reads a slow
 * static generation as the build-cost class returning. On 2026-10-14 nine
 * production builds ran in 48 minutes, one to three at a time, and every one
 * of them read 192 to 372 s of static generation with 33 to 104 rail timeouts,
 * while every build that ran alone before and after read 106 to 168 s with 6
 * to 36. A build that shared the database with another build proves nothing
 * about the code; the next solo build is the measurement. The caller names the
 * builds this returns so a reader can see the crowd instead of a regression.
 *
 * A deployment's window runs from `buildingAt` to `ready` (Vercel sets `ready`
 * on an ERROR too); one still building ends at `now`. A deployment with no
 * `buildingAt` never built (ignoreCommand canceled it) and cannot have
 * contended.
 *
 * @param {{ uid?: string, id?: string, buildingAt?: number, ready?: number, state?: string }} target
 * @param {Array<{ uid?: string, id?: string, buildingAt?: number, ready?: number, state?: string, sha?: string, meta?: { githubCommitSha?: string } }>} others
 * @param {number} [now]
 * @returns {Array<{ id: string, sha: string, state: string }>}
 */
export function concurrentBuilds(target, others, now = Date.now()) {
  const ours = buildWindow(target, now)
  if (!ours) return []
  const selfId = String(target?.uid ?? target?.id ?? '')
  const out = []
  for (const d of Array.isArray(others) ? others : []) {
    const id = String(d?.uid ?? d?.id ?? '')
    if (!id || id === selfId) continue
    const w = buildWindow(d, now)
    if (!w) continue
    if (w.start < ours.end && w.end > ours.start) {
      out.push({
        id,
        sha: String(d?.sha || d?.meta?.githubCommitSha || '').slice(0, 7),
        state: String(d?.state || '').toUpperCase(),
      })
    }
  }
  return out
}

function buildWindow(d, now) {
  const start = Number(d?.buildingAt) || 0
  if (!start) return null
  const state = String(d?.state || '').toUpperCase()
  const ready = Number(d?.ready) || 0
  const end = ready || (ACTIVE_STATES.has(state) && state !== 'READY' ? now : 0)
  if (!end || end < start) return null
  return { start, end }
}
