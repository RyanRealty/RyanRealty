/**
 * Client-side tracking: dataLayer (GA4/GTM) and Meta Pixel (fbq).
 * Only call from client components. Scripts load after cookie consent, so
 * pushing events is safe when these run.
 * Event names from Section 30.3 (GA4 Custom Event Taxonomy).
 */

import { trackEventWithCAPI } from '@/lib/meta-pixel-helpers'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
    fbq?: (...args: unknown[]) => void
  }
}

/** GA4 custom event names (Section 30.3). */
export type EventName =
  | 'generate_lead'
  | 'tour_requested'
  | 'schedule_tour_click'
  | 'schedule_showing_click'
  | 'ask_question_click'
  | 'contact_agent_click'
  | 'email_agent'
  | 'call_initiated'
  | 'cma_downloaded'
  | 'valuation_requested'
  | 'sign_up'
  | 'open_house_rsvp'
  | 'open_house_page_view'
  | 'view_listing'
  | 'save_listing'
  | 'like_listing'
  | 'share_listing'
  | 'compare_listing'
  | 'compare_add'
  | 'compare_remove'
  | 'compare_share'
  | 'compare_pdf_download'
  | 'share'
  | 'view_photo_gallery'
  | 'play_video'
  | 'view_similar_listings'
  | 'search'
  | 'save_search'
  | 'view_community'
  | 'view_city'
  | 'view_neighborhood'
  | 'view_blog_post'
  | 'view_market_report'
  | 'download_report'
  | 'scroll_depth'
  | 'click_cta'
  | 'calculator_used'
  | 'calculator_interact'
  | 'map_interaction'
  | 'share_collection'
  | 'ai_chat_started'
  | 'ai_chat_message'
  | 'return_visit'
  | 'exit_intent_shown'
  | 'homepage_view'
  | 'hero_search'
  | 'hero_impression'
  | 'hero_city_chip'
  | 'featured_impression'
  | 'view_featured_listings'
  | 'community_impression'
  | 'newsletter_signup'
  | 'community_view'
  | 'community_cta_click'
  | 'city_view'
  | 'city_cta_click'
  | 'neighborhood_view'
  | 'broker_view'
  | 'contact_agent'
  | 'view_landing_page'
  | 'form_start'
  // Pulse feed events — locked 2026-05-22.
  // See marketing_brain_skills/pulse-feed/SKILL.md for the surface spec.
  | 'pulse_feed_entry'      // user clicked "Browse the feed" entry CTA
  | 'pulse_card_view'       // card became >55% visible in viewport
  | 'pulse_card_like'       // tap on heart or double-tap on card
  | 'pulse_card_share'      // tap on share icon
  | 'pulse_cta_click'       // tap on a card's primary CTA (schedule/read/etc.)
  | 'pulse_filter_change'   // user changed a feed filter (city, event type)

function pushDataLayer(obj: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push(obj)
}

function fireGaEvent(eventName: string, params: Record<string, unknown> = {}) {
  if (typeof window === 'undefined' || !window.gtag) return
  window.gtag('event', eventName, params)
}

/**
 * Fire a Google Ads conversion (when send_to env is set). Only call from client after consent.
 */
function fireGoogleAdsConversion(sendTo: string | undefined) {
  if (typeof window === 'undefined' || !sendTo?.trim() || !window.gtag) return
  window.gtag('event', 'conversion', { send_to: sendTo.trim() })
}

const GOOGLE_ADS_CONVERSION_LEAD = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LEAD?.trim()
const GOOGLE_ADS_CONVERSION_SIGNUP = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_SIGNUP?.trim()

/**
 * Push a typed event to window.dataLayer for GTM/GA4.
 * Also fires Google Ads conversion when event is generate_lead and NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LEAD is set.
 */
export function trackEvent(eventName: EventName, params: Record<string, unknown> = {}) {
  pushDataLayer({ event: eventName, ...params })
  // Direct GA4 event dispatch keeps analytics working even without GTM tags.
  fireGaEvent(eventName, params)
  if (eventName === 'generate_lead' && GOOGLE_ADS_CONVERSION_LEAD) {
    fireGoogleAdsConversion(GOOGLE_ADS_CONVERSION_LEAD)
  }
}

/**
 * Push a page view to window.dataLayer (e.g. for virtual page views or SPA updates).
 */
export function trackPageView(pageType: string, params: Record<string, unknown> = {}) {
  pushDataLayer({ event: 'page_view', page_type: pageType, ...params })
  fireGaEvent('page_view', { page_type: pageType, ...params })
}

// ----------------------------------------------------------------------------
// First-party session id — the key that stitches an anonymous visitor's
// browsing history to the FUB person they become when they identify.
// VisitTracker mints this uuid v4 into localStorage on first page view; the
// lead forms + email-click bridge READ it (never mint) and hand it to the
// server so backfillSessionToFub() can replay prior anonymous events under
// the now-known person. Mirrors VisitTracker's key + validation exactly.
// ----------------------------------------------------------------------------

const RR_SESSION_STORAGE_KEY = 'rr_session_id'
const RR_SESSION_UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Read the visitor session id VisitTracker stored in localStorage. Returns
 * undefined when absent or malformed (so it drops cleanly from a submission
 * object). Never creates one — that's VisitTracker's job, and a form-only
 * session with no prior tracked events has nothing to backfill anyway.
 */
export function readRrSessionId(): string | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const id = window.localStorage.getItem(RR_SESSION_STORAGE_KEY)
    return id && RR_SESSION_UUID_V4_RE.test(id) ? id : undefined
  } catch {
    return undefined
  }
}

// ----------------------------------------------------------------------------
// Landing page context — UTM capture + sessionStorage persistence.
// See marketing_brain_skills/tools_registry/ga4-instrumentation/SKILL.md for
// the LP tracking convention this implements.
// ----------------------------------------------------------------------------

export type LpContext = {
  lp_variant: string
  lp_source?: string
  lp_medium?: string
  lp_campaign?: string
  lp_content?: string
  lp_term?: string
  /** Meta click-id — persisted alongside utm_* so it survives navigation. */
  fbclid?: string
}

const LP_CONTEXT_STORAGE_KEY = 'rr_lp_context'

/**
 * Read UTM params from the URL and any previously captured LP context from
 * sessionStorage. URL params win on conflict (a deeper-link landing always
 * re-captures). Returns undefined keys for missing params — never empty
 * strings, so they drop cleanly from GA4 event params.
 */
export function getLpContext(lpVariant?: string): LpContext {
  if (typeof window === 'undefined') {
    return { lp_variant: lpVariant ?? 'unknown' }
  }
  const url = new URL(window.location.href)
  const fromUrl: Partial<LpContext> = {
    lp_source: url.searchParams.get('utm_source') ?? undefined,
    lp_medium: url.searchParams.get('utm_medium') ?? undefined,
    lp_campaign: url.searchParams.get('utm_campaign') ?? undefined,
    lp_content: url.searchParams.get('utm_content') ?? undefined,
    lp_term: url.searchParams.get('utm_term') ?? undefined,
    fbclid: url.searchParams.get('fbclid') ?? undefined,
  }
  let fromStorage: Partial<LpContext> = {}
  try {
    const raw = window.sessionStorage.getItem(LP_CONTEXT_STORAGE_KEY)
    if (raw) fromStorage = JSON.parse(raw) as Partial<LpContext>
  } catch {
    // sessionStorage may be unavailable (private browsing) — fall through.
  }
  const merged: LpContext = {
    lp_variant: lpVariant ?? fromStorage.lp_variant ?? 'unknown',
    lp_source: fromUrl.lp_source ?? fromStorage.lp_source,
    lp_medium: fromUrl.lp_medium ?? fromStorage.lp_medium,
    lp_campaign: fromUrl.lp_campaign ?? fromStorage.lp_campaign,
    lp_content: fromUrl.lp_content ?? fromStorage.lp_content,
    lp_term: fromUrl.lp_term ?? fromStorage.lp_term,
    fbclid: fromUrl.fbclid ?? fromStorage.fbclid,
  }
  return merged
}

function persistLpContext(ctx: LpContext) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(LP_CONTEXT_STORAGE_KEY, JSON.stringify(ctx))
  } catch {
    // sessionStorage may be unavailable — fail silently; the URL still carries the truth.
  }
}

/**
 * Fire the canonical `view_landing_page` event for a landing page mount.
 * Persists the captured UTM context to sessionStorage so any later
 * trackEvent call on this LP can enrich its event params via getLpContext().
 *
 * Returns the captured context so the caller (typically <LandingPageTracker>)
 * can also pass it to scroll-depth and CTA handlers without re-reading the URL.
 */
export function trackLandingPageView(lpVariant: string): LpContext {
  const ctx = getLpContext(lpVariant)
  persistLpContext(ctx)
  trackEvent('view_landing_page', {
    lp_variant: ctx.lp_variant,
    lp_source: ctx.lp_source,
    lp_medium: ctx.lp_medium,
    lp_campaign: ctx.lp_campaign,
    lp_content: ctx.lp_content,
    lp_term: ctx.lp_term,
  })
  return ctx
}

function trackFbq(event: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !window.fbq) return
  if (params) {
    window.fbq('track', event, params)
  } else {
    window.fbq('track', event)
  }
}

/** Listing detail page view (view_item). */
export function trackListingView(params: {
  listingKey: string
  listingUrl: string
  price?: number
  city?: string
  state?: string
  mlsNumber?: string
  bedrooms?: number
  bathrooms?: number
}) {
  pushDataLayer({
    event: 'listing_view',
    listing_key: params.listingKey,
    listing_url: params.listingUrl,
    value: params.price,
    currency: 'USD',
    city: params.city,
    state: params.state,
    mls_number: params.mlsNumber,
    bedrooms: params.bedrooms,
    bathrooms: params.bathrooms,
  })
  pushDataLayer({
    event: 'view_item',
    ecommerce: {
      currency: 'USD',
      value: params.price ?? 0,
      items: [{
        item_id: params.listingKey,
        item_name: params.mlsNumber ?? params.listingKey,
        price: params.price,
        quantity: 1,
      }],
    },
  })
  const viewContent = {
    content_type: 'product',
    content_ids: [params.listingKey],
    content_name: params.mlsNumber ?? params.listingKey,
    value: params.price,
    currency: 'USD',
  }
  // Pixel + server CAPI with a shared event_id (dedup) so listing views survive
  // ad-blockers and feed value-based / catalog retargeting audiences.
  void trackEventWithCAPI('ViewContent', viewContent, { customData: viewContent })
}

/** Search / geo page view (search or view_search_results). */
export function trackSearchView(params: {
  searchTerm?: string
  city?: string
  subdivision?: string
  resultsCount?: number
}) {
  const searchTerm = [params.city, params.subdivision].filter(Boolean).join(' ')
  pushDataLayer({
    event: 'search_view',
    search_term: searchTerm || params.searchTerm,
    city: params.city,
    subdivision: params.subdivision,
    results_count: params.resultsCount,
  })
  pushDataLayer({
    event: 'view_search_results',
    search_term: searchTerm || params.searchTerm,
    results_count: params.resultsCount,
  })
  const searchContent = {
    search_string: searchTerm || params.searchTerm,
    content_category: 'real_estate',
  }
  void trackEventWithCAPI('Search', searchContent, { customData: searchContent })
}

/** Listing card/tile click (before navigation). */
export function trackListingClick(params: {
  listingKey: string
  listingUrl: string
  sourcePage: string
  price?: number
  city?: string
  mlsNumber?: string
}) {
  pushDataLayer({
    event: 'listing_click',
    listing_key: params.listingKey,
    listing_url: params.listingUrl,
    source_page: params.sourcePage,
    value: params.price,
    city: params.city,
    mls_number: params.mlsNumber,
  })
  trackFbq('ViewContent', {
    content_type: 'product',
    content_ids: [params.listingKey],
    content_name: params.mlsNumber ?? params.listingKey,
    value: params.price,
    currency: 'USD',
  })
}

/**
 * User saved a listing. This is mid-funnel buyer INTENT (AddToWishlist), NOT a
 * Lead. The old code fired both `fbq('Lead')` and GA4 `generate_lead` on every
 * save, so saves polluted the Lead conversion both Meta and GA4 optimize toward
 * — inflating lead volume and misdirecting ad budget toward savers. Saves are a
 * wishlist/retargeting signal and feed a dedicated audience, not the Lead count.
 */
export function trackSaveListing(params: {
  listingKey: string
  listingUrl: string
  price?: number
  mlsNumber?: string
}) {
  pushDataLayer({
    event: 'saved_property',
    listing_key: params.listingKey,
    listing_url: params.listingUrl,
    value: params.price,
    mls_number: params.mlsNumber,
  })
  pushDataLayer({
    event: 'add_to_wishlist',
    currency: 'USD',
    value: params.price,
    items: [{ item_id: params.listingKey, item_name: params.mlsNumber ?? params.listingKey }],
  })
  const wishlist = {
    content_type: 'product',
    content_ids: [params.listingKey],
    content_name: params.mlsNumber ?? params.listingKey,
    value: params.price,
    currency: 'USD',
  }
  void trackEventWithCAPI('AddToWishlist', wishlist, { customData: wishlist })
}

/** User signed up / created account. */
export function trackSignUp() {
  pushDataLayer({
    event: 'sign_up',
    method: 'Google',
  })
  void trackEventWithCAPI('CompleteRegistration', { content_name: 'Account created' }, { customData: { content_name: 'Account created' } })
  if (GOOGLE_ADS_CONVERSION_SIGNUP) fireGoogleAdsConversion(GOOGLE_ADS_CONVERSION_SIGNUP)
}
