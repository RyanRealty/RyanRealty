/**
 * lib/site-menu.ts — the STATIC, serializable mega-menu config.
 *
 * One entry per top-level parent (Homes, Communities, Cities, Market, Sell,
 * Company, Learn). Each entry carries the intent-grouped link columns and an
 * optional editorial featured card (one photo + caption + CTA) that the clean
 * editorial mega-menu renders. There are NO stats, counts, sparklines, verdict
 * pills, or tiles here by design — this is the approved "menu-B" direction.
 *
 * Single source of truth for nav structure remains lib/site-nav.ts (PRIMARY_NAV
 * drives the reachability gate). This file is the DISPLAY layer for the desktop
 * panels and the mobile accordion. Every href below is grounded in a real route:
 *   - /homes-for-sale + homesForSalePath(city) + preset paths (app/search/[...slug])
 *   - /communities + /communities/<slug> (app/communities/[slug])
 *   - /cities + /cities/<slug> (app/cities/[slug])
 *   - /housing-market + its sub-routes (app/housing-market/*)
 *   - /sell, /sell/valuation (app/sell/*)
 *   - /team, /about, /contact, /reviews, /join (real pages)
 *   - /guides, /blog, /faq, /videos, /resources, /tools/* (real pages)
 *
 * Featured images live under public/ and are verified to exist.
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

export type MenuFeatured = {
  /** Omit to render a clean navy block with just the CTA (used for Market). */
  imageSrc?: string
  alt: string
  caption: string
  ctaLabel: string
  ctaHref: string
}

export type MenuEntry = {
  label: string
  href: string
  columns: MenuColumn[]
  featured?: MenuFeatured
}

// ─── Helpers (build-time only, fully static) ─────────────────────────────────

const bend = homesForSalePath('Bend') // "/homes-for-sale/bend"

/** A Bend preset search path, e.g. preset('under-750k') -> /homes-for-sale/bend/under-750k */
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
        heading: 'Popular searches',
        links: [
          { label: 'Under $750K', href: bendPreset('under-750k') },
          { label: 'Luxury homes', href: bendPreset('luxury') },
          { label: 'New construction', href: bendPreset('new-construction') },
          { label: 'On golf course', href: bendPreset('on-golf-course') },
          { label: 'Acreage', href: bendPreset('acreage') },
          { label: 'Single level', href: bendPreset('single-level') },
        ],
      },
    ],
    featured: {
      imageSrc: '/lp/central-oregon-golf/img/bend-cascades-01.jpg',
      alt: 'Homes across Central Oregon with the Cascade peaks behind Bend',
      caption: 'Homes across Central Oregon',
      ctaLabel: 'Browse all homes',
      ctaHref: '/homes-for-sale',
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
    featured: {
      imageSrc: '/lp/central-oregon-golf/img/tetherow-hero.jpg',
      alt: 'Tetherow golf community in Bend, Oregon',
      caption: 'Tetherow, Bend',
      ctaLabel: 'Explore Tetherow',
      ctaHref: '/communities/tetherow',
    },
  },
  {
    label: 'Cities',
    href: '/cities',
    columns: [
      {
        heading: 'Central Oregon cities',
        links: [
          { label: 'Bend', href: '/cities/bend' },
          { label: 'Redmond', href: '/cities/redmond' },
          { label: 'Sisters', href: '/cities/sisters' },
          { label: 'Sunriver', href: '/cities/sunriver' },
          { label: 'La Pine', href: '/cities/la-pine' },
          { label: 'Prineville', href: '/cities/prineville' },
          { label: 'Terrebonne', href: '/cities/terrebonne' },
          { label: 'Powell Butte', href: '/cities/powell-butte' },
          { label: 'Madras', href: '/cities/madras' },
          { label: 'Culver', href: '/cities/culver' },
          { label: 'See every city we cover', href: '/cities' },
        ],
      },
    ],
    featured: {
      imageSrc: '/lp/central-oregon-golf/img/three-sisters-backdrop.jpg',
      alt: 'The Three Sisters peaks above Central Oregon',
      caption: 'Central Oregon, end to end',
      ctaLabel: 'See every city',
      ctaHref: '/cities',
    },
  },
  {
    label: 'Market',
    href: '/housing-market',
    columns: [
      {
        heading: 'Housing market',
        links: [
          { label: 'Market overview', href: '/housing-market' },
          { label: 'Latest market report', href: '/housing-market/reports' },
          { label: 'Explore reports', href: '/housing-market/explore' },
          { label: 'Recent activity', href: '/activity' },
          { label: 'Neighborhood guides', href: '/area-guides' },
        ],
      },
    ],
    featured: {
      // No image — a clean navy block per the mockup's Market panel.
      alt: 'Central Oregon housing market',
      caption: 'Where the market stands right now',
      ctaLabel: 'See the latest',
      ctaHref: '/housing-market',
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
          { label: 'Our current listings', href: '/our-homes' },
          { label: 'Seller guides', href: '/guides' },
          { label: 'Recently sold', href: '/homes-for-sale?status=Sold' },
        ],
      },
    ],
  },
  {
    label: 'Company',
    href: '/about',
    columns: [
      {
        heading: 'Ryan Realty',
        links: [
          { label: 'Meet the team', href: '/team' },
          { label: 'About Ryan Realty', href: '/about' },
          { label: 'Contact us', href: '/contact' },
          { label: 'Client reviews', href: '/reviews' },
          { label: 'Join the team', href: '/join' },
        ],
      },
    ],
  },
  {
    label: 'Learn',
    href: '/guides',
    columns: [
      {
        heading: 'Guides and tools',
        links: [
          { label: 'Buyer and seller guides', href: '/guides' },
          { label: 'Blog', href: '/blog' },
          { label: 'Frequently asked questions', href: '/faq' },
          { label: 'Mortgage calculator', href: '/tools/mortgage-calculator' },
          { label: 'Appreciation tool', href: '/tools/appreciation' },
          { label: 'Video library', href: '/videos' },
        ],
      },
    ],
  },
]
