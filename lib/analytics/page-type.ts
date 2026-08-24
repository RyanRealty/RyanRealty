/**
 * One page-type map for the whole public site.
 *
 * Layout (VisitTracker, PageViewTracker, GTM dataLayer) and V3SectionTracker
 * all read this. A new public route is tracked automatically once its first
 * URL segment is listed in PUBLIC_PAGE_SEGMENTS — you do not add a per-page
 * pixel or a new GTM tag.
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
  'guides',
  'contact',
  'legal',
  'account',
  'utility',
  'other',
] as const

export type PageType = (typeof PAGE_TYPES)[number]

/**
 * First path segment of every public `app/<seg>/page.tsx`.
 * `ci:page-analytics` fails if a new public page is added without listing
 * its segment here (and classifying it in pageTypeFromPath).
 */
export const PUBLIC_PAGE_SEGMENTS = [
  'about',
  'accessibility',
  'account',
  'activity',
  'alerts',
  'area-guides',
  'areas',
  'auth-error',
  'blog',
  'builders',
  'buy',
  'central-oregon',
  'cities',
  'cma-drafts',
  'communities',
  'compare',
  'contact',
  'cookies',
  'dashboard',
  'data-deletion',
  'dev',
  'dmca',
  'fair-housing',
  'faq',
  'feed',
  'forgot-password',
  'homes-for-sale',
  'how-we-get-our-numbers',
  'housing-market',
  'join',
  'listing',
  'login',
  'lp',
  'luxury-homes-bend',
  'marketing',
  'months-of-supply',
  'motivated-sellers',
  'neighborhoods',
  'newsletter',
  'offline',
  'open-houses',
  'oregon',
  'our-homes',
  'parks',
  'price-drops',
  'privacy',
  'pulse',
  'refer-a-client',
  'reports',
  'resources',
  'reviews',
  'schools',
  'search',
  'sell',
  'sign',
  'signup',
  'site-index',
  'subdivisions',
  'team',
  'terms',
  'tools',
  'videos',
  'zip',
] as const

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
  if (/^\/our-homes(\/|$)/.test(p)) return 'listing_detail'
  if (
    /^\/(search|listings|properties)/.test(p) ||
    p.startsWith('/homes-for-sale') ||
    p.startsWith('/open-houses') ||
    p.startsWith('/price-drops') ||
    p.startsWith('/compare') ||
    p.startsWith('/luxury-homes-bend') ||
    p.startsWith('/activity') ||
    p.startsWith('/feed') ||
    p.startsWith('/pulse')
  ) {
    return 'search'
  }
  if (/^\/lp\/seller-home-value|^\/sell(\/|$)/.test(p) || p.startsWith('/motivated-sellers')) {
    return 'seller_intent'
  }
  if (/^\/lp\/buyer-listing-alerts|^\/buyers(\/|$)|^\/explore/.test(p) || p.startsWith('/buy')) {
    return 'buyer_intent'
  }
  if (/^\/lp\/expired-listing|^\/lp\/fsbo|^\/lp\/sell/.test(p)) return 'seller_intent'
  if (/mortgage|affordability|rental-property|appreciation/.test(p)) return 'financial_tools'
  if (
    /^\/communit|^\/cities|^\/neighborhood|^\/area-guides?|^\/areas|^\/subdivisions|^\/zip\/|^\/oregon|^\/builders|^\/central-oregon/.test(
      p,
    )
  ) {
    return 'area_guide'
  }
  if (/^\/blog|^\/resources|^\/faq|^\/videos/.test(p)) return 'blog'
  if (/^\/about|^\/contact|^\/team/.test(p)) return 'about'
  if (p === '/' || p === '') return 'home'
  return 'other'
}

export function pageTypeFromPath(pathname: string): PageType {
  const p = (pathname || '/').toLowerCase().replace(/\/+$/, '') || '/'
  if (p === '/') return 'home'
  if (listingMlsFromPath(p) || p.startsWith('/listing') || p.startsWith('/our-homes')) return 'listing'
  if (
    p.startsWith('/search') ||
    p.startsWith('/homes-for-sale') ||
    p.startsWith('/open-houses') ||
    p.startsWith('/price-drops') ||
    p.startsWith('/compare') ||
    p.startsWith('/luxury-homes-bend') ||
    p.startsWith('/activity') ||
    p.startsWith('/feed') ||
    p.startsWith('/pulse')
  ) {
    return 'search'
  }
  if (p.startsWith('/cities/') && p.split('/').filter(Boolean).length >= 3) return 'neighborhood'
  if (
    p.startsWith('/cities') ||
    p.startsWith('/neighborhoods') ||
    p.startsWith('/area-guides') ||
    p.startsWith('/areas') ||
    p.startsWith('/oregon')
  ) {
    return 'city'
  }
  if (p.startsWith('/communities') || p.startsWith('/builders')) return 'community'
  if (p.startsWith('/subdivisions')) return 'subdivision'
  if (p.startsWith('/zip/')) return 'zip'
  if (
    p.startsWith('/housing-market') ||
    p.startsWith('/reports') ||
    p.startsWith('/months-of-supply') ||
    p.startsWith('/how-we-get-our-numbers')
  ) {
    return 'market'
  }
  if (
    p.startsWith('/sell') ||
    p.startsWith('/lp/seller') ||
    p.startsWith('/lp/expired') ||
    p.startsWith('/lp/fsbo') ||
    p.startsWith('/lp/sell') ||
    p.startsWith('/motivated-sellers')
  ) {
    return 'sell'
  }
  if (p.startsWith('/buy') || p.startsWith('/lp/buyer')) return 'buy'
  if (p.startsWith('/lp/')) return 'lead'
  if (p.startsWith('/team') || p.startsWith('/about') || p.startsWith('/reviews') || p.startsWith('/join')) {
    return 'team'
  }
  if (p.startsWith('/blog') || p.startsWith('/resources') || p.startsWith('/faq') || p.startsWith('/videos')) {
    return 'blog'
  }
  if (p.startsWith('/tools') || p.startsWith('/cma-drafts')) return 'tools'
  if (p.startsWith('/schools')) return 'schools'
  if (p.startsWith('/parks')) return 'parks'
  if (p.startsWith('/central-oregon')) return 'guides'
  if (p.startsWith('/contact') || p.startsWith('/refer-a-client')) return 'contact'
  if (
    p.startsWith('/privacy') ||
    p.startsWith('/terms') ||
    p.startsWith('/cookies') ||
    p.startsWith('/accessibility') ||
    p.startsWith('/dmca') ||
    p.startsWith('/fair-housing') ||
    p.startsWith('/data-deletion')
  ) {
    return 'legal'
  }
  if (p.startsWith('/account') || p.startsWith('/dashboard')) return 'account'
  if (
    p.startsWith('/login') ||
    p.startsWith('/signup') ||
    p.startsWith('/offline') ||
    p.startsWith('/auth') ||
    p.startsWith('/forgot-password') ||
    p.startsWith('/newsletter') ||
    p.startsWith('/marketing') ||
    p.startsWith('/alerts') ||
    p.startsWith('/sign') ||
    p.startsWith('/site-index') ||
    p.startsWith('/dev')
  ) {
    return 'utility'
  }
  return 'other'
}
