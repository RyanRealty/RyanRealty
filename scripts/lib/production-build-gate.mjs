/**
 * production-build-gate.mjs — may `npm run ship` merge now, or is a production
 * build still running?
 *
 * WHY (2026-10-14/15). Every production build on Vercel prerenders ~850 pages
 * against the one Supabase project, and two at once double that load. Of the
 * nine production builds that ERRORed that day and night, six ran while another
 * production build was running (a107eaa6b with b70e1f9ad, 84cb04f65 with
 * 9be2b3fdd, 458d4a40a beside fb68c62ff, 0a9c47645 beside 8357b3122), and the
 * database restarted uncleanly twice inside those overlaps (22:20Z, 22:43Z).
 * Merges land seconds apart (#619 and #620 merged 2 s apart), and each merge
 * to main starts its own production build.
 *
 * THE RULE. Merge only when no production deployment is building, queued or
 * initializing, and when main's tip already has its deployment (Vercel opens
 * it seconds after the push; until then the build is coming, not absent). A
 * tip that never gets one (a push Vercel does not build) stops counting after
 * `pendingTipGraceMs`.
 *
 * Pure: the caller fetches the deployments. Tests: production-build-gate.test.mjs.
 */

export const IN_FLIGHT_STATES = Object.freeze(new Set(['BUILDING', 'QUEUED', 'INITIALIZING', 'PENDING']))

/** How long a main tip with no deployment yet is treated as a build on its way. */
export const PENDING_TIP_GRACE_MS = 3 * 60 * 1000

function stateOf(d) {
  return String(d?.state ?? d?.readyState ?? '').toUpperCase()
}

function shaOf(d) {
  return String(d?.sha ?? d?.meta?.githubCommitSha ?? '').toLowerCase()
}

function sameCommit(a, b) {
  if (!a || !b) return false
  return a === b || a.startsWith(b) || b.startsWith(a)
}

/**
 * @param {Array<{ uid?: string, id?: string, state?: string, readyState?: string, sha?: string, created?: number, meta?: { githubCommitSha?: string } }>} deployments
 *   the latest production deployments of the project
 * @param {{ mainSha?: string, tipPendingForMs?: number, now?: number, pendingTipGraceMs?: number }} [opts]
 *   `tipPendingForMs`: how long the caller has seen main at `mainSha` without a deployment
 * @returns {{ wait: boolean, reason: string, inFlight: Array<{ id: string, sha: string, state: string, minutes: number }> }}
 */
export function productionBuildGate(deployments, opts = {}) {
  const now = opts.now ?? Date.now()
  const grace = opts.pendingTipGraceMs ?? PENDING_TIP_GRACE_MS
  const list = Array.isArray(deployments) ? deployments : []
  const inFlight = list
    .filter((d) => IN_FLIGHT_STATES.has(stateOf(d)))
    .map((d) => ({
      id: String(d?.uid ?? d?.id ?? ''),
      sha: shaOf(d).slice(0, 9),
      state: stateOf(d),
      minutes: d?.created ? Math.max(0, Math.round((now - Number(d.created)) / 60_000)) : 0,
    }))
  if (inFlight.length > 0) {
    const names = inFlight.map((b) => `${b.sha || b.id} ${b.state} ${b.minutes} min`).join(', ')
    return { wait: true, reason: `production build in flight: ${names}`, inFlight }
  }
  const mainSha = String(opts.mainSha ?? '').toLowerCase()
  if (mainSha && !list.some((d) => sameCommit(shaOf(d), mainSha))) {
    if ((opts.tipPendingForMs ?? 0) < grace) {
      return {
        wait: true,
        reason: `main ${mainSha.slice(0, 9)} has no production deployment yet (Vercel opens it after the push)`,
        inFlight,
      }
    }
  }
  return { wait: false, reason: 'no production build in flight', inFlight }
}
