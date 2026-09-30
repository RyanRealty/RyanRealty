// The site tracker as it was deployed before the session rule (components/VisitTracker.tsx
// on main up to the 2026-09-30 deploy: getOrCreateSessionId and nextVisitContext, run by
// fireFirstPartyEvent on every event). A tab loaded before the deploy keeps running it until
// it reloads: a search page whose filters change the address with pushState never does.
//
// What it does to the storage every tab shares, per event: it keeps rr_session_id (minting
// one only when there is none or it is not a uuid), and it REWRITES rr_visit_v1 as
// { id, n, last }, a new visit after 30 minutes idle, with nothing else in it. It never
// reads or writes rr_visit_sid_v1. Its sessionStorage writes (rr_session_id, rr_source_v1)
// land in its own tab's sessionStorage, not the tab under test, so they are left out here.
//
// The rollout tests run it between the current trackers' events. While the session id sat
// in rr_visit_v1, this rewrite erased it and the current tracker read every such event as a
// session it did not start: five session ids in nine minutes of one visit (review of
// 2026-09-30).
//
// Lives in test/ rather than lib/ because a module only tests import is an orphan to
// ci:reachable-exports.

const RR_SESSION_ID_KEY = 'rr_session_id'
const VISIT_KEY = 'rr_visit_v1'
const VISIT_IDLE_MS = 30 * 60 * 1000
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type DeployedVisit = { id: number; n: number; last: number }

/** One tab running the deployed tracker. Its page memory is its own, as a tab's is. */
export function deployedTrackerTab() {
  let memoryVisit: DeployedVisit | null = null
  return {
    /** One tracked event at `now`: returns the session id the deployed tracker posts it under. */
    event(now: number): string {
      // getOrCreateSessionId
      const existing = window.localStorage.getItem(RR_SESSION_ID_KEY)
      const sessionId = existing && UUID_V4.test(existing) ? existing : crypto.randomUUID()
      if (sessionId !== existing) window.localStorage.setItem(RR_SESSION_ID_KEY, sessionId)
      // nextVisitContext
      let stored: DeployedVisit | null = memoryVisit
      const raw = window.localStorage.getItem(VISIT_KEY)
      if (raw) stored = JSON.parse(raw) as DeployedVisit
      const fresh =
        !stored || typeof stored.id !== 'number' || typeof stored.last !== 'number' || now - stored.last > VISIT_IDLE_MS
      const next: DeployedVisit = fresh
        ? { id: Math.floor(now / 1000), n: (stored && typeof stored.n === 'number' ? stored.n : 0) + 1, last: now }
        : { id: stored!.id, n: stored!.n, last: now }
      memoryVisit = next
      window.localStorage.setItem(VISIT_KEY, JSON.stringify(next))
      return sessionId
    },
  }
}
