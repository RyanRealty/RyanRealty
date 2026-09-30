/**
 * /commercial-space-for-lease: the pure half. Grouping the leases by town, the
 * town ledger's rows, the ItemList, and the meta description, so the unit suite
 * holds them without a server.
 *
 * Every figure on the page is a row's own: a count of the leases grouped here,
 * a lease's rent with its unit (publishLeaseRate), and a town's rate line
 * (publishLeaseRateSummary), which covers every lease the town's count covers:
 * a span per rent unit with how many leases use it, and how many rates are not
 * published. Nothing is converted between units and nothing is estimated
 * (CLAUDE.md section 0). A lease is never an Offer: the ItemList names each listing and
 * its rent in words, with no price property.
 */
import type { LeaseRateOptionsByKey, LeaseTermsByKey, ListingTile } from '@/lib/data'
import type { V3ListingRowData } from '@/components/site/v3/V3ListingRow'
import { CENTRAL_OREGON_CITY_SLUGS, SITE_CITY_SLUGS, citySlugForScope } from '@/lib/central-oregon'
import { formatCount } from '@/lib/format/count'
import { listingRowPhotoSrc } from '@/lib/listing/row-photo'
import { listingPriceIsLeaseRate } from '@/lib/listing/publish-listing-figure'
import {
  LEASE_RATE_NOT_PUBLISHED,
  publishLeaseRateSummary,
  publishListingLeaseFigure,
} from '@/lib/listing/publish-lease-rate'
import { leaseRowsRatesFirst, placeLeaseRowFromTile } from '@/lib/place/place-lease-stock'
import type { LeaseMapPoint, LeaseMapTownInput } from './lease-map'

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
  /**
   * Every lease in the town, by the rent its own card prints: "$0.29 to $0.85
   * per sq ft per month" when they share one unit, else each unit's span with
   * its count and the count not published ("2 from $0.75 to $0.85 per sq ft
   * per month · 1 at $750 per month · 1 rate not published").
   */
  rateSummary: string | null
  /** The town's own place page, when it has one. */
  cityHref: string | null
  /** Each lease's coordinates as its listing files them, for the map; a lease without them is absent. */
  places: ReadonlyArray<{ listingKey: string; lat: number; lng: number }>
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
  /** The lease's terms (getLeaseTerms), printed on its dial card; absent prints none. */
  leaseTerms: Readonly<LeaseTermsByKey> = {},
): LeaseCityGroup[] {
  const seen = new Set<string>()
  const byTown = new Map<
    string,
    { label: string; rows: V3ListingRowData[]; places: Array<{ listingKey: string; lat: number; lng: number }> }
  >()
  for (const tile of tiles) {
    if (!tile.listingKey || seen.has(tile.listingKey)) continue
    if (!listingPriceIsLeaseRate(tile.propertyType)) continue
    const label = tile.city?.trim()
    if (!label) continue
    const base = placeLeaseRowFromTile(tile, rateOptions)
    if (!base) continue
    const terms = leaseTerms[tile.listingKey] ?? []
    const row: V3ListingRowData = terms.length > 0 ? { ...base, leaseTerms: terms } : base
    seen.add(tile.listingKey)
    const slug = citySlugForScope(label)
    const town = byTown.get(slug) ?? { label, rows: [], places: [] }
    town.rows.push(row)
    if (tile.lat != null && tile.lng != null && Number.isFinite(tile.lat) && Number.isFinite(tile.lng)) {
      town.places.push({ listingKey: tile.listingKey, lat: tile.lat, lng: tile.lng })
    }
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
      rateSummary: publishLeaseRateSummary(
        town.rows.map((row) => ({ listPrice: row.price, rateOption: row.leaseRateOption ?? null })),
      ),
      cityHref: CITY_PAGES.has(slug) ? `/cities/${slug}` : null,
      places: town.places,
    }))
}

/**
 * A town opened in the drawer shows its leases on a dial at this many; fewer
 * read faster as rows, every one in view at once.
 */
export const LEASE_DIAL_MIN = 5

/**
 * The page's two tiers (2026-09-30, "every town is the same dial block"): the
 * busiest town leads on its own full dial, and every other town is one row of
 * a drawer, busiest first, that opens to its own leases on demand. A market is
 * browsed from its biggest town down, not read as a stack of equal blocks.
 */
export function leaseTownTiers(groups: readonly LeaseCityGroup[]): {
  lead: LeaseCityGroup | null
  rest: LeaseCityGroup[]
} {
  if (groups.length === 0) return { lead: null, rest: [] }
  const order = new Map(groups.map((group, i) => [group, i]))
  const ranked = [...groups].sort(
    (a, b) => b.rows.length - a.rows.length || order.get(a)! - order.get(b)!,
  )
  return { lead: ranked[0]!, rest: ranked.slice(1) }
}

/** The drawer's heading: its towns by name, which is what a search asks for. */
export function leaseCompactHeading(groups: readonly LeaseCityGroup[]): string {
  return `Also for lease in ${townList(groups.map((g) => g.label))}`
}

/** One sentence under it: how many spaces, in how many towns, and how to open one. */
export function leaseCompactNote(groups: readonly LeaseCityGroup[]): string {
  const total = leaseTotal(groups)
  const spaces = `${formatCount(total)} ${total === 1 ? 'space' : 'spaces'}`
  if (groups.length === 1) return `${spaces} in ${groups[0]!.label}, each with its rent and its terms.`
  return `${spaces} in ${formatCount(groups.length)} more towns, busiest first. Open a town for its spaces, each with its rent and its terms.`
}

/** Up to four of a town's own photographs, for its drawer row. */
export function leaseTownThumbs(
  group: LeaseCityGroup,
  max = 4,
): Array<{ key: string; src: string; alt: string }> {
  const out: Array<{ key: string; src: string; alt: string }> = []
  for (const row of group.rows) {
    const photo = row.photoUrl?.trim()
    if (!photo) continue
    out.push({ key: row.listingKey, src: listingRowPhotoSrc(photo), alt: '' })
    if (out.length >= max) break
  }
  return out
}

/** The rent as a card prints it, unit and all, or "Lease rate not published". */
function leaseRentText(row: V3ListingRowData): string {
  const lease = publishListingLeaseFigure({
    price: row.price,
    propertyType: row.propertyType,
    leaseRateOption: row.leaseRateOption ?? null,
  })
  return lease?.text ?? LEASE_RATE_NOT_PUBLISHED
}

/**
 * The map's dots: every lease with coordinates, labelled in the card's own
 * words (street, rent with its unit, listed size), paired with its town's
 * ledger row by order.
 */
export function leaseMapPoints(groups: readonly LeaseCityGroup[]): LeaseMapPoint[] {
  const out: LeaseMapPoint[] = []
  groups.forEach((group, i) => {
    const byKey = new Map(group.rows.map((row) => [row.listingKey, row]))
    for (const place of group.places) {
      const row = byKey.get(place.listingKey)
      if (!row) continue
      const size = row.sqft != null && row.sqft > 0 ? `${formatCount(row.sqft)} sq ft` : null
      out.push({
        key: place.listingKey,
        href: row.href,
        lat: place.lat,
        lng: place.lng,
        sqft: row.sqft != null && row.sqft > 0 ? row.sqft : null,
        town: group.slug,
        row: i + 1,
        label: [row.addressLine, leaseRentText(row), size].filter(Boolean).join(' · '),
      })
    }
  })
  return out
}

/** The map's town names: the ledger's own count, and the same door the row is. */
export function leaseMapTowns(groups: readonly LeaseCityGroup[]): LeaseMapTownInput[] {
  return groups.map((group, i) => ({
    slug: group.slug,
    label: group.label,
    countLabel: group.countLabel,
    href: `#${group.anchor}`,
    row: i + 1,
  }))
}

export type LeaseLedgerRow = {
  href: string
  what: string
  value: string
  /** This town's lease count over the largest town's, 0 to 1. */
  weight: number
  detail?: string
  /** What a hover on the row reveals: the kinds of space and their sizes. */
  reveal?: string
  /** One of the town's own leases, photographed: the row's picture, named. */
  media?: { src: string; alt: string }
}

/**
 * The line a hover on a town's row reveals (2026-09-29: "no hover on the
 * bars"): what kinds of space its leases are, most first, and the span of
 * their listed sizes. Every figure is a count or a size off the rows the dial
 * under it shows; a kind or a size a row does not carry is not guessed.
 */
export function leaseTownReveal(rows: readonly V3ListingRowData[]): string | null {
  const kinds = new Map<string, number>()
  for (const row of rows) {
    const kind = row.propertySubType?.trim()
    if (kind) kinds.set(kind, (kinds.get(kind) ?? 0) + 1)
  }
  const kindLine = [...kinds.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([kind, n]) => `${kind} ${formatCount(n)}`)
    .join(' · ')
  const sizes = rows
    .map((row) => row.sqft)
    .filter((n): n is number => n != null && Number.isFinite(n) && n > 0)
  let sizeLine = ''
  if (sizes.length > 0) {
    const lo = Math.min(...sizes)
    const hi = Math.max(...sizes)
    sizeLine =
      lo === hi
        ? `${formatCount(lo)} sq ft`
        : `${formatCount(lo)} to ${formatCount(hi)} sq ft`
    if (sizes.length < rows.length) {
      sizeLine += ` (${formatCount(sizes.length)} ${sizes.length === 1 ? 'lists' : 'list'} a size)`
    }
  }
  const line = [kindLine, sizeLine].filter(Boolean).join('; ')
  return line || null
}

/** One row per town: its count as a length, its rate line (every lease in it) under the name. */
export function leaseCityLedgerRows(groups: readonly LeaseCityGroup[]): LeaseLedgerRow[] {
  const most = Math.max(0, ...groups.map((g) => g.rows.length))
  return groups.map((group) => ({
    href: `#${group.anchor}`,
    what: group.label,
    value: group.countLabel,
    weight: most > 0 ? group.rows.length / most : 0,
    // One unit to a line (2026-09-25): a per-sq-ft span and a whole-space
    // rent in one sentence asked the reader to convert between them. The
    // figures and their counts are publishLeaseRateSummary's, unchanged.
    ...(group.rateSummary ? { detail: group.rateSummary.split(' · ').join('\n') } : {}),
    ...(() => {
      const reveal = leaseTownReveal(group.rows)
      return reveal ? { reveal } : {}
    })(),
    // The town's first photographed lease, at the row-thumb size, so the
    // ledger that opens the page shows the space and not only its count
    // (2026-09-29: a first screen of text and bars).
    ...(() => {
      const pictured = group.rows.find((row) => row.photoUrl?.trim())
      const photo = pictured?.photoUrl?.trim()
      return pictured && photo
        ? {
            media: {
              src: listingRowPhotoSrc(photo),
              alt: `${pictured.addressLine}, commercial space for lease in ${group.label}`,
            },
          }
        : {}
    })(),
  }))
}

/**
 * The ledger's claim and its scale, in one sentence (2026-09-29: "the bars
 * carry no max-value reference"): how many leases in how many towns, and the
 * bar every other is measured against. Counts are the groups' own rows.
 */
export function leaseLedgerNote(groups: readonly LeaseCityGroup[]): string | null {
  if (groups.length === 0) return null
  const total = leaseTotal(groups)
  const top = [...groups].sort((a, b) => b.rows.length - a.rows.length || a.label.localeCompare(b.label))[0]!
  const spaces = `${formatCount(total)} ${total === 1 ? 'space' : 'spaces'} for lease`
  const towns = `${formatCount(groups.length)} ${groups.length === 1 ? 'town' : 'towns'}`
  if (groups.length === 1) return `${spaces} in ${top.label}.`
  return `${spaces} in ${towns}. Each bar is a town's count on one scale; the longest is ${top.label}'s ${formatCount(top.rows.length)}.`
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
