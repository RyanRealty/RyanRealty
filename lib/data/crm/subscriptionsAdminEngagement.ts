import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Engagement rollups for the admin Subscriptions hub — split from
 * lib/data/crm/subscriptionsAdmin.ts (same DAL surface, 600-LOC file budget).
 *
 * Aggregates sends / opens / clicks / last-open per subscription from the
 * unified email_events store (lib/crm/email-events.ts is the single writer):
 *   - Listing alerts key events on email_key 'listing-alert:<rowId>:<runDate>'
 *     (both the guest and the signed-in send paths), so the rollup matches on
 *     the email_key prefix — one OR-batched query per page, no N+1. The prefix
 *     match also picks up historical rows misclassified send_type='other'
 *     before the 2026-07-06 sendTypeFromEmailKey fix.
 *   - Market reports record every event with person_id + send_type
 *     'market-report', so the rollup is a plain IN query per page.
 */

export type SubscriptionEngagement = {
  sends: number
  opens: number
  clicks: number
  /** Most recent open (or click — a click implies an open). Null = never. */
  lastOpenAt: string | null
}

export function emptyEngagement(): SubscriptionEngagement {
  return { sends: 0, opens: 0, clicks: 0, lastOpenAt: null }
}

type EngagementEventRow = {
  email_key?: string | null
  person_id?: number | null
  event: string
  occurred_at: string | null
}

function foldEvent(agg: SubscriptionEngagement, e: EngagementEventRow): void {
  if (e.event === 'sent') agg.sends += 1
  else if (e.event === 'open') agg.opens += 1
  else if (e.event === 'click') agg.clicks += 1
  if ((e.event === 'open' || e.event === 'click') && e.occurred_at) {
    if (!agg.lastOpenAt || e.occurred_at > agg.lastOpenAt) agg.lastOpenAt = e.occurred_at
  }
}

/**
 * Batched engagement rollup for a page of listing alerts (guest OR user rows).
 * One prefix-LIKE-per-id OR query, grouped in memory.
 */
export async function getAlertEngagementByIds(
  ids: string[],
): Promise<Map<string, SubscriptionEngagement>> {
  const out = new Map<string, SubscriptionEngagement>()
  // uuid-shaped ids only — keeps the PostgREST or() string safe by construction.
  const clean = [...new Set(ids.filter((id) => /^[0-9a-f-]{32,40}$/i.test(id)))]
  if (clean.length === 0) return out
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('email_events')
    .select('email_key, event, occurred_at')
    .or(clean.map((id) => `email_key.like.listing-alert:${id}:%`).join(','))
    .in('event', ['sent', 'open', 'click'])
    .limit(10000)
  if (error) {
    console.error('[getAlertEngagementByIds]', error.message)
    return out
  }
  for (const e of (data ?? []) as EngagementEventRow[]) {
    const rowId = (e.email_key ?? '').split(':')[1] ?? ''
    if (!rowId) continue
    const agg = out.get(rowId) ?? emptyEngagement()
    foldEvent(agg, e)
    out.set(rowId, agg)
  }
  return out
}

/**
 * Batched engagement rollup for a page of market-report subscriptions, keyed
 * by person id. One IN query per page.
 */
export async function getReportEngagementByPersonIds(
  personIds: number[],
): Promise<Map<number, SubscriptionEngagement>> {
  const out = new Map<number, SubscriptionEngagement>()
  const clean = [...new Set(personIds.filter((n) => Number.isInteger(n) && n > 0))]
  if (clean.length === 0) return out
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('email_events')
    .select('person_id, event, occurred_at')
    .eq('send_type', 'market-report')
    .in('person_id', clean)
    .in('event', ['sent', 'open', 'click'])
    .limit(10000)
  if (error) {
    console.error('[getReportEngagementByPersonIds]', error.message)
    return out
  }
  for (const e of (data ?? []) as EngagementEventRow[]) {
    const pid = e.person_id
    if (!pid) continue
    const agg = out.get(pid) ?? emptyEngagement()
    foldEvent(agg, e)
    out.set(pid, agg)
  }
  return out
}
