/**
 * lib/site-nav.ts — single source of truth for site navigation.
 *
 * PRIMARY_NAV drives SiteHeader (mega-menu + desktop) and MobileNav (Sheet + Accordion).
 * FOOTER_NAV drives SiteFooter column groups.
 *
 * All slugs are hardcoded to avoid runtime fetches.
 * Community slugs match data/resort-communities.json and app/communities/[slug].
 * City slugs match app/cities/[slug].
 *
 * Wire the gate: node scripts/check-nav-reachability.mjs (see that file for CI setup)
 */

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

// ─── Community + City data (hardcoded — static and crawlable) ─────────────────

const COMMUNITY_LINKS: NavLink[] = [
  { href: '/communities/tetherow', label: 'Tetherow' },
  { href: '/communities/broken-top', label: 'Broken Top' },
  { href: '/communities/eagle-crest', label: 'Eagle Crest' },
  { href: '/communities/pronghorn', label: 'Pronghorn' },
  { href: '/communities/caldera-springs', label: 'Caldera Springs' },
  { href: '/communities/sunriver', label: 'Sunriver' },
  { href: '/communities/awbrey-glen', label: 'Awbrey Glen' },
  { href: '/communities/northwest-crossing', label: 'Northwest Crossing' },
  { href: '/communities/crosswater', label: 'Crosswater' },
  { href: '/communities/black-butte-ranch', label: 'Black Butte Ranch' },
  { href: '/communities/brasada-ranch', label: 'Brasada Ranch' },
  { href: '/communities/widgi-creek', label: 'Widgi Creek' },
  { href: '/communities/vandevert-ranch', label: 'Vandevert Ranch' },
  { href: '/communities/three-rivers', label: 'Three Rivers' },
]

const CITY_LINKS: NavLink[] = [
  { href: '/cities/bend', label: 'Bend' },
  { href: '/cities/redmond', label: 'Redmond' },
  { href: '/cities/sisters', label: 'Sisters' },
  { href: '/cities/sunriver', label: 'Sunriver' },
  { href: '/cities/la-pine', label: 'La Pine' },
  { href: '/cities/madras', label: 'Madras' },
  { href: '/cities/prineville', label: 'Prineville' },
  { href: '/cities/culver', label: 'Culver' },
  { href: '/cities/terrebonne', label: 'Terrebonne' },
  { href: '/cities/powell-butte', label: 'Powell Butte' },
]

// ─── PRIMARY_NAV ──────────────────────────────────────────────────────────────

/**
 * Top-level navigation groups.
 * Each group has a label (shown in the nav bar), an optional top-level href,
 * and child links that populate the mega-menu panel or accordion section.
 */
export const PRIMARY_NAV: NavGroup[] = [
  {
    // "Homes" is the merged Homes + Explore panel. Children include every city
    // and community href so the reachability gate passes and mobile accordion
    // exposes all destinations under one section.
    label: 'Homes',
    href: '/homes-for-sale',
    children: [
      { href: '/homes-for-sale', label: 'All homes for sale' },
      { href: '/search', label: 'Map search' },
      { href: '/open-houses', label: 'Open houses' },
      { href: '/price-drops', label: 'Price drops' },
      { href: '/lp/buyer-listing-alerts', label: 'Get listing alerts' },
      { href: '/cities', label: 'All cities' },
      ...CITY_LINKS,
      { href: '/communities', label: 'All communities' },
      ...COMMUNITY_LINKS,
    ],
  },
  {
    label: 'Market',
    href: '/housing-market',
    children: [
      { href: '/housing-market', label: 'Market overview' },
      { href: '/housing-market/reports', label: 'Market reports' },
      { href: '/reports/explore', label: 'Explore reports' },
      { href: '/activity', label: 'Recent activity' },
      { href: '/price-drops', label: 'Price drops' },
    ],
  },
  {
    label: 'Sell',
    href: '/sell',
    children: [
      { href: '/sell', label: 'Sell your home' },
      { href: '/sell/valuation', label: 'Get a free valuation' },
      { href: '/our-homes', label: 'Our listings' },
    ],
  },
  {
    label: 'Guides',
    href: '/guides',
    children: [
      { href: '/blog', label: 'Blog' },
      { href: '/guides', label: 'Buyer and seller guides' },
      { href: '/central-oregon/events', label: 'Central Oregon events' },
      { href: '/central-oregon/venues', label: 'Live music & shows' },
      { href: '/resources', label: 'Resources' },
      { href: '/faq', label: 'FAQ' },
      { href: '/videos', label: 'Video tours' },
      { href: '/tools/mortgage-calculator', label: 'Mortgage calculator' },
      { href: '/tools/appreciation', label: 'Appreciation tool' },
    ],
  },
  {
    label: 'About',
    href: '/about',
    children: [
      { href: '/team', label: 'Meet the team' },
      { href: '/about', label: 'About Ryan Realty' },
      { href: '/contact', label: 'Contact us' },
      { href: '/reviews', label: 'Client reviews' },
      { href: '/join', label: 'Join the team' },
    ],
  },
]

// ─── FOOTER_NAV ───────────────────────────────────────────────────────────────

/**
 * Footer column groups.
 * Each group maps to one column in the footer grid.
 */
export const FOOTER_NAV: FooterGroup[] = [
  {
    heading: 'Search',
    links: [
      { href: '/homes-for-sale', label: 'Homes for sale' },
      { href: '/search', label: 'Map search' },
      { href: '/open-houses', label: 'Open houses' },
      { href: '/compare', label: 'Compare listings' },
      { href: '/homes-for-sale?status=Sold', label: 'Sold homes' },
    ],
  },
  {
    heading: 'Communities',
    links: [
      { href: '/communities', label: 'All communities' },
      { href: '/communities/tetherow', label: 'Tetherow' },
      { href: '/communities/broken-top', label: 'Broken Top' },
      { href: '/communities/eagle-crest', label: 'Eagle Crest' },
      { href: '/communities/sunriver', label: 'Sunriver' },
      { href: '/communities/pronghorn', label: 'Pronghorn' },
      { href: '/communities/black-butte-ranch', label: 'Black Butte Ranch' },
      { href: '/communities/caldera-springs', label: 'Caldera Springs' },
    ],
  },
  {
    heading: 'Cities',
    links: [
      { href: '/cities', label: 'All cities' },
      { href: '/cities/bend', label: 'Bend' },
      { href: '/cities/redmond', label: 'Redmond' },
      { href: '/cities/sisters', label: 'Sisters' },
      { href: '/cities/sunriver', label: 'Sunriver' },
      { href: '/cities/la-pine', label: 'La Pine' },
      { href: '/cities/madras', label: 'Madras' },
    ],
  },
  {
    heading: 'Market',
    links: [
      { href: '/housing-market', label: 'Market overview' },
      { href: '/housing-market/reports', label: 'Market reports' },
      { href: '/reports/explore', label: 'Explore reports' },
      { href: '/activity', label: 'Recent activity' },
    ],
  },
  {
    heading: 'Sell',
    links: [
      { href: '/sell', label: 'Sell your home' },
      { href: '/sell/valuation', label: 'Free home valuation' },
      { href: '/our-homes', label: 'Our listings' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { href: '/team', label: 'Meet the team' },
      { href: '/about', label: 'About us' },
      { href: '/contact', label: 'Contact' },
      { href: '/reviews', label: 'Client reviews' },
      { href: '/join', label: 'Join the team' },
    ],
  },
  {
    heading: 'Learn',
    links: [
      { href: '/blog', label: 'Blog' },
      { href: '/guides', label: 'Guides' },
      { href: '/central-oregon/events', label: 'Central Oregon events' },
      { href: '/central-oregon/venues', label: 'Live music & shows' },
      { href: '/videos', label: 'Video tours' },
      { href: '/faq', label: 'FAQ' },
      { href: '/tools/mortgage-calculator', label: 'Mortgage calculator' },
      { href: '/tools/appreciation', label: 'Appreciation tool' },
    ],
  },
]

/**
 * Legal row links — rendered separately at the bottom of the footer.
 */
export const LEGAL_LINKS: NavLink[] = [
  { href: '/privacy', label: 'Privacy policy' },
  { href: '/terms', label: 'Terms of use' },
  { href: '/accessibility', label: 'Accessibility' },
  { href: '/fair-housing', label: 'Fair housing' },
  { href: '/dmca', label: 'DMCA' },
]
