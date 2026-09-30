/**
 * marketReportSubscription — one contact's market-report subscription as the
 * sender, the no-login preferences page, the one-click endpoint and the admin
 * card all read and change it (Matt's decisions 2026-09-29).
 *
 * Reads return the whole row, including the approval stamp, the consent
 * source and the stop stamp (migration 20260929230000). Writes apply a patch
 * the caller already planned (lib/crm/market-report-subscription-control.ts
 * decides what a pause, a stop or an interval change writes) and log the
 * change to crm_timeline in the same call, so no path can change a
 * subscription without the contact record showing who changed it and from
 * where.
 *
 * DAL boundary (G1): every raw .from() for crm_report_subscriptions,
 * crm_timeline (these rows) and the contact lookup lives here. Service role.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { normalizeReportFrequency, type ReportFrequency } from '@/lib/data/crm/getContactReportSubscriptions'

export type ReportSubscriptionRecord = {
  id: number
  personId: number
  areas: string[]
  frequency: ReportFrequency
  isActive: boolean
  lastSentAt: string | null
  lastAttemptAt: string | null
  createdAt: string | null
  updatedAt: string | null
  firstSendApprovedAt: string | null
  firstSendApprovedBy: string | null
  source: string | null
  requestedAt: string | null
  consentNote: string | null
  stoppedAt: string | null
  stoppedVia: string | null
}

/** Every column a ReportSubscriptionRecord maps (mapReportSubscriptionRecord). */
export const REPORT_SUBSCRIPTION_COLS =
  'id, person_id, areas, frequency, is_active, last_sent_at, last_attempt_at, created_at, updated_at, first_send_approved_at, first_send_approved_by, source, requested_at, consent_note, stopped_at, stopped_via'

type SubRow = {
  id: number
  person_id: number
  areas: unknown
  frequency: unknown
  is_active: unknown
  last_sent_at: string | null
  last_attempt_at: string | null
  created_at: string | null
  updated_at: string | null
  first_send_approved_at: string | null
  first_send_approved_by: string | null
  source: string | null
  requested_at: string | null
  consent_note: string | null
  stopped_at: string | null
  stopped_via: string | null
}

/** Map a raw row to the record. Pure, exported for the unit test. */
export function mapReportSubscriptionRecord(r: SubRow): ReportSubscriptionRecord {
  return {
    id: Number(r.id),
    personId: Number(r.person_id),
    areas: Array.isArray(r.areas) ? r.areas.filter((a): a is string => typeof a === 'string') : [],
    frequency: normalizeReportFrequency(r.frequency),
    isActive: r.is_active === true,
    lastSentAt: r.last_sent_at ?? null,
    lastAttemptAt: r.last_attempt_at ?? null,
    createdAt: r.created_at ?? null,
    updatedAt: r.updated_at ?? null,
    firstSendApprovedAt: r.first_send_approved_at ?? null,
    firstSendApprovedBy: r.first_send_approved_by ?? null,
    source: r.source ?? null,
    requestedAt: r.requested_at ?? null,
    consentNote: r.consent_note ?? null,
    stoppedAt: r.stopped_at ?? null,
    stoppedVia: r.stopped_via ?? null,
  }
}

/** The subscription by id or by person. Null on a miss; throws on a read error (fail closed). */
export async function getReportSubscriptionRecord(
  by: { id: number } | { personId: number },
): Promise<ReportSubscriptionRecord | null> {
  const sb = createServiceClient()
  const q = sb.from('crm_report_subscriptions').select(REPORT_SUBSCRIPTION_COLS)
  const { data, error } =
    'id' in by ? await q.eq('id', by.id).maybeSingle() : await q.eq('person_id', by.personId).maybeSingle()
  if (error) throw new Error(`getReportSubscriptionRecord: ${error.message}`)
  return data ? mapReportSubscriptionRecord(data as unknown as SubRow) : null
}

/** The columns a planned change may write. */
export type ReportSubscriptionPatch = Partial<{
  areas: string[]
  frequency: ReportFrequency
  is_active: boolean
  last_sent_at: string | null
  first_send_approved_at: string | null
  first_send_approved_by: string | null
  source: string | null
  requested_at: string | null
  consent_note: string | null
  stopped_at: string | null
  stopped_via: string | null
}>

export type ReportTimelineEntry = {
  title: string
  body?: string | null
  /** 'system' for a preference change; 'email_out' for a delivered report. */
  kind?: 'system' | 'email_out'
  payload?: Record<string, unknown>
  broker?: string | null
  /** Where the change came from: 'email-link', 'one-click', 'app' (admin), 'cron'. */
  source: string
  /** Idempotency key for the timeline row (a repeat write collapses). */
  dedupeKey?: string | null
}

/** Write one crm_timeline row for this contact. Never throws; returns ok. */
export async function logReportTimeline(personId: number, entry: ReportTimelineEntry): Promise<boolean> {
  try {
    const sb = createServiceClient()
    const row = {
      person_id: personId,
      kind: entry.kind ?? 'system',
      title: entry.title.slice(0, 500),
      body: entry.body ?? null,
      payload: { sendType: 'market-report', ...(entry.payload ?? {}) },
      broker: entry.broker ?? null,
      source: entry.source,
      dedupe_key: entry.dedupeKey ?? null,
    }
    const { error } = entry.dedupeKey
      ? await sb.from('crm_timeline').upsert(row, { onConflict: 'dedupe_key', ignoreDuplicates: true })
      : await sb.from('crm_timeline').insert(row)
    if (error) {
      console.error('[logReportTimeline]', error.message)
      return false
    }
    return true
  } catch (e) {
    console.error('[logReportTimeline]', e instanceof Error ? e.message : String(e))
    return false
  }
}

/**
 * Apply a planned patch to one subscription and log the change. The update is
 * scoped by id AND person, so a patch can never land on another contact's row.
 */
export async function applyReportSubscriptionPatch(
  subscription: { id: number; personId: number },
  patch: ReportSubscriptionPatch,
  timeline: ReportTimelineEntry,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (Object.keys(patch).length === 0) return { ok: true }
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_report_subscriptions')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', subscription.id)
    .eq('person_id', subscription.personId)
    .select('id')
  if (error) return { ok: false, error: error.message }
  if (!data || data.length === 0) return { ok: false, error: 'Subscription not found' }
  await logReportTimeline(subscription.personId, timeline)
  return { ok: true }
}

/**
 * Create a subscription row for a person who has none (a one-click stop on a
 * one-off report records the choice as a stopped row; a broker's first save
 * creates it). A person with a row keeps it: the insert is a no-op on the
 * person_id conflict, `created` is false, no timeline row is written, and the
 * existing row is returned so the caller can apply its change to that row
 * instead of reporting a save that did not happen.
 */
export async function createReportSubscription(
  personId: number,
  values: {
    areas: string[]
    frequency: ReportFrequency
    isActive: boolean
    lastSentAt?: string | null
    source?: string | null
    requestedAt?: string | null
    consentNote?: string | null
    stoppedAt?: string | null
    stoppedVia?: string | null
  },
  timeline: ReportTimelineEntry,
): Promise<{ ok: true; created: boolean; record: ReportSubscriptionRecord } | { ok: false; error: string }> {
  const sb = createServiceClient()
  const { count, error } = await sb.from('crm_report_subscriptions').upsert(
    {
      person_id: personId,
      areas: values.areas,
      frequency: values.frequency,
      is_active: values.isActive,
      last_sent_at: values.lastSentAt ?? null,
      source: values.source ?? null,
      requested_at: values.requestedAt ?? null,
      consent_note: values.consentNote ?? null,
      stopped_at: values.stoppedAt ?? null,
      stopped_via: values.stoppedVia ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'person_id', ignoreDuplicates: true, count: 'exact' },
  )
  if (error) return { ok: false, error: error.message }
  const created = (count ?? 0) > 0
  const record = await getReportSubscriptionRecord({ personId }).catch(() => null)
  if (!record) return { ok: false, error: 'Subscription not found after create' }
  if (created) await logReportTimeline(personId, timeline)
  return { ok: true, created, record }
}

/** Stamp last_sent_at after a send that did not come from the cadence (a broker's manual send). */
export async function stampReportSubscriptionSentForPerson(personId: number, at: string): Promise<boolean> {
  try {
    const sb = createServiceClient()
    const { error } = await sb
      .from('crm_report_subscriptions')
      .update({ last_sent_at: at, last_attempt_at: at })
      .eq('person_id', personId)
    if (error) {
      console.error('[stampReportSubscriptionSentForPerson]', error.message)
      return false
    }
    return true
  } catch (e) {
    console.error('[stampReportSubscriptionSentForPerson]', e instanceof Error ? e.message : String(e))
    return false
  }
}

/** The contact fields a report send needs: greeting, broker, address. */
export type MarketReportContact = {
  personId: number
  name: string | null
  firstName: string | null
  primaryEmail: string | null
  assignedBroker: string | null
  deleted: boolean
  /**
   * The survivor this contact was merged into (custom.merged_into, written by
   * lib/crm/merge-people.ts when it soft-deletes the duplicate). Null when
   * the contact was never merged away.
   */
  mergedInto: number | null
}

function mergedIntoOf(custom: unknown): number | null {
  if (!custom || typeof custom !== 'object') return null
  const n = Number((custom as { merged_into?: unknown }).merged_into)
  return Number.isInteger(n) && n > 0 ? n : null
}

function primaryEmailOf(emails: unknown): string | null {
  const list = Array.isArray(emails) ? (emails as Array<{ value?: unknown; isPrimary?: unknown }>) : []
  const primary = list.find((e) => e?.isPrimary === 1 || e?.isPrimary === true)
  const value = typeof primary?.value === 'string' ? primary.value : list.find((e) => typeof e?.value === 'string')?.value
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed || null
}

/** One contact for a report send. Null when missing; throws on a read error. */
export async function getMarketReportContact(personId: number): Promise<MarketReportContact | null> {
  if (!Number.isInteger(personId) || personId <= 0) return null
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_people')
    .select('id, name, first_name, emails, assigned_broker, deleted, custom')
    .eq('id', personId)
    .maybeSingle()
  if (error) throw new Error(`getMarketReportContact: ${error.message}`)
  if (!data) return null
  const r = data as {
    id: number
    name: string | null
    first_name: string | null
    emails: unknown
    assigned_broker: string | null
    deleted: boolean | null
    custom: unknown
  }
  return {
    personId: Number(r.id),
    name: r.name ?? null,
    firstName: r.first_name ?? null,
    primaryEmail: primaryEmailOf(r.emails),
    assignedBroker: (r.assigned_broker ?? '').trim() || null,
    deleted: r.deleted === true,
    mergedInto: mergedIntoOf(r.custom),
  }
}

/** How many merges a link follows before giving up (a chain, never a loop). */
const MAX_MERGE_HOPS = 20

/**
 * The contact a report link acts on (review 2026-09-30).
 *
 * A link minted before a contact merge names the duplicate, which the merge
 * soft-deleted with custom.merged_into pointing at the survivor, and moved her
 * subscription and past reports onto that survivor. So the link follows that
 * pointer, never around a loop, and the chain ends at the first contact that
 * was not merged away:
 *   - a live contact: every choice on her page applies to her;
 *   - a DELETED contact (deleted and not merged, or merged into a contact that
 *     no longer exists, or a loop of deleted contacts): returned as it is,
 *     `deleted: true`. Her stop, her one-click unsubscribe and her "stop all
 *     email" still land on that record. Before, a deleted contact read as
 *     "not found": Gmail's one-click got a 400 and her page could not open,
 *     so she could not stop a report the cron kept sending.
 * Null when the link's own contact does not exist, or the chain is longer
 * than MAX_MERGE_HOPS (unresolvable: acting on a contact partway along it
 * would stop the wrong record). Throws on a read error (fail closed).
 */
export async function resolveReportLinkContact(personId: number): Promise<MarketReportContact | null> {
  const seen = new Set<number>()
  let reached: MarketReportContact | null = null
  let id = personId
  for (let hop = 0; hop <= MAX_MERGE_HOPS; hop++) {
    if (seen.has(id)) return reached
    seen.add(id)
    const contact = await getMarketReportContact(id)
    if (!contact) return reached
    reached = contact
    if (!contact.deleted || !contact.mergedInto) return contact
    id = contact.mergedInto
  }
  return null
}

/**
 * Stop the market report of contacts that were just deleted (review
 * 2026-09-30: deleting a contact left her subscription on, and the cron kept
 * sending to a record nobody could see). Only rows that are not already
 * stopped change: a contact's own stop stays hers (a broker restart of it
 * needs her consent on record), and an existing broker stop keeps its stamp.
 * Each stopped row gets a crm_timeline line naming the admin. Returns the
 * person ids whose report was stopped. Never throws; a failure is returned so
 * the delete can report it.
 */
export async function stopReportSubscriptionsForDeletedPeople(
  personIds: readonly number[],
  actor: { email: string; brokerSlug?: string | null },
  now: Date = new Date(),
): Promise<{ ok: true; stopped: number[] } | { ok: false; error: string }> {
  const ids = [...new Set(personIds.filter((n) => Number.isInteger(n) && n > 0))]
  if (ids.length === 0) return { ok: true, stopped: [] }
  try {
    const sb = createServiceClient()
    const nowIso = now.toISOString()
    const stopped: number[] = []
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await sb
        .from('crm_report_subscriptions')
        .update({ is_active: false, stopped_at: nowIso, stopped_via: 'admin', updated_at: nowIso })
        .in('person_id', ids.slice(i, i + 200))
        .is('stopped_at', null)
        .select('person_id')
      if (error) return { ok: false, error: error.message }
      for (const r of (data ?? []) as Array<{ person_id: number }>) stopped.push(Number(r.person_id))
    }
    for (const personId of stopped) {
      await logReportTimeline(personId, {
        title: `Market report stopped: the contact was deleted by ${actor.email}`,
        payload: { via: 'admin', change: 'stop', reason: 'contact-deleted' },
        broker: actor.brokerSlug ?? null,
        source: 'app',
      })
    }
    return { ok: true, stopped }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
