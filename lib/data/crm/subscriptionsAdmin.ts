import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
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
  frequency: string
  active: boolean
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
}

type ReportSubRow = {
  person_id: number
  areas: string[] | null
  frequency: string | null
  is_active: boolean
  last_sent_at: string | null
  updated_at: string | null
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

/**
 * List market report subscriptions with the person's name/email/broker.
 * Two-step read: crm_report_subscriptions has no FK to crm_people, so the
 * PostgREST embedded join is unavailable. A name/email search resolves the
 * matching person ids FIRST, then filters subscriptions to those ids.
 */
export async function listReportSubscriptionsAdmin(
  opts: ListReportSubscriptionsOptions,
): Promise<{ rows: AdminReportSubscriptionRow[], total: number }> {
  const sb = createServiceClient()
  const limit = Math.min(100, Math.max(1, opts.limit ?? 50))
  const offset = Math.max(0, opts.offset ?? 0)

  // Step 0 (search only): resolve person ids matching the query by name OR
  // email (the emails jsonb cast to text, same pattern as buildCrmPeopleQuery).
  let personIdFilter: number[] | null = null
  const q = (opts.q ?? '').trim().replace(/[,()"\\]/g, ' ').trim()
  if (q) {
    const { data: matches, error: matchErr } = await sb
      .from('crm_people')
      .select('id')
      .eq('deleted', false)
      .or(`name.ilike.%${q}%,emails::text.ilike.%${q}%`)
      .limit(2000)
    if (matchErr) {
      console.error('[listReportSubscriptionsAdmin match]', matchErr.message)
      return { rows: [], total: 0 }
    }
    personIdFilter = (matches ?? []).map((m) => m.id as number)
    if (personIdFilter.length === 0) return { rows: [], total: 0 }
  }

  let query = sb
    .from('crm_report_subscriptions')
    .select('person_id, areas, frequency, is_active, last_sent_at, updated_at', { count: 'exact' })
  if (personIdFilter) query = query.in('person_id', personIdFilter)
  if (opts.status === 'active') query = query.eq('is_active', true)
  if (opts.status === 'paused') query = query.eq('is_active', false)
  if (opts.frequency && opts.frequency !== 'all') query = query.eq('frequency', opts.frequency)
  if (opts.area) query = query.contains('areas', [opts.area])

  const { data, count, error } = await query
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) {
    console.error('[listReportSubscriptionsAdmin]', error.message)
    return { rows: [], total: 0 }
  }
  const subs = (data ?? []) as unknown as ReportSubRow[]

  // Step 2: hydrate the page's people + engagement in two parallel reads.
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
    return {
      personId: r.person_id,
      personName: person?.name ?? null,
      personEmail: primaryEmail(person?.emails ?? []),
      assignedBroker: person?.assigned_broker ?? null,
      areas: Array.isArray(r.areas) ? r.areas : [],
      frequency: r.frequency ?? 'monthly',
      active: r.is_active,
      lastSentAt: r.last_sent_at,
      updatedAt: r.updated_at,
      engagement: engagementByPersonId.get(r.person_id) ?? emptyEngagement(),
    }
  })
  return { rows, total: count ?? rows.length }
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

/** Fetch one market report subscription by person id (edit dialog + preview). */
export async function getReportSubscriptionByPersonId(
  personId: number,
): Promise<{ personId: number, areas: string[], frequency: string, active: boolean } | null> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_report_subscriptions')
    .select('person_id, areas, frequency, is_active')
    .eq('person_id', personId)
    .maybeSingle()
  if (error || !data) {
    if (error) console.error('[getReportSubscriptionByPersonId]', error.message)
    return null
  }
  const r = data as unknown as ReportSubRow
  return {
    personId: r.person_id,
    areas: Array.isArray(r.areas) ? r.areas : [],
    frequency: r.frequency ?? 'monthly',
    active: r.is_active,
  }
}

/** Update one market report subscription (areas / cadence / active). */
export async function updateReportSubscription(
  personId: number,
  patch: { areas?: string[], frequency?: 'weekly' | 'monthly' | 'quarterly', active?: boolean },
): Promise<{ ok: boolean, error: string | null }> {
  const sb = createServiceClient()
  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.areas !== undefined) fields.areas = patch.areas
  if (patch.frequency !== undefined) fields.frequency = patch.frequency
  if (patch.active !== undefined) fields.is_active = patch.active
  const { error } = await sb.from('crm_report_subscriptions').update(fields).eq('person_id', personId)
  if (error) {
    console.error('[updateReportSubscription]', error.message)
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
 * Assign the CRM person behind a subscription to a broker. Subscription rows
 * carry no broker column — attribution + report sends resolve the broker from
 * crm_people.assigned_broker, so that is what an admin assignment writes.
 */
export async function setPersonAssignedBroker(
  personId: number,
  brokerSlug: string,
): Promise<{ ok: boolean, error: string | null }> {
  const sb = createServiceClient()
  const { error } = await sb
    .from('crm_people')
    .update({ assigned_broker: brokerSlug })
    .eq('id', personId)
    .eq('deleted', false)
  if (error) {
    console.error('[setPersonAssignedBroker]', error.message)
    return { ok: false, error: 'Could not assign that broker' }
  }
  return { ok: true, error: null }
}

/** Bulk pause/resume/re-cadence market report subscriptions by person id. */
export async function bulkUpdateReportSubscriptions(
  personIds: number[],
  patch: { active?: boolean, frequency?: 'weekly' | 'monthly' | 'quarterly' },
): Promise<{ updated: number, error: string | null }> {
  if (personIds.length === 0) return { updated: 0, error: null }
  const sb = createServiceClient()
  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.active !== undefined) fields.is_active = patch.active
  if (patch.frequency !== undefined) fields.frequency = patch.frequency
  const { data, error } = await sb
    .from('crm_report_subscriptions')
    .update(fields)
    .in('person_id', personIds)
    .select('person_id')
  if (error) {
    console.error('[bulkUpdateReportSubscriptions]', error.message)
    return { updated: 0, error: 'Could not update those subscriptions' }
  }
  return { updated: data?.length ?? 0, error: null }
}
