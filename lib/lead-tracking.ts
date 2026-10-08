/**
 * Server-side lead-tracking helper. THE ONLY sender of GA4 `generate_lead`
 * (Matt 2026-10-08): one event per real submission, lead_type from the fixed
 * list in lib/analytics/lead-event.ts, the form's form_id. Matt 2026-10-08: no
 * dollar values on leads.
 * The browser never sends generate_lead (lead-event.test.ts).
 *
 * Wraps `fireGa4Event` from `@/lib/ga4-measurement-protocol` with the
 * canonical `generate_lead` event taxonomy + automatic `_ga` cookie + UTM
 * extraction from the request context.
 *
 * Designed to be called from server actions and route handlers AFTER an
 * upstream lead-capture success (CRM person resolved, table row inserted,
 * etc.) so we never report a conversion that did not happen.
 *
 * Why this helper exists: one place reads the `_ga` cookie and referer UTMs,
 * checks lead_type and form_id against the fixed lists, and sends. Every lead
 * surface calls it; none calls fireGa4Event('generate_lead').
 *
 * Usage:
 *   ```
 *   import { fireLeadGenerated } from '@/lib/lead-tracking'
 *
 *   await fireLeadGenerated({
 *     lp_variant: 'home-valuation',
 *     lead_type: 'seller_valuation',
 *     form_id: 'home_valuation',
 *     event_id: eventId,
 *     broker_slug: 'matt',
 *   })
 *   ```
 *
 * Never blocks the caller — wrapped in try/catch and logs failures to console.
 */

import { cookies, headers } from 'next/headers'
import { fireGa4Event, readGa4ClientIdFromCookies } from '@/lib/ga4-measurement-protocol'
import {
  isLeadFormId,
  isLeadType,
  type LeadFormId,
  type LeadType,
  type NonLeadEvent,
} from '@/lib/analytics/lead-event'

export type FireLeadParams = {
  /**
   * The LP/source identifier — `'seller-home-value'`, `'contact'`,
   * `'home-valuation'`, `'expired-listing'`, `'buyer-listing-alerts'`,
   * `'heath-cma'`, `'lead-landing'`, `'exit-intent'`, `'page-cta'`,
   * `'listing-inquiry'`. Stable token so the GA4 brain can pivot by LP.
   */
  lp_variant: string
  /** The fixed lead_type list (lib/analytics/lead-event.ts). An unknown value is never sent. */
  lead_type: LeadType
  /** The form that produced the lead (lib/analytics/lead-event.ts LEAD_FORM_IDS). */
  form_id: LeadFormId
  /** Lead-tier classification when known. */
  lead_classification?: 'hot' | 'warm' | 'nurture' | 'unknown'
  /** Broker the lead was assigned to. */
  broker_slug?: 'matt' | 'rebecca' | 'paul'
  /** CAPI event_id for downstream Meta dedup correlation. */
  event_id?: string
  /** Optional CRM person id for cross-system stitching. */
  crm_person_id?: number | null
  /** @deprecated alias for crm_person_id. */
  fub_person_id?: number | null
  /**
   * Extra event-scoped params (form fields, intent, etc.). Cannot override
   * lead_type or form_id. `value` and `currency` are stripped (Matt 2026-10-08:
   * no dollar values on leads).
   */
  extra?: Record<string, string | number | boolean | undefined | null>
}

/** Campaign params from the referer, the same way every lead path read them. */
async function requestContext(): Promise<{
  clientId: string | undefined
  utm: { lp_source?: string; lp_medium?: string; lp_campaign?: string; lp_content?: string }
}> {
  const [cookieStore, headersList] = await Promise.all([cookies(), headers()])
  const referer = headersList.get('referer') ?? ''
  const utm: { lp_source?: string; lp_medium?: string; lp_campaign?: string; lp_content?: string } = {}
  try {
    const refUrl = new URL(referer)
    utm.lp_source = refUrl.searchParams.get('utm_source') ?? undefined
    utm.lp_medium = refUrl.searchParams.get('utm_medium') ?? undefined
    utm.lp_campaign = refUrl.searchParams.get('utm_campaign') ?? undefined
    utm.lp_content = refUrl.searchParams.get('utm_content') ?? undefined
  } catch {
    // Referer not parseable. No UTMs to capture.
  }
  return { clientId: readGa4ClientIdFromCookies(cookieStore) ?? undefined, utm }
}

/**
 * The GA4 params of one generate_lead, or null when the lead_type or form_id
 * is not on the fixed lists (then nothing is sent and the log says why).
 * Exported for lead-event.test.ts.
 */
export function leadEventParams(
  params: FireLeadParams,
  utm: { lp_source?: string; lp_medium?: string; lp_campaign?: string; lp_content?: string } = {},
): Record<string, string | number | boolean | undefined | null> | null {
  if (!isLeadType(params.lead_type) || !isLeadFormId(params.form_id)) return null
  const extra = { ...(params.extra ?? {}) }
  delete extra.lead_type
  delete extra.form_id
  delete extra.value
  delete extra.currency
  return {
    lp_variant: params.lp_variant,
    ...utm,
    broker_slug: params.broker_slug,
    lead_classification: params.lead_classification,
    event_id: params.event_id,
    crm_person_id: params.crm_person_id ?? params.fub_person_id ?? undefined,
    ...extra,
    // Last, so `extra` can never change what the lead is.
    lead_type: params.lead_type,
    form_id: params.form_id,
  }
}

/**
 * Fire `generate_lead` server-side via GA4 Measurement Protocol v2. Reads the
 * `_ga` cookie and referer UTMs so the event ties back to the visitor's
 * session. Fire-and-forget: never throws, returns void, logs failures.
 */
export async function fireLeadGenerated(params: FireLeadParams): Promise<void> {
  const eventName = 'generate_lead'
  try {
    if (!isLeadType(params.lead_type) || !isLeadFormId(params.form_id)) {
      console.error(
        `[lead-tracking] generate_lead NOT sent: lead_type "${String(params.lead_type)}" / form_id "${String(params.form_id)}" is not on the fixed list (lib/analytics/lead-event.ts)`,
      )
      return
    }
    const { clientId, utm } = await requestContext()
    const eventParams = leadEventParams(params, utm)
    if (!eventParams) return
    await fireGa4Event({
      eventName,
      clientId,
      eventParams,
      userProperties: params.broker_slug ? { assigned_broker: params.broker_slug } : undefined,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn(`[lead-tracking] ${eventName} fire failed for ${params.lp_variant}: ${msg}`)
  }
}

/**
 * A form outcome that is NOT a lead (plan B2): a recruit inquiry, a newsletter
 * signup. Its own event name, never generate_lead, never a lead_type.
 * Fire-and-forget like fireLeadGenerated.
 */
export async function fireNonLeadEvent(params: {
  event_name: NonLeadEvent
  form_id: string
  lp_variant: string
  extra?: Record<string, string | number | boolean | undefined | null>
}): Promise<void> {
  try {
    const { clientId, utm } = await requestContext()
    await fireGa4Event({
      eventName: params.event_name,
      clientId,
      eventParams: { lp_variant: params.lp_variant, ...utm, ...(params.extra ?? {}), form_id: params.form_id },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn(`[lead-tracking] ${params.event_name} fire failed for ${params.lp_variant}: ${msg}`)
  }
}
