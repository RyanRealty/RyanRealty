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
  type PersonListingView,
} from '@/lib/crm/person-header-lines'
import { lookingAtAskHrefIfRecent } from '@/lib/crm/looking-at'

const MESSAGE_KINDS = ['sms_in', 'sms_out', 'email_in', 'email_out'] as const
const VIEW_KINDS = ['property_view', 'page_view'] as const

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

function listingViewFromRow(row: {
  ts?: string | null
  title?: string | null
  payload?: Record<string, unknown> | null
} | null): PersonListingView | null {
  if (!row?.ts) return null
  const payload = row.payload ?? {}
  const street = String(payload.listing_street ?? payload.street ?? row.title ?? '').trim()
  const mls = String(payload.listing_mls ?? payload.mls ?? '').trim()
  return {
    listingStreet: street || null,
    listingMls: mls || null,
    eventAt: String(row.ts),
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
    sb
      .from('crm_timeline')
      .select('ts,title,payload')
      .eq('person_id', personId)
      .in('kind', VIEW_KINDS as unknown as string[])
      .order('ts', { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from('crm_tasks')
      .select('name,type,origin')
      .eq('person_id', personId)
      .is('completed_at', null)
      .order('due_at', { ascending: true })
      .limit(8),
  ])
  if (messages.error) console.error('[getPersonGlance] messages', messages.error.message)
  if (view.error) console.error('[getPersonGlance] view', view.error.message)
  if (tasks.error) console.error('[getPersonGlance] tasks', tasks.error.message)

  const unreplied = unrepliedInboundFromMessages(
    (messages.data ?? []).map((row) => ({
      kind: String(row.kind),
      ts: String(row.ts ?? ''),
      payload: (row.payload ?? null) as Record<string, unknown> | null,
    })),
  )
  const latestView = listingViewFromRow(view.data)
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
