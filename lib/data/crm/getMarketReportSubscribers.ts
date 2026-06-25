/**
 * getMarketReportSubscribers — the reader the cadence send engine + the admin
 * subscribers view both render from (Wave 8).
 *
 * crm_report_subscriptions holds the subscription (person_id, areas, frequency,
 * is_active) plus the Wave 8 cadence stamps (last_sent_at, last_attempt_at). This
 * reader joins it to crm_people for the display name + assigned broker + the FUB
 * legacy id (for click attribution), so the engine has everything it needs to
 * render + attribute + send a contact's report in one pass, and the admin view
 * can list "who is subscribed, to what, last sent when".
 *
 * DAL boundary (G1): the raw .from('crm_report_subscriptions') read lives here,
 * inside lib/data/. The cron + the admin page call these functions; neither
 * queries the table directly.
 *
 * Compliance note: this reader returns the SUBSCRIPTION state only. It performs
 * NO suppression decision and resolves NO email address — those happen at send
 * time inside the engine's per-contact send function, behind the isSuppressed
 * chokepoint (so the ci:email-send-gated gate sees the gate next to the send).
 */
import { createServiceClient } from '@/lib/supabase/service'
import { normalizeReportFrequency, type ReportFrequency } from '@/lib/data/crm/getContactReportSubscriptions'

/** One subscriber row joined to the person it belongs to. */
export type MarketReportSubscriber = {
  subscriptionId: number
  personId: number
  /** Display name for the admin list + the email greeting. */
  personName: string | null
  /** crm_people.assigned_broker short slug (matt/rebecca/paul), for attribution. */
  assignedBroker: string | null
  /** FUB legacy person id, for the ?_fuid= click-attribution stamp (nullable). */
  fubPersonId: number | null
  /** Subscribed geo area slugs. */
  areas: string[]
  frequency: ReportFrequency
  isActive: boolean
  /** ISO timestamp of the last successful send, or null when never sent. */
  lastSentAt: string | null
  /** ISO timestamp of the last send attempt, or null when never attempted. */
  lastAttemptAt: string | null
}

type RawJoinedRow = {
  id: number | string
  person_id: number | string
  areas: unknown
  frequency: unknown
  is_active: unknown
  last_sent_at: string | null
  last_attempt_at: string | null
  crm_people: {
    name: string | null
    first_name: string | null
    last_name: string | null
    assigned_broker: string | null
    fub_legacy_id: number | string | null
  } | null
}

function toInt(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

/** Best display name: explicit name, else "first last", else null. */
function deriveName(p: RawJoinedRow['crm_people']): string | null {
  if (!p) return null
  const explicit = (p.name ?? '').trim()
  if (explicit) return explicit
  const joined = [p.first_name, p.last_name].map((s) => (s ?? '').trim()).filter(Boolean).join(' ')
  return joined || null
}

/**
 * Map a raw joined row to the typed subscriber shape. Pure — exported so the
 * mapping (name derivation, areas filtering, frequency normalization, the FUB id
 * coercion) is unit-tested without the DB.
 */
export function mapMarketReportSubscriberRow(row: RawJoinedRow): MarketReportSubscriber {
  const p = row.crm_people
  return {
    subscriptionId: toInt(row.id) ?? 0,
    personId: toInt(row.person_id) ?? 0,
    personName: deriveName(p),
    assignedBroker: (p?.assigned_broker ?? null) || null,
    fubPersonId: toInt(p?.fub_legacy_id ?? null),
    areas: Array.isArray(row.areas) ? row.areas.filter((a): a is string => typeof a === 'string') : [],
    frequency: normalizeReportFrequency(row.frequency),
    isActive: row.is_active === true,
    lastSentAt: row.last_sent_at ?? null,
    lastAttemptAt: row.last_attempt_at ?? null,
  }
}

const JOIN_SELECT =
  'id,person_id,areas,frequency,is_active,last_sent_at,last_attempt_at,' +
  'crm_people!inner(name,first_name,last_name,assigned_broker,fub_legacy_id)'

/**
 * Active subscriptions ordered by last_attempt_at (never-attempted first, then
 * oldest attempt) — the order the cadence cron drains so the most-overdue
 * contacts are looked at first within a bounded per-run chunk. The cron applies
 * the isDue() cadence filter in code (the window depends on per-row frequency,
 * which is awkward to express in one SQL predicate across three cadences).
 *
 * `limit` bounds the scan so the cron never times out; pass a generous cap (the
 * cron then per-contact-rate-limits its actual sends).
 */
export async function getActiveMarketReportSubscriptions(
  limit = 1000,
): Promise<MarketReportSubscriber[]> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_report_subscriptions')
    .select(JOIN_SELECT)
    .eq('is_active', true)
    .order('last_attempt_at', { ascending: true, nullsFirst: true })
    .limit(Math.max(1, Math.trunc(limit)))
  if (error || !data) {
    if (error) console.error('[getActiveMarketReportSubscriptions]', error.message)
    return []
  }
  return (data as unknown as RawJoinedRow[]).map(mapMarketReportSubscriberRow)
}

/**
 * The admin subscribers list. Optionally scoped to one broker's contacts (a
 * non-superuser sees only their own); a null/undefined scope returns all.
 * Ordered most-recently-sent first, then never-sent, so the admin sees recent
 * activity at the top. Bounded to a sane page cap.
 */
export async function getMarketReportSubscribers(
  brokerScope?: string | null,
  limit = 500,
): Promise<MarketReportSubscriber[]> {
  const sb = createServiceClient()
  let q = sb
    .from('crm_report_subscriptions')
    .select(JOIN_SELECT)
    .order('last_sent_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .limit(Math.max(1, Math.trunc(limit)))

  const scope = (brokerScope ?? '').trim()
  if (scope) q = q.eq('crm_people.assigned_broker', scope)

  const { data, error } = await q
  if (error || !data) {
    if (error) console.error('[getMarketReportSubscribers]', error.message)
    return []
  }
  return (data as unknown as RawJoinedRow[]).map(mapMarketReportSubscriberRow)
}
