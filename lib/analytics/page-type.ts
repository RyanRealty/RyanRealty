/**
 * One page-type map for the whole public site.
 *
 * VisitTracker, PageViewTracker, and GTM all read this. A new route is
 * tracked automatically once its prefix is listed here — you do not add a
 * per-page pixel.
 */

export const PAGE_TYPES = [
  'home',
  'listing',
  'search',
  'city',
  'neighborhood',
  'community',
  'subdivision',
  'zip',
  'market',
  'sell',
  'buy',
  'lead',
  'team',
  'blog',
  'tools',
  'schools',
  'parks',
  'contact',
  'legal',
  'account',
  'utility',
  'other',
] as const

export type PageType = (typeof PAGE_TYPES)[number]

/** Trailing 6+ digit MLS on a pretty listing URL. */
export function listingMlsFromPath(pathname: string): string | null {
  const p = (pathname || '/').toLowerCase().replace(/\/+$/, '') || '/'
  const segs = p.split('/').filter(Boolean)
  if (segs[0] === 'listing' && segs[1] && segs[1] !== 'by-address' && segs[1] !== 'by-key') {
    return decodeURIComponent(segs[1])
  }
  if (segs[0] === 'homes-for-sale' && segs.length >= 3) {
    const m = segs[segs.length - 1].match(/(\d{6,})$/)
    if (m) return m[1]
  }
  return null
}

/**
 * First-party visitor_events.page_category. These strings are locked by
 * the scoring trigger on visitor_events — do not rename.
 */
export function visitorPageCategoryFromPath(pathname: string): string {
  const p = (pathname || '/').toLowerCase()
  if (listingMlsFromPath(p)) return 'listing_detail'
  if (/^\/listing\/[^/]+/.test(p)) return 'listing_detail'
  if (/^\/(search|listings|properties)/.test(p) || p.startsWith('/homes-for-sale')) return 'search'
  if (/^\/lp\/seller-home-value|^\/sell(\/|$)/.test(p)) return 'seller_intent'
  if (/^\/lp\/buyer-listing-alerts|^\/buyers(\/|$)|^\/explore/.test(p) || p.startsWith('/buy')) return 'buyer_intent'
  if (/^\/lp\/expired-listing|^\/lp\/fsbo|^\/lp\/sell/.test(p)) return 'seller_intent'
  if (/mortgage|affordability|rental-property|appreciation/.test(p)) return 'financial_tools'
  if (/^\/communit|^\/cities|^\/neighborhood|^\/area-guides?|^\/subdivisions|^\/zip\//.test(p)) return 'area_guide'
  if (/^\/blog/.test(p)) return 'blog'
  if (/^\/about|^\/contact|^\/team/.test(p)) return 'about'
  if (p === '/' || p === '') return 'home'
  return 'other'
}

export function pageTypeFromPath(pathname: string): PageType {
  const p = (pathname || '/').toLowerCase().replace(/\/+$/, '') || '/'
  if (p === '/') return 'home'
  if (listingMlsFromPath(p)) return 'listing'
  if (p.startsWith('/search') || p.startsWith('/homes-for-sale') || p.startsWith('/open-houses') || p.startsWith('/price-drops') || p.startsWith('/compare')) {
    return 'search'
  }
  if (p.startsWith('/cities/') && p.split('/').filter(Boolean).length >= 3) return 'neighborhood'
  if (p.startsWith('/cities') || p.startsWith('/neighborhoods')) return 'city'
  if (p.startsWith('/communities')) return 'community'
  if (p.startsWith('/subdivisions')) return 'subdivision'
  if (p.startsWith('/zip/')) return 'zip'
  if (p.startsWith('/housing-market') || p.startsWith('/reports') || p.startsWith('/months-of-supply')) return 'market'
  if (p.startsWith('/sell') || p.startsWith('/lp/seller') || p.startsWith('/lp/expired') || p.startsWith('/lp/fsbo') || p.startsWith('/lp/sell')) {
    return 'sell'
  }
  if (p.startsWith('/buy') || p.startsWith('/lp/buyer')) return 'buy'
  if (p.startsWith('/lp/')) return 'lead'
  if (p.startsWith('/team') || p.startsWith('/about') || p.startsWith('/reviews') || p.startsWith('/join')) return 'team'
  if (p.startsWith('/blog') || p.startsWith('/resources')) return 'blog'
  if (p.startsWith('/tools')) return 'tools'
  if (p.startsWith('/schools')) return 'schools'
  if (p.startsWith('/parks')) return 'parks'
  if (p.startsWith('/contact') || p.startsWith('/refer-a-client')) return 'contact'
  if (p.startsWith('/privacy') || p.startsWith('/terms') || p.startsWith('/cookies') || p.startsWith('/accessibility') || p.startsWith('/dmca') || p.startsWith('/fair-housing')) {
    return 'legal'
  }
  if (p.startsWith('/account') || p.startsWith('/dashboard')) return 'account'
  if (p.startsWith('/login') || p.startsWith('/signup') || p.startsWith('/offline') || p.startsWith('/auth')) return 'utility'
  return 'other'
}
