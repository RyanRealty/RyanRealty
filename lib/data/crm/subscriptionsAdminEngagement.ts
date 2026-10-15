import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { fetchPagedRows } from '@/lib/supabase/paginate'

/**
 * Engagement rollups for the admin Subscriptions hub — split from
 * lib/data/crm/subscriptionsAdmin.ts (same DAL surface, 600-LOC file budget).
 *
 * Aggregates sends / delivered / opens / clicks / bounces / last-open per
 * subscription, counted per email (EngagementFold), from the
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
  /** Emails sent (one email_events 'sent' row per email). */
  sends: number
  /** Emails the provider confirmed delivered (Resend webhook), once per email. */
  delivered: number
  /** Emails opened at least once. A click counts as an open. */
  opens: number
  /** Emails with at least one human click (click_automated never counts). */
  clicks: number
  /** Emails that bounced, once per email. */
  bounced: number
  /** Most recent open (or click — a click implies an open). Null = never. */
  lastOpenAt: string | null
}

export function emptyEngagement(): SubscriptionEngagement {
  return { sends: 0, delivered: 0, opens: 0, clicks: 0, bounced: 0, lastOpenAt: null }
}

type EngagementEventRow = {
  email_key?: string | null
  message_id?: string | null
  person_id?: number | null
  event: string
  occurred_at: string | null
}

/** The events the hub reads. Unsubscribe and complaint live on the Delivery tab. */
export const ENGAGEMENT_EVENTS = ['sent', 'delivered', 'open', 'click', 'bounce'] as const

/**
 * Per-subscription accumulator. Counts are per EMAIL, not per row: the pixel
 * and the click route each write their own rows (and a reader can open one
 * email five times), so a raw row count overstates engagement. An email is
 * its email_key (`listing-alert:<row>:<send stamp>`, unique per send since
 * 2026-10-14) or, for a provider event with no key yet, its message id.
 */
export class EngagementFold {
  private sends = 0
  private delivered = new Set<string>()
  private opened = new Set<string>()
  private clicked = new Set<string>()
  private bounced = new Set<string>()
  private lastOpenAt: string | null = null

  add(e: EngagementEventRow): void {
    const key = (e.email_key ?? '').trim() || (e.message_id ?? '').trim()
    // Delivery is the provider's per-message fact: key it on the message id
    // when present so two sends that once shared a daily key both count.
    const messageKey = (e.message_id ?? '').trim() || key
    if (e.event === 'sent') this.sends += 1
    else if (e.event === 'delivered' && messageKey) this.delivered.add(messageKey)
    else if (e.event === 'bounce' && messageKey) this.bounced.add(messageKey)
    else if ((e.event === 'open' || e.event === 'click') && key) {
      this.opened.add(key)
      if (e.event === 'click') this.clicked.add(key)
    }
    if ((e.event === 'open' || e.event === 'click') && e.occurred_at) {
      if (!this.lastOpenAt || e.occurred_at > this.lastOpenAt) this.lastOpenAt = e.occurred_at
    }
  }

  result(): SubscriptionEngagement {
    return {
      sends: this.sends,
      delivered: this.delivered.size,
      opens: this.opened.size,
      clicks: this.clicked.size,
      bounced: this.bounced.size,
      lastOpenAt: this.lastOpenAt,
    }
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
  // Paged read (PostgREST caps single responses at 1,000 rows — the old
  // .limit(10000) silently truncated there, undercounting sends/opens/clicks).
  const { rows: data, error } = await fetchPagedRows<EngagementEventRow>(
    (from, to) =>
      sb
        .from('email_events')
        .select('email_key, message_id, event, occurred_at')
        .or(clean.map((id) => `email_key.like.listing-alert:${id}:%`).join(','))
        .in('event', [...ENGAGEMENT_EVENTS])
        .order('id', { ascending: true })
        .range(from, to),
    10000,
  )
  if (error) {
    console.error('[getAlertEngagementByIds]', error.message)
    return out
  }
  const folds = new Map<string, EngagementFold>()
  for (const e of data) {
    const rowId = (e.email_key ?? '').split(':')[1] ?? ''
    if (!rowId) continue
    const fold = folds.get(rowId) ?? new EngagementFold()
    fold.add(e)
    folds.set(rowId, fold)
  }
  for (const [rowId, fold] of folds) out.set(rowId, fold.result())
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
  // Paged read — same 1,000-row response-cap rationale as getAlertEngagementByIds.
  const { rows: data, error } = await fetchPagedRows<EngagementEventRow>(
    (from, to) =>
      sb
        .from('email_events')
        .select('person_id, email_key, message_id, event, occurred_at')
        .eq('send_type', 'market-report')
        .in('person_id', clean)
        .in('event', [...ENGAGEMENT_EVENTS])
        .order('id', { ascending: true })
        .range(from, to),
    10000,
  )
  if (error) {
    console.error('[getReportEngagementByPersonIds]', error.message)
    return out
  }
  const folds = new Map<number, EngagementFold>()
  for (const e of data) {
    const pid = e.person_id
    if (!pid) continue
    const fold = folds.get(pid) ?? new EngagementFold()
    fold.add(e)
    folds.set(pid, fold)
  }
  for (const [pid, fold] of folds) out.set(pid, fold.result())
  return out
}
