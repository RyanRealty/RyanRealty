/**
 * Per-visit GA4 session fields for the Measurement Protocol page-view mirror in
 * /api/visitors/track (TRACK-1, 2026-09-23).
 *
 * THE DEFECT. The mirror sent `session_id` = rr_session_id, a uuid that lives in
 * localStorage for the browser's whole life, and no traffic source. GA4 needs a
 * NUMERIC per-visit session id to draw session boundaries, and attributes a
 * Measurement Protocol session only from a `campaign_details` event (Google MP
 * reference, "campaign_details": campaign_id, campaign, source, medium, term,
 * content, applied to events at or after its timestamp). Result, measured in
 * site_signal ga4_data_api over the 14 days to 2026-09-22: 8,593 of about 8,900
 * sessions had source "(not set)" and google / organic had 1.
 *
 * THE FIX. components/VisitTracker.tsx keeps a visit: the Unix second it
 * started, a running visit number, and whether this event starts it (a new
 * visit after 30 minutes idle, GA4's own default session timeout). The route
 * sends `session_id` = that start second and `session_number`, and on the
 * first event of a visit prepends a `campaign_details` event carrying the
 * source / medium / campaign / term / content the tracker already captured.
 * The mirror itself stays (Matt's decision, commit 416911b31).
 *
 * Pure: no I/O.
 */

export const VISIT_IDLE_MS = 30 * 60 * 1000

export type VisitContext = { id: number; number: number; start: boolean }

/** Validate the client's visit object. Unix seconds, sane range, positive counter. */
export function parseVisit(raw: unknown, nowMs: number = Date.now()): VisitContext | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = Number(o.id)
  const number = Number(o.number)
  if (!Number.isInteger(id) || !Number.isInteger(number) || number < 1 || number > 100000) return null
  const nowSec = Math.floor(nowMs / 1000)
  // A visit id is the second it started: never in the future (allow 5 min of
  // clock skew) and never older than a week (a stale tab resumes as a new visit).
  if (id > nowSec + 300 || id < nowSec - 7 * 86400) return null
  return { id, number, start: o.start === true }
}

/** GA4 session params for one mirrored event. */
export function ga4SessionParams(visit: VisitContext | null, fallbackSessionId: string): Record<string, string | number> {
  if (visit) return { session_id: visit.id, session_number: visit.number }
  // Old cached clients during a rollout: the previous behaviour.
  return { session_id: fallbackSessionId.slice(0, 36) }
}

export type CampaignFields = {
  source?: string | null
  medium?: string | null
  campaign?: string | null
  content?: string | null
  term?: string | null
}

/**
 * `campaign_details` params for the first event of a visit, or null when there
 * is nothing to attribute. The tracker labels an untagged, referrer-less arrival
 * `direct / none`; GA4's own spelling for that is `(direct) / (none)`.
 */
export function campaignDetailsParams(campaign: CampaignFields | null | undefined): Record<string, string> | null {
  if (!campaign) return null
  const clean = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 100) : null)
  let source = clean(campaign.source)
  let medium = clean(campaign.medium)
  if (!source) return null
  if (source.toLowerCase() === 'direct' && (!medium || medium.toLowerCase() === 'none')) {
    source = '(direct)'
    medium = '(none)'
  }
  const out: Record<string, string> = { source }
  if (medium) out.medium = medium
  const name = clean(campaign.campaign)
  if (name) {
    out.campaign = name
    out.campaign_id = name
  }
  const content = clean(campaign.content)
  if (content) out.content = content
  const term = clean(campaign.term)
  if (term) out.term = term
  return out
}
