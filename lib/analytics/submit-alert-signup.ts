/**
 * Client wrappers around the public alert-capture server actions. On a real
 * success (`counted: true`) they push GA4 `sign_up` to the dataLayer. Honeypot
 * and intake-screened (suspect) submits return ok but counted=false, matching
 * the server's skip of `fireLeadGenerated`.
 *
 * /buy and /buy/alerts keep the raw server action (PR #497 / #502).
 */

import {
  submitListingPriceDropWatch as submitListingPriceDropWatchAction,
  submitListingSaveCapture as submitListingSaveCaptureAction,
  submitSearchAlertSignup as submitSearchAlertSignupAction,
  type SearchAlertResult,
} from '@/app/actions/search-alert-capture'
import { trackAlertSignup, type AlertSignupFormId, type AlertSignupMethod } from '@/lib/analytics/form-conversion'

function trackIfCounted(
  result: SearchAlertResult,
  method: AlertSignupMethod,
  form_id: AlertSignupFormId,
): SearchAlertResult {
  if (result.ok && result.counted) trackAlertSignup({ method, form_id })
  return result
}

export async function submitSearchAlertSignup(
  input: Parameters<typeof submitSearchAlertSignupAction>[0],
): Promise<SearchAlertResult> {
  return trackIfCounted(await submitSearchAlertSignupAction(input), 'search_alert', 'search_alert')
}

export async function submitListingSaveCapture(
  input: Parameters<typeof submitListingSaveCaptureAction>[0],
): Promise<SearchAlertResult> {
  return trackIfCounted(await submitListingSaveCaptureAction(input), 'listing_alert', 'listing_save')
}

export async function submitListingPriceDropWatch(
  input: Parameters<typeof submitListingPriceDropWatchAction>[0],
): Promise<SearchAlertResult> {
  return trackIfCounted(await submitListingPriceDropWatchAction(input), 'listing_alert', 'listing_price_watch')
}
