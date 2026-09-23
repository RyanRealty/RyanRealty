/**
 * lib/site-nav.ts — SINGLE source of truth for public site navigation.
 *
 * Matt lock 2026-08-10 (SEO/IA plan):
 *   Top bar (chrome): Homes · Places · Market · Sell · About (ia-lock).
 *   Market is first-class — not buried in Places.
 *   Lifestyle (parks, schools, trails, events, venues, golf) lives under Areas
 *   One chrome (KbNav) for public pages — dual SiteHeader/KbNav trees retired
 *
 * Projections from this file (do not re-author separate trees):
 *   KB_TOP_NAV     — desktop top bar + caret panels (KbNav)
 *   KB_MENU_GROUPS — Menu+ / mobile overlay
 *   KB_FOOTER_COLUMNS / FOOTER_NAV — footer columns (Markets, Buy · Sell · Join, Company, Contact)
 *   PRIMARY_NAV    — alias of KB_TOP_NAV for reachability gate + legacy imports
 *
 * Gate: scripts/check-nav-reachability.mjs
 */

import { publishNewsletterSubscribeHref } from '@/lib/site/publish-newsletter-href'
import { bendLuxuryHomesDoor } from '@/lib/site/bend-luxury-homes'

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
  /** When set, the cluster title is a door (city place page). */
  href?: string
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
  return column.groups?.length
    ? column.groups.flatMap((g) => [
        ...(g.href ? [{ href: g.href, label: g.heading }] : []),
        ...g.links,
      ])
    : column.links
}

function footerFromGroups(heading: string, groups: FooterCluster[]): FooterGroup {
  return { heading, groups, links: footerColumnLinks({ heading, groups, links: [] }) }
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

/** One town cluster under the Markets footer column. */
function cityFooterCluster(
  label: string,
  communityLabels: readonly string[] = [],
  extra: NavLink[] = [],
): FooterCluster {
  const city = footerCity(label)
  return {
    heading: label,
    href: city.href,
    links: [...extra, ...communityLabels.map(footerCommunity)],
    depth: 1,
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
  { href: '/communities/juniper-preserve', label: 'Juniper Preserve' },
  { href: '/communities/sunriver', label: 'Sunriver' },
  { href: '/communities/brasada-ranch', label: 'Brasada Ranch' },
  { href: '/communities/awbrey-glen', label: 'Awbrey Glen' },
  { href: '/communities/crosswater', label: 'Crosswater' },
  { href: '/communities/widgi-creek', label: 'Widgi Creek' },
  { href: '/communities/vandevert-ranch', label: 'Vandevert Ranch' },
  { href: '/communities/three-rivers', label: 'Three Rivers' },
]

/**
 * Regional inventory door: the INDEXABLE `/homes-for-sale`, with no query.
 *
 * UXLIVE-4 / EXP-11 (visibility audit 2026-09-22): every chrome door used to
 * point at `?view=list` / `?view=map`, which serve `noindex, follow` with a
 * canonical to the bare URL, so the site's strongest repeated link for "homes
 * for sale" landed on a URL Google is told not to index. The bare URL now
 * DEFAULTS to the regional list (app/search/page.tsx), so the chrome links it
 * clean and the view (list / split / map) stays client state on the page.
 * There is no separate "Map search" door: the map is one tap away inside the
 * one Field, and a `?view=map` link is a noindex variant (ci:chrome-links).
 */
export const REGIONAL_SEARCH: NavLink = {
  href: '/homes-for-sale',
  label: 'All homes for sale',
}

/** Income property. SITE_PAGES.md lists invest as a Homes child that stays. */
const INVEST: NavLink = { href: '/invest', label: 'Invest' }

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
      // gsc-trend-5 (visibility audit 2026-09-23, owner directive MATT
      // 2026-09-23): the city search pages own "{City} homes for sale" since
      // c29c2d79f moved /cities/{city} to "{City} real estate", yet no chrome
      // door reached them (Search Console's referring URLs for
      // /homes-for-sale/bend: two deep pages). The three cities are the ones
      // the p1 city-buy target queries name.
      { href: '/homes-for-sale/bend', label: 'Bend homes for sale' },
      { href: '/homes-for-sale/redmond', label: 'Redmond homes for sale' },
      { href: '/homes-for-sale/sisters', label: 'Sisters homes for sale' },
      { href: '/open-houses', label: 'Open houses' },
      { href: '/price-drops', label: 'Price drops' },
      bendLuxuryHomesDoor(),
      { href: '/new-construction', label: 'New construction in Bend' },
      { href: '/our-homes', label: 'Our listings' },
      INVEST,
    ],
  },
  {
    label: 'Areas',
    href: '/cities',
    children: [
      { href: '/cities', label: 'All cities' },
      ...CITY_LINKS,
      { href: '/communities', label: 'All communities' },
      { href: '/communities/tetherow', label: 'Tetherow' },
      { href: '/communities/broken-top', label: 'Broken Top' },
      { href: '/communities/northwest-crossing', label: 'NorthWest Crossing' },
      { href: '/communities/eagle-crest', label: 'Eagle Crest' },
      { href: '/communities/black-butte-ranch', label: 'Black Butte Ranch' },
      { href: '/communities/juniper-preserve', label: 'Juniper Preserve' },
      { href: '/communities/brasada-ranch', label: 'Brasada Ranch' },
      { href: '/neighborhoods', label: 'All neighborhoods' },
      { href: '/subdivisions', label: 'All subdivisions' },
      { href: '/schools', label: 'School districts' },
    ],
  },
  {
    // First-class chrome (ia-lock).
    // Market report hierarchy — keep in lockstep with lib/market/report-doors.ts
    // (ci:nav-reachability reads literal hrefs in this file).
    label: 'Market',
    href: '/housing-market',
    children: [
      { href: '/housing-market', label: 'Live market' },
      { href: '/housing-market/central-oregon', label: 'Region deep dive' },
      { href: '/months-of-supply', label: 'Months of supply' },
      { href: '/how-we-get-our-numbers', label: 'How we get our numbers' },
      { href: '/housing-market/history', label: 'Closed sales explorer' },
      { href: '/housing-market/reports', label: 'Sales and weekly reports' },
      { href: '/blog', label: 'Market stories' },
      { href: '/faq', label: 'FAQ' },
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
      { href: '/join', label: 'Join Ryan Realty' },
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
      { href: '/open-houses', label: 'Open houses' },
      { href: '/price-drops', label: 'Price drops' },
      bendLuxuryHomesDoor(),
      { href: '/new-construction', label: 'New construction in Bend' },
      { href: '/our-homes', label: 'Our listings' },
      INVEST,
      { href: '/videos', label: 'Video tours' },
    ],
  },
  {
    title: 'Areas',
    links: [
      { href: '/cities', label: 'All cities' },
      ...CITY_LINKS,
      { href: '/communities', label: 'All communities' },
      { href: '/communities/tetherow', label: 'Tetherow' },
      { href: '/communities/broken-top', label: 'Broken Top' },
      { href: '/communities/eagle-crest', label: 'Eagle Crest' },
      { href: '/communities/black-butte-ranch', label: 'Black Butte Ranch' },
      { href: '/neighborhoods', label: 'All neighborhoods' },
      { href: '/subdivisions', label: 'All subdivisions' },
      { href: '/central-oregon/golf', label: 'Golf' },
      { href: '/schools', label: 'Schools' },
      { href: '/parks', label: 'Parks' },
    ],
  },
  {
    title: 'Market',
    links: [
      { href: '/housing-market', label: 'Live market' },
      { href: '/housing-market/central-oregon', label: 'Region deep dive' },
      { href: '/months-of-supply', label: 'Months of supply' },
      { href: '/how-we-get-our-numbers', label: 'How we get our numbers' },
      { href: '/housing-market/history', label: 'Closed sales explorer' },
      { href: '/housing-market/reports', label: 'Sales and weekly reports' },
      { href: '/blog', label: 'Market stories' },
      { href: '/faq', label: 'FAQ' },
      NEWSLETTER_SUBSCRIBE,
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
      { href: '/join', label: 'Join Ryan Realty' },
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
 * Public sitemap: Markets / Buy · Sell · Join / Company / Contact.
 * Markets is a city directory: the town name is the place-page door, communities
 * nest under it. Keyword sentences ("Homes for sale in {city}") live on
 * /site-index, not as a hairline dump in chrome (SITE-157, Matt 2026-09-20).
 * Header chrome: Homes / Places / Market / Sell / About.
 */
const FOOTER_MORE_CITIES = ['La Pine', 'Terrebonne', 'Prineville', 'Madras'] as const

export const KB_FOOTER_COLUMNS: FooterGroup[] = [
  footerFromGroups('Markets', [
    cityFooterCluster(
      'Bend',
      ['Tetherow', 'Broken Top', 'NorthWest Crossing', 'Awbrey Glen'],
      [{ href: '/neighborhoods', label: 'Bend neighborhoods' }],
    ),
    cityFooterCluster('Redmond', ['Eagle Crest', 'Juniper Preserve']),
    // SITE-184: the Black Butte Ranch community page is the one winner for
    // "Black Butte Ranch homes for sale"; the one sitewide door carries that
    // phrase (it replaces the bare "Black Butte Ranch" item: same href, and a
    // cluster never lists one href twice).
    cityFooterCluster('Sisters', [], [
      { href: '/communities/black-butte-ranch', label: 'Black Butte Ranch homes for sale' },
    ]),
    // SITE-187: the Sunriver community page is the one winner for "Sunriver
    // homes for sale"; the cluster heading stays the city guide.
    cityFooterCluster(
      'Sunriver',
      ['Caldera Springs', 'Crosswater'],
      [{ href: '/communities/sunriver', label: 'Sunriver homes for sale' }],
    ),
    ...FOOTER_MORE_CITIES.map((label) => cityFooterCluster(label)),
  ]),
  footerFromGroups('Buy · Sell · Join', [
    {
      heading: 'Buy',
      links: [
        { href: REGIONAL_SEARCH.href, label: 'Search homes' },
        { href: '/open-houses', label: 'Open houses' },
        { href: '/price-drops', label: 'Price drops' },
        bendLuxuryHomesDoor(),
        { href: '/new-construction', label: 'New construction in Bend' },
        { href: '/our-homes', label: 'Our listings' },
      ],
    },
    {
      heading: 'Sell',
      links: [
        { href: '/sell', label: 'Sell your home' },
        VALUATION_FORM,
      ],
    },
    {
      heading: 'Join',
      links: [{ href: '/join', label: 'Join Ryan Realty' }],
    },
  ]),
  {
    heading: 'Company',
    links: [
      { href: '/about', label: 'About Ryan Realty' },
      { href: '/team', label: 'Our team' },
      { href: '/reviews', label: 'Client reviews' },
      { href: '/invest', label: 'Invest' },
      { href: '/housing-market', label: 'Housing market' },
      { href: '/blog', label: 'Market stories' },
    ],
  },
  {
    heading: 'Contact',
    links: [
      { href: '/contact', label: 'Contact us' },
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
