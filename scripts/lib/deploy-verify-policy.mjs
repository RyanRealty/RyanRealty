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
import { classifyDiff, isVercelSkippable, listChangedFiles } from './product-diff.mjs'

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
  return classifyDiff(listChangedFiles({ head: sha, cwd: opts.cwd, prev: opts.prev }), { skippable: isVercelSkippable })
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
