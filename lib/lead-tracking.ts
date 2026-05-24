/**
 * Server-side lead-tracking helper.
 *
 * Wraps `fireGa4Event` from `@/lib/ga4-measurement-protocol` with the
 * canonical `generate_lead` event taxonomy + automatic `_ga` cookie + UTM
 * extraction from the request context.
 *
 * Designed to be called from server actions and route handlers AFTER an
 * upstream lead-capture success (FUB person resolved, table row inserted,
 * etc.) so we never report a conversion that did not happen.
 *
 * Why this helper exists:
 *   The gold-standard `/lp/seller-home-value` action implements the full
 *   GA4 mirror inline (~50 lines: cookies(), headers(), URL parse, UTM
 *   extraction, fireGa4Event call). Replicating that across 8+ lead
 *   surfaces would balloon the code. This helper does it in one call.
 *
 * Usage:
 *   ```
 *   import { fireLeadGenerated } from '@/lib/lead-tracking'
 *
 *   await fireLeadGenerated({
 *     lp_variant: 'home-valuation',
 *     lead_type: 'seller',
 *     value: 500,
 *     event_id: eventId,
 *     broker_slug: 'matt',
 *   })
 *   ```
 *
 * Never blocks the caller — wrapped in try/catch and logs failures to console.
 */

import { cookies, headers } from 'next/headers'
import { fireGa4Event, readGa4ClientIdFromCookies } from '@/lib/ga4-measurement-protocol'

export type LeadEventName = 'generate_lead' | 'home_valuation_cta_click' | 'listing_inquiry'

export type FireLeadParams = {
  /**
   * The LP/source identifier — `'seller-home-value'`, `'contact'`,
   * `'home-valuation'`, `'expired-listing'`, `'buyer-listing-alerts'`,
   * `'heath-cma'`, `'lead-landing'`, `'exit-intent'`, `'page-cta'`,
   * `'listing-inquiry'`. Stable token so the GA4 brain can pivot by LP.
   */
  lp_variant: string
  /**
   * Lead taxonomy — `'seller' | 'buyer' | 'listing_inquiry' | 'exit_intent'
   * | 'page_cta' | 'general' | 'cta_click'`. Drives dashboard pivots.
   */
  lead_type: 'seller' | 'buyer' | 'listing_inquiry' | 'exit_intent' | 'page_cta' | 'general' | 'cta_click'
  /** GA4 event name. Defaults to `generate_lead`. */
  event_name?: LeadEventName
  /** Lead-tier classification when known. */
  lead_classification?: 'hot' | 'warm' | 'nurture' | 'unknown'
  /** Broker the lead was assigned to. */
  broker_slug?: 'matt' | 'rebecca' | 'paul'
  /** Estimated lead value, mirrors the CAPI value. */
  value?: number
  /** CAPI event_id for downstream Meta dedup correlation. */
  event_id?: string
  /** Optional FUB person id when available, useful for cross-system stitching. */
  fub_person_id?: number | null
  /** Extra event-scoped params (form fields, intent, etc.). */
  extra?: Record<string, string | number | boolean | undefined | null>
}

/**
 * Fire a `generate_lead` (or sibling event) server-side via GA4 Measurement
 * Protocol v2. Reads `_ga` cookie and UTM parameters from the request
 * automatically so the event ties back to the visitor's session.
 *
 * Fire-and-forget: never throws, returns void, logs failures.
 */
export async function fireLeadGenerated(params: FireLeadParams): Promise<void> {
  const eventName = params.event_name ?? 'generate_lead'
  try {
    const [cookieStore, headersList] = await Promise.all([cookies(), headers()])
    const referer = headersList.get('referer') ?? ''
    let utmSource: string | undefined
    let utmMedium: string | undefined
    let utmCampaign: string | undefined
    let utmContent: string | undefined
    try {
      const refUrl = new URL(referer)
      utmSource = refUrl.searchParams.get('utm_source') ?? undefined
      utmMedium = refUrl.searchParams.get('utm_medium') ?? undefined
      utmCampaign = refUrl.searchParams.get('utm_campaign') ?? undefined
      utmContent = refUrl.searchParams.get('utm_content') ?? undefined
    } catch {
      // Referer not parseable. No UTMs to capture.
    }
    const ga4ClientId = readGa4ClientIdFromCookies(cookieStore) ?? undefined
    await fireGa4Event({
      eventName,
      clientId: ga4ClientId,
      eventParams: {
        lp_variant: params.lp_variant,
        lp_source: utmSource,
        lp_medium: utmMedium,
        lp_campaign: utmCampaign,
        lp_content: utmContent,
        broker_slug: params.broker_slug,
        lead_classification: params.lead_classification,
        lead_type: params.lead_type,
        value: params.value,
        currency: params.value ? 'USD' : undefined,
        event_id: params.event_id,
        fub_person_id: params.fub_person_id ?? undefined,
        ...(params.extra ?? {}),
      },
      userProperties: params.broker_slug ? { assigned_broker: params.broker_slug } : undefined,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn(`[lead-tracking] ${eventName} fire failed for ${params.lp_variant}: ${msg}`)
  }
}
