import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import {
  normalizeSavedSearchFrequency,
  type SavedSearchFrequency,
} from '@/lib/saved-search-frequency'

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

/** One additional-recipient entry (listing_alerts.recipients jsonb array). */
export type ListingAlertRecipientEntry = {
  email: string
  name?: string | null
  unsubscribe_token?: string | null
}

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
  /** Per-key notified state for the typed-event diff: legacy plain key
   *  strings and/or {key, price, status, notified_at, open_house} objects
   *  (lib/alerts/event-detection.ts parseNotifiedState accepts both). */
  notified_listing_keys: Array<string | Record<string, unknown>> | null
  /** Typed-event toggle map. Undefined until migration 20260729235500 is
   *  applied; readers normalize via normalizeEventToggles. */
  events?: Record<string, unknown> | null
  /** Weekly per-day schedule, 0=Sunday..6=Saturday. NULL = every day. */
  schedule_days?: number[] | null
  /** Preview mode: hold events in listing_alert_queue for broker approval. */
  preview_mode?: boolean | null
  /** Additional household recipients: [{email, name?, unsubscribe_token}]. */
  recipients?: ListingAlertRecipientEntry[] | null
  /** Portal "new since last visit" baseline — the owner's last explicit
   *  "mark as seen" on /account (migration 20260731180000). NULL until they
   *  mark it once; readers fall back to created_at (lib/data/leads/newSince). */
  last_viewed_at?: string | null
  created_at: string | null
  updated_at: string | null
}

// select('*') on purpose: the typed-event columns (events / schedule_days /
// preview_mode / recipients) ship in migration 20260729235500 and the engine
// must keep working BEFORE the migration is applied — an explicit column list
// naming a not-yet-existing column fails the whole read, silencing every
// alert. Missing columns simply read as undefined on the row type.
export const ROW_COLS = '*'

/**
 * Resolve the crm_people.id for an alert row (fub legacy id link first, then
 * email match). Every alert row should be born tracking-ready — the send path
 * needs a crm_person_id for open/click attribution.
 */
export async function resolveCrmPersonId(
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

/**
 * True only when a row for (email, filters_hash) already exists AND was
 * explicitly deactivated (is_active=false, a one-click unsubscribe). The upsert
 * paths use this to avoid RESURRECTING a search the lead muted: re-saving or
 * re-attaching the same search leaves it off (search stays saved, just not
 * emailed) instead of forcing is_active=true on conflict. Unsubscribing ONE
 * search never touches the lead's other searches. A NULL is_active (legacy) is
 * treated as active, so only an explicit opt-out is honored.
 */
async function alertExplicitlyOptedOut(
  supabase: ReturnType<typeof createServiceClient>,
  email: string,
  filtersHash: string,
): Promise<boolean> {
  const { data } = await supabase
    .from(TABLE)
    .select('is_active')
    .eq('email', email)
    .eq('filters_hash', filtersHash)
    .limit(1)
    .maybeSingle()
  return (data as { is_active: boolean | null } | null)?.is_active === false
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
  // Resurrection guard: an existing explicit opt-out stays muted on re-save.
  const optedOut = await alertExplicitlyOptedOut(supabase, email, input.filtersHash)
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
      is_active: !optedOut,
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
  /** All four cadences (incl. instant) are broker-assignable. Defaults to weekly. */
  frequency?: SavedSearchFrequency
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient()
  const email = input.email.trim().toLowerCase()

  // Resolve the CRM person when the caller didn't supply one, so the row is
  // born tracking-ready (fub id link first, then email match).
  const crmPersonId = input.crmPersonId
    ?? await resolveCrmPersonId(supabase, { email, fubPersonId: input.fubPersonId })

  // Resurrection guard: re-attaching a search the lead one-click-unsubscribed
  // leaves it muted (is_active stays false) rather than forcing it back on.
  const optedOut = await alertExplicitlyOptedOut(supabase, email, input.filtersHash)
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
      // Normalize even the typed value (belt-and-suspenders) but keep the
      // broker-path default of weekly when the caller omits it — the bare
      // normalizer would default to daily.
      notification_frequency: input.frequency
        ? normalizeSavedSearchFrequency(input.frequency)
        : 'weekly',
      is_active: !optedOut,
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
    frequency?: SavedSearchFrequency
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

/** Stamp last_notified_at after the cron sends (or decides to skip) an alert.
 *  notifiedKeys accepts legacy plain key strings AND the typed per-key state
 *  objects ({key, price, status, notified_at, open_house}) the event engine
 *  writes. */
export async function markListingAlertNotified(
  id: string,
  isoTime: string,
  notifiedKeys?: Array<string | Record<string, unknown>>,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient()
  const update: Record<string, unknown> = { last_notified_at: isoTime, updated_at: isoTime }
  // Cap from the TAIL, keeping the HEAD: detectListingEvents builds nextState
  // newest-FIRST (current matches, then carried-forward departed keys), so
  // slice(-1000) would have dropped the listings we just emailed and re-fired
  // them as `new` forever once a subscriber crossed 1,000 keys (adversarial
  // audit 2026-07-30; two live rows were at 189 and 145 and climbing).
  if (notifiedKeys) update.notified_listing_keys = notifiedKeys.slice(0, 1000)
  const { error } = await supabase.from(TABLE).update(update).eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/**
 * Claim-before-send for listing alerts (P12 send-integrity).
 *
 * Stamps last_notified_at + nextState BEFORE the email leaves, so a successful
 * Resend call can never leave the row due and re-blast next tick when the
 * post-send mark fails. Compare-and-set on the prior last_notified_at so two
 * concurrent runners cannot both claim the same due window.
 *
 * On total send failure the caller MUST restore via restoreListingAlertCursor.
 */
export async function claimListingAlertSend(
  id: string,
  expectedLastNotifiedAt: string | null,
  isoTime: string,
  notifiedKeys: Array<string | Record<string, unknown>>,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient()
  const update: Record<string, unknown> = {
    last_notified_at: isoTime,
    updated_at: isoTime,
    notified_listing_keys: notifiedKeys.slice(0, 1000),
  }
  let q = supabase.from(TABLE).update(update).eq('id', id)
  // PostgREST: null expected → .is('last_notified_at', null); else equality.
  q = expectedLastNotifiedAt == null
    ? q.is('last_notified_at', null)
    : q.eq('last_notified_at', expectedLastNotifiedAt)
  const { data, error } = await q.select('id')
  if (error) return { ok: false, error: error.message }
  if (!data || data.length === 0) {
    return { ok: false, error: 'claim_lost' }
  }
  return { ok: true }
}

/** Undo a claim after every Resend call failed so the alert stays due. */
export async function restoreListingAlertCursor(
  id: string,
  previousLastNotifiedAt: string | null,
  previousKeys: Array<string | Record<string, unknown>> | null | undefined,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient()
  const update: Record<string, unknown> = {
    last_notified_at: previousLastNotifiedAt,
    updated_at: new Date().toISOString(),
  }
  if (previousKeys !== undefined) {
    update.notified_listing_keys = previousKeys == null ? null : previousKeys.slice(0, 1000)
  }
  const { error } = await supabase.from(TABLE).update(update).eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** One alert row by id (queue release path). Null when missing. */
export async function getListingAlertById(id: string): Promise<ListingAlertRow | null> {
  const trimmed = (id ?? '').trim()
  if (!trimmed) return null
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from(TABLE)
    .select(ROW_COLS)
    .eq('id', trimmed)
    .maybeSingle()
  if (error) {
    console.error('[getListingAlertById]', error.message)
    return null
  }
  return (data as ListingAlertRow | null) ?? null
}

/** Several alert rows by id in one read (admin approval-queue grouping). */
export async function getListingAlertsByIds(ids: string[]): Promise<ListingAlertRow[]> {
  const clean = [...new Set(ids.map((s) => (s ?? '').trim()).filter(Boolean))]
  if (clean.length === 0) return []
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from(TABLE)
    .select(ROW_COLS)
    .in('id', clean)
  if (error) {
    console.error('[getListingAlertsByIds]', error.message)
    return []
  }
  return (data ?? []) as ListingAlertRow[]
}

/**
 * ADMIN engine-settings write (typed-event upgrade, migration 20260729235500):
 * event toggle map, weekly schedule days, and/or preview mode on one alert.
 * No user scope — the caller is an admin action gated by getCrmAccess, and
 * broker-managed rows (origin='broker'/'system') have no user_id to scope by.
 */
export async function updateListingAlertEngineSettings(
  id: string,
  fields: {
    events?: Record<string, boolean>
    /** 0=Sunday..6=Saturday; null clears the per-day restriction. */
    scheduleDays?: number[] | null
    previewMode?: boolean
  },
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (fields.events !== undefined) patch.events = fields.events
  if (fields.scheduleDays !== undefined) patch.schedule_days = fields.scheduleDays
  if (fields.previewMode !== undefined) patch.preview_mode = fields.previewMode
  const { error } = await supabase.from(TABLE).update(patch).eq('id', id)
  if (error) {
    console.error('[updateListingAlertEngineSettings]', error.message)
    return { ok: false, error: 'persist_failed' }
  }
  return { ok: true }
}

/**
 * Overwrite the additional-recipients array (token backfill + recipient
 * removal both route through here so the shape stays canonical).
 */
export async function updateListingAlertRecipients(
  id: string,
  recipients: ListingAlertRecipientEntry[] | null,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from(TABLE)
    .update({ recipients, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) {
    console.error('[updateListingAlertRecipients]', error.message)
    return { ok: false, error: 'persist_failed' }
  }
  return { ok: true }
}

/**
 * Unsubscribe — deactivate by token (ONE token namespace now: guest + signed-in
 * tokens were both migrated into listing_alerts with their values preserved, so
 * links in already-sent emails keep working). matched=false means the token was
 * unknown.
 *
 * Two tiers (typed-events upgrade, migration 20260729235500):
 * - PRIMARY token (unsubscribe_token column) deactivates the whole alert.
 * - ADDITIONAL-recipient token (an entry in the recipients jsonb array)
 *   removes ONLY that recipient — the primary and everyone else keep
 *   receiving. Checked second so a primary match never scans recipients.
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
  if ((data?.length ?? 0) > 0) return { ok: true, matched: true }

  // Additional-recipient token: jsonb containment on the recipients array.
  // Fail-soft pre-migration (missing column errors → token simply unmatched).
  try {
    const { data: rows, error: findErr } = await supabase
      .from(TABLE)
      .select('id, recipients')
      .contains('recipients', JSON.stringify([{ unsubscribe_token: trimmed }]))
      .limit(5)
    if (findErr || !rows?.length) return { ok: true, matched: false }
    let matched = false
    for (const row of rows as Array<{ id: string; recipients: ListingAlertRecipientEntry[] | null }>) {
      const remaining = (row.recipients ?? []).filter(
        (r) => (r?.unsubscribe_token ?? '').trim() !== trimmed,
      )
      if (remaining.length === (row.recipients ?? []).length) continue
      const { error: updErr } = await supabase
        .from(TABLE)
        .update({ recipients: remaining.length > 0 ? remaining : null, updated_at: new Date().toISOString() })
        .eq('id', row.id)
      if (!updErr) matched = true
    }
    return { ok: true, matched }
  } catch {
    return { ok: true, matched: false }
  }
}

/**
 * Identity-stitch companion: stamp crm_person_id onto existing alert rows for
 * this email when the column is still null. Open/click attribution and packet
 * §1b "alerts with crm_person_id" read this column. Best-effort; never throws.
 */
export async function stampListingAlertsCrmPerson(
  email: string,
  crmPersonId: number,
): Promise<number> {
  const normalized = (email ?? '').trim().toLowerCase()
  if (!normalized || !Number.isInteger(crmPersonId) || crmPersonId <= 0) return 0
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from(TABLE)
    .update({ crm_person_id: crmPersonId, updated_at: new Date().toISOString() })
    .eq('email', normalized)
    .is('crm_person_id', null)
    .select('id')
  if (error) {
    console.error('[stampListingAlertsCrmPerson]', error.message)
    return 0
  }
  return data?.length ?? 0
}

// Session-user-scoped reads/writes + sign-in claim live in listingAlertsUser.ts.
export * from '@/lib/data/leads/listingAlertsUser'
