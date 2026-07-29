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
      { href: '/homes-for-sale?view=map', label: 'Map search' },
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
      { href: '/housing-market', label: 'Explore reports' },
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
    href: '/blog',
    children: [
      { href: '/blog', label: 'Blog' },
      { href: '/blog', label: 'Buyer and seller guides' },
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
      { href: '/homes-for-sale?view=map', label: 'Map search' },
      // Sitewide internal link to the indexed-but-underlinked luxury page —
      // GSC was ranking /sitemap/ for "luxury homes bend" while this page sat
      // with no inbound links from money surfaces (westside backlog #10).
      { href: '/luxury-homes-bend', label: 'Luxury homes in Bend' },
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
      { href: '/housing-market', label: 'Explore reports' },
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
  // Site index — crawlable directory of every browse-URL family (W3.4
  // internal-link layer). Registry entry so both footers render it from the
  // same source instead of hand-appending the link.
  { href: '/site-index', label: 'Site index' },
]

// ─── KB chrome SSOT (KbNav + KbFooter) ────────────────────────────────────────

/** Canonical map entry — never bare `/search` (that 301s to homes-for-sale). */
export const MAP_SEARCH: NavLink = {
  href: '/homes-for-sale?view=map',
  label: 'Map search',
}

/** Global chrome valuation CTA — form page, not the ad LP. */
export const VALUATION_FORM: NavLink = {
  href: '/sell/valuation',
  label: "What's my home worth",
}

/** Ad-funnel LP only — never use in KbNav / KbFooter / SiteHeader chrome. */
export const VALUATION_LP: NavLink = {
  href: '/lp/seller-home-value',
  label: "What's my home worth",
}

/** Always-visible KB top bar links (About is rendered with a dropdown separately). */
export const KB_TOP_LINKS: NavLink[] = [
  { href: '/homes-for-sale', label: 'Homes' },
  { href: '/communities', label: 'Communities' },
  { href: '/cities', label: 'Cities' },
  { href: '/sell', label: 'Sell' },
  { href: '/about', label: 'About' },
]

/** About dropdown children (also mirrored under Menu+ Company). */
export const KB_ABOUT_DROPDOWN: NavLink[] = [
  { href: '/team', label: 'Team' },
  { href: '/reviews', label: 'Reviews' },
  { href: '/contact', label: 'Contact' },
]

/**
 * Menu+ overlay groups. Company sits second so mobile trust pages appear near
 * the top of the overlay (IA plan Phase 1).
 */
export const KB_MENU_GROUPS: { title: string; links: NavLink[] }[] = [
  {
    title: 'Buy',
    links: [
      { href: '/homes-for-sale', label: 'Search homes' },
      MAP_SEARCH,
      { href: '/communities', label: 'Communities' },
      { href: '/cities', label: 'Cities' },
      { href: '/open-houses', label: 'Open houses' },
      { href: '/price-drops', label: 'Price drops' },
      { href: '/our-homes', label: 'Our listings' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/team', label: 'Our team' },
      { href: '/reviews', label: 'Reviews' },
      { href: '/contact', label: 'Contact' },
      { href: '/join', label: 'Join the team' },
    ],
  },
  {
    title: 'Sell',
    links: [
      { href: '/sell', label: 'Sell your home' },
      VALUATION_FORM,
      { href: '/motivated-sellers', label: 'Sell on a deadline' },
    ],
  },
  {
    title: 'Market',
    links: [
      { href: '/housing-market', label: 'Housing market' },
      { href: '/area-guides', label: 'Area guides' },
      { href: '/schools', label: 'Schools' },
      { href: '/parks', label: 'Parks' },
      { href: '/tools/mortgage-calculator', label: 'Mortgage calculator' },
    ],
  },
  {
    title: 'Learn',
    links: [
      { href: '/blog', label: 'Blog' },
      { href: '/faq', label: 'FAQ' },
      { href: '/videos', label: 'Videos' },
      { href: '/resources', label: 'Resources' },
    ],
  },
  {
    title: 'Things to do',
    links: [
      { href: '/central-oregon/events', label: 'Events' },
      { href: '/central-oregon/venues', label: 'Live music & shows' },
      { href: '/central-oregon/trails', label: 'Trails' },
      { href: '/lp/central-oregon-golf', label: 'Golf' },
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

/** KB footer columns (Explore / Communities / lifestyle stay hand-curated geos). */
export const KB_FOOTER_COLUMNS: FooterGroup[] = [
  {
    heading: 'Explore',
    links: [
      { href: '/cities/bend', label: 'Bend homes' },
      { href: '/cities/redmond', label: 'Redmond homes' },
      { href: '/cities/sisters', label: 'Sisters homes' },
      { href: '/cities/sunriver', label: 'Sunriver homes' },
      { href: '/cities/la-pine', label: 'La Pine homes' },
      { href: '/cities/terrebonne', label: 'Terrebonne homes' },
    ],
  },
  {
    heading: 'Communities',
    links: [
      { href: '/communities/tetherow', label: 'Tetherow' },
      { href: '/communities/broken-top', label: 'Broken Top' },
      { href: '/communities/northwest-crossing', label: 'NorthWest Crossing' },
      { href: '/communities/caldera-springs', label: 'Caldera Springs' },
    ],
  },
  {
    heading: 'Central Oregon',
    links: [
      { href: '/central-oregon/events', label: 'Events' },
      { href: '/central-oregon/venues', label: 'Live music & shows' },
      { href: '/central-oregon/trails', label: 'Trails' },
      { href: '/lp/central-oregon-golf', label: 'Golf' },
    ],
  },
  {
    heading: 'Buyers',
    links: [
      { href: '/homes-for-sale', label: 'Browse homes' },
      // Sitewide link to the indexed-but-underlinked luxury page (westside
      // backlog #10) — this is the LIVE footer; SiteFooter carries the same
      // link but renders display:none behind the chrome toggle.
      { href: '/luxury-homes-bend', label: 'Luxury homes' },
      { href: '/housing-market', label: 'The market' },
      { href: '/about', label: 'About' },
      { href: '/team', label: 'The team' },
      { href: '/reviews', label: 'Reviews' },
      { href: '/contact', label: 'Contact' },
    ],
  },
  {
    heading: 'Sellers',
    links: [
      VALUATION_FORM,
      { href: '/sell', label: 'Sell your home' },
      { href: '/housing-market', label: 'Market reports' },
    ],
  },
]
