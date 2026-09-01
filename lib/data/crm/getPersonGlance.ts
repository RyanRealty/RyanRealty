/**
 * Cheap person-file first paint: next step and what they are waiting on.
 * Do not go through getCrmPersonFull or the visitor identity stitch.
 */
import { createServiceClient } from '@/lib/supabase/service'
import { isTriageTaskCandidate } from '@/lib/data/crm/getInboundTriage'
import { getPersonAwaitingBrokerStep } from '@/lib/data/crm/getBrokerActionQueue'
import {
  composePersonNextStep,
  composePersonNowLine,
  listingViewIsRecent,
  unrepliedInboundFromMessages,
  RECENT_LISTING_VIEW_MS,
  type PersonListingView,
} from '@/lib/crm/person-header-lines'
import { lookingAtAskHrefIfRecent } from '@/lib/crm/looking-at'
import { resolveLeadSessionIds } from '@/lib/data/crm/getViewedListings'

const MESSAGE_KINDS = ['sms_in', 'sms_out', 'email_in', 'email_out'] as const

export type PersonGlance = {
  nextLine: string
  nowLine: string
  /**
   * One-tap composer deep link when the now-line names a home they are looking
   * at (Matt 2026-09-01: "I see you're on the site… want my opinion on the
   * price, or a CMA?"). Null when the view is stale or has no street.
   */
  askHref: string | null
}

/**
 * Latest listing view from the REAL source: the person's sessions (full
 * native identity chain — direct person keys, identity map, rr_vid; the same
 * resolution the engagement panels use, request-memoized since 2026-09-01 so
 * this costs one execution per request) → listing_view visitor_events in the
 * 24h window. Two dead/narrow reads preceded this (both found 2026-09-01):
 * crm_timeline property_view/page_view rows that NO writer has ever produced
 * (zero all time), and a crm_person_id-only session leg that missed everyone
 * stitched via visitor_identity_map or rr_vid — e.g. batch-email clickers.
 */
async function latestListingViewForPerson(
  sb: ReturnType<typeof createServiceClient>,
  personId: number,
): Promise<PersonListingView | null> {
  const cutoffIso = new Date(Date.now() - RECENT_LISTING_VIEW_MS).toISOString()
  const sessionIds = await resolveLeadSessionIds(sb, { crmPersonId: personId })
  const ids = sessionIds.slice(0, 200)
  if (ids.length === 0) return null
  const { data: events, error: evErr } = await sb
    .from('visitor_events')
    .select('listing_mls,listing_street,event_at')
    .eq('event_type', 'listing_view')
    .in('session_id', ids)
    .not('listing_mls', 'is', null)
    .gte('event_at', cutoffIso)
    .order('event_at', { ascending: false })
    .limit(1)
  if (evErr) {
    console.error('[getPersonGlance] events', evErr.message)
    return null
  }
  const ev = events?.[0]
  if (!ev?.event_at) return null
  return {
    listingStreet: ((ev.listing_street as string | null) ?? '').trim() || null,
    listingMls: ((ev.listing_mls as string | null) ?? '').trim() || null,
    eventAt: String(ev.event_at),
  }
}

export async function getPersonGlance(personId: number): Promise<PersonGlance> {
  if (!Number.isFinite(personId) || personId <= 0) {
    return { nextLine: 'No next step queued.', nowLine: 'Not on the site.', askHref: null }
  }
  const sb = createServiceClient()
  const [messages, awaiting, view, tasks] = await Promise.all([
    sb
      .from('crm_timeline')
      .select('kind,ts,payload')
      .eq('person_id', personId)
      .in('kind', MESSAGE_KINDS as unknown as string[])
      .order('ts', { ascending: false })
      .limit(20),
    getPersonAwaitingBrokerStep(personId),
    latestListingViewForPerson(sb, personId),
    sb
      .from('crm_tasks')
      .select('name,type,origin')
      .eq('person_id', personId)
      .is('completed_at', null)
      .order('due_at', { ascending: true })
      .limit(8),
  ])
  if (messages.error) console.error('[getPersonGlance] messages', messages.error.message)
  if (tasks.error) console.error('[getPersonGlance] tasks', tasks.error.message)

  const unreplied = unrepliedInboundFromMessages(
    (messages.data ?? []).map((row) => ({
      kind: String(row.kind),
      ts: String(row.ts ?? ''),
      payload: (row.payload ?? null) as Record<string, unknown> | null,
    })),
  )
  const latestView = view
  const triage = (tasks.data ?? []).find((t) =>
    isTriageTaskCandidate({
      name: (t.name as string | null) ?? null,
      type: (t.type as string | null) ?? null,
      origin: (t.origin as string | null) ?? null,
    }),
  )
  return {
    nextLine: composePersonNextStep({
      unrepliedInbound: unreplied ? { channel: unreplied.channel } : null,
      replyIntent: unreplied?.replyIntent ?? null,
      triageTask: triage ? { name: (triage.name as string | null) ?? null, type: (triage.type as string | null) ?? null } : null,
      sequenceWaiting: awaiting,
    }),
    nowLine: composePersonNowLine({ latestListingView: latestView }),
    askHref: lookingAtAskHrefIfRecent(personId, latestView?.listingStreet, listingViewIsRecent(latestView)),
  }
}
