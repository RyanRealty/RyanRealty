import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { daysSince } from '@/lib/format/relative-ago'
import type { DeliverySendRow } from '@/lib/data/crm/emailDelivery'

/**
 * emailDeliveryAttention — builds the "needs attention" list for the Delivery
 * tab (split from lib/data/crm/emailDelivery.ts, 600-LOC file budget).
 *
 * Four honest signal sources, each with a plain-English fix:
 *
 *   1. report-overdue    active market-report subscription, nothing sent in
 *                        over 2x its cadence (weekly 7d / monthly 30d /
 *                        quarterly 90d).
 *   2. report-attempted  the send engine looked at the subscription and could
 *                        not send (last_attempt_at advanced past last_sent_at —
 *                        the only durable trace of a send-time failure today).
 *   3. alert-quiet       active listing alert with nothing sent in over
 *                        max(2x cadence, 14 days). Phrased carefully: alerts
 *                        only send when new listings match, so quiet is a
 *                        prompt to check the search, not proof of a failure.
 *   4. no-opens          5+ sends in the window with zero opens or clicks —
 *                        emails may be landing in spam.
 *   5. bounced/complained  hard delivery failures from the Resend webhook.
 *
 * Synchronous send-API errors are NOT persisted per-recipient anywhere today
 * (the crons keep them only in an ephemeral run summary), so nothing here
 * pretends to list them — #2 is the honest proxy for market reports, and the
 * UI says so.
 */

export type DeliveryAttentionKind =
  | 'report-overdue'
  | 'report-attempted'
  | 'alert-quiet'
  | 'no-opens'
  | 'bounced'
  | 'complained'

export type DeliveryAttentionItem = {
  kind: DeliveryAttentionKind
  severity: 'problem' | 'watch'
  /** Broker-language headline: "Sarah Smith hasn't gotten her monthly market report in 74 days". */
  headline: string
  /** One more sentence of context. */
  detail: string
  /** Plain-English suggested fix. */
  fix: string
  personId: number | null
  personName: string | null
  email: string | null
  /** Where the fix lives (person page when known, else the subscriptions hub). */
  fixHref: string
  fixLabel: string
  /** The timestamp the item is anchored on (last send / bounce time / etc). */
  atIso: string | null
}

const SUBSCRIPTIONS_HUB = '/admin/crm/subscriptions'
const NO_OPENS_MIN_SENDS = 5
const PER_KIND_CAP = 15

function personHref(personId: number | null): string {
  return personId ? `/admin/console/leads/${personId}` : SUBSCRIPTIONS_HUB
}

function cadenceDaysFor(frequency: string | null | undefined, fallback: number): number {
  const f = (frequency ?? '').trim().toLowerCase()
  if (f === 'daily' || f === 'instant') return 1
  if (f === 'weekly') return 7
  if (f === 'monthly') return 30
  if (f === 'quarterly') return 90
  return fallback
}

type PersonLite = {
  id: number
  name: string | null
  first_name: string | null
  last_name: string | null
  emails: Array<{ value?: string; isPrimary?: number | boolean }> | null
}

function displayName(p: PersonLite | undefined): string | null {
  if (!p) return null
  const explicit = (p.name ?? '').trim()
  if (explicit) return explicit
  const joined = [p.first_name, p.last_name].map((s) => (s ?? '').trim()).filter(Boolean).join(' ')
  return joined || null
}

function primaryEmail(p: PersonLite | undefined): string | null {
  const list = Array.isArray(p?.emails) ? p.emails : []
  const primary = list.find((e) => e?.isPrimary === 1 || e?.isPrimary === true)
  const value = (primary?.value ?? list.find((e) => typeof e?.value === 'string' && e.value.trim())?.value ?? '').trim()
  return value || null
}

/** "Sarah Smith" / "sarah@example.com" / "a subscriber" — never a raw id. */
function who(name: string | null, email: string | null): string {
  return name || email || 'a subscriber'
}

export type BuildAttentionResult = {
  attention: DeliveryAttentionItem[]
  subscriptionCounts: { reportsActive: number; alertsActive: number }
}

/**
 * Build the attention list. `sendRows` is the already-folded per-send window
 * from getGlobalDeliverySummary (drives no-opens + failures); the subscription
 * checks read their tables directly.
 */
export async function buildDeliveryAttention(input: {
  sendRows: DeliverySendRow[]
  nowMs: number
}): Promise<BuildAttentionResult> {
  const { sendRows, nowMs } = input
  const sb = createServiceClient()

  const [reportRes, alertRes, alertCountRes] = await Promise.all([
    sb
      .from('crm_report_subscriptions')
      .select('person_id, areas, frequency, is_active, created_at, last_sent_at, last_attempt_at')
      .eq('is_active', true)
      .limit(1000),
    sb
      .from('listing_alerts')
      .select('id, email, user_id, name, notification_frequency, created_at, last_notified_at, crm_person_id')
      .eq('is_active', true)
      .limit(1000),
    sb.from('listing_alerts').select('id', { count: 'exact', head: true }).eq('is_active', true),
  ])
  if (reportRes.error) console.error('[buildDeliveryAttention] reports', reportRes.error.message)
  if (alertRes.error) console.error('[buildDeliveryAttention] listing alerts', alertRes.error.message)

  type ReportRow = {
    person_id: number
    areas: string[] | null
    frequency: string | null
    is_active: boolean
    created_at: string | null
    last_sent_at: string | null
    last_attempt_at: string | null
  }
  type AlertRow = {
    id: string
    email?: string | null
    user_id?: string | null
    name: string | null
    notification_frequency: string | null
    created_at: string | null
    last_notified_at: string | null
    crm_person_id: number | null
  }
  const reports = (reportRes.data ?? []) as ReportRow[]
  const listingAlerts = (alertRes.data ?? []) as AlertRow[]

  // ── Resolve display names for every person we might mention, in ONE query ──
  const personIds = new Set<number>()
  for (const r of reports) if (r.person_id > 0) personIds.add(r.person_id)
  for (const a of listingAlerts) {
    if (a.crm_person_id && a.crm_person_id > 0) personIds.add(a.crm_person_id)
  }
  for (const s of sendRows) if (s.personId && s.personId > 0) personIds.add(s.personId)

  const peopleById = new Map<number, PersonLite>()
  if (personIds.size > 0) {
    const { data: people, error: pErr } = await sb
      .from('crm_people')
      .select('id, name, first_name, last_name, emails')
      .in('id', [...personIds])
    if (pErr) console.error('[buildDeliveryAttention] people', pErr.message)
    for (const p of (people ?? []) as PersonLite[]) peopleById.set(p.id, p)
  }

  const items: DeliveryAttentionItem[] = []
  const counts: Record<DeliveryAttentionKind, number> = {
    'report-overdue': 0,
    'report-attempted': 0,
    'alert-quiet': 0,
    'no-opens': 0,
    bounced: 0,
    complained: 0,
  }
  const push = (item: DeliveryAttentionItem) => {
    if (counts[item.kind] >= PER_KIND_CAP) return
    counts[item.kind] += 1
    items.push(item)
  }

  // ── 1 + 2: market-report subscriptions ─────────────────────────────────────
  for (const r of reports) {
    const p = peopleById.get(r.person_id)
    const name = displayName(p)
    const email = primaryEmail(p)
    const freq = (r.frequency ?? 'monthly').trim().toLowerCase()
    const cadence = cadenceDaysFor(freq, 30)
    const anchorIso = r.last_sent_at ?? r.created_at
    const idleDays = daysSince(anchorIso, nowMs)

    const attemptFailed =
      r.last_attempt_at != null && (r.last_sent_at == null || r.last_attempt_at > r.last_sent_at)

    if (attemptFailed) {
      const attemptDays = daysSince(r.last_attempt_at, nowMs) ?? 0
      push({
        kind: 'report-attempted',
        severity: 'problem',
        headline: `We tried to send ${who(name, email)} their ${freq} market report, but it didn't go out`,
        detail:
          r.last_sent_at == null
            ? `The last try was ${attemptDays === 0 ? 'today' : `${attemptDays} days ago`} and nothing has ever been delivered to them.`
            : `The last try was ${attemptDays === 0 ? 'today' : `${attemptDays} days ago`}; the last report that actually went out was ${daysSince(r.last_sent_at, nowMs)} days ago.`,
        fix: 'Open their page and check for a missing email address, a bad address, or an unsubscribe. Fix it and the next run will pick them up.',
        personId: r.person_id,
        personName: name,
        email,
        fixHref: personHref(r.person_id),
        fixLabel: 'Open contact',
        atIso: r.last_attempt_at,
      })
      continue
    }

    if (idleDays != null && idleDays > 2 * cadence) {
      push({
        kind: 'report-overdue',
        severity: 'problem',
        headline:
          r.last_sent_at == null
            ? `${who(name, email)} signed up for the ${freq} market report but has never gotten one`
            : `${who(name, email)} hasn't gotten their ${freq} market report in ${idleDays} days`,
        detail: `Their subscription is active and on a ${freq} cadence, so a send is more than twice overdue.`,
        fix: 'Open their page and confirm they have a good email address and the subscription areas still exist. If everything looks right, the send engine may need a look.',
        personId: r.person_id,
        personName: name,
        email,
        fixHref: personHref(r.person_id),
        fixLabel: 'Open contact',
        atIso: anchorIso,
      })
    }
  }

  // ── 3: quiet listing alerts ────────────────────────────────────────────────
  // Unified table: rows carrying an auth user_id read as "saved search" (the
  // signed-in vocabulary), the rest as "listing alert".
  const alertRows: Array<{ row: AlertRow; kindLabel: string }> = listingAlerts.map((row) => ({
    row,
    kindLabel: row.user_id ? 'saved search' : 'listing alert',
  }))
  for (const { row, kindLabel } of alertRows) {
    const freq = (row.notification_frequency ?? 'daily').trim().toLowerCase()
    // Floor at 14 days: a daily alert quiet for 2 days usually just means no
    // new listings matched — two weeks of silence is worth a look.
    const threshold = Math.max(2 * cadenceDaysFor(freq, 1), 14)
    const anchorIso = row.last_notified_at ?? row.created_at
    const idleDays = daysSince(anchorIso, nowMs)
    if (idleDays == null || idleDays <= threshold) continue
    const p = row.crm_person_id ? peopleById.get(row.crm_person_id) : undefined
    const name = displayName(p)
    const email = (row.email ?? '').trim() || primaryEmail(p)
    const label = (row.name ?? '').trim() || 'their search'
    push({
      kind: 'alert-quiet',
      severity: 'watch',
      headline:
        row.last_notified_at == null
          ? `${who(name, email)}'s ${kindLabel} "${label}" has never sent anything`
          : `${who(name, email)}'s ${kindLabel} "${label}" hasn't sent anything in ${idleDays} days`,
      detail: 'Alerts only go out when new listings match, so this can be normal — but a search that never matches anything may be too narrow.',
      fix: 'Open the search and sanity-check the criteria (price band, area, beds). Widen it or ask the client if their needs changed.',
      personId: row.crm_person_id,
      personName: name,
      email,
      fixHref: row.crm_person_id ? personHref(row.crm_person_id) : SUBSCRIPTIONS_HUB,
      fixLabel: row.crm_person_id ? 'Open contact' : 'Open subscriptions',
      atIso: anchorIso,
    })
  }

  // ── 4: sends with zero opens ───────────────────────────────────────────────
  type RecipientAgg = { personId: number | null; email: string | null; sends: number; opens: number; lastIso: string | null }
  const byRecipient = new Map<string, RecipientAgg>()
  for (const s of sendRows) {
    const key = s.personId ? `p:${s.personId}` : `e:${(s.recipientEmail ?? '').toLowerCase()}`
    if (key === 'e:') continue
    let agg = byRecipient.get(key)
    if (!agg) {
      agg = { personId: s.personId, email: s.recipientEmail, sends: 0, opens: 0, lastIso: null }
      byRecipient.set(key, agg)
    }
    agg.sends += 1
    if (s.opened || s.clicked) agg.opens += 1
    if (s.sentAtIso && (!agg.lastIso || s.sentAtIso > agg.lastIso)) agg.lastIso = s.sentAtIso
  }
  for (const agg of byRecipient.values()) {
    if (agg.sends < NO_OPENS_MIN_SENDS || agg.opens > 0) continue
    const p = agg.personId ? peopleById.get(agg.personId) : undefined
    const name = displayName(p)
    const email = agg.email ?? primaryEmail(p)
    push({
      kind: 'no-opens',
      severity: 'watch',
      headline: `${who(name, email)} has gotten ${agg.sends} emails and opened none of them`,
      detail: 'Every send in this window went unopened. The emails may be landing in spam, or the address may not be one they check.',
      fix: 'Confirm the email address with them directly, or ask them to add us to their contacts. If they truly aren\u2019t interested, pause their subscriptions.',
      personId: agg.personId,
      personName: name,
      email,
      fixHref: agg.personId ? personHref(agg.personId) : SUBSCRIPTIONS_HUB,
      fixLabel: agg.personId ? 'Open contact' : 'Open subscriptions',
      atIso: agg.lastIso,
    })
  }

  // ── 5: bounces + spam complaints ───────────────────────────────────────────
  for (const s of sendRows) {
    if (!s.bounced && !s.complained) continue
    const p = s.personId ? peopleById.get(s.personId) : undefined
    const name = displayName(p)
    const email = s.recipientEmail ?? primaryEmail(p)
    const what = s.subject ? `"${s.subject}"` : s.streamLabel.toLowerCase()
    if (s.bounced) {
      push({
        kind: 'bounced',
        severity: 'problem',
        headline: `An email to ${who(name, email)} bounced (${what})`,
        detail: 'The address rejected the message — it may be misspelled or no longer in use.',
        fix: 'Check the address with them and update it on their page. Hard bounces auto-suppress future sends until the address is fixed.',
        personId: s.personId,
        personName: name,
        email,
        fixHref: s.personId ? personHref(s.personId) : SUBSCRIPTIONS_HUB,
        fixLabel: s.personId ? 'Open contact' : 'Open subscriptions',
        atIso: s.statusAtIso,
      })
    } else {
      push({
        kind: 'complained',
        severity: 'problem',
        headline: `${who(name, email)} marked an email as spam (${what})`,
        detail: 'A spam complaint stops all future emails to them automatically (sender-reputation protection).',
        fix: 'Leave email off for them. If they say it was a mistake, re-confirm consent before resuming any sends.',
        personId: s.personId,
        personName: name,
        email,
        fixHref: s.personId ? personHref(s.personId) : SUBSCRIPTIONS_HUB,
        fixLabel: s.personId ? 'Open contact' : 'Open subscriptions',
        atIso: s.statusAtIso,
      })
    }
  }

  // Problems first, newest anchor first within each severity.
  items.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'problem' ? -1 : 1
    return (a.atIso ?? '') < (b.atIso ?? '') ? 1 : -1
  })

  return {
    attention: items,
    subscriptionCounts: {
      reportsActive: reports.length,
      alertsActive: alertCountRes.count ?? listingAlerts.length,
    },
  }
}
