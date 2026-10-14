/**
 * The campaign a visit arrived with, for tagging a lead from that visit (Matt
 * 2026-10-09, "Visit they signed up in": a buyer sign-up or form is credited to
 * the link that started the visit it happens in; lib/crm/visit-attribution.ts).
 * DAL boundary (G1): the raw .from() lives here.
 *
 * The tracker records each session at every consent tier except an explicit
 * decline or GPC, and starts a new session after VISIT_IDLE_MS idle or on a new
 * campaign's arrival (lib/analytics/visitor-session.ts decideSession), so a
 * session's landing page IS the link that started that visit. A visitor who
 * declined tracking has no row; their lead is credited to the page's own link.
 *
 * The campaign is read from that landing page's own utm_* query, never from the
 * utm_* columns: captureSource fills those from the referrer when the link had
 * no utm_source (facebook / social, google / organic, a referring host /
 * referral) and writes direct / none when there was neither, so a column value
 * does not mean the visit came from a tagged link. The landing page keeps its
 * utm_* (stripIdentityParams removes only _pid and _fuid). No utm_source on it
 * means no campaign, the same reading the other doors give a page's own URL.
 *
 * Never throws: attribution is best-effort and must not block a sign-up.
 */
import 'server-only'
import { createServiceClient } from '@/lib/data/client'
import { SESSION_UUID_V4 } from '@/lib/analytics/visitor-session'
import { VISIT_IDLE_MS } from '@/lib/analytics/ga4-visit'

export type VisitCampaign = {
  source: string
  medium: string | null
  campaign: string | null
  content: string | null
}

type CampaignRow = { landing_page: string | null }

const COLUMNS = 'landing_page'

/** The utm_* the visit's landing link carried, or null when it had no utm_source. Pure. */
function toCampaign(row: CampaignRow | null | undefined): VisitCampaign | null {
  const landingPage = row?.landing_page
  if (!landingPage) return null
  let query: URLSearchParams
  try {
    query = new URL(landingPage, 'https://ryan-realty.com').searchParams
  } catch {
    return null
  }
  const source = query.get('utm_source')?.trim()
  if (!source) return null
  return {
    source,
    medium: query.get('utm_medium')?.trim() || null,
    campaign: query.get('utm_campaign')?.trim() || null,
    content: query.get('utm_content')?.trim() || null,
  }
}

/**
 * The visit a sign-up happens in, or null when there is no live one.
 *
 * Only a session still inside the tracker's visit window (VISIT_IDLE_MS since
 * its last event, the rule decideSession applies) is live, so an old visit never
 * answers for today's. The session the form names (`sessionId`, read on the
 * client from the store every tab shares) is the one asked. It is null when the
 * session has gone idle or has no row: tracking declined or GPC, or a session the
 * tracker started a moment ago and has not written yet. The browser's other
 * sessions are never asked in its place, so a brand-new visit never borrows the
 * one before it. Only a caller with no session id is answered from the browser's
 * (`rrVid` cookie) most recent live session.
 *
 * `campaign` is null for a live visit whose landing link carried no utm_source.
 */
export async function readLiveVisit(input: {
  sessionId?: string | null
  rrVid?: string | null
  now?: number
}): Promise<{ campaign: VisitCampaign | null } | null> {
  try {
    const sb = createServiceClient()
    const since = new Date((input.now ?? Date.now()) - VISIT_IDLE_MS).toISOString()
    const sessionId = input.sessionId?.trim()
    if (sessionId && SESSION_UUID_V4.test(sessionId)) {
      const { data } = await sb
        .from('visitor_sessions')
        .select(COLUMNS)
        .eq('session_id', sessionId)
        .gte('last_seen_at', since)
        .maybeSingle()
      return data ? { campaign: toCampaign(data as CampaignRow) } : null
    }
    const rrVid = input.rrVid?.trim()
    if (rrVid && SESSION_UUID_V4.test(rrVid)) {
      const { data } = await sb
        .from('visitor_sessions')
        .select(COLUMNS)
        .eq('rr_vid', rrVid)
        .gte('last_seen_at', since)
        .order('last_seen_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data ? { campaign: toCampaign(data as CampaignRow) } : null
    }
    return null
  } catch {
    return null
  }
}
