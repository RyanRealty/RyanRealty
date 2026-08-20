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
export const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000
export const DEFAULT_SKIP_WAIT_MS = 45 * 1000

const ACTIVE_STATES = new Set(['READY', 'BUILDING', 'QUEUED', 'INITIALIZING', 'PENDING'])

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
