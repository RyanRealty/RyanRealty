/**
 * The campaign a visit arrived with, for tagging a sign-up from that visit
 * (Matt 2026-10-09, "Visit they signed up in": saved searches, search alerts,
 * listing saves and price-drop watches are credited to the link that started
 * the visit they happen in). DAL boundary (G1): the raw .from() lives here.
 *
 * The tracker writes each session's first non-null utm_* (coalesce-on-update in
 * /api/visitors/track) at every consent tier except an explicit decline or GPC,
 * and starts a new session after VISIT_IDLE_MS idle or on a new campaign's
 * arrival (lib/analytics/visitor-session.ts decideSession), so a session row's
 * campaign IS the link that started that visit. A visitor who declined tracking
 * has no row, and their sign-up stays untagged unless the page itself carries
 * the link.
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

type CampaignRow = {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
}

const COLUMNS = 'utm_source, utm_medium, utm_campaign, utm_content'

function toCampaign(row: CampaignRow | null | undefined): VisitCampaign | null {
  const source = row?.utm_source?.trim()
  if (!source) return null
  return {
    source,
    medium: row?.utm_medium?.trim() || null,
    campaign: row?.utm_campaign?.trim() || null,
    content: row?.utm_content?.trim() || null,
  }
}

/**
 * The visit's campaign. Only a session still inside the tracker's visit window
 * (VISIT_IDLE_MS since its last event, the rule decideSession applies) answers,
 * so an old visit never answers for today's.
 *
 * The session the form names (`sessionId`, read on the client) answers first,
 * campaign or not. The client keeps that id past the idle timeout (it names the
 * session holding the browsing history, for the stitch), so a stale or unknown
 * id falls through to the browser's (`rrVid` cookie) most recent live session.
 * null when no live session exists or it arrived with no campaign.
 */
export async function readVisitCampaign(input: {
  sessionId?: string | null
  rrVid?: string | null
  now?: number
}): Promise<VisitCampaign | null> {
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
      if (data) return toCampaign(data as CampaignRow)
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
      return toCampaign(data as CampaignRow | null)
    }
    return null
  } catch {
    return null
  }
}
