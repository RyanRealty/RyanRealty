/**
 * Browser dataLayer `sign_up` for listing/search alert enroll.
 *
 * Server Measurement Protocol never sends `sign_up`. Alert enroll still sends
 * server `generate_lead` (`lead_type: buyer_alerts`) — a different event.
 * `generate_lead` itself is server-only (`fireLeadGenerated`); this module
 * never pushes it.
 *
 * Pushes go through `trackEvent` → `pushDataLayerEvent` (GTM GA4 Event tag).
 * No `value` / `currency` (Matt 2026-10-08).
 */

import type { LeadFormId } from '@/lib/analytics/lead-event'
import { trackEvent } from '@/lib/tracking'

export type AlertSignupMethod = 'listing_alert' | 'search_alert'

export type AlertSignupFormId = Extract<LeadFormId, 'search_alert' | 'listing_save' | 'listing_price_watch'>

export type AlertSignupPayload = {
  event: 'sign_up'
  method: AlertSignupMethod
  form_id: AlertSignupFormId
  lead_type: 'buyer_alerts'
}

export function alertSignupPayload(input: {
  method: AlertSignupMethod
  form_id: AlertSignupFormId
}): AlertSignupPayload {
  return {
    event: 'sign_up',
    method: input.method,
    form_id: input.form_id,
    lead_type: 'buyer_alerts',
  }
}

/** Listing/search alert enroll. GTM already allows `sign_up`. */
export function trackAlertSignup(input: {
  method: AlertSignupMethod
  form_id: AlertSignupFormId
}): void {
  const payload = alertSignupPayload(input)
  trackEvent(payload.event, {
    method: payload.method,
    form_id: payload.form_id,
    lead_type: payload.lead_type,
  })
}
