/**
 * Client-side tracking: dataLayer (GA4/GTM) and Meta Pixel (fbq).
 * Only call from client components. Scripts load after cookie consent, so
 * pushing events is safe when these run.
 * Event names from Section 30.3 (GA4 Custom Event Taxonomy).
 */

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
  trackFbq('ViewContent', {
    content_type: 'product',
    content_ids: [params.listingKey],
    content_name: params.mlsNumber ?? params.listingKey,
    value: params.price,
    currency: 'USD',
  })
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
  trackFbq('Search', {
    search_string: searchTerm || params.searchTerm,
    content_category: 'real_estate',
  })
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

/** User saved a listing (saved_property / lead). */
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
    event: 'generate_lead',
    method: 'save_listing',
  })
  trackFbq('Lead', {
    content_name: params.mlsNumber ?? params.listingKey,
    value: params.price,
    currency: 'USD',
  })
}

/** User signed up / created account. */
export function trackSignUp() {
  pushDataLayer({
    event: 'sign_up',
    method: 'Google',
  })
  trackFbq('CompleteRegistration', { content_name: 'Account created' })
  if (GOOGLE_ADS_CONVERSION_SIGNUP) fireGoogleAdsConversion(GOOGLE_ADS_CONVERSION_SIGNUP)
}
