/**
 * The one GA4 lead event: `generate_lead`, sent once per real submission, from
 * the server only (lib/lead-tracking.ts fireLeadGenerated), with a lead_type
 * from the fixed list below and the form's form_id. Matt 2026-10-08: no dollar
 * values on leads.
 *
 * WHY (Analytics audit 2026-10-08, plan B2): GA4 held 126 generate_lead for
 * Sep 10 to Oct 7 with lead_type general 55, buyer 51, recruit 9,
 * listing_inquiry 9, page_cta 1, seller 1. "general" was the biggest bucket, so
 * lead intent was mostly unknown; recruit inquiries counted as leads; and ten
 * forms also pushed a browser generate_lead next to the server one, with no
 * defined dedup. Now: one server event, a fixed lead_type, the form named by
 * form_id, recruit_inquiry and newsletter_signup as their own non-lead events.
 * lead-event.test.ts fails on an unknown lead_type, a generate_lead sent from
 * anywhere but fireLeadGenerated, and any browser generate_lead.
 */

import { ga4SafePagePath, ga4SafeParamValue, isPersonParamName } from '@/app/api/visitors/track/strip-identity'

/** The fixed lead_type list. A new value is a decision for Matt, not a code edit. */
export const LEAD_TYPES = [
  'seller_valuation', // wants a value: valuation, CMA, home-worth forms
  'seller_listing', // wants to sell or list: list-now, FSBO, expired, seller inquiry
  'buyer_showing', // asked to see a home (tour request)
  'buyer_question', // buyer question or buyer-intent capture with no specific home
  'buyer_alerts', // signed up for listing alerts, a saved search, a saved home or a price watch
  'listing_inquiry', // a question about one specific listing
  'contact_general', // a contact form that names no buyer, seller or listing intent
] as const

export type LeadType = (typeof LEAD_TYPES)[number]

export function isLeadType(value: unknown): value is LeadType {
  return typeof value === 'string' && (LEAD_TYPES as readonly string[]).includes(value)
}

/** Every form that can produce a lead. form_id is a GA4 event parameter (register it as a custom dimension). */
export const LEAD_FORM_IDS = [
  'contact',
  'sell_value', // /sell and the seller-home-value / list-now LPs
  'home_valuation',
  'place_value', // the value field on place pages
  'fsbo_lp',
  'expired_lp',
  'buyer_alerts_lp',
  'buyer_leverage_lp',
  'tetherow_heath_cma',
  'tetherow_lp',
  'lead_landing',
  'page_cta',
  'rental_calculator',
  'search_alert',
  'listing_save',
  'listing_price_watch',
  'listing_cma_download',
  'listing_cma_request',
  'listing_payment_email',
  'inbound_agent_referral',
  'out_of_area_referral',
  'meta_lead_ad',
  'buy_concessions',
] as const

export type LeadFormId = (typeof LEAD_FORM_IDS)[number]

export function isLeadFormId(value: unknown): value is LeadFormId {
  return typeof value === 'string' && (LEAD_FORM_IDS as readonly string[]).includes(value)
}

/** Outcomes that are NOT leads. Their own events, never generate_lead, never a key event by default. */
export const NON_LEAD_EVENTS = ['recruit_inquiry', 'newsletter_signup'] as const
export type NonLeadEvent = (typeof NON_LEAD_EVENTS)[number]

/**
 * The contact form's lead_type, from what the visitor actually asked for. A
 * tour request is a showing; a home named on the form is a listing inquiry;
 * the inquiry picker says selling (Selling, Both, a valuation) or buying
 * (Buying, Relocation); only what is left is contact_general. Recruit
 * inquiries never reach here: they are recruit_inquiry, not a lead.
 */
export function contactLeadType(input: {
  isTour: boolean
  listingKey?: string | null
  inquiryType?: string | null
}): LeadType {
  const lower = (input.inquiryType ?? '').toLowerCase()
  if (input.isTour) return 'buyer_showing'
  if (input.listingKey || lower.includes('property') || lower.includes('listing')) return 'listing_inquiry'
  if (/valuation|home value|apprais|worth/.test(lower)) return 'seller_valuation'
  if (/sell|seller|both/.test(lower)) return 'seller_listing'
  if (/buy|relocat/.test(lower)) return 'buyer_question'
  return 'contact_general'
}

/**
 * The /contact "How can we help" values a page or link can send. The /about box
 * puts what a person TYPED into `?inquiry=`, and /contact turns that into a
 * select option, so the submitted value can be free text. GA4 gets one of
 * these or `Other` (Matt 2026-10-14: no free text in GA4).
 */
export const GA4_INQUIRY_TYPES = [
  'Buying',
  'Selling',
  'Both',
  'General Inquiry',
  'Relocation',
  'Join the team',
  'Commercial lease',
] as const

export function ga4InquiryType(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const v = value.trim().toLowerCase()
  return GA4_INQUIRY_TYPES.find((t) => t.toLowerCase() === v) ?? 'Other'
}

/** A label or id: no whitespace, so never a sentence, a name or a street address. */
const GA4_LABEL_RE = /^[A-Za-z0-9][A-Za-z0-9_.:/#-]{0,99}$/

/**
 * The GA4 copy of a lead or non-lead event's `extra` (lib/lead-tracking.ts).
 * Labels and ids only, never a person's words: callers put free text here (a
 * housing-market inquiry's context held the sender's name and message, a
 * referral's area is typed), and GA4's terms forbid personal information.
 *
 *   - a person-named key (`address`, `email`, `cma_slug`) is dropped;
 *   - `inquiry_type` is mapped to GA4_INQUIRY_TYPES;
 *   - `page_path` goes through ga4SafePagePath;
 *   - any other string must be label-shaped (GA4_LABEL_RE, no whitespace) after
 *     ga4SafeParamValue, or it is dropped; numbers and booleans pass.
 *
 * The CRM and broker alerts keep the full text; only GA4's copy is cut.
 */
export function ga4LeadExtra(
  extra: Record<string, string | number | boolean | undefined | null> | undefined,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(extra ?? {})) {
    if (v === undefined || v === null || isPersonParamName(k)) continue
    if (k === 'inquiry_type') {
      const t = ga4InquiryType(v)
      if (t) out[k] = t
      continue
    }
    if (k === 'page_path') {
      const p = typeof v === 'string' ? ga4SafePagePath(v) : undefined
      if (p) out[k] = p
      continue
    }
    if (typeof v !== 'string') {
      if (typeof v !== 'number' || Number.isFinite(v)) out[k] = v
      continue
    }
    const safe = ga4SafeParamValue(k, v.trim())
    if (typeof safe === 'string' && GA4_LABEL_RE.test(safe)) out[k] = safe
  }
  return out
}
