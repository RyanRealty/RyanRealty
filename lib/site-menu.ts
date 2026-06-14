/**
 * lib/site-menu.ts — the STATIC, serializable mega-menu config.
 *
 * Top-level nav: Homes · Sell · Market · Guides · About
 *
 * "Homes" is the merged Homes + Explore panel — browse links, cities,
 * communities, price ranges, and lifestyle filters in one unified panel.
 * The old "Explore" top-level entry and its "Central Oregon, end to end"
 * promo card are removed entirely.
 *
 * Each entry carries intent-grouped link columns plus a short text "promo"
 * (eyebrow + title + one line + a single CTA) pinned to the right edge of the
 * full-width panel so every panel stays balanced edge-to-edge. There are NO
 * stats, counts, sparklines, verdict pills, tiles, or photos here by design —
 * this is the approved clean "menu-B" direction.
 *
 * Single source of truth for nav structure remains lib/site-nav.ts (PRIMARY_NAV
 * drives the reachability gate). This file is the DISPLAY layer for the desktop
 * panels and the mobile accordion. Every href below is grounded in a real route:
 *   - /homes-for-sale + homesForSalePath(city) + preset paths (app/search/[...slug],
 *     preset slugs verified against lib/search-presets.ts)
 *   - /communities + /communities/<slug> (app/communities/[slug])
 *   - /cities + /cities/<slug> (app/cities/[slug])
 *   - /housing-market + /housing-market/<city> (app/housing-market/*)
 *   - /sell, /sell/valuation (app/sell/*)
 *   - /team, /about, /contact, /reviews, /join (real pages)
 *   - /guides, /blog, /faq, /videos, /tools/* (real pages)
 *
 * Because this is a plain data module (no JSX, no client hooks) it is fully
 * serializable and can be imported by the SERVER SiteHeader and passed to the
 * CLIENT MegaMenu / MobileNav as a prop.
 */

import { homesForSalePath } from '@/lib/slug'

// ─── Types ──────────────────────────────────────────────────────────────────

export type MenuLink = {
  label: string
  href: string
}

export type MenuColumn = {
  heading: string
  links: MenuLink[]
}

/** A short text call-to-action pinned to the right edge of a panel. No image. */
export type MenuPromo = {
  eyebrow: string
  title: string
  body: string
  ctaLabel: string
  ctaHref: string
}

export type MenuEntry = {
  label: string
  href: string
  columns: MenuColumn[]
  promo?: MenuPromo
}

// ─── Live enrichment data (fetched server-side in SiteHeader, passed as prop) ──

/** One area row for the Areas panel editorial index. */
export type AreaPulseRow = {
  slug: string
  label: string
  href: string
  /** Active SFR listings. Null = data not available (renders —). */
  activeCount: number | null
  /** Median list price. Null = data not available. */
  medianListPrice: number | null
}

/**
 * The biggest price drop this week — for the Homes panel editorial strip.
 * Null when no drops are available (panel falls back to text-only).
 */
export type TopPriceDrop = {
  address: string
  /** Dollar amount of the drop (positive). */
  amount: number
  /** Percent of the drop (positive). e.g. 4.2 = 4.2%. */
  pct: number
  /** Current list price. */
  listPrice: number
  /** Photo URL. */
  photoUrl: string | null
  /** Neighborhood or city label. */
  neighborhood: string | null
  /** Full listing href. */
  href: string
}

/**
 * NavData — the live enrichment bundle fetched once in SiteHeader and passed
 * as a prop to MegaMenu + MobileNav. Every field is nullable so a DB failure
 * silently falls back to the static link-only layout.
 */
export type NavData = {
  /** Areas panel: city pulse rows (8 cities). */
  cityRows: AreaPulseRow[]
  /** Areas panel: community + neighborhood rows — static, no live data yet. */
  communityRows: AreaPulseRow[]
  /** Homes panel: biggest price drop this week. */
  topDrop: TopPriceDrop | null
  /** Homes panel: total price-drop count for the badge. */
  dropCount: number
  /** Market panel: region-level active count. */
  regionActive: number | null
  /** Market panel: region-level median list price. */
  regionMedian: number | null
}

// ─── Helpers (build-time only, fully static) ─────────────────────────────────

const bend = homesForSalePath('Bend') // "/homes-for-sale/bend"

/** A Bend preset search path, e.g. bendPreset('under-750k') -> /homes-for-sale/bend/under-750k */
function bendPreset(slug: string): string {
  return `${bend}/${slug}`
}

// ─── MENU ────────────────────────────────────────────────────────────────────
//
// Order: Homes · Sell · Market · Guides · About
//

export const MENU: MenuEntry[] = [
  {
    // Merged Homes + Explore. Five content columns: Browse, Cities,
    // Communities, By price, Lifestyle & type. Right side: live price-drop strip.
    label: 'Homes',
    href: '/homes-for-sale',
    columns: [
      {
        heading: 'Browse',
        links: [
          { label: 'All homes for sale', href: '/homes-for-sale' },
          { label: 'Map search', href: '/search' },
          { label: 'Open houses', href: '/open-houses' },
          { label: 'New this week', href: bendPreset('new-listings') },
          { label: 'Price drops', href: '/price-drops' },
          { label: 'Get listing alerts', href: '/lp/buyer-listing-alerts' },
        ],
      },
      {
        heading: 'Cities',
        links: [
          { label: 'Bend', href: '/cities/bend' },
          { label: 'Redmond', href: '/cities/redmond' },
          { label: 'Sisters', href: '/cities/sisters' },
          { label: 'Sunriver', href: '/cities/sunriver' },
          { label: 'La Pine', href: '/cities/la-pine' },
          { label: 'Prineville', href: '/cities/prineville' },
          { label: 'Terrebonne', href: '/cities/terrebonne' },
          { label: 'See all cities', href: '/cities' },
        ],
      },
      {
        heading: 'Communities',
        links: [
          { label: 'Tetherow', href: '/communities/tetherow' },
          { label: 'Broken Top', href: '/communities/broken-top' },
          { label: 'NorthWest Crossing', href: '/communities/northwest-crossing' },
          { label: 'Awbrey Butte', href: '/communities/bend-awbrey-butte' },
          { label: 'Caldera Springs', href: '/communities/caldera-springs' },
          { label: 'Black Butte Ranch', href: '/communities/black-butte-ranch' },
          { label: 'All communities', href: '/communities' },
        ],
      },
      {
        heading: 'By price',
        links: [
          { label: 'Under $500K', href: bendPreset('under-500k') },
          { label: 'Under $750K', href: bendPreset('under-750k') },
          { label: 'Under $1M', href: bendPreset('under-1m') },
          { label: 'Luxury ($1M+)', href: bendPreset('luxury') },
          { label: '$2M and up', href: bendPreset('over-2m') },
        ],
      },
      {
        heading: 'Lifestyle & type',
        links: [
          { label: 'On the golf course', href: bendPreset('on-golf-course') },
          { label: 'Mountain views', href: bendPreset('mountain-view') },
          { label: 'River views', href: bendPreset('river-view') },
          { label: 'Single level', href: bendPreset('single-level') },
          { label: 'Acreage (1+ acres)', href: bendPreset('acreage') },
          { label: 'New construction', href: bendPreset('new-construction') },
          { label: 'Condos', href: bendPreset('condos') },
        ],
      },
    ],
    promo: {
      eyebrow: 'Buyers',
      title: 'Be first to new listings',
      body: 'Get homes that match your search the moment they hit the market.',
      ctaLabel: 'Get listing alerts',
      ctaHref: '/lp/buyer-listing-alerts',
    },
  },
  {
    label: 'Sell',
    href: '/sell',
    columns: [
      {
        heading: 'Sell with us',
        links: [
          { label: 'Free home valuation', href: '/sell/valuation' },
          { label: 'How selling works', href: '/sell' },
          { label: 'Recently sold', href: '/homes-for-sale?status=Sold' },
        ],
      },
      {
        heading: 'Seller resources',
        links: [
          { label: 'Seller guides', href: '/guides' },
          { label: 'Our current listings', href: '/our-homes' },
          { label: 'Market reports', href: '/housing-market/reports' },
        ],
      },
    ],
    promo: {
      eyebrow: 'Sellers',
      title: 'What is your home worth?',
      body: 'Get a free valuation, without the high pressure.',
      ctaLabel: 'Free home valuation',
      ctaHref: '/sell/valuation',
    },
  },
  {
    label: 'Market',
    href: '/housing-market',
    columns: [
      {
        heading: 'Market data',
        links: [
          { label: 'Market overview', href: '/housing-market' },
          { label: 'Latest market report', href: '/housing-market/reports' },
          { label: 'Explore reports', href: '/housing-market/explore' },
          { label: 'Recent activity', href: '/activity' },
          { label: 'Price drops', href: '/price-drops' },
          { label: 'Neighborhood guides', href: '/area-guides' },
        ],
      },
      {
        heading: 'By city',
        links: [
          { label: 'Bend market', href: '/housing-market/bend' },
          { label: 'Redmond market', href: '/housing-market/redmond' },
          { label: 'Sisters market', href: '/housing-market/sisters' },
          { label: 'Central Oregon', href: '/housing-market/central-oregon' },
        ],
      },
    ],
    promo: {
      eyebrow: 'Market',
      title: 'Where the market stands',
      body: 'Current prices, inventory, and pace across the region.',
      ctaLabel: 'Latest report',
      ctaHref: '/housing-market/reports',
    },
  },
  {
    label: 'Guides',
    href: '/guides',
    columns: [
      {
        heading: 'Guides & answers',
        links: [
          { label: 'Buyer and seller guides', href: '/guides' },
          { label: 'Blog', href: '/blog' },
          { label: 'Frequently asked questions', href: '/faq' },
        ],
      },
      {
        heading: 'Tools',
        links: [
          { label: 'Mortgage calculator', href: '/tools/mortgage-calculator' },
          { label: 'Appreciation tool', href: '/tools/appreciation' },
          { label: 'Video tours', href: '/videos' },
        ],
      },
    ],
    promo: {
      eyebrow: 'Resources',
      title: 'Guides, tools, and answers',
      body: 'Free home tools plus buyer and seller guides.',
      ctaLabel: 'Browse guides',
      ctaHref: '/guides',
    },
  },
  {
    label: 'About',
    href: '/about',
    columns: [
      {
        heading: 'Ryan Realty',
        links: [
          { label: 'About Ryan Realty', href: '/about' },
          { label: 'Meet the team', href: '/team' },
          { label: 'Client reviews', href: '/reviews' },
        ],
      },
      {
        heading: 'Connect',
        links: [
          { label: 'Contact us', href: '/contact' },
          { label: 'Join the team', href: '/join' },
        ],
      },
    ],
    promo: {
      eyebrow: 'Ryan Realty',
      title: 'Talk to a local broker',
      body: 'Questions about buying or selling here? We are glad to help.',
      ctaLabel: 'Contact us',
      ctaHref: '/contact',
    },
  },
]
