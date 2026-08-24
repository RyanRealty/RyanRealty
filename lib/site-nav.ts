/**
 * lib/site-nav.ts — SINGLE source of truth for public site navigation.
 *
 * Matt lock 2026-08-10 (SEO/IA plan):
 *   Top bar: Buy · Areas · Market · Sell · About
 *   Lifestyle (parks, schools, trails, events, venues, golf) lives under Areas
 *   One chrome (KbNav) for public pages — dual SiteHeader/KbNav trees retired
 *
 * Projections from this file (do not re-author separate trees):
 *   KB_TOP_NAV     — desktop top bar + caret panels (KbNav)
 *   KB_MENU_GROUPS — Menu+ / mobile overlay
 *   KB_FOOTER_COLUMNS / FOOTER_NAV — footer columns
 *   PRIMARY_NAV    — alias of KB_TOP_NAV for reachability gate + legacy imports
 *
 * Gate: scripts/check-nav-reachability.mjs
 */

import { publishNewsletterSubscribeHref } from '@/lib/site/publish-newsletter-href'

// ─── Types ────────────────────────────────────────────────────────────────────

export type NavLink = {
  href: string
  label: string
}

export type NavGroup = {
  label: string
  /** Top-level href for the group itself (optional — used when the label is also a link). */
  href?: string
  children: NavLink[]
}

export type FooterGroup = {
  heading: string
  links: NavLink[]
}

const NEWSLETTER_SUBSCRIBE: NavLink = {
  href: publishNewsletterSubscribeHref(),
  label: 'Monthly briefing',
}

/** A top-bar group. `href` is required — every top-level item is a real destination. */
export type TopNavGroup = NavGroup & { href: string }

// ─── Shared link banks ────────────────────────────────────────────────────────

const CITY_LINKS: NavLink[] = [
  { href: '/cities/bend', label: 'Bend' },
  { href: '/cities/redmond', label: 'Redmond' },
  { href: '/cities/sisters', label: 'Sisters' },
  { href: '/cities/sunriver', label: 'Sunriver' },
  { href: '/cities/la-pine', label: 'La Pine' },
  { href: '/cities/terrebonne', label: 'Terrebonne' },
  { href: '/cities/prineville', label: 'Prineville' },
  { href: '/cities/madras', label: 'Madras' },
]

const COMMUNITY_LINKS: NavLink[] = [
  { href: '/communities/tetherow', label: 'Tetherow' },
  { href: '/communities/broken-top', label: 'Broken Top' },
  { href: '/communities/northwest-crossing', label: 'NorthWest Crossing' },
  { href: '/communities/caldera-springs', label: 'Caldera Springs' },
  { href: '/communities/eagle-crest', label: 'Eagle Crest' },
  { href: '/communities/black-butte-ranch', label: 'Black Butte Ranch' },
  { href: '/communities/pronghorn', label: 'Pronghorn' },
  { href: '/communities/sunriver', label: 'Sunriver' },
  { href: '/communities/brasada-ranch', label: 'Brasada Ranch' },
  { href: '/communities/awbrey-glen', label: 'Awbrey Glen' },
  { href: '/communities/crosswater', label: 'Crosswater' },
  { href: '/communities/widgi-creek', label: 'Widgi Creek' },
  { href: '/communities/vandevert-ranch', label: 'Vandevert Ranch' },
  { href: '/communities/three-rivers', label: 'Three Rivers' },
]

/** Canonical map entry — never bare `/search` (that 301s to homes-for-sale). */
export const MAP_SEARCH: NavLink = {
  href: '/homes-for-sale?view=map',
  label: 'Map search',
}

/**
 * Regional inventory door. Bare `/homes-for-sale` is split/map and injects
 * city=Bend. List view is the Central Oregon set (publishRegionalSearchHref).
 */
export const REGIONAL_SEARCH: NavLink = {
  href: '/homes-for-sale?view=list',
  label: 'All homes for sale',
}

/** Global chrome valuation CTA — on-page form on /sell (Matt Wave 0). */
export const VALUATION_FORM: NavLink = {
  href: '/sell#get-value',
  label: 'Value my home',
}

/** Ad-funnel LP only — never use in primary chrome. */
export const VALUATION_LP: NavLink = {
  href: '/lp/seller-home-value',
  label: "Get your home's value",
}

// ─── KB_TOP_NAV — the public top bar (SSOT) ───────────────────────────────────

/**
 * Every top-level item is a link to its overview AND a panel of children.
 * Reachability: at most two interactions from any page (hover then click, or Menu+).
 */
export const KB_TOP_NAV: TopNavGroup[] = [
  {
    label: 'Buy',
    href: REGIONAL_SEARCH.href,
    children: [
      REGIONAL_SEARCH,
      MAP_SEARCH,
      { href: '/open-houses', label: 'Open houses' },
      { href: '/price-drops', label: 'Price drops' },
      { href: '/luxury-homes-bend', label: 'Luxury homes in Bend' },
      { href: '/homes-for-sale?status=Sold', label: 'Sold homes' },
      { href: '/compare', label: 'Compare homes' },
      { href: '/videos', label: 'Video tours' },
      { href: '/lp/buyer-listing-alerts', label: 'Listing alerts' },
    ],
  },
  {
    label: 'Areas',
    href: '/cities',
    children: [
      { href: '/cities', label: 'All cities' },
      ...CITY_LINKS,
      { href: '/communities', label: 'All communities' },
      { href: '/neighborhoods', label: 'All neighborhoods' },
      { href: '/subdivisions', label: 'All subdivisions' },
      { href: '/communities/tetherow', label: 'Tetherow' },
      { href: '/communities/broken-top', label: 'Broken Top' },
      { href: '/communities/northwest-crossing', label: 'NorthWest Crossing' },
      { href: '/communities/caldera-springs', label: 'Caldera Springs' },
      { href: '/communities/eagle-crest', label: 'Eagle Crest' },
      { href: '/communities/black-butte-ranch', label: 'Black Butte Ranch' },
      { href: '/schools', label: 'Schools' },
      { href: '/parks', label: 'Parks' },
      { href: '/central-oregon/trails', label: 'Trails' },
      { href: '/central-oregon/events', label: 'Events' },
      { href: '/central-oregon/venues', label: 'Live music and shows' },
      { href: '/lp/central-oregon-golf', label: 'Golf' },
    ],
  },
  {
    label: 'Market',
    href: '/housing-market',
    children: [
      { href: '/housing-market', label: 'Market overview' },
      { href: '/housing-market/reports', label: 'Market reports' },
      { href: '/activity', label: 'Recent activity' },
      { href: '/months-of-supply', label: 'Months of supply' },
      { href: '/how-we-get-our-numbers', label: 'How we get our numbers' },
      { href: '/blog', label: 'Blog and guides' },
      { href: '/faq', label: 'FAQ' },
      { href: '/tools/mortgage-calculator', label: 'Mortgage calculator' },
      { href: '/tools/rental-property-calculator', label: 'Rental calculator' },
      { href: '/tools/appreciation', label: 'Appreciation tool' },
    ],
  },
  {
    label: 'Sell',
    href: '/sell',
    children: [
      { href: '/sell', label: 'Sell your home' },
      VALUATION_FORM,
      { href: '/sell/valuation', label: 'Written valuation' },
      { href: '/our-homes', label: 'Our listings' },
      { href: '/motivated-sellers', label: 'Sell on a deadline' },
    ],
  },
  {
    label: 'About',
    href: '/about',
    children: [
      { href: '/about', label: 'About Ryan Realty' },
      { href: '/team', label: 'Our team' },
      { href: '/reviews', label: 'Client reviews' },
      { href: '/contact', label: 'Contact us' },
      { href: '/join', label: 'Join the team' },
      { href: '/refer-a-client', label: 'Refer a client' },
    ],
  },
]

/** Alias — reachability gate and any legacy import. Same object as KB_TOP_NAV. */
export const PRIMARY_NAV: TopNavGroup[] = KB_TOP_NAV

/** Derived — flat top-bar labels. */
export const KB_TOP_LINKS: NavLink[] = KB_TOP_NAV.map((g) => ({
  href: g.href,
  label: g.label,
}))

/** Trust subset under About (named export for surfaces that need only these). */
const ABOUT_TRUST_HREFS = ['/team', '/reviews', '/contact']
export const KB_ABOUT_DROPDOWN: NavLink[] =
  KB_TOP_NAV.find((g) => g.href === '/about')?.children.filter((l) =>
    ABOUT_TRUST_HREFS.includes(l.href),
  ) ?? []

// ─── Menu+ / mobile overlay (projection — denser than top bar) ────────────────

export const KB_MENU_GROUPS: { title: string; links: NavLink[] }[] = [
  {
    title: 'Buy',
    links: [
      { href: REGIONAL_SEARCH.href, label: 'Search homes' },
      MAP_SEARCH,
      { href: '/open-houses', label: 'Open houses' },
      { href: '/price-drops', label: 'Price drops' },
      { href: '/luxury-homes-bend', label: 'Luxury homes' },
      { href: '/compare', label: 'Compare homes' },
      { href: '/videos', label: 'Video tours' },
      { href: '/lp/buyer-listing-alerts', label: 'Listing alerts' },
      { href: '/our-homes', label: 'Our listings' },
    ],
  },
  {
    title: 'Areas',
    links: [
      { href: '/cities', label: 'All cities' },
      ...CITY_LINKS,
      { href: '/communities', label: 'All communities' },
      { href: '/neighborhoods', label: 'All neighborhoods' },
      { href: '/subdivisions', label: 'All subdivisions' },
      ...COMMUNITY_LINKS.slice(0, 8),
      { href: '/schools', label: 'Schools' },
      { href: '/parks', label: 'Parks' },
      { href: '/central-oregon/trails', label: 'Trails' },
      { href: '/central-oregon/events', label: 'Events' },
      { href: '/central-oregon/venues', label: 'Live music and shows' },
      { href: '/lp/central-oregon-golf', label: 'Golf' },
    ],
  },
  {
    title: 'Market',
    links: [
      { href: '/housing-market', label: 'Market overview' },
      { href: '/housing-market/reports', label: 'Market reports' },
      { href: '/activity', label: 'Recent activity' },
      { href: '/months-of-supply', label: 'Months of supply' },
      { href: '/how-we-get-our-numbers', label: 'How we get our numbers' },
      { href: '/blog', label: 'Blog and guides' },
      { href: '/faq', label: 'FAQ' },
      { href: '/tools/mortgage-calculator', label: 'Mortgage calculator' },
      { href: '/tools/rental-property-calculator', label: 'Rental calculator' },
      { href: '/tools/appreciation', label: 'Appreciation tool' },
    ],
  },
  {
    title: 'Sell',
    links: [
      { href: '/sell', label: 'Sell your home' },
      VALUATION_FORM,
      { href: '/our-homes', label: 'Our listings' },
      { href: '/motivated-sellers', label: 'Sell on a deadline' },
    ],
  },
  {
    title: 'About',
    links: [
      { href: '/about', label: 'About Ryan Realty' },
      { href: '/team', label: 'Our team' },
      { href: '/reviews', label: 'Client reviews' },
      { href: '/contact', label: 'Contact us' },
      { href: '/join', label: 'Join the team' },
      { href: '/refer-a-client', label: 'Refer a client' },
    ],
  },
  {
    title: 'Your account',
    links: [
      { href: '/account', label: 'Saved homes and searches' },
      { href: '/login', label: 'Sign in' },
    ],
  },
]

// ─── Footers (projections) ────────────────────────────────────────────────────

export const KB_FOOTER_COLUMNS: FooterGroup[] = [
  {
    heading: 'Buy',
    links: [
      { href: REGIONAL_SEARCH.href, label: 'Homes for sale' },
      MAP_SEARCH,
      { href: '/open-houses', label: 'Open houses' },
      { href: '/price-drops', label: 'Price drops' },
      { href: '/luxury-homes-bend', label: 'Luxury homes' },
      { href: '/compare', label: 'Compare homes' },
      { href: '/videos', label: 'Video tours' },
    ],
  },
  {
    heading: 'Areas',
    links: [
      { href: '/cities', label: 'All cities' },
      { href: '/cities/bend', label: 'Bend homes' },
      { href: '/cities/redmond', label: 'Redmond homes' },
      { href: '/cities/sisters', label: 'Sisters homes' },
      { href: '/cities/sunriver', label: 'Sunriver homes' },
      { href: '/cities/la-pine', label: 'La Pine homes' },
      { href: '/communities', label: 'All communities' },
      { href: '/neighborhoods', label: 'All neighborhoods' },
      { href: '/subdivisions', label: 'All subdivisions' },
      { href: '/schools', label: 'Schools' },
      { href: '/parks', label: 'Parks' },
      { href: '/central-oregon/trails', label: 'Trails' },
      { href: '/central-oregon/events', label: 'Events' },
    ],
  },
  {
    heading: 'Market',
    links: [
      { href: '/housing-market', label: 'Market overview' },
      { href: '/housing-market/reports', label: 'Market reports' },
      { href: '/activity', label: 'Recent activity' },
      { href: '/months-of-supply', label: 'Months of supply' },
      { href: '/how-we-get-our-numbers', label: 'How we get our numbers' },
      { href: '/blog', label: 'Blog' },
      NEWSLETTER_SUBSCRIBE,
      { href: '/faq', label: 'FAQ' },
      { href: '/tools/mortgage-calculator', label: 'Mortgage calculator' },
      { href: '/tools/rental-property-calculator', label: 'Rental calculator' },
    ],
  },
  {
    heading: 'Sell',
    links: [
      { href: '/sell', label: 'Sell your home' },
      VALUATION_FORM,
      { href: '/our-homes', label: 'Our listings' },
      { href: '/motivated-sellers', label: 'Sell on a deadline' },
    ],
  },
  {
    heading: 'About',
    links: [
      { href: '/about', label: 'About Ryan Realty' },
      { href: '/team', label: 'Our team' },
      { href: '/reviews', label: 'Client reviews' },
      { href: '/contact', label: 'Contact' },
      { href: '/join', label: 'Join the team' },
      { href: '/refer-a-client', label: 'Refer a client' },
    ],
  },
]

/** Portal SiteFooter columns — same IA, slightly different packing for legal routes. */
export const FOOTER_NAV: FooterGroup[] = [
  {
    heading: 'Buy',
    links: [
      { href: REGIONAL_SEARCH.href, label: 'Homes for sale' },
      MAP_SEARCH,
      { href: '/luxury-homes-bend', label: 'Luxury homes in Bend' },
      { href: '/open-houses', label: 'Open houses' },
      { href: '/compare', label: 'Compare homes' },
      { href: '/homes-for-sale?status=Sold', label: 'Sold homes' },
    ],
  },
  {
    heading: 'Areas',
    links: [
      { href: '/cities', label: 'All cities' },
      { href: '/cities/bend', label: 'Bend' },
      { href: '/cities/redmond', label: 'Redmond' },
      { href: '/cities/sisters', label: 'Sisters' },
      { href: '/cities/sunriver', label: 'Sunriver' },
      { href: '/cities/la-pine', label: 'La Pine' },
      { href: '/communities', label: 'All communities' },
      { href: '/neighborhoods', label: 'All neighborhoods' },
      { href: '/subdivisions', label: 'All subdivisions' },
      { href: '/communities/tetherow', label: 'Tetherow' },
      { href: '/communities/broken-top', label: 'Broken Top' },
    ],
  },
  {
    heading: 'Market',
    links: [
      { href: '/housing-market', label: 'Market overview' },
      { href: '/housing-market/reports', label: 'Market reports' },
      { href: '/activity', label: 'Recent activity' },
      { href: '/how-we-get-our-numbers', label: 'How we get our numbers' },
      { href: '/blog', label: 'Blog' },
      NEWSLETTER_SUBSCRIBE,
      { href: '/faq', label: 'FAQ' },
      { href: '/tools/mortgage-calculator', label: 'Mortgage calculator' },
    ],
  },
  {
    heading: 'Sell',
    links: [
      { href: '/sell', label: 'Sell your home' },
      VALUATION_FORM,
      { href: '/our-homes', label: 'Our listings' },
    ],
  },
  {
    heading: 'About',
    links: [
      { href: '/team', label: 'Meet the team' },
      { href: '/about', label: 'About us' },
      { href: '/contact', label: 'Contact' },
      { href: '/reviews', label: 'Client reviews' },
      { href: '/join', label: 'Join the team' },
      { href: '/refer-a-client', label: 'Refer a client' },
    ],
  },
]

export const LEGAL_LINKS: NavLink[] = [
  { href: '/privacy', label: 'Privacy policy' },
  { href: '/terms', label: 'Terms of use' },
  { href: '/accessibility', label: 'Accessibility' },
  { href: '/fair-housing', label: 'Fair housing' },
  { href: '/dmca', label: 'DMCA' },
  { href: '/site-index', label: 'Site index' },
]
