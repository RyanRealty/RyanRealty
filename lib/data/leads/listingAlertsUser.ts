import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import {
  normalizeSavedSearchFrequency,
  type SavedSearchFrequency,
} from '@/lib/saved-search-frequency'
import { ROW_COLS, resolveCrmPersonId, type ListingAlertRow, type ListingAlertRecipientEntry } from '@/lib/data/leads/listingAlerts'

/**
 * Session-user-scoped listing_alerts DAL (split from listingAlerts.ts, which
 * holds the shared row types + guest/broker/engine paths and re-exports this
 * module). Every write here carries BOTH the row id and the session user id so
 * a signed-in user can only touch their own rows, with RLS as defense in
 * depth. Same G1 boundary: the table is only reachable through lib/data.
 */

const TABLE = 'listing_alerts'

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
    frequency?: SavedSearchFrequency
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

/** One alert owned by the session user — the owner-checked read the /account
 *  recipient editor uses before a read-modify-write. Null when the row does
 *  not exist OR belongs to someone else (indistinguishable on purpose). */
export async function getListingAlertForUser(
  id: string,
  userId: string,
): Promise<ListingAlertRow | null> {
  const trimmedId = (id ?? '').trim()
  const uid = (userId ?? '').trim()
  if (!trimmedId || !uid) return null
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from(TABLE)
    .select(ROW_COLS)
    .eq('id', trimmedId)
    .eq('user_id', uid)
    .maybeSingle()
  if (error) {
    console.error('[getListingAlertForUser]', error.message)
    return null
  }
  return (data as ListingAlertRow | null) ?? null
}

/**
 * Owner-scoped engine-settings write: event toggle map and/or weekly schedule
 * days on one alert the session user owns (typed-event upgrade). preview_mode
 * is deliberately NOT settable here — it is a broker-side control.
 */
export async function updateListingAlertEventSettingsForUser(
  id: string,
  userId: string,
  fields: {
    events?: Record<string, boolean>
    /** 0=Sunday..6=Saturday; null clears the per-day restriction. */
    scheduleDays?: number[] | null
  },
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (fields.events !== undefined) patch.events = fields.events
  if (fields.scheduleDays !== undefined) patch.schedule_days = fields.scheduleDays
  const { error } = await supabase.from(TABLE).update(patch).eq('id', id).eq('user_id', userId)
  if (error) {
    console.error('[updateListingAlertEventSettingsForUser]', error.message)
    return { ok: false, error: 'persist_failed' }
  }
  return { ok: true }
}

/** Owner-scoped overwrite of the additional-recipients array. */
export async function updateListingAlertRecipientsForUser(
  id: string,
  userId: string,
  recipients: ListingAlertRecipientEntry[] | null,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from(TABLE)
    .update({ recipients, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) {
    console.error('[updateListingAlertRecipientsForUser]', error.message)
    return { ok: false, error: 'persist_failed' }
  }
  return { ok: true }
}

/**
 * Stamp the portal "new since last visit" baseline on ONE alert the session
 * user owns (Phase 4.1). This is the entire mechanism behind the badge: one
 * timestamp, written when the owner says they have seen the results. It never
 * touches notified_listing_keys, so marking a search seen cannot suppress an
 * alert email the engine has not sent yet.
 */
export async function markListingAlertViewedForUser(
  id: string,
  userId: string,
  isoTime: string,
): Promise<{ ok: boolean; error?: string }> {
  const trimmedId = (id ?? '').trim()
  const uid = (userId ?? '').trim()
  if (!trimmedId || !uid) return { ok: false, error: 'not_found' }
  const supabase = createServiceClient()
  const { error } = await supabase
    .from(TABLE)
    .update({ last_viewed_at: isoTime, updated_at: isoTime })
    .eq('id', trimmedId)
    .eq('user_id', uid)
  if (error) {
    console.error('[markListingAlertViewedForUser]', error.message)
    return { ok: false, error: 'persist_failed' }
  }
  return { ok: true }
}

/** Stamp the baseline on EVERY alert the session user owns ("mark all seen"). */
export async function markAllListingAlertsViewedForUser(
  userId: string,
  isoTime: string,
): Promise<{ ok: boolean; error?: string }> {
  const uid = (userId ?? '').trim()
  if (!uid) return { ok: false, error: 'not_found' }
  const supabase = createServiceClient()
  const { error } = await supabase
    .from(TABLE)
    .update({ last_viewed_at: isoTime, updated_at: isoTime })
    .eq('user_id', uid)
  if (error) {
    console.error('[markAllListingAlertsViewedForUser]', error.message)
    return { ok: false, error: 'persist_failed' }
  }
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
