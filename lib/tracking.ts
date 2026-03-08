/**
 * Client-side tracking: dataLayer (GA4/GTM) and Meta Pixel (fbq).
 * Only call from client components. Scripts load after cookie consent, so
 * pushing events is safe when these run.
 */

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
    fbq?: (...args: unknown[]) => void
  }
}

function pushDataLayer(obj: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push(obj)
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
}
