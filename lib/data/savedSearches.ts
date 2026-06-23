import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { getPersonIdsByEmail } from '@/lib/data/crm/getPersonIdsByEmail'

/**
 * DAL for signed-in saved-search alert unsubscribe (one-click from the alert
 * email). Lives in lib/data so the /alerts/unsubscribe page satisfies G8.
 * Service-role only.
 */

/**
 * A guest_search_alerts row, as far as the claim path needs it. Matches the
 * columns selected by claimGuestSavedSearches below.
 */
export type ClaimableGuestAlert = {
  id: string
  email: string
  filters: Record<string, unknown> | null
  filters_hash: string | null
  name: string | null
  notification_frequency: string | null
  fub_person_id: number | null
}

/**
 * The shape of a saved_searches INSERT row materialized from a guest alert.
 * Only the columns we carry over. Every other column takes its DB default
 * (id, created_at, is_paused=false, unsubscribe_token, result_count, etc.).
 */
export type ClaimedSavedSearchRow = {
  user_id: string
  name: string
  filters: Record<string, unknown>
  filters_hash: string | null
  notification_frequency: string
  crm_person_id: number | null
}

/**
 * Pure mapper. Turn a guest_search_alerts row into the saved_searches INSERT row
 * owned by the just-signed-in user. Carries filters + notification_frequency +
 * filters_hash, and stamps crm_person_id when the caller resolved one. No I/O,
 * no Date, no randomness, so it is unit-tested directly.
 *
 * notification_frequency is normalized to one of instant/daily/weekly so a
 * malformed guest value cannot violate the cron's frequency contract. An unknown
 * or missing value defaults to daily (the saved_searches column default).
 */
export function toSavedSearchRow(
  guestAlert: ClaimableGuestAlert,
  userId: string,
  crmPersonId: number | null,
): ClaimedSavedSearchRow {
  const freq = (guestAlert.notification_frequency ?? '').trim().toLowerCase()
  const notificationFrequency =
    freq === 'instant' || freq === 'weekly' || freq === 'daily' ? freq : 'daily'
  return {
    user_id: userId,
    name: guestAlert.name?.trim() || 'Saved search',
    filters: (guestAlert.filters ?? {}) as Record<string, unknown>,
    filters_hash: guestAlert.filters_hash ?? null,
    notification_frequency: notificationFrequency,
    crm_person_id: crmPersonId,
  }
}

/**
 * Pure dedupe. Collapse rows that share a non-null filters_hash to the FIRST
 * occurrence, dropping later duplicates. Rows with a null or blank filters_hash
 * are always kept (they cannot be confidently matched as the "same" search).
 * Order is preserved. This is what makes the claim idempotent against searches
 * the user already owns AND against duplicate guest rows for the same criteria.
 *
 * Generic over any row carrying a filters_hash so the same helper guards both
 * the incoming guest rows and the already-owned saved_searches hashes.
 */
export function dedupeByFiltersHash<T extends { filters_hash: string | null }>(
  rows: T[],
): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const row of rows) {
    const hash = (row.filters_hash ?? '').trim()
    if (!hash) {
      out.push(row)
      continue
    }
    if (seen.has(hash)) continue
    seen.add(hash)
    out.push(row)
  }
  return out
}

/**
 * Pause a signed-in saved search by its email unsubscribe token (one-click).
 * Sets is_paused so the alert cron skips it; the user can resume from
 * /account/saved-searches. matched=false means the token was not a saved-search
 * token (it may be a guest token instead).
 */
export async function pauseSavedSearchByToken(token: string): Promise<{ ok: boolean; matched: boolean; error?: string }> {
  const trimmed = (token ?? '').trim()
  if (!trimmed) return { ok: true, matched: false }
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('saved_searches')
    .update({ is_paused: true })
    .eq('unsubscribe_token', trimmed)
    .select('id')
  if (error) {
    console.error('[pauseSavedSearchByToken]', error.message)
    return { ok: false, matched: false, error: 'pause_failed' }
  }
  return { ok: true, matched: (data?.length ?? 0) > 0 }
}

export type ClaimGuestSavedSearchesResult = {
  ok: boolean
  /** Guest alerts that matched the email. */
  matched: number
  /** New saved_searches rows created (after dedupe). */
  claimed: number
  /** Guest alerts deactivated. */
  deactivated: number
  error?: string
}

/**
 * CONTACT360 Phase 7.3 — claim-on-sign-in.
 *
 * When a guest who saved listing-alert searches by email (rows in
 * guest_search_alerts) signs in or creates an account, attach those searches to
 * their account so they are not orphaned. For the just-signed-in user this:
 *
 *   1. finds the guest_search_alerts rows whose email matches their VERIFIED
 *      account email (the caller passes only a verified email — see the auth
 *      callback wiring),
 *   2. materializes each as a saved_searches row owned by their auth user_id,
 *      carrying filters + notification_frequency + filters_hash, stamping
 *      crm_person_id when resolvable,
 *   3. deactivates the claimed guest rows so the guest cron stops emailing the
 *      same address (the signed-in cron now owns them).
 *
 * IDEMPOTENT. Dedupes by filters_hash against the searches the user ALREADY owns
 * AND across duplicate guest rows, so a second sign-in (or a double-fire of the
 * callback) never creates a duplicate. Service-role only (the guest table has
 * RLS with no policies, and we write a row keyed by another user_id). Lives in
 * lib/data so the auth callback satisfies the DAL boundary (G1). Best-effort:
 * never throws, so a failure here cannot break sign-in.
 */
export async function claimGuestSavedSearches(
  userId: string,
  email: string,
): Promise<ClaimGuestSavedSearchesResult> {
  const empty: ClaimGuestSavedSearchesResult = {
    ok: true,
    matched: 0,
    claimed: 0,
    deactivated: 0,
  }
  const uid = (userId ?? '').trim()
  const normalizedEmail = (email ?? '').trim().toLowerCase()
  if (!uid || !normalizedEmail) return empty

  const supabase = createServiceClient()

  // 1. Active guest alerts for this email. is_active only — a guest who already
  // unsubscribed should not have a dead search resurrected as a signed-in one.
  const { data: guestRaw, error: guestError } = await supabase
    .from('guest_search_alerts')
    .select('id, email, filters, filters_hash, name, notification_frequency, fub_person_id')
    .eq('email', normalizedEmail)
    .eq('is_active', true)
  if (guestError) {
    console.error('[claimGuestSavedSearches] read guest alerts', guestError.message)
    return { ...empty, ok: false, error: 'read_failed' }
  }
  const guestAlerts = (guestRaw ?? []) as ClaimableGuestAlert[]
  if (guestAlerts.length === 0) return empty

  // 2. filters_hash values the user already owns, so we never re-create one.
  const { data: ownedRaw, error: ownedError } = await supabase
    .from('saved_searches')
    .select('filters_hash')
    .eq('user_id', uid)
  if (ownedError) {
    console.error('[claimGuestSavedSearches] read owned searches', ownedError.message)
    return { ...empty, ok: false, error: 'read_failed' }
  }
  const ownedHashes = new Set(
    (ownedRaw ?? [])
      .map((r) => ((r as { filters_hash: string | null }).filters_hash ?? '').trim())
      .filter(Boolean),
  )

  // 3. Dedupe the guest rows by filters_hash, then drop any the user already
  // owns. Rows with a blank hash are always candidates (can't be matched).
  const candidates = dedupeByFiltersHash(guestAlerts).filter((g) => {
    const hash = (g.filters_hash ?? '').trim()
    return hash ? !ownedHashes.has(hash) : true
  })

  // 4. Resolve the crm_person_id once for this email (the same id is correct for
  // every claimed row). Best-effort: a null id just means the column stays null.
  let crmPersonId: number | null = null
  try {
    const ids = await getPersonIdsByEmail(normalizedEmail)
    crmPersonId = ids.length > 0 ? ids[0] : null
  } catch (err) {
    console.error('[claimGuestSavedSearches] resolve crm person', err)
  }

  // 5. Materialize the claimed rows. Insert (not upsert) — we already excluded
  // the user's existing hashes, and there's no unique (user_id, filters_hash)
  // constraint to conflict on.
  let claimed = 0
  if (candidates.length > 0) {
    const rows = candidates.map((g) => toSavedSearchRow(g, uid, crmPersonId))
    const { data: inserted, error: insertError } = await supabase
      .from('saved_searches')
      .insert(rows)
      .select('id')
    if (insertError) {
      console.error('[claimGuestSavedSearches] insert', insertError.message)
      return { ...empty, ok: false, matched: guestAlerts.length, error: 'insert_failed' }
    }
    claimed = inserted?.length ?? 0
  }

  // 6. Deactivate every matched guest alert (claimed AND the ones the user
  // already owned), so the guest cron stops double-emailing this address. The
  // signed-in saved_searches now own delivery.
  const claimedIds = guestAlerts.map((g) => g.id)
  let deactivated = 0
  if (claimedIds.length > 0) {
    const { data: deactivatedRows, error: deactivateError } = await supabase
      .from('guest_search_alerts')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in('id', claimedIds)
      .select('id')
    if (deactivateError) {
      // The claim already succeeded. Report the partial state instead of failing
      // the whole operation (the worst case is one extra guest email).
      console.error('[claimGuestSavedSearches] deactivate', deactivateError.message)
      return { ok: false, matched: guestAlerts.length, claimed, deactivated: 0, error: 'deactivate_failed' }
    }
    deactivated = deactivatedRows?.length ?? 0
  }

  return { ok: true, matched: guestAlerts.length, claimed, deactivated }
}
