/**
 * isSustainedHotAnonymous — the PURE rule that decides whether a durable
 * anonymous visitor (one rr_vid / identity bundle) has shown enough sustained,
 * repeat, high-intent listing interest to be worth converting into a tracked
 * crm_people lead — even though they have never submitted a form (CONTACT360
 * Phase 0.3).
 *
 * WHY this exists
 * ----------------
 * Today a hot anonymous session only triggers an alert email to Matt
 * (app/api/cron/visitor-hot-lead-escalation/route.ts) and sets hot_lead_fired_at.
 * Nothing durable is written, so a high-intent shopper who keeps coming back but
 * never fills out a form is lost the moment their cookie clears: not queryable as
 * a lead, not reconcilable, not remarketing-addressable. This rule is the gate
 * that says "this anonymous visitor has earned a tracked record."
 *
 * The rule is intentionally STRICTER than the single-session hot-lead alert. The
 * alert fires on one engagement_score spike (a binge). A durable crm_people row
 * is a heavier commitment, so we require the interest to be SUSTAINED — repeat
 * listing views ACROSS MULTIPLE SESSIONS within a recent window — before we
 * mint a lead. That avoids polluting the CRM with one-off curious browsers and
 * bots, while still capturing the genuine return shopper.
 *
 * THRESHOLDS (defaults, all overridable for tuning without a deploy)
 * ------------------------------------------------------------------
 *   - minListingViews = 5   listing_view events. Five distinct property looks is
 *                            well past idle browsing; it is shopping behavior.
 *   - minSessions     = 2   distinct sessions. This is the "sustained" half: the
 *                            visitor came back. A single session, however hot, is
 *                            a binge, not a durable shopper. The existing alert
 *                            already covers that case. Requiring >= 2 sessions is
 *                            what separates "hot" from "sustained hot".
 *   - windowDays      = 14  recency. Interest older than two weeks is stale for
 *                            outreach / remarketing; we only convert visitors who
 *                            are active NOW.
 *
 * These mirror the spirit of the engagement scoring already in the DB (listing
 * views are the highest-weight signal) but key off COUNTS, not the score, so the
 * rule is deterministic and unit-testable in isolation.
 *
 * STILL UN-IDENTIFIED is mandatory. The whole point is to capture the visitor we
 * have NOT otherwise tracked. If the identity bundle already carries a known
 * email, a FUB person, an auth user, OR an existing crm_person, there is nothing
 * to capture. The rule must return false so we never create a duplicate.
 *
 * This file is PURE: no Supabase, no IO, no env. The capture DAL
 * (lib/data/crm/captureHotAnonymous.ts) reads the signals and feeds them here.
 */

/** Default thresholds. Exported so the capture path + tests share one source. */
export const SUSTAINED_HOT_ANONYMOUS_DEFAULTS = {
  /** Minimum total listing_view events across the window. */
  minListingViews: 5,
  /** Minimum number of DISTINCT sessions the listing views span (the "sustained" bar). */
  minSessions: 2,
  /** Recency window in days; signals older than this do not count. */
  windowDays: 14,
} as const

export type SustainedHotAnonymousThresholds = {
  minListingViews: number
  minSessions: number
  windowDays: number
}

/**
 * The signal bundle for ONE durable anonymous visitor (one rr_vid / identity).
 *
 * `listingViewEvents` is the list of listing_view events already filtered to the
 * visitor's sessions; each carries the session it belongs to and when it
 * happened, so the rule can recompute the window + distinct-session counts
 * deterministically (it never trusts a pre-aggregated total).
 */
export type SustainedHotAnonymousSignals = {
  /** Every listing_view event attributed to this visitor's sessions. */
  listingViewEvents: Array<{
    /** The session the event belongs to (distinct-session counting key). */
    sessionId: string
    /** ISO timestamp of the event (recency filtering). */
    eventAt: string
  }>
  /**
   * Identity flags. ANY truthy value here means the visitor is already known /
   * tracked, so the rule must NOT fire (no duplicate lead).
   */
  identity: {
    /** visitor_sessions.identified_at on any of the visitor's sessions. */
    identifiedAt?: string | null
    /** A known FUB person stitched to this visitor. */
    fubPersonId?: number | null
    /** visitor_identity_map.email — a captured email means we already know them. */
    email?: string | null
    /** visitor_identity_map.user_id — a signed-in auth user. */
    authUserId?: string | null
    /**
     * An EXISTING crm_people id already mapped to this visitor. Today this is
     * derived best-effort (the durable rr_vid -> crm_person bridge lands with
     * Phase 1.1); when present it means a tracked lead already exists.
     */
    existingCrmPersonId?: number | null
  }
}

export type SustainedHotAnonymousEvaluation = {
  /** The verdict — true only when every condition holds. */
  qualifies: boolean
  /** Total listing_view events inside the recency window. */
  listingViewsInWindow: number
  /** Count of DISTINCT sessions those in-window listing views span. */
  distinctSessionsInWindow: number
  /** True when an identity flag marks the visitor as already known. */
  alreadyIdentified: boolean
  /** The thresholds actually applied (after defaults merge). */
  thresholds: SustainedHotAnonymousThresholds
}

/**
 * True when ANY identity flag marks the visitor as already known / tracked.
 * Pure + exported so the capture path can short-circuit before reading events,
 * and so the "ignores already-identified" behavior is testable in isolation.
 */
export function isAlreadyIdentified(identity: SustainedHotAnonymousSignals['identity']): boolean {
  if (identity.identifiedAt) return true
  if (typeof identity.fubPersonId === 'number' && identity.fubPersonId > 0) return true
  if (typeof identity.email === 'string' && identity.email.trim() !== '') return true
  if (typeof identity.authUserId === 'string' && identity.authUserId.trim() !== '') return true
  if (typeof identity.existingCrmPersonId === 'number' && identity.existingCrmPersonId > 0) return true
  return false
}

/**
 * Evaluate the sustained-hot-anonymous rule for one visitor's signals.
 *
 * Deterministic and side-effect free. `now` is injectable so the recency window
 * is testable; it defaults to the call time.
 *
 * Returns the full evaluation (not just the boolean) so the capture path can log
 * WHY a visitor did or did not qualify, and so the tests can assert the counts.
 */
export function evaluateSustainedHotAnonymous(
  signals: SustainedHotAnonymousSignals,
  overrides: Partial<SustainedHotAnonymousThresholds> = {},
  now: Date = new Date(),
): SustainedHotAnonymousEvaluation {
  const thresholds: SustainedHotAnonymousThresholds = {
    minListingViews: overrides.minListingViews ?? SUSTAINED_HOT_ANONYMOUS_DEFAULTS.minListingViews,
    minSessions: overrides.minSessions ?? SUSTAINED_HOT_ANONYMOUS_DEFAULTS.minSessions,
    windowDays: overrides.windowDays ?? SUSTAINED_HOT_ANONYMOUS_DEFAULTS.windowDays,
  }

  const alreadyIdentified = isAlreadyIdentified(signals.identity)

  // Recency cutoff: only events at-or-after (now - windowDays) count.
  const cutoffMs = now.getTime() - thresholds.windowDays * 24 * 60 * 60 * 1000
  const distinctSessions = new Set<string>()
  let listingViewsInWindow = 0
  for (const ev of signals.listingViewEvents) {
    const t = Date.parse(ev.eventAt)
    if (!Number.isFinite(t)) continue // unparseable timestamp never counts
    if (t < cutoffMs) continue // outside the recency window
    listingViewsInWindow += 1
    const sid = String(ev.sessionId ?? '').trim()
    if (sid) distinctSessions.add(sid)
  }
  const distinctSessionsInWindow = distinctSessions.size

  const qualifies =
    !alreadyIdentified &&
    listingViewsInWindow >= thresholds.minListingViews &&
    distinctSessionsInWindow >= thresholds.minSessions

  return {
    qualifies,
    listingViewsInWindow,
    distinctSessionsInWindow,
    alreadyIdentified,
    thresholds,
  }
}

/**
 * Thin boolean wrapper — the headline name the plan/task asks for. Most callers
 * want only the verdict; use evaluateSustainedHotAnonymous when you need the
 * counts (e.g. to log the qualifying reason).
 */
export function isSustainedHotAnonymous(
  signals: SustainedHotAnonymousSignals,
  overrides: Partial<SustainedHotAnonymousThresholds> = {},
  now: Date = new Date(),
): boolean {
  return evaluateSustainedHotAnonymous(signals, overrides, now).qualifies
}
