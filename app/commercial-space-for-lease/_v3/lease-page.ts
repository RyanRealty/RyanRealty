/**
 * /commercial-space-for-lease: the pure half. Grouping the leases by town, the
 * town ledger's rows, the ItemList, and the meta description, so the unit suite
 * holds them without a server.
 *
 * Every figure on the page is a row's own: a count of the leases grouped here,
 * a lease's rent with its unit (publishLeaseRate), and a town's span of the
 * per-square-foot monthly rents its own cards print (publishLeaseRateRange).
 * Nothing is converted between units and nothing is estimated (CLAUDE.md
 * section 0). A lease is never an Offer: the ItemList names each listing and
 * its rent in words, with no price property.
 */
import type { LeaseRateOptionsByKey, ListingTile } from '@/lib/data'
import type { V3ListingRowData } from '@/components/site/v3/V3ListingRow'
import { CENTRAL_OREGON_CITY_SLUGS, SITE_CITY_SLUGS, citySlugForScope } from '@/lib/central-oregon'
import { formatCount } from '@/lib/format/count'
import { listingPriceIsLeaseRate } from '@/lib/listing/publish-listing-figure'
import {
  LEASE_RATE_NOT_PUBLISHED,
  publishLeaseRateRange,
  publishListingLeaseFigure,
} from '@/lib/listing/publish-lease-rate'
import { leaseRowsRatesFirst, placeLeaseRowFromTile } from '@/lib/place/place-lease-stock'

export const LEASE_PAGE_HEADING = 'Commercial space for lease in Central Oregon'

export type LeaseCityGroup = {
  /** Route-style slug of the MLS City ("bend", "powell-butte"). */
  slug: string
  /** The MLS City as the feed spells it ("Powell Butte"). */
  label: string
  /** The town's section id on this page. */
  anchor: string
  rows: V3ListingRowData[]
  /** "13 for lease". */
  countLabel: string
  /** "$0.90 to $2.50 per sq ft per month", from this town's own cards; null when none prints per sq ft per month. */
  perSqftMonthRange: string | null
  /** The town's own place page, when it has one. */
  cityHref: string | null
}

const CITY_RANK: ReadonlyMap<string, number> = new Map(
  [...CENTRAL_OREGON_CITY_SLUGS].map((slug, i) => [slug, i]),
)
const CITY_PAGES: ReadonlySet<string> = new Set(SITE_CITY_SLUGS)

/**
 * The leases grouped by MLS City, towns in the site's own order (Bend first),
 * each lease once. A town with no lease is absent, never an empty section.
 */
export function leaseCityGroups(
  tiles: readonly ListingTile[],
  rateOptions: Readonly<LeaseRateOptionsByKey>,
): LeaseCityGroup[] {
  const seen = new Set<string>()
  const byTown = new Map<string, { label: string; rows: V3ListingRowData[] }>()
  for (const tile of tiles) {
    if (!tile.listingKey || seen.has(tile.listingKey)) continue
    if (!listingPriceIsLeaseRate(tile.propertyType)) continue
    const label = tile.city?.trim()
    if (!label) continue
    const row = placeLeaseRowFromTile(tile, rateOptions)
    if (!row) continue
    seen.add(tile.listingKey)
    const slug = citySlugForScope(label)
    const town = byTown.get(slug) ?? { label, rows: [] }
    town.rows.push(row)
    byTown.set(slug, town)
  }
  return [...byTown.entries()]
    .sort(([a, ta], [b, tb]) => {
      const ra = CITY_RANK.get(a) ?? Number.MAX_SAFE_INTEGER
      const rb = CITY_RANK.get(b) ?? Number.MAX_SAFE_INTEGER
      return ra !== rb ? ra - rb : ta.label.localeCompare(tb.label)
    })
    .map(([slug, town]) => ({
      slug,
      label: town.label,
      anchor: `lease-${slug}`,
      rows: leaseRowsRatesFirst(town.rows),
      countLabel: `${formatCount(town.rows.length)} for lease`,
      perSqftMonthRange: publishLeaseRateRange(
        town.rows.map((row) => ({ listPrice: row.price, rateOption: row.leaseRateOption ?? null })),
        '$/SF/Mo',
      ),
      cityHref: CITY_PAGES.has(slug) ? `/cities/${slug}` : null,
    }))
}

export type LeaseLedgerRow = {
  href: string
  what: string
  value: string
  /** This town's lease count over the largest town's, 0 to 1. */
  weight: number
  detail?: string
}

/** One row per town: its count as a length, its per-square-foot span under the name. */
export function leaseCityLedgerRows(groups: readonly LeaseCityGroup[]): LeaseLedgerRow[] {
  const most = Math.max(0, ...groups.map((g) => g.rows.length))
  return groups.map((group) => ({
    href: `#${group.anchor}`,
    what: group.label,
    value: group.countLabel,
    weight: most > 0 ? group.rows.length / most : 0,
    ...(group.perSqftMonthRange ? { detail: group.perSqftMonthRange } : {}),
  }))
}

/** How many leases the page lists, across every town. */
export function leaseTotal(groups: readonly LeaseCityGroup[]): number {
  return groups.reduce((sum, group) => sum + group.rows.length, 0)
}

/** The ItemList's cap: every Central Oregon lease on 2026-09-23 (36) fits. */
export const LEASE_ITEM_LIST_CAP = 60

/**
 * The machine-readable list: each lease named with its street, town and rent in
 * words, pointing at its own page. No Offer and no price property: a rent is
 * not a sale price (listing JSON-LD, 735 Purcell Boulevard).
 */
export function leaseItemList(
  groups: readonly LeaseCityGroup[],
  siteUrl: string,
): { type: 'itemList'; name: string; items: Array<{ name: string; url: string }> } | null {
  const items = groups
    .flatMap((group) =>
      group.rows.map((row) => {
        const lease = publishListingLeaseFigure(
          { price: row.price, propertyType: row.propertyType, leaseRateOption: row.leaseRateOption ?? null },
          'long',
        )
        const rent = lease?.rate ? `for lease at ${lease.rate}` : `for lease, ${LEASE_RATE_NOT_PUBLISHED.toLowerCase()}`
        return {
          name: `${row.addressLine}, ${group.label} · ${rent}`,
          url: row.href.startsWith('http') ? row.href : `${siteUrl}${row.href}`,
        }
      }),
    )
    .slice(0, LEASE_ITEM_LIST_CAP)
  if (items.length === 0) return null
  return { type: 'itemList', name: LEASE_PAGE_HEADING, items }
}

function townList(labels: readonly string[]): string {
  if (labels.length <= 1) return labels[0] ?? ''
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`
  return `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`
}

/** The meta description budget (lib/site/page-metadata.ts MAX_DESC). */
export const LEASE_META_MAX = 155

/**
 * The search snippet, from the towns that have a lease today, busiest first,
 * so it never names a town with nothing listed. It names as many towns as fit
 * the snippet budget whole, rather than letting the tail be cut mid-sentence.
 */
export function leaseMetaDescription(groups: readonly LeaseCityGroup[]): string {
  const towns = [...groups]
    .sort((a, b) => b.rows.length - a.rows.length || a.label.localeCompare(b.label))
    .map((g) => g.label)
  if (towns.length === 0) {
    return 'Commercial space for lease in Central Oregon from the regional MLS, each with its asking rent. Talk to a Ryan Realty broker about what you need.'
  }
  for (let n = Math.min(5, towns.length); n >= 1; n -= 1) {
    const text = `Commercial space for lease in ${townList(towns.slice(0, n))}, each with its asking rent and unit from the regional MLS. Talk to a Ryan Realty broker.`
    if (text.length <= LEASE_META_MAX) return text
  }
  return `Commercial space for lease in ${towns[0]}, each with its asking rent and unit from the regional MLS.`
}
