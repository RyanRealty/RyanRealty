import 'server-only'
import {
  claimListingAlertsForUser,
  deactivateListingAlertByToken,
  type ClaimListingAlertsResult,
} from '@/lib/data/leads/listingAlerts'

/**
 * LEGACY-NAMED wrappers over the unified listing_alerts DAL
 * (lib/data/leads/listingAlerts.ts).
 *
 * Alerts were unified into public.listing_alerts on 2026-07-07 (migration
 * 20260707160000_unify_listing_alerts.sql). The two flows this module used to
 * implement against the split tables collapse to:
 *
 *   - claim-on-sign-in: the old copy-guest-row-into-saved_searches-then-
 *     deactivate flow is DEAD. Claiming now just stamps user_id (+
 *     crm_person_id) onto the matching active email rows — the rows were
 *     already canonical.
 *   - token unsubscribe: one token namespace. Deactivating by token covers
 *     what used to be pauseSavedSearchByToken (saved_searches.is_paused) AND
 *     deactivateGuestAlertByToken (guest_search_alerts.is_active).
 *
 * The exported names are kept so existing import sites (the auth callback,
 * lib/data/index.ts) stay stable. New code should import from
 * lib/data/leads/listingAlerts.ts directly.
 */

/**
 * Pause a saved search by its email unsubscribe token (one-click). Same
 * operation as guest-alert deactivation now — one table, one token column.
 * matched=false means the token was unknown.
 */
export async function pauseSavedSearchByToken(token: string): Promise<{ ok: boolean; matched: boolean; error?: string }> {
  return deactivateListingAlertByToken(token)
}

/**
 * Claim-on-sign-in (CONTACT360 Phase 7.3, simplified by the unification):
 * attach the alert rows matching the just-signed-in user's VERIFIED email to
 * their account by stamping user_id. Idempotent, best-effort — a failure here
 * never breaks sign-in. The caller passes only a verified email (see the auth
 * callback wiring).
 */
export async function claimGuestSavedSearches(
  userId: string,
  email: string,
): Promise<ClaimListingAlertsResult> {
  return claimListingAlertsForUser(userId, email)
}
