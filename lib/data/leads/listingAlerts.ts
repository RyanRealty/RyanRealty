import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { normalizeSavedSearchFrequency } from '@/lib/saved-search-frequency'

/**
 * DAL for public.listing_alerts — the ONE canonical listing-alert table
 * (unified 2026-07-07 from saved_searches + guest_search_alerts by migration
 * 20260707160000_unify_listing_alerts.sql).
 *
 * Every alert row, whether created by a guest on /search, a signed-in user on
 * /account, a broker (bulk assign / lead page), or the system (neighborhood
 * defaults), lives here keyed by (email, filters_hash). Optional identity
 * links: user_id (auth), crm_person_id (tracking), fub_person_id (compliance).
 *
 * Service-role only for writes (RLS grants authenticated users read/update/
 * delete on their OWN rows, but the app routes all mutations through here so
 * email normalization + identity stamping is consistent). Lives in lib/data so
 * the table stays behind the DAL boundary (G1 — listing_alerts is in the
 * eslint + check-dal-boundary banned lists).
 */

const TABLE = 'listing_alerts'

export type ListingAlertRow = {
  id: string
  email: string
  user_id: string | null
  crm_person_id: number | null
  fub_person_id: number | null
  name: string | null
  filters: Record<string, unknown> | null
  filters_hash: string | null
  notification_frequency: string | null
  is_active: boolean | null
  origin: 'user' | 'broker' | 'system'
  assigned_by: string | null
  source: string | null
  unsubscribe_token: string
  last_notified_at: string | null
  created_at: string | null
  updated_at: string | null
}

const ROW_COLS =
  'id, email, user_id, crm_person_id, fub_person_id, name, filters, filters_hash, notification_frequency, is_active, origin, assigned_by, source, unsubscribe_token, last_notified_at, created_at, updated_at'

/**
 * Resolve the crm_people.id for an alert row (fub legacy id link first, then
 * email match). Every alert row should be born tracking-ready — the send path
 * needs a crm_person_id for open/click attribution.
 */
async function resolveCrmPersonId(
  supabase: ReturnType<typeof createServiceClient>,
  args: { email?: string | null; fubPersonId?: number | null },
): Promise<number | null> {
  if (args.fubPersonId) {
    const { data } = await supabase
      .from('crm_people')
      .select('id')
      .eq('fub_legacy_id', args.fubPersonId)
      .eq('deleted', false)
      .limit(1)
      .maybeSingle()
    if (data?.id) return data.id as number
  }
  const email = (args.email ?? '').trim().toLowerCase()
  if (email) {
    const { data } = await supabase
      .from('crm_people')
      .select('id')
      .contains('emails', JSON.stringify([{ value: email }]))
      .eq('deleted', false)
      .limit(1)
      .maybeSingle()
    if (data?.id) return data.id as number
  }
  return null
}

export type ListingAlertInput = {
  email: string
  filters: Record<string, unknown>
  filtersHash: string
  name: string
  fubPersonId?: number | null
  /** Auth user id when the subscriber is signed in (the /account create path). */
  userId?: string | null
}

/**
 * Upsert by (email, filters_hash) — the self-serve create path (guest capture
 * on /search + signed-in save). Re-submitting the same search re-activates +
 * refreshes the row rather than creating a duplicate.
 */
export async function upsertListingAlert(input: ListingAlertInput): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient()
  const email = input.email.trim().toLowerCase()
  const crmPersonId = await resolveCrmPersonId(supabase, {
    email,
    fubPersonId: input.fubPersonId,
  })
  const { error } = await supabase.from(TABLE).upsert(
    {
      email,
      filters: input.filters,
      filters_hash: input.filtersHash,
      name: input.name,
      user_id: input.userId ?? null,
      fub_person_id: input.fubPersonId ?? null,
      crm_person_id: crmPersonId,
      origin: 'user',
      source: input.userId ? 'user' : 'idx-registration',
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'email,filters_hash' },
  )
  if (error) {
    // Log the raw DB error server-side; return a generic code so a careless
    // caller edit can never leak schema/constraint details to the client.
    console.error('[upsertListingAlert]', error.message)
    return { ok: false, error: 'persist_failed' }
  }
  return { ok: true }
}

/**
 * Create a listing alert FOR a lead on the broker's behalf (origin='broker'),
 * or a system-generated one (origin='system'). Same engine + table as a user's
 * own saved search, so it shows up in the lead's list and the alert cron emails
 * it like any other.
 */
export async function createListingAlertForLead(input: {
  email: string
  fubPersonId?: number | null
  /** crm_people.id — required for the alert email's open/click tracking. Resolved from fub id or email when omitted. */
  crmPersonId?: number | null
  name: string
  filters: Record<string, unknown>
  filtersHash: string
  origin: 'broker' | 'system'
  assignedBy?: string | null
  frequency?: 'daily' | 'weekly'
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient()
  const email = input.email.trim().toLowerCase()

  // Resolve the CRM person when the caller didn't supply one, so the row is
  // born tracking-ready (fub id link first, then email match).
  const crmPersonId = input.crmPersonId
    ?? await resolveCrmPersonId(supabase, { email, fubPersonId: input.fubPersonId })

  const { error } = await supabase.from(TABLE).upsert(
    {
      email,
      filters: input.filters,
      filters_hash: input.filtersHash,
      name: input.name,
      fub_person_id: input.fubPersonId ?? null,
      crm_person_id: crmPersonId,
      origin: input.origin,
      assigned_by: input.assignedBy ?? null,
      source: input.origin === 'broker' ? 'broker-assigned' : 'system',
      notification_frequency: input.frequency ?? 'weekly',
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'email,filters_hash' },
  )
  if (error) { console.error('[createListingAlertForLead]', error.message); return { ok: false, error: 'persist_failed' } }
  return { ok: true }
}

/**
 * Listing alerts for ONE lead — matched by auth user id, CRM person id, FUB
 * person id, OR any of the lead's emails (signups that predate identity
 * linking carry only the email). Used by the broker Lead Command Center to
 * show what a lead is actively shopping for. Active rows first, newest first.
 */
export async function getListingAlertsForLead(args: {
  userId?: string | null
  crmPersonId?: number | null
  fubPersonId?: number | null
  emails?: string[]
}): Promise<ListingAlertRow[]> {
  const supabase = createServiceClient()
  const emails = (args.emails ?? [])
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  const ors: string[] = []
  if (args.userId) ors.push(`user_id.eq.${args.userId}`)
  if (args.crmPersonId) ors.push(`crm_person_id.eq.${args.crmPersonId}`)
  if (args.fubPersonId) ors.push(`fub_person_id.eq.${args.fubPersonId}`)
  for (const e of emails) ors.push(`email.eq.${e}`)
  if (ors.length === 0) return []

  const { data, error } = await supabase
    .from(TABLE)
    .select(ROW_COLS)
    .or(ors.join(','))
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(25)
  if (error) {
    console.error('[getListingAlertsForLead]', error.message)
    return []
  }
  return (data ?? []) as ListingAlertRow[]
}

/**
 * Active alerts for the cron to email — MOST-OVERDUE FIRST (never-notified rows
 * lead) so a large active set (e.g. the neighborhood-default rollout) drains
 * fairly across cron runs instead of newest-created rows starving the rest.
 */
export async function getActiveListingAlertsDue(limit: number): Promise<ListingAlertRow[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from(TABLE)
    .select(ROW_COLS)
    .eq('is_active', true)
    .order('last_notified_at', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true })
    .limit(Math.min(1000, Math.max(1, limit)))
  if (error) {
    console.error('[getActiveListingAlertsDue]', error.message)
    return []
  }
  return (data ?? []) as ListingAlertRow[]
}

/** Edit a listing alert — rename and/or change its parameters or cadence. */
export async function updateListingAlert(
  id: string,
  fields: {
    name?: string
    filters?: Record<string, unknown>
    filtersHash?: string
    frequency?: 'instant' | 'daily' | 'weekly'
  },
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (fields.name !== undefined) patch.name = fields.name
  if (fields.filters !== undefined) patch.filters = fields.filters
  if (fields.filtersHash !== undefined) patch.filters_hash = fields.filtersHash
  if (fields.frequency !== undefined) patch.notification_frequency = normalizeSavedSearchFrequency(fields.frequency)
  const { error } = await supabase.from(TABLE).update(patch).eq('id', id)
  if (error) { console.error('[updateListingAlert]', error.message); return { ok: false, error: 'persist_failed' } }
  return { ok: true }
}

/** Pause (false) / resume (true) one alert by id. */
export async function setListingAlertActive(id: string, active: boolean): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from(TABLE)
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) { console.error('[setListingAlertActive]', error.message); return { ok: false, error: 'persist_failed' } }
  return { ok: true }
}

/** Remove a listing alert by id. */
export async function deleteListingAlertById(id: string): Promise<{ ok: boolean }> {
  const supabase = createServiceClient()
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  return { ok: !error }
}

/** Stamp last_notified_at after the cron sends (or decides to skip) an alert. */
export async function markListingAlertNotified(id: string, isoTime: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient()
  const { error } = await supabase.from(TABLE).update({ last_notified_at: isoTime, updated_at: isoTime }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/**
 * Unsubscribe — deactivate by token (ONE token namespace now: guest + signed-in
 * tokens were both migrated into listing_alerts with their values preserved, so
 * links in already-sent emails keep working). matched=false means the token was
 * unknown.
 */
export async function deactivateListingAlertByToken(token: string): Promise<{ ok: boolean; matched: boolean; error?: string }> {
  const trimmed = (token ?? '').trim()
  if (!trimmed) return { ok: true, matched: false }
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from(TABLE)
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('unsubscribe_token', trimmed)
    .select('id')
  if (error) return { ok: false, matched: false, error: error.message }
  return { ok: true, matched: (data?.length ?? 0) > 0 }
}

export type ClaimListingAlertsResult = {
  ok: boolean
  /** Active alert rows whose email matched and got the user_id stamped. */
  claimed: number
  error?: string
}

/**
 * Claim-on-sign-in (replaces the old copy-guest-row-then-deactivate flow):
 * stamp user_id (+ crm_person_id when resolvable) onto the ACTIVE alert rows
 * matching the just-signed-in user's VERIFIED email. The rows themselves are
 * already canonical — no materialization, no deactivation, no dedupe needed
 * (the unique (email, filters_hash) pair guarantees one row per search).
 *
 * IDEMPOTENT (re-stamping the same user_id is a no-op-shaped update). Only
 * rows without a DIFFERENT user_id are touched — an alert already claimed by
 * another account is never re-assigned. Best-effort: never throws, so a
 * failure here cannot break sign-in.
 */
export async function claimListingAlertsForUser(
  userId: string,
  email: string,
): Promise<ClaimListingAlertsResult> {
  const uid = (userId ?? '').trim()
  const normalizedEmail = (email ?? '').trim().toLowerCase()
  if (!uid || !normalizedEmail) return { ok: true, claimed: 0 }

  const supabase = createServiceClient()

  // Resolve the CRM person once for this email (best-effort — null just means
  // the column stays as-is).
  const crmPersonId = await resolveCrmPersonId(supabase, { email: normalizedEmail })

  const patch: Record<string, unknown> = { user_id: uid, updated_at: new Date().toISOString() }
  if (crmPersonId != null) patch.crm_person_id = crmPersonId

  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq('email', normalizedEmail)
    .eq('is_active', true)
    .is('user_id', null)
    .select('id')
  if (error) {
    console.error('[claimListingAlertsForUser]', error.message)
    return { ok: false, claimed: 0, error: 'claim_failed' }
  }
  return { ok: true, claimed: data?.length ?? 0 }
}

// ── Session-user-scoped helpers ───────────────────────────────────────────────
// The /account server actions (app/actions/saved-searches.ts) verify the
// session via getSession() and pass the authenticated user id here. Every write
// carries BOTH .eq('id', id) AND .eq('user_id', userId), so a user can only
// ever touch their own rows even though this runs on the service client.

/** All alerts owned by a signed-in user, newest first. */
export async function getListingAlertsForUser(userId: string): Promise<ListingAlertRow[]> {
  const uid = (userId ?? '').trim()
  if (!uid) return []
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from(TABLE)
    .select(ROW_COLS)
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[getListingAlertsForUser]', error.message)
    return []
  }
  return (data ?? []) as ListingAlertRow[]
}

/** Count of alerts owned by a signed-in user (lead scoring / personalization). */
export async function countListingAlertsForUser(userId: string): Promise<number> {
  const uid = (userId ?? '').trim()
  if (!uid) return 0
  const supabase = createServiceClient()
  const { count } = await supabase
    .from(TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', uid)
  return count ?? 0
}

/** Edit one alert owned by the session user (rename / filters / cadence). */
export async function updateListingAlertForUser(
  id: string,
  userId: string,
  fields: {
    name?: string
    filters?: Record<string, unknown>
    filtersHash?: string
    frequency?: 'instant' | 'daily' | 'weekly'
  },
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (fields.name !== undefined) patch.name = fields.name
  if (fields.filters !== undefined) patch.filters = fields.filters
  if (fields.filtersHash !== undefined) patch.filters_hash = fields.filtersHash
  if (fields.frequency !== undefined) patch.notification_frequency = normalizeSavedSearchFrequency(fields.frequency)
  const { error } = await supabase.from(TABLE).update(patch).eq('id', id).eq('user_id', userId)
  if (error) { console.error('[updateListingAlertForUser]', error.message); return { ok: false, error: 'persist_failed' } }
  return { ok: true }
}

/** Pause / resume one alert owned by the session user. */
export async function setListingAlertActiveForUser(
  id: string,
  userId: string,
  active: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from(TABLE)
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) { console.error('[setListingAlertActiveForUser]', error.message); return { ok: false, error: 'persist_failed' } }
  return { ok: true }
}

/** Delete one alert owned by the session user. */
export async function deleteListingAlertForUser(id: string, userId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient()
  const { error } = await supabase.from(TABLE).delete().eq('id', id).eq('user_id', userId)
  if (error) { console.error('[deleteListingAlertForUser]', error.message); return { ok: false, error: 'persist_failed' } }
  return { ok: true }
}

/** Set the cadence on EVERY alert the session user owns (the /account/notifications fan-out). */
export async function setListingAlertFrequencyForUser(
  userId: string,
  frequency: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from(TABLE)
    .update({
      notification_frequency: normalizeSavedSearchFrequency(frequency),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
  if (error) { console.error('[setListingAlertFrequencyForUser]', error.message); return { ok: false, error: 'persist_failed' } }
  return { ok: true }
}
