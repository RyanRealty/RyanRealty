/**
 * getContactNewsletterDetail — the "is this contact on the newsletter, how
 * often, and are they reading it" reader for the Contact-360 view
 * (CONTACT360 Phase 3.2, read side).
 *
 * One call returns the contact's full newsletter status: whether they are an
 * active subscriber, their send segment (the cadence/audience bucket sends are
 * grouped by — see the frequency note below), when they last subscribed/last
 * received a send, and their recent engagement (last open + a count of opens
 * across their recent newsletter sends).
 *
 * Identity comes from the keystone resolver (resolvePersonIdentity): it yields
 * the person's normalized (lowercased) emails, the FUB legacy id, and the auth
 * uuid. Resolution is FUB-independent — a native lead resolves the same way as
 * an imported one. The newsletter list (`newsletter_subscribers`) is matched by
 * `crm_person_id` OR any of those emails; per-send engagement
 * (`newsletter_recipients`) is matched by `subscriber_id` (when subscribed) OR
 * any of those emails.
 *
 * `frequency` NOTE (FLAGGED): `newsletter_subscribers` has no dedicated
 * frequency/cadence column. Sends are grouped and targeted by `segment`
 * ('general' | 'buyer' | 'seller' | 'past-client'), which is the field that
 * determines which newsletters a subscriber receives. We surface that segment
 * as `frequency` — it is the closest stored cadence/audience attribute. If a
 * true per-subscriber cadence column is ever added, swap the source here.
 *
 * Tables read (FLAGGED): `public.newsletter_subscribers` (the list) and
 * `public.newsletter_recipients` (per-send opens/clicks). Both are service-role
 * only (RLS on, no policies), so this never runs from the browser/anon client.
 *
 * DAL boundary (G1): the raw .from() reads live here, inside lib/data/. This is
 * read-only — no consent/subscribe mutation, so it does NOT touch the
 * suppression chokepoint; the `subscribed` flag reflects the existing
 * `newsletter_subscribers.status` (which the subscribe/unsubscribe DAL already
 * keeps in sync with suppressions).
 */
import { createServiceClient } from '@/lib/supabase/service'
import { resolvePersonIdentity } from '@/lib/data/crm/resolvePersonIdentity'

export type ContactNewsletterDetail = {
  /** True only when the contact has an ACTIVE newsletter subscriber row. */
  subscribed: boolean
  /** Send segment / audience bucket (the cadence-determining field), or null. */
  frequency: string | null
  /** When the subscriber row was created (their subscribe time), or null. */
  subscribedAt: string | null
  /** Most recent newsletter open across their recent sends, or null. */
  lastOpenAt: string | null
  /** Most recent newsletter send to the contact (subscriber.last_sent_at), or null. */
  lastSendAt: string | null
  /** Count of opened newsletters across the recent sends inspected. */
  recentOpens: number
}

/** A normalized newsletter engagement event for the pure summarizer. */
export type NewsletterEngagementEvent = {
  /** Event kind — 'open' (case-insensitive) counts as an open; others ignored. */
  kind: string
  /** ISO timestamp of the event. */
  at: string
}

/** How many of the contact's most-recent recipient rows to inspect for opens. */
const RECENT_SEND_LIMIT = 50

/**
 * PURE: reduce a list of newsletter engagement events to the latest open and a
 * count of opens. Only events whose `kind` is 'open' (case-insensitive) count.
 * Empty / no-open input => zeros (lastOpenAt null, recentOpens 0). Latest open
 * is the max ISO timestamp among the opens. No DB access — unit-tested directly.
 */
export function summarizeNewsletterEngagement(
  events: NewsletterEngagementEvent[],
): { lastOpenAt: string | null; recentOpens: number } {
  let lastOpenAt: string | null = null
  let recentOpens = 0
  for (const e of events ?? []) {
    if (String(e?.kind ?? '').trim().toLowerCase() !== 'open') continue
    const at = typeof e?.at === 'string' ? e.at.trim() : ''
    if (!at) continue
    recentOpens += 1
    if (lastOpenAt === null || at > lastOpenAt) lastOpenAt = at
  }
  return { lastOpenAt, recentOpens }
}

type SubscriberRow = {
  id: string
  status: string | null
  segment: string | null
  created_at: string | null
  last_sent_at: string | null
}

type RecipientRow = {
  open_count: number | null
  last_opened_at: string | null
}

/**
 * One call: the contact's full newsletter status + recent engagement. Resolves
 * the contact's identity, reads the subscriber row (by crm_person_id OR email),
 * then reads their recent per-send recipient rows (by subscriber_id OR email)
 * and summarizes opens. Never throws — an unreadable table yields the empty
 * detail (not-subscribed / zero engagement).
 */
export async function getContactNewsletterDetail(crmPersonId: number): Promise<ContactNewsletterDetail> {
  const empty: ContactNewsletterDetail = {
    subscribed: false,
    frequency: null,
    subscribedAt: null,
    lastOpenAt: null,
    lastSendAt: null,
    recentOpens: 0,
  }
  if (!Number.isFinite(crmPersonId) || crmPersonId <= 0) return empty

  const identity = await resolvePersonIdentity(crmPersonId)
  const emails = identity.emails.map((e) => e.trim().toLowerCase()).filter(Boolean)

  // No identifiers to join on => nothing to look up.
  if (emails.length === 0 && !identity.crmPersonId) return empty

  const sb = createServiceClient()

  // 1. The subscriber row — matched by crm_person_id OR any normalized email.
  const subOrs: string[] = []
  if (identity.crmPersonId) subOrs.push(`crm_person_id.eq.${identity.crmPersonId}`)
  for (const e of emails) subOrs.push(`email.eq.${e}`)

  let subscriber: SubscriberRow | null = null
  if (subOrs.length > 0) {
    const { data, error } = await sb
      .from('newsletter_subscribers')
      .select('id, status, segment, created_at, last_sent_at')
      .or(subOrs.join(','))
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (error) {
      console.error('[getContactNewsletterDetail] newsletter_subscribers', error.message)
    } else if (data) {
      subscriber = {
        id: String(data.id),
        status: (data.status as string | null) ?? null,
        segment: (data.segment as string | null) ?? null,
        created_at: (data.created_at as string | null) ?? null,
        last_sent_at: (data.last_sent_at as string | null) ?? null,
      }
    }
  }

  // 2. Recent per-send engagement — matched by subscriber_id (when subscribed)
  // OR any of the contact's emails. open_count > 0 marks an opened send.
  const recOrs: string[] = []
  if (subscriber?.id) recOrs.push(`subscriber_id.eq.${subscriber.id}`)
  for (const e of emails) recOrs.push(`email.eq.${e}`)

  const events: NewsletterEngagementEvent[] = []
  if (recOrs.length > 0) {
    const { data, error } = await sb
      .from('newsletter_recipients')
      .select('open_count, last_opened_at')
      .or(recOrs.join(','))
      .gt('open_count', 0)
      .order('last_opened_at', { ascending: false, nullsFirst: false })
      .limit(RECENT_SEND_LIMIT)
    if (error) {
      console.error('[getContactNewsletterDetail] newsletter_recipients', error.message)
    } else {
      for (const r of (data ?? []) as RecipientRow[]) {
        const at = (r.last_opened_at as string | null) ?? null
        if (at) events.push({ kind: 'open', at })
      }
    }
  }

  const { lastOpenAt, recentOpens } = summarizeNewsletterEngagement(events)

  return {
    subscribed: subscriber?.status === 'active',
    frequency: subscriber?.segment ?? null,
    subscribedAt: subscriber?.created_at ?? null,
    lastOpenAt,
    lastSendAt: subscriber?.last_sent_at ?? null,
    recentOpens,
  }
}
