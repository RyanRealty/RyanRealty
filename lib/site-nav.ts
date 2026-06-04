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
    // "Homes" renders as a stylized mega-menu on desktop (SiteHeader) driven by
    // lib/popular-searches.ts, and as this accordion section on mobile
    // (MobileNav). The children below are the mobile fallback — browse links
    // plus an "All [City] homes" link per city so every city hub is reachable
    // on one thumb. Per-city popular searches live in the desktop mega-menu.
    label: 'Homes',
    href: '/homes-for-sale',
    children: [
      { href: '/homes-for-sale', label: 'All homes for sale' },
      { href: '/search', label: 'Map search' },
      { href: '/open-houses', label: 'Open houses' },
      { href: '/compare', label: 'Compare properties' },
      { href: '/homes-for-sale/bend', label: 'All Bend homes' },
      { href: '/homes-for-sale/redmond', label: 'All Redmond homes' },
      { href: '/homes-for-sale/sisters', label: 'All Sisters homes' },
      { href: '/homes-for-sale/sunriver', label: 'All Sunriver homes' },
      { href: '/homes-for-sale/la-pine', label: 'All La Pine homes' },
      { href: '/homes-for-sale/prineville', label: 'All Prineville homes' },
    ],
  },
  {
    // Explore = the merged Communities + Cities parent (Matt directive 2026-06-04).
    // Keeps every city + community href reachable so the reachability gate passes;
    // the desktop mega-menu groups them into columns (see lib/site-menu.ts).
    label: 'Explore',
    href: '/communities',
    children: [
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
    label: 'Company',
    href: '/about',
    children: [
      { href: '/team', label: 'Meet the team' },
      { href: '/about', label: 'About Ryan Realty' },
      { href: '/contact', label: 'Contact us' },
      { href: '/reviews', label: 'Client reviews' },
      { href: '/join', label: 'Join the team' },
    ],
  },
  {
    label: 'Learn',
    href: '/guides',
    children: [
      { href: '/blog', label: 'Blog' },
      { href: '/guides', label: 'Buyer and seller guides' },
      { href: '/resources', label: 'Resources' },
      { href: '/faq', label: 'FAQ' },
      { href: '/videos', label: 'Video library' },
      { href: '/tools/mortgage-calculator', label: 'Mortgage calculator' },
      { href: '/tools/appreciation', label: 'Appreciation tool' },
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
