import 'server-only'
import { createServiceClient } from '@/lib/data/client'

/**
 * Per-broker newsletter analytics DAL (spec §9.5 / Phase 8).
 *
 * Every read here is scoped to a SINGLE broker slug — never an unscoped
 * aggregate across newsletter_recipients / newsletter_recipient_events. This is
 * the load-bearing invariant for G-NL-12 (a restricted broker must never see
 * another broker's rows): the scoping happens HERE, at the query layer, not
 * just at the page. Both tables carry the FROZEN `broker` column (spec §5/§9.5
 * "branding = live at send; analytics = frozen at send") — a lead reassigned
 * after an issue sent keeps that issue's engagement with the broker who
 * actually sent it.
 *
 * Counts are deduped off the newsletter_recipient_events LEDGER (the same
 * source getNewsletterStatsFromLedger reads, spec §3.1) — never the
 * newsletter_recipients.open_count/click_count columns, which a webhook
 * redelivery can inflate.
 */

const RECIPIENTS = 'newsletter_recipients'
const EVENTS = 'newsletter_recipient_events'

export type BrokerNewsletterAnalytics = {
  recipients: number
  delivered: number
  opened: number
  clicked: number
  /** clicked / delivered */
  ctr: number
  /** clicked / opened (click-to-open rate) */
  ctor: number
}

/** A recipient row counts as "delivered" once it reached a real inbox. */
const DELIVERED_STATUSES = new Set(['sent', 'delivered', 'opened', 'clicked'])

/**
 * Aggregate delivery + engagement stats for ONE broker's slice of the
 * newsletter program, across every issue. Two scoped reads:
 *   - newsletter_recipients WHERE broker = brokerSlug → recipients + delivered
 *   - newsletter_recipient_events WHERE broker = brokerSlug → deduped
 *     open/click distinct-row counts (the ledger is append-only + dedupe-keyed,
 *     so a webhook replay can never inflate these).
 * Both queries filter on the CALLER-PROVIDED brokerSlug — the caller (the
 * console page) is responsible for resolving that slug from the session for a
 * restricted broker (never from a client-supplied param). See G-NL-12.
 */
export async function getBrokerNewsletterAnalytics(brokerSlug: string): Promise<BrokerNewsletterAnalytics> {
  const slug = (brokerSlug ?? '').trim().toLowerCase()
  if (!slug) return { recipients: 0, delivered: 0, opened: 0, clicked: 0, ctr: 0, ctor: 0 }

  const sb = createServiceClient()

  const { data: recRows } = await sb
    .from(RECIPIENTS)
    .select('status')
    .eq('broker', slug)

  let recipients = 0
  let delivered = 0
  for (const row of recRows ?? []) {
    const r = row as { status: string }
    recipients += 1
    if (DELIVERED_STATUSES.has(r.status)) delivered += 1
  }

  const countEvent = async (event: 'open' | 'click') => {
    const { count } = await sb
      .from(EVENTS)
      .select('id', { count: 'exact', head: true })
      .eq('broker', slug)
      .eq('event', event)
    return count ?? 0
  }
  const [opened, clicked] = await Promise.all([countEvent('open'), countEvent('click')])

  const deliveredDenom = delivered || recipients || 1
  const openedDenom = opened || 1

  return {
    recipients,
    delivered,
    opened,
    clicked,
    ctr: clicked / deliveredDenom,
    ctor: clicked / openedDenom,
  }
}

export type BrokerWarmListRow = {
  email: string
  personId: number | null
  clicks: number
  lastAt: string
}

/**
 * This broker's warm list — recipients of THEIR OWN newsletter sends who
 * clicked at least once, newest engagement first, so the broker has a
 * follow-up list (spec §9.5 "my warm list this month"). Reads the deduped
 * click ledger (newsletter_recipient_events, event='click', broker=slug),
 * grouped in memory by email (one broker's click volume is small — no need for
 * a DB-side GROUP BY). personId resolves via the recipient's subscriber_id →
 * newsletter_subscribers.crm_person_id when available, else null.
 */
export async function getBrokerWarmList(brokerSlug: string, limit = 50): Promise<BrokerWarmListRow[]> {
  const slug = (brokerSlug ?? '').trim().toLowerCase()
  if (!slug) return []

  const sb = createServiceClient()

  const { data: clickRows } = await sb
    .from(EVENTS)
    .select('email, subscriber_id, occurred_at')
    .eq('broker', slug)
    .eq('event', 'click')
    .order('occurred_at', { ascending: false })
    .limit(2000)

  type ClickRow = { email: string; subscriber_id: string | null; occurred_at: string }
  const byEmail = new Map<string, { subscriberId: string | null; clicks: number; lastAt: string }>()
  for (const row of (clickRows ?? []) as ClickRow[]) {
    const email = (row.email ?? '').trim().toLowerCase()
    if (!email) continue
    const cur = byEmail.get(email)
    if (cur) {
      cur.clicks += 1
      if (row.occurred_at > cur.lastAt) cur.lastAt = row.occurred_at
      if (!cur.subscriberId && row.subscriber_id) cur.subscriberId = row.subscriber_id
    } else {
      byEmail.set(email, { subscriberId: row.subscriber_id, clicks: 1, lastAt: row.occurred_at })
    }
  }

  const ranked = [...byEmail.entries()]
    .sort((a, b) => (a[1].lastAt < b[1].lastAt ? 1 : a[1].lastAt > b[1].lastAt ? -1 : 0))
    .slice(0, Math.max(1, limit))

  // Resolve subscriber_id -> crm_person_id in one batched read.
  const subscriberIds = [...new Set(ranked.map(([, v]) => v.subscriberId).filter((v): v is string => Boolean(v)))]
  const personIdBySubscriber = new Map<string, number | null>()
  if (subscriberIds.length > 0) {
    const { data: subRows } = await sb
      .from('newsletter_subscribers')
      .select('id, crm_person_id')
      .in('id', subscriberIds)
    for (const row of subRows ?? []) {
      const r = row as { id: string; crm_person_id: number | null }
      personIdBySubscriber.set(r.id, r.crm_person_id ?? null)
    }
  }

  return ranked.map(([email, v]) => ({
    email,
    personId: v.subscriberId ? personIdBySubscriber.get(v.subscriberId) ?? null : null,
    clicks: v.clicks,
    lastAt: v.lastAt,
  }))
}
