import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { fetchPagedRows } from '@/lib/supabase/paginate'
import { reportAreaLabel } from '@/lib/crm/market-report-areas'
import { UNMAPPED_OWN_BOOK } from '@/lib/crm/scope'
import {
  CONTACT_STOP_VIAS,
  isContactStopped,
  planReportChanges,
  type ReportChange,
} from '@/lib/crm/market-report-subscription-control'
import {
  mapReportSubscriptionRecord,
  REPORT_SUBSCRIPTION_COLS,
  type ReportSubscriptionPatch,
  type ReportSubscriptionRecord,
} from '@/lib/data/crm/marketReportSubscription'
import {
  getAlertEngagementByIds,
  getReportEngagementByPersonIds,
  emptyEngagement,
  type SubscriptionEngagement,
} from '@/lib/data/crm/subscriptionsAdminEngagement'

export {
  getAlertEngagementByIds,
  getReportEngagementByPersonIds,
  emptyEngagement,
  type SubscriptionEngagement,
}

/**
 * Admin DAL for the unified Subscriptions hub (/admin/crm/subscriptions).
 *
 * Two subscription families, one management surface:
 *   - Listing alerts: ONE canonical table (public.listing_alerts, unified
 *     2026-07-07). The hub's historical guest/user split is preserved as a
 *     VIEW over the row's user_id: a row with a user_id is kind='user', a row
 *     without one is kind='guest'. The exported types + function signatures
 *     are unchanged so the hub UI keeps compiling.
 *   - Market reports: crm_report_subscriptions (one row per CRM person).
 *
 * Service-role only (listing_alerts RLS only grants users their own rows).
 * Callers are the admin-gated server actions in app/actions/subscriptions-admin.ts.
 */

export type AlertSubscriptionKind = 'guest' | 'user'

export type AdminAlertSubscriptionRow = {
  kind: AlertSubscriptionKind
  id: string
  email: string | null
  name: string | null
  filters: Record<string, unknown> | null
  frequency: string
  active: boolean
  lastNotifiedAt: string | null
  createdAt: string | null
  origin: string | null
  assignedBy: string | null
  crmPersonId: number | null
  engagement: SubscriptionEngagement
}

export type ListAlertSubscriptionsOptions = {
  /** Substring match on email or search name. */
  q?: string
  status?: 'active' | 'paused' | 'all'
  kind?: AlertSubscriptionKind | 'all'
  origin?: 'user' | 'broker' | 'system' | 'all'
  frequency?: 'instant' | 'daily' | 'weekly' | 'all'
  limit?: number
  offset?: number
}

export type ListAlertSubscriptionsResult = {
  rows: AdminAlertSubscriptionRow[]
  total: number
}

const ALERT_COLS =
  'id, email, user_id, filters, name, notification_frequency, is_active, last_notified_at, created_at, origin, assigned_by, crm_person_id'

type AlertRow = {
  id: string
  email: string
  user_id: string | null
  filters: Record<string, unknown> | null
  name: string | null
  notification_frequency: string | null
  is_active: boolean
  last_notified_at: string | null
  created_at: string | null
  origin: string | null
  assigned_by: string | null
  crm_person_id: number | null
}

function toAdminAlertRow(r: AlertRow, engagement: SubscriptionEngagement): AdminAlertSubscriptionRow {
  return {
    kind: r.user_id ? 'user' : 'guest',
    id: r.id,
    email: r.email,
    name: r.name,
    filters: r.filters,
    frequency: r.notification_frequency ?? 'daily',
    active: r.is_active,
    lastNotifiedAt: r.last_notified_at,
    createdAt: r.created_at,
    origin: r.origin ?? 'user',
    assignedBy: r.assigned_by,
    crmPersonId: r.crm_person_id,
    engagement,
  }
}

/** Shared list query over listing_alerts, optionally restricted to one kind. */
async function listAlertSubscriptions(
  opts: ListAlertSubscriptionsOptions,
  kind: AlertSubscriptionKind | null,
): Promise<ListAlertSubscriptionsResult> {
  const sb = createServiceClient()
  const limit = Math.min(100, Math.max(1, opts.limit ?? 50))
  const offset = Math.max(0, opts.offset ?? 0)

  let query = sb.from('listing_alerts').select(ALERT_COLS, { count: 'exact' })
  if (kind === 'guest') query = query.is('user_id', null)
  if (kind === 'user') query = query.not('user_id', 'is', null)
  const q = (opts.q ?? '').trim()
  if (q) query = query.or(`email.ilike.%${q}%,name.ilike.%${q}%`)
  if (opts.status === 'active') query = query.eq('is_active', true)
  if (opts.status === 'paused') query = query.eq('is_active', false)
  if (opts.origin && opts.origin !== 'all') query = query.eq('origin', opts.origin)
  if (opts.frequency && opts.frequency !== 'all') query = query.eq('notification_frequency', opts.frequency)

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) {
    console.error('[listAlertSubscriptions]', error.message)
    return { rows: [], total: 0 }
  }
  const alertRows = (data ?? []) as unknown as AlertRow[]
  const engagementById = await getAlertEngagementByIds(alertRows.map((r) => r.id))
  const rows = alertRows.map((r) => toAdminAlertRow(r, engagementById.get(r.id) ?? emptyEngagement()))
  return { rows, total: count ?? rows.length }
}

/**
 * List guest listing alerts (listing_alerts rows with no user_id) with
 * filters + count. The hub renders guest/user as tabs of one surface.
 */
export async function listGuestAlertSubscriptions(
  opts: ListAlertSubscriptionsOptions,
): Promise<ListAlertSubscriptionsResult> {
  return listAlertSubscriptions(opts, 'guest')
}

/**
 * List signed-in saved searches (listing_alerts rows carrying a user_id) with
 * filters + count. The account email is stored on the row now — no auth admin
 * API round-trips.
 */
export async function listUserSavedSearches(
  opts: ListAlertSubscriptionsOptions,
): Promise<ListAlertSubscriptionsResult> {
  return listAlertSubscriptions(opts, 'user')
}

export type AlertSubscriptionPatch = {
  active?: boolean
  frequency?: 'instant' | 'daily' | 'weekly'
}

/**
 * Bulk pause/resume/re-cadence listing alerts by id. Ids are unique across the
 * unified table, so `kind` no longer routes the write — it is kept in the
 * signature for the hub UI's sake. Returns the number of rows actually touched
 * so the UI can report honestly.
 */
export async function bulkUpdateAlertSubscriptions(
  _kind: AlertSubscriptionKind,
  ids: string[],
  patch: AlertSubscriptionPatch,
): Promise<{ updated: number, error: string | null }> {
  if (ids.length === 0) return { updated: 0, error: null }
  const sb = createServiceClient()
  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.active !== undefined) fields.is_active = patch.active
  if (patch.frequency !== undefined) fields.notification_frequency = patch.frequency
  const { data, error } = await sb.from('listing_alerts').update(fields).in('id', ids).select('id')
  if (error) {
    console.error('[bulkUpdateAlertSubscriptions]', error.message)
    return { updated: 0, error: 'Could not update those alerts' }
  }
  return { updated: data?.length ?? 0, error: null }
}

/** Bulk delete listing alerts by id (kind kept for signature stability). */
export async function bulkDeleteAlertSubscriptions(
  _kind: AlertSubscriptionKind,
  ids: string[],
): Promise<{ deleted: number, error: string | null }> {
  if (ids.length === 0) return { deleted: 0, error: null }
  const sb = createServiceClient()
  const { data, error } = await sb.from('listing_alerts').delete().in('id', ids).select('id')
  if (error) {
    console.error('[bulkDeleteAlertSubscriptions]', error.message)
    return { deleted: 0, error: 'Could not delete those alerts' }
  }
  return { deleted: data?.length ?? 0, error: null }
}

// ── Market report subscriptions ───────────────────────────────────────────────

export type AdminReportSubscriptionRow = {
  personId: number
  personName: string | null
  personEmail: string | null
  assignedBroker: string | null
  areas: string[]
  /** Display labels for `areas`, in order ("bend-larkspur" -> "Larkspur"). */
  areaLabels: string[]
  frequency: string
  active: boolean
  /** on / paused (off, not stopped) / stopped (a report-scoped stop). */
  state: 'on' | 'paused' | 'stopped'
  /** Who stopped it: one-click, email-link, self-serve (the contact) or admin. */
  stoppedVia: string | null
  /** Null until a broker approves the first send after a preview. */
  firstSendApprovedAt: string | null
  lastSentAt: string | null
  updatedAt: string | null
  engagement: SubscriptionEngagement
}

export type ListReportSubscriptionsOptions = {
  /** Substring match on the person's name or email. */
  q?: string
  status?: 'active' | 'paused' | 'all'
  frequency?: 'weekly' | 'monthly' | 'quarterly' | 'all'
  /** Restrict to subscriptions containing this area slug. */
  area?: string
  limit?: number
  offset?: number
  /**
   * A scoped broker's own slug (lib/crm/scope.ts scopeBroker): only contacts
   * assigned to them are listed. Null or absent = every contact (the owner).
   */
  scopeBroker?: string | null
}

type ReportSubRow = {
  person_id: number
  areas: string[] | null
  frequency: string | null
  is_active: boolean
  last_sent_at: string | null
  updated_at: string | null
  stopped_at?: string | null
  stopped_via?: string | null
  first_send_approved_at?: string | null
}

type PersonLite = {
  id: number
  name: string | null
  emails: Array<{ value?: string, isPrimary?: number | boolean }> | null
  assigned_broker: string | null
  deleted: boolean
}

function primaryEmail(emails: Array<{ value?: string, isPrimary?: number | boolean }> | null): string | null {
  const list = Array.isArray(emails) ? emails : []
  const primary = list.find((e) => e?.isPrimary === 1 || e?.isPrimary === true)
  const value = (primary?.value ?? list.find((e) => typeof e?.value === 'string' && e.value.trim())?.value ?? '').trim()
  return value || null
}

/** Contact ids per request when checking ids against crm_people (a bounded URL). */
const PERSON_ID_CHUNK = 200

const REPORT_LIST_COLS =
  'person_id, areas, frequency, is_active, last_sent_at, updated_at, stopped_at, stopped_via, first_send_approved_at'

/**
 * List market report subscriptions with the person's name/email/broker.
 * crm_report_subscriptions has no FK to crm_people, so the PostgREST embedded
 * join is unavailable.
 *
 * Unfiltered (the owner, no search): one counted, paged read of the table.
 *
 * Scoped (a broker's own book) or searched: SUBSCRIPTION-FIRST. Every
 * subscription the row filters keep is read (one row per subscribed contact,
 * far fewer than any broker's book), their contacts are checked against the
 * scope and the search PERSON_ID_CHUNK ids at a time, and the page is cut
 * from that ordered list. No request carries a whole book of contact ids.
 */
export async function listReportSubscriptionsAdmin(
  opts: ListReportSubscriptionsOptions,
): Promise<{ rows: AdminReportSubscriptionRow[], total: number }> {
  const sb = createServiceClient()
  const limit = Math.min(100, Math.max(1, opts.limit ?? 50))
  const offset = Math.max(0, opts.offset ?? 0)
  const scope = opts.scopeBroker ?? null
  const q = (opts.q ?? '').trim().replace(/[,()"\\]/g, ' ').trim()
  if (scope === UNMAPPED_OWN_BOOK) return { rows: [], total: 0 }

  let subs: ReportSubRow[]
  let total: number
  if (!scope && !q) {
    let query = sb.from('crm_report_subscriptions').select(REPORT_LIST_COLS, { count: 'exact' })
    if (opts.status === 'active') query = query.eq('is_active', true)
    if (opts.status === 'paused') query = query.eq('is_active', false)
    if (opts.frequency && opts.frequency !== 'all') query = query.eq('frequency', opts.frequency)
    if (opts.area) query = query.contains('areas', [opts.area])
    const { data, count, error } = await query
      .order('updated_at', { ascending: false })
      .order('person_id', { ascending: true })
      .range(offset, offset + limit - 1)
    if (error) {
      console.error('[listReportSubscriptionsAdmin]', error.message)
      return { rows: [], total: 0 }
    }
    subs = (data ?? []) as unknown as ReportSubRow[]
    total = count ?? subs.length
  } else {
    // 1. Every subscription the row filters keep, newest first.
    const { rows: candidates, error: candErr } = await fetchPagedRows<ReportSubRow>((from, to) => {
      let query = sb.from('crm_report_subscriptions').select(REPORT_LIST_COLS)
      if (opts.status === 'active') query = query.eq('is_active', true)
      if (opts.status === 'paused') query = query.eq('is_active', false)
      if (opts.frequency && opts.frequency !== 'all') query = query.eq('frequency', opts.frequency)
      if (opts.area) query = query.contains('areas', [opts.area])
      return query
        .order('updated_at', { ascending: false })
        .order('person_id', { ascending: true })
        .range(from, to)
    })
    if (candErr) {
      console.error('[listReportSubscriptionsAdmin candidates]', candErr.message)
      return { rows: [], total: 0 }
    }
    // 2. Keep the ones whose contact is live, in the caller's book, and
    // matches the search (name, or the emails jsonb cast to text, the same
    // pattern as buildCrmPeopleQuery).
    const ids = [...new Set(candidates.map((r) => Number(r.person_id)))]
    const keep = new Set<number>()
    for (let i = 0; i < ids.length; i += PERSON_ID_CHUNK) {
      let people = sb.from('crm_people').select('id').in('id', ids.slice(i, i + PERSON_ID_CHUNK)).eq('deleted', false)
      if (scope) people = people.eq('assigned_broker', scope)
      if (q) people = people.or(`name.ilike.%${q}%,emails::text.ilike.%${q}%`)
      const { data, error } = await people
      if (error) {
        console.error('[listReportSubscriptionsAdmin people filter]', error.message)
        return { rows: [], total: 0 }
      }
      for (const row of (data ?? []) as Array<{ id: number }>) keep.add(Number(row.id))
    }
    const kept = candidates.filter((r) => keep.has(Number(r.person_id)))
    total = kept.length
    subs = kept.slice(offset, offset + limit)
  }

  // Then hydrate the page's people + engagement in two parallel reads.
  const ids = [...new Set(subs.map((r) => r.person_id))]
  const peopleById = new Map<number, PersonLite>()
  const [engagementByPersonId] = await Promise.all([
    getReportEngagementByPersonIds(ids),
    (async () => {
      if (ids.length === 0) return
      const { data: people, error: pErr } = await sb
        .from('crm_people')
        .select('id, name, emails, assigned_broker, deleted')
        .in('id', ids)
      if (pErr) console.error('[listReportSubscriptionsAdmin people]', pErr.message)
      for (const p of (people ?? []) as unknown as PersonLite[]) peopleById.set(p.id, p)
    })(),
  ])

  const rows: AdminReportSubscriptionRow[] = subs.map((r) => {
    const person = peopleById.get(r.person_id) ?? null
    const areas = Array.isArray(r.areas) ? r.areas : []
    return {
      personId: r.person_id,
      personName: person?.name ?? null,
      personEmail: primaryEmail(person?.emails ?? []),
      assignedBroker: person?.assigned_broker ?? null,
      areas,
      areaLabels: areas.map(reportAreaLabel),
      frequency: r.frequency ?? 'monthly',
      active: r.is_active,
      state: r.is_active ? 'on' : r.stopped_at ? 'stopped' : 'paused',
      stoppedVia: r.stopped_via ?? null,
      firstSendApprovedAt: r.first_send_approved_at ?? null,
      lastSentAt: r.last_sent_at,
      updatedAt: r.updated_at,
      engagement: engagementByPersonId.get(r.person_id) ?? emptyEngagement(),
    }
  })
  return { rows, total }
}

// ── Single-row reads + mutations (edit / preview / assign) ──────────────────

export type AlertSubscriptionDetail = {
  kind: AlertSubscriptionKind
  id: string
  email: string | null
  name: string | null
  filters: Record<string, unknown> | null
  frequency: string
  active: boolean
  unsubscribeToken: string | null
  crmPersonId: number | null
}

/**
 * Fetch one listing alert by id (edit dialog + email preview). Ids are unique
 * across the unified table; the returned `kind` is derived from the row's
 * user_id (the caller-passed kind is accepted for signature stability).
 */
export async function getAlertSubscriptionById(
  _kind: AlertSubscriptionKind,
  id: string,
): Promise<AlertSubscriptionDetail | null> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('listing_alerts')
    .select('id, email, user_id, name, filters, notification_frequency, is_active, unsubscribe_token, crm_person_id')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) {
    if (error) console.error('[getAlertSubscriptionById]', error.message)
    return null
  }
  const r = data as unknown as AlertRow & { unsubscribe_token: string | null }
  return {
    kind: r.user_id ? 'user' : 'guest',
    id: r.id,
    email: r.email,
    name: r.name,
    filters: r.filters,
    frequency: r.notification_frequency ?? 'daily',
    active: r.is_active,
    unsubscribeToken: r.unsubscribe_token,
    crmPersonId: r.crm_person_id,
  }
}

export type AlertSubscriptionUpdate = {
  name?: string
  filters?: Record<string, unknown>
  /** Stable hash of the normalized filters (the unified unique (email, filters_hash) pair). */
  filtersHash?: string
  frequency?: 'instant' | 'daily' | 'weekly'
  active?: boolean
}

/** Update one listing alert (edit dialog write-back). */
export async function updateAlertSubscription(
  _kind: AlertSubscriptionKind,
  id: string,
  patch: AlertSubscriptionUpdate,
): Promise<{ ok: boolean, error: string | null }> {
  const sb = createServiceClient()
  const fields: Record<string, unknown> = {}
  if (patch.name !== undefined) fields.name = patch.name
  if (patch.filters !== undefined) fields.filters = patch.filters
  if (patch.filtersHash !== undefined) fields.filters_hash = patch.filtersHash
  if (patch.frequency !== undefined) fields.notification_frequency = patch.frequency
  if (patch.active !== undefined) fields.is_active = patch.active
  if (Object.keys(fields).length === 0) return { ok: true, error: null }
  fields.updated_at = new Date().toISOString()
  const { error } = await sb.from('listing_alerts').update(fields).eq('id', id)
  if (error) {
    console.error('[updateAlertSubscription]', error.message)
    return { ok: false, error: 'Could not save those changes' }
  }
  return { ok: true, error: null }
}

/** Delete one market report subscription (the person keeps their CRM record). */
export async function deleteReportSubscription(
  personId: number,
): Promise<{ ok: boolean, error: string | null }> {
  const sb = createServiceClient()
  const { error } = await sb.from('crm_report_subscriptions').delete().eq('person_id', personId)
  if (error) {
    console.error('[deleteReportSubscription]', error.message)
    return { ok: false, error: 'Could not delete that subscription' }
  }
  return { ok: true, error: null }
}

/**
 * The subset of `personIds` a caller may change: every id for the owner
 * (scope null), none for an unmapped non-superuser, else the contacts
 * assigned to the caller's own slug (the same rule as requirePersonInScope,
 * lib/crm/scope.ts isPersonInScope). PERSON_ID_CHUNK ids per read, so a bulk
 * selection is one bounded query per chunk rather than one query per contact.
 */
export async function filterPersonIdsInBrokerScope(
  personIds: readonly number[],
  scope: string | null,
): Promise<{ ids: number[], error: string | null }> {
  const clean = [...new Set(personIds.filter((n) => Number.isInteger(n) && n > 0))]
  if (scope === null) return { ids: clean, error: null }
  if (scope === UNMAPPED_OWN_BOOK || clean.length === 0) return { ids: [], error: null }
  const sb = createServiceClient()
  const keep = new Set<number>()
  for (let i = 0; i < clean.length; i += PERSON_ID_CHUNK) {
    const { data, error } = await sb
      .from('crm_people')
      .select('id')
      .in('id', clean.slice(i, i + PERSON_ID_CHUNK))
      .eq('assigned_broker', scope)
    if (error) {
      console.error('[filterPersonIdsInBrokerScope]', error.message)
      return { ids: [], error: 'Could not check which contacts are in your book' }
    }
    for (const row of (data ?? []) as Array<{ id: number }>) keep.add(Number(row.id))
  }
  return { ids: clean.filter((id) => keep.has(id)), error: null }
}

export type BulkReportUpdateResult = {
  /** Subscriptions actually changed (already-so rows are not counted). */
  updated: number
  /** Stopped by the contact herself: a bulk turn-on never restarts one. */
  skippedContactStopped: number
  /** No areas: a report cannot turn on with nothing to report on. */
  skippedNoAreas: number
  error: string | null
}

/**
 * Bulk pause / resume / re-cadence market report subscriptions by person id
 * (Matt's decisions 2026-09-29: no subscription changes silently).
 *
 * Each row is planned through the same planner as one contact's card
 * (lib/crm/market-report-subscription-control.ts), so the hub's bulk bar
 * follows the same rules: a row already in the asked state is left alone and
 * gets no timeline row; a turn-on skips a row with no areas and every row the
 * contact stopped herself (restarting one needs her new consent on record, one
 * contact at a time, on the market report card); an admin stop or a pause
 * turns back on and its stop stamp clears. Rows with the same planned patch
 * are written together, and every changed row gets one crm_timeline row
 * naming the admin.
 */
export async function bulkUpdateReportSubscriptions(
  personIds: number[],
  patch: { active?: boolean, frequency?: 'weekly' | 'monthly' | 'quarterly' },
  actor: { email: string, brokerSlug: string | null } = { email: 'an admin', brokerSlug: null },
): Promise<BulkReportUpdateResult> {
  const result: BulkReportUpdateResult = { updated: 0, skippedContactStopped: 0, skippedNoAreas: 0, error: null }
  const ids = [...new Set(personIds.filter((n) => Number.isInteger(n) && n > 0))]
  if (ids.length === 0) return result
  const sb = createServiceClient()

  // 1. The rows as they are now.
  const records: ReportSubscriptionRecord[] = []
  for (let i = 0; i < ids.length; i += PERSON_ID_CHUNK) {
    const { data, error } = await sb
      .from('crm_report_subscriptions')
      .select(REPORT_SUBSCRIPTION_COLS)
      .in('person_id', ids.slice(i, i + PERSON_ID_CHUNK))
    if (error) {
      console.error('[bulkUpdateReportSubscriptions] read', error.message)
      return { ...result, error: 'Could not update those subscriptions' }
    }
    for (const row of (data ?? []) as unknown as Parameters<typeof mapReportSubscriptionRecord>[0][]) {
      records.push(mapReportSubscriptionRecord(row))
    }
  }

  // 2. Plan each row: the interval first, then on/off (the card's order).
  const changes: ReportChange[] = []
  if (patch.frequency) changes.push({ kind: 'frequency', frequency: patch.frequency })
  if (patch.active !== undefined) changes.push(patch.active ? { kind: 'resume' } : { kind: 'pause' })
  if (changes.length === 0) return result
  const groups = new Map<string, { patch: ReportSubscriptionPatch, rows: Array<{ personId: number, title: string }> }>()
  for (const rec of records) {
    const plan = planReportChanges(rec, changes, { via: 'admin', adminEmail: actor.email })
    if (!plan.ok) {
      if (plan.code === 'consent-required' || isContactStopped(rec)) result.skippedContactStopped += 1
      else result.skippedNoAreas += 1
      continue
    }
    if (plan.noop) continue
    const key = JSON.stringify(plan.patch)
    const group = groups.get(key) ?? { patch: plan.patch, rows: [] }
    group.rows.push({ personId: rec.personId, title: `${plan.titles.join('; ')} (Subscriptions hub, bulk)` })
    groups.set(key, group)
  }

  // 3. Write each group. A turn-on also re-checks, in the same statement,
  // that the contact has not stopped the report herself since the read.
  const nowIso = new Date().toISOString()
  const titles = new Map<number, string>()
  for (const group of groups.values()) {
    for (const r of group.rows) titles.set(r.personId, r.title)
    const groupIds = group.rows.map((r) => r.personId)
    for (let i = 0; i < groupIds.length; i += PERSON_ID_CHUNK) {
      let update = sb
        .from('crm_report_subscriptions')
        .update({ ...group.patch, updated_at: nowIso })
        .in('person_id', groupIds.slice(i, i + PERSON_ID_CHUNK))
      if (group.patch.is_active === true) {
        update = update.or(`stopped_via.is.null,stopped_via.not.in.(${CONTACT_STOP_VIAS.join(',')})`)
      }
      const { data, error } = await update.select('person_id')
      if (error) {
        console.error('[bulkUpdateReportSubscriptions]', error.message)
        result.error = 'Could not update those subscriptions'
        break
      }
      const changed = ((data ?? []) as Array<{ person_id: number }>).map((r) => Number(r.person_id))
      result.updated += changed.length
      const rows = changed.map((personId) => ({
        person_id: personId,
        kind: 'system',
        title: (titles.get(personId) ?? 'Market report changed (Subscriptions hub, bulk)').slice(0, 500),
        payload: { sendType: 'market-report', via: 'admin', change: 'bulk', patch },
        broker: actor.brokerSlug,
        source: 'app',
      }))
      if (rows.length > 0) {
        const { error: tlErr } = await sb.from('crm_timeline').insert(rows)
        if (tlErr) console.error('[bulkUpdateReportSubscriptions] timeline', tlErr.message)
      }
    }
    if (result.error) break
  }
  return result
}
