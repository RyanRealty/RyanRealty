/**
 * SITE-123 — Sep 7 AEO guide cluster, SEO Desk live list only.
 *
 * Human anchors are the published titles from
 * `scripts/blog-content/aeo-guides-2026-09.ts`. Do not invent slugs.
 * Omitted on purpose: `/blog/closing-costs-buyers-bend-oregon` (404, SITE-124)
 * and any buyer-broker slug that was not on the Desk list.
 *
 * reachability: imported by /buy, /sell, /neighborhoods, and
 * /housing-market/bend through V3Ledger / V3Quiet (44px tap floor).
 * Homepage SITE-125 consumes the unique tip-min union through
 * `aeoHubHomeStripDoors` → V3Answers layout="strip".
 */
import {
  v3Text,
  type V3AnswersDoor,
  type V3LedgerPlainRow,
  type V3QuietLink,
} from '@/components/site/v3'

export const AEO_HUB_GATE = 'ci:aeo-hub-guides'

export type AeoHubId = 'buy' | 'sell' | 'neighborhoods' | 'housing-market/bend'

export type AeoHubGuide = {
  readonly href: `/blog/${string}`
  readonly title: string
}

export const AEO_HUB_OMIT = ['/blog/closing-costs-buyers-bend-oregon'] as const

export const AEO_HUB_GUIDES: Record<AeoHubId, readonly AeoHubGuide[]> = {
  buy: [
    {
      href: '/blog/first-time-home-buyer-guide-central-oregon',
      title: 'First-Time Home Buyer Guide for Bend and Central Oregon',
    },
    {
      href: '/blog/cost-of-living-bend-oregon',
      title: 'Cost of Living in Bend, Oregon: Housing, Taxes, and a Realistic Budget',
    },
    {
      href: '/blog/best-neighborhoods-bend-buyers',
      title: 'Best Neighborhoods in Bend, Oregon for Buyers',
    },
    {
      href: '/blog/bend-vs-redmond-vs-sisters',
      title: 'Bend vs Redmond vs Sisters: Which Central Oregon Town Fits',
    },
    {
      href: '/blog/westside-vs-eastside-bend',
      title: 'Westside vs Eastside Bend: Price, Walkability, and Trade-offs',
    },
    {
      href: '/blog/moving-to-bend-from-california',
      title: 'Moving to Bend from California: What Changes',
    },
    {
      href: '/blog/is-now-a-good-time-to-buy-in-bend',
      title: 'Is Now a Good Time to Buy in Bend?',
    },
    {
      href: '/blog/property-taxes-deschutes-county',
      title: 'Property Taxes in Bend and Deschutes County, Explained',
    },
  ],
  sell: [
    {
      href: '/blog/how-to-sell-your-home-bend',
      title: 'How to Sell Your House in Bend, Oregon',
    },
    {
      href: '/blog/cost-to-sell-house-bend-oregon',
      title: 'What It Costs to Sell a House in Bend (and Oregon)',
    },
    {
      href: '/blog/how-to-price-your-bend-home',
      title: 'How to Price Your Bend Home So It Sells',
    },
    {
      href: '/blog/selling-your-bend-home-from-out-of-state',
      title: 'Selling Your Bend Home from Out of State',
    },
    {
      href: '/blog/property-taxes-deschutes-county',
      title: 'Property Taxes in Bend and Deschutes County, Explained',
    },
  ],
  neighborhoods: [
    {
      href: '/blog/best-neighborhoods-bend-buyers',
      title: 'Best Neighborhoods in Bend, Oregon for Buyers',
    },
    {
      href: '/blog/westside-vs-eastside-bend',
      title: 'Westside vs Eastside Bend: Price, Walkability, and Trade-offs',
    },
    {
      href: '/blog/bend-vs-redmond-vs-sisters',
      title: 'Bend vs Redmond vs Sisters: Which Central Oregon Town Fits',
    },
  ],
  'housing-market/bend': [
    {
      href: '/blog/is-now-a-good-time-to-buy-in-bend',
      title: 'Is Now a Good Time to Buy in Bend?',
    },
    {
      href: '/blog/cost-of-living-bend-oregon',
      title: 'Cost of Living in Bend, Oregon: Housing, Taxes, and a Realistic Budget',
    },
    {
      href: '/blog/property-taxes-deschutes-county',
      title: 'Property Taxes in Bend and Deschutes County, Explained',
    },
  ],
}

/** Tip Ready floors from SEO Desk. The gate still requires the full sealed list. */
export const AEO_HUB_TIP_MINS: Record<AeoHubId, readonly string[]> = {
  buy: [
    '/blog/first-time-home-buyer-guide-central-oregon',
    '/blog/cost-of-living-bend-oregon',
    '/blog/best-neighborhoods-bend-buyers',
    '/blog/bend-vs-redmond-vs-sisters',
  ],
  sell: ['/blog/how-to-sell-your-home-bend', '/blog/cost-to-sell-house-bend-oregon'],
  neighborhoods: [
    '/blog/best-neighborhoods-bend-buyers',
    '/blog/bend-vs-redmond-vs-sisters',
  ],
  'housing-market/bend': [
    '/blog/is-now-a-good-time-to-buy-in-bend',
    '/blog/cost-of-living-bend-oregon',
    '/blog/property-taxes-deschutes-county',
  ],
}

export function aeoHubLedgerRows(hub: AeoHubId): V3LedgerPlainRow[] {
  return AEO_HUB_GUIDES[hub].map((guide) => ({
    href: guide.href,
    what: v3Text(guide.title),
    id: guide.href.replace('/blog/', ''),
  }))
}

export function aeoHubQuietItems(hub: AeoHubId): V3QuietLink[] {
  return AEO_HUB_GUIDES[hub].map((guide) => ({
    kind: 'link',
    label: guide.title,
    href: guide.href,
  }))
}

const HOME_STRIP_HUBS = [
  { hub: 'buy', group: 'Buy' },
  { hub: 'sell', group: 'Sell' },
  { hub: 'neighborhoods', group: 'Neighborhoods' },
  { hub: 'housing-market/bend', group: 'Market' },
] as const satisfies readonly { hub: AeoHubId; group: string }[]

/**
 * Homepage ATF strip (SITE-125). Unique tip-min guides across the four hubs,
 * published titles only. Dedupes shared slugs so Best Neighborhoods is one
 * door, not three. Closing-costs stays omitted with the sealed list.
 */
export function aeoHubHomeStripDoors(): V3AnswersDoor[] {
  const seen = new Set<string>()
  const doors: V3AnswersDoor[] = []
  for (const { hub, group } of HOME_STRIP_HUBS) {
    for (const href of AEO_HUB_TIP_MINS[hub]) {
      if (seen.has(href)) continue
      const guide = AEO_HUB_GUIDES[hub].find((row) => row.href === href)
      if (!guide) continue
      seen.add(href)
      doors.push({ href: guide.href, label: guide.title, group })
    }
  }
  return doors
}
