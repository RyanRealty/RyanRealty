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
 *   KB_FOOTER_COLUMNS / FOOTER_NAV — footer columns (city SEO, then Sell, then About)
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

/**
 * A labeled cluster inside a footer column. Places uses this so the geo
 * ladder is visible: city → neighborhoods / master-planned communities →
 * subdivisions. `depth` is that ladder step (1/2/3); omit it for a cluster
 * that is not on the ladder (schools, parks, trails).
 */
export type FooterCluster = {
  heading: string
  links: NavLink[]
  depth?: 1 | 2 | 3
}

export type FooterGroup = {
  heading: string
  links: NavLink[]
  /** When present, the footer renders these instead of a single list. */
  groups?: FooterCluster[]
}

/** Flatten a column's destinations. Groups, when present, are the source. */
export function footerColumnLinks(column: FooterGroup): NavLink[] {
  return column.groups?.length ? column.groups.flatMap((g) => g.links) : column.links
}

function footerFromGroups(heading: string, groups: FooterCluster[]): FooterGroup {
  return { heading, groups, links: groups.flatMap((g) => g.links) }
}

/** City slug from a CITY_LINKS href (`/cities/la-pine` → `la-pine`). */
function citySlugFromHref(href: string): string {
  return href.replace(/^\/cities\//, '')
}

function footerCity(label: string): NavLink {
  const city = CITY_LINKS.find((c) => c.label === label)
  if (!city) {
    throw new Error(`site-nav footer: "${label}" is not in CITY_LINKS`)
  }
  return city
}

function footerCommunity(label: string): NavLink {
  const community = COMMUNITY_LINKS.find((c) => c.label === label)
  if (!community) {
    throw new Error(`site-nav footer: "${label}" is not in COMMUNITY_LINKS`)
  }
  return community
}

/** Exact-match SEO door onto city inventory. */
function cityHomes(label: string): NavLink {
  const city = footerCity(label)
  return {
    href: `/homes-for-sale/${citySlugFromHref(city.href)}`,
    label: `Homes for sale in ${city.label}`,
  }
}

/** Exact-match SEO door onto the city market node. */
function cityMarket(label: string): NavLink {
  const city = footerCity(label)
  return {
    href: `/housing-market/${citySlugFromHref(city.href)}`,
    label: `${city.label} housing market`,
  }
}

function cityFooterColumn(
  label: string,
  communityLabels: readonly string[] = [],
  extra: NavLink[] = [],
): FooterGroup {
  return {
    heading: label,
    links: [cityHomes(label), cityMarket(label), ...extra, ...communityLabels.map(footerCommunity)],
  }
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

const NEWSLETTER_SUBSCRIBE: NavLink = {
  href: publishNewsletterSubscribeHref(),
  label: 'Monthly briefing',
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
      { href: '/invest', label: 'Investment property' },
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
      { href: '/central-oregon/golf', label: 'Golf' },
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
      NEWSLETTER_SUBSCRIBE,
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
      { href: '/central-oregon/golf', label: 'Golf' },
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
      NEWSLETTER_SUBSCRIBE,
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

/**
 * Public sitemap: city-named SEO anchors, then Sell, then About.
 * PAGE_OUTLINE.md Footer. Header stays Buy / Areas / Market / Sell / About.
 */
const FOOTER_MORE_CITIES = ['La Pine', 'Terrebonne', 'Prineville', 'Madras'] as const

export const KB_FOOTER_COLUMNS: FooterGroup[] = [
  cityFooterColumn(
    'Bend',
    ['Tetherow', 'Broken Top', 'NorthWest Crossing', 'Awbrey Glen'],
    [{ href: '/neighborhoods', label: 'Bend neighborhoods' }],
  ),
  cityFooterColumn('Redmond', ['Eagle Crest', 'Pronghorn']),
  cityFooterColumn('Sisters', ['Black Butte Ranch']),
  cityFooterColumn('Sunriver', ['Caldera Springs', 'Crosswater']),
  footerFromGroups(
    FOOTER_MORE_CITIES.join(' · '),
    FOOTER_MORE_CITIES.map((label) => ({
      heading: label,
      links: [cityHomes(label), cityMarket(label)],
    })),
  ),
  {
    heading: 'Sell',
    links: [VALUATION_FORM, { href: '/our-homes', label: 'Our listings' }],
  },
  {
    heading: 'About',
    links: [
      { href: '/team', label: 'Our team' },
      { href: '/reviews', label: 'Client reviews' },
      { href: '/contact', label: 'Contact' },
      { href: '/book', label: 'Book a broker' },
    ],
  },
]

/** Portal SiteFooter columns — same city IA as the public footer. */
export const FOOTER_NAV: FooterGroup[] = KB_FOOTER_COLUMNS

export const LEGAL_LINKS: NavLink[] = [
  { href: '/privacy', label: 'Privacy policy' },
  { href: '/terms', label: 'Terms of use' },
  { href: '/accessibility', label: 'Accessibility' },
  { href: '/fair-housing', label: 'Fair housing' },
  { href: '/dmca', label: 'DMCA' },
  { href: '/site-index', label: 'Site index' },
]
