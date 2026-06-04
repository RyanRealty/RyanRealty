/**
 * lib/site-menu.ts — the STATIC, serializable mega-menu config.
 *
 * One entry per top-level parent (Homes, Communities, Cities, Market, Sell,
 * Company, Learn). Each entry carries intent-grouped link columns plus a short
 * text "promo" (eyebrow + title + one line + a single CTA) that the editorial
 * mega-menu pins to the right edge of the full-width panel. The promo is what
 * keeps every panel balanced edge-to-edge — sparse parents (Sell, Company,
 * Learn) no longer strand a lone column in a wide empty bar. There are NO stats,
 * counts, sparklines, verdict pills, tiles, or photos here by design — this is
 * the approved clean "menu-B" direction (photos were explicitly removed).
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

// ─── Helpers (build-time only, fully static) ─────────────────────────────────

const bend = homesForSalePath('Bend') // "/homes-for-sale/bend"

/** A Bend preset search path, e.g. bendPreset('under-750k') -> /homes-for-sale/bend/under-750k */
function bendPreset(slug: string): string {
  return `${bend}/${slug}`
}

// ─── MENU ────────────────────────────────────────────────────────────────────

export const MENU: MenuEntry[] = [
  {
    label: 'Homes',
    href: '/homes-for-sale',
    columns: [
      {
        heading: 'Browse',
        links: [
          { label: 'All homes for sale', href: '/homes-for-sale' },
          { label: 'Map search', href: '/search' },
          { label: 'Open houses', href: '/open-houses' },
          { label: 'Compare homes', href: '/compare' },
        ],
      },
      {
        heading: 'By city',
        links: [
          { label: 'Bend', href: homesForSalePath('Bend') },
          { label: 'Redmond', href: homesForSalePath('Redmond') },
          { label: 'Sisters', href: homesForSalePath('Sisters') },
          { label: 'Sunriver', href: homesForSalePath('Sunriver') },
          { label: 'La Pine', href: homesForSalePath('La Pine') },
          { label: 'Prineville', href: homesForSalePath('Prineville') },
          { label: 'Terrebonne', href: homesForSalePath('Terrebonne') },
          { label: 'Powell Butte', href: homesForSalePath('Powell Butte') },
        ],
      },
      {
        heading: 'By price',
        links: [
          { label: 'Under $400K', href: bendPreset('under-400k') },
          { label: 'Under $500K', href: bendPreset('under-500k') },
          { label: 'Under $750K', href: bendPreset('under-750k') },
          { label: 'Under $1M', href: bendPreset('under-1m') },
          { label: 'Luxury ($1M+)', href: bendPreset('luxury') },
          { label: '$1.5M and up', href: bendPreset('over-1-5m') },
          { label: '$2M and up', href: bendPreset('over-2m') },
        ],
      },
      {
        heading: 'Lifestyle & views',
        links: [
          { label: 'On the golf course', href: bendPreset('on-golf-course') },
          { label: 'Mountain views', href: bendPreset('mountain-view') },
          { label: 'River views', href: bendPreset('river-view') },
          { label: 'Single level', href: bendPreset('single-level') },
          { label: 'Acreage (1+ acres)', href: bendPreset('acreage') },
          { label: '5+ acres', href: bendPreset('acreage-5') },
          { label: 'With a shop', href: bendPreset('with-shop') },
          { label: 'With a pool', href: bendPreset('with-pool') },
        ],
      },
      {
        heading: 'Type & status',
        links: [
          { label: 'New construction', href: bendPreset('new-construction') },
          { label: 'Condos', href: bendPreset('condos') },
          { label: 'Townhomes', href: bendPreset('townhomes') },
          { label: 'New this week', href: bendPreset('new-listings') },
          { label: 'New this month', href: bendPreset('new-listings-30') },
          { label: 'Pending', href: bendPreset('pending') },
        ],
      },
    ],
    promo: {
      eyebrow: 'Search',
      title: 'Find your place in Central Oregon',
      body: 'Browse every active listing or search the map.',
      ctaLabel: 'Open map search',
      ctaHref: '/search',
    },
  },
  {
    label: 'Communities',
    href: '/communities',
    columns: [
      {
        heading: 'Golf communities',
        links: [
          { label: 'Tetherow', href: '/communities/tetherow' },
          { label: 'Pronghorn', href: '/communities/pronghorn' },
          { label: 'Broken Top', href: '/communities/broken-top' },
          { label: 'Widgi Creek', href: '/communities/widgi-creek' },
          { label: 'Awbrey Glen', href: '/communities/awbrey-glen' },
        ],
      },
      {
        heading: 'Resort communities',
        links: [
          { label: 'Eagle Crest', href: '/communities/eagle-crest' },
          { label: 'Brasada Ranch', href: '/communities/brasada-ranch' },
          { label: 'Black Butte Ranch', href: '/communities/black-butte-ranch' },
          { label: 'Sunriver', href: '/communities/sunriver' },
          { label: 'Caldera Springs', href: '/communities/caldera-springs' },
          { label: 'Crosswater', href: '/communities/crosswater' },
        ],
      },
      {
        heading: 'Bend neighborhoods',
        links: [
          { label: 'NorthWest Crossing', href: '/communities/northwest-crossing' },
          { label: 'Awbrey Butte', href: '/communities/bend-awbrey-butte' },
          { label: 'Old Bend', href: '/communities/bend-old-bend' },
          { label: 'Old Mill District', href: '/communities/bend-old-mill-district' },
          { label: 'View all communities', href: '/communities' },
        ],
      },
    ],
    promo: {
      eyebrow: 'Explore',
      title: 'Resort and golf communities',
      body: 'Compare master-planned neighborhoods across the region.',
      ctaLabel: 'All communities',
      ctaHref: '/communities',
    },
  },
  {
    label: 'Cities',
    href: '/cities',
    columns: [
      {
        heading: 'Deschutes County',
        links: [
          { label: 'Bend', href: '/cities/bend' },
          { label: 'Redmond', href: '/cities/redmond' },
          { label: 'Sisters', href: '/cities/sisters' },
          { label: 'Sunriver', href: '/cities/sunriver' },
          { label: 'La Pine', href: '/cities/la-pine' },
        ],
      },
      {
        heading: 'Nearby areas',
        links: [
          { label: 'Prineville', href: '/cities/prineville' },
          { label: 'Terrebonne', href: '/cities/terrebonne' },
          { label: 'Powell Butte', href: '/cities/powell-butte' },
          { label: 'Madras', href: '/cities/madras' },
          { label: 'Culver', href: '/cities/culver' },
        ],
      },
      {
        heading: 'Browse',
        links: [
          { label: 'See every city we cover', href: '/cities' },
          { label: 'Homes by city', href: '/homes-for-sale' },
          { label: 'Market by city', href: '/housing-market' },
        ],
      },
    ],
    promo: {
      eyebrow: 'Coverage',
      title: 'Every city we cover',
      body: 'Local market data and homes for each Central Oregon city.',
      ctaLabel: 'See all cities',
      ctaHref: '/cities',
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
    label: 'Company',
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
  {
    label: 'Learn',
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
          { label: 'Video library', href: '/videos' },
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
]
