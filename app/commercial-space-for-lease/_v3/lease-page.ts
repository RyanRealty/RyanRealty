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
  leaseRateOption,
  publishLeaseRate,
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
      rows: leaseRowsLargestFirst(town.rows),
      countLabel: `${formatCount(town.rows.length)} for lease`,
      rateSummary: publishLeaseRateSummary(
        town.rows.map((row) => ({ listPrice: row.price, rateOption: row.leaseRateOption ?? null })),
      ),
      cityHref: CITY_PAGES.has(slug) ? `/cities/${slug}` : null,
      places: town.places,
    }))
}

/** A row's listed size, or null when it lists none. */
function listedSqft(row: V3ListingRowData): number | null {
  return row.sqft != null && Number.isFinite(row.sqft) && row.sqft > 0 ? row.sqft : null
}

/**
 * The order a town's leases are shown in (2026-09-30, "the lead photo is a grey,
 * rain-soaked parking lot"): the leases whose rent publishes first (a lead card
 * that reads "Lease rate not published" tells a reader less), and within each
 * group the largest listed space first, the ones that list no size last. So
 * every dial opens on the biggest space whose rent it can print, a rule that
 * holds as listings come and go, never a hand-picked listing. Ties keep the
 * read's order (newest first).
 */
export function leaseRowsLargestFirst<T extends V3ListingRowData>(rows: readonly T[]): T[] {
  const bySize = (list: T[]): T[] =>
    list
      .map((row, i) => ({ row, i, size: listedSqft(row) }))
      .sort((a, b) => {
        if (a.size != null && b.size != null) return b.size - a.size || a.i - b.i
        if (a.size != null) return -1
        if (b.size != null) return 1
        return a.i - b.i
      })
      .map(({ row }) => row)
  // leaseRowsRatesFirst's own split (the place page's lease section uses it),
  // then size inside each half.
  const ordered = leaseRowsRatesFirst(rows)
  const priced = ordered.filter(leaseRentPublishes)
  const withheld = ordered.filter((row) => !leaseRentPublishes(row))
  return [...bySize(priced), ...bySize(withheld)]
}

/** The same test leaseRowsRatesFirst applies: the card prints a rent with its unit. */
function leaseRentPublishes(row: V3ListingRowData): boolean {
  return Boolean(
    publishListingLeaseFigure({
      price: row.price,
      propertyType: row.propertyType,
      leaseRateOption: row.leaseRateOption ?? null,
    })?.rate,
  )
}

/** The square feet a town's leases list between them, and how many list a size. */
export function leaseTownSize(rows: readonly V3ListingRowData[]): { sqft: number; sized: number } {
  let sqft = 0
  let sized = 0
  for (const row of rows) {
    const size = listedSqft(row)
    if (size == null) continue
    sqft += size
    sized += 1
  }
  return { sqft, sized }
}

/**
 * A town's largest listed space, by the size its listing files, or null when
 * none lists a size: the drawer row's picture and its "largest space" line.
 */
export function leaseTownLargest(
  group: LeaseCityGroup,
): { row: V3ListingRowData; sqft: number; photo: string | null } | null {
  let best: { row: V3ListingRowData; sqft: number } | null = null
  for (const row of group.rows) {
    const size = listedSqft(row)
    if (size == null) continue
    if (!best || size > best.sqft) best = { row, sqft: size }
  }
  if (!best) return null
  const photo = best.row.photoUrl?.trim()
  return { ...best, photo: photo ? listingRowPhotoSrc(photo) : null }
}

/** The one rent unit the drawer's strips plot: a monthly rate per square foot. */
export const LEASE_STRIP_UNIT = '$/SF/Mo' as const

export type LeaseStripDot = {
  key: string
  /** The rent, per sq ft per month, as the listing files it. */
  rate: number
  /** Position on the shared axis, 0 to 100 (percent of the strip). */
  x: number
  /** Diameter in rem: the listed size, by area; null when it lists none (a ring). */
  d: number | null
}

export type LeaseStripModel = {
  /** The axis end, dollars per sq ft per month (the largest plotted rent, up to the next half dollar). */
  max: number
  /** Whole-dollar ticks inside the axis, with their position. */
  ticks: Array<{ value: number; x: number; label: string }>
  /** Each town's plotted leases, by the town's slug. */
  dots: Record<string, LeaseStripDot[]>
}

/** The strip's dot, in rem: the smallest listed space and the largest. */
export const LEASE_STRIP_D_MIN = 0.5
export const LEASE_STRIP_D_MAX = 1.25
export const LEASE_STRIP_D_UNSIZED = 0.625

/**
 * The drawer's rent strips (2026-09-30, "the drawer rows read as one repeated
 * shape"): every town in the drawer on ONE axis of asking rent per sq ft per
 * month, each lease a dot at its own rent, drawn to its listed size by area
 * (the map's encoding), a ring when it lists none. Only rents filed per sq ft
 * per month and that publish are plotted; a monthly amount for a whole space,
 * a yearly rate, or a rate that does not publish is never converted onto the
 * axis. The words beside the strip (the town's rate line) count every lease.
 * Null when no town has a rent to plot.
 */
export function leaseRentStrips(groups: readonly LeaseCityGroup[]): LeaseStripModel | null {
  const plotted: Array<{ slug: string; key: string; rate: number; sqft: number | null }> = []
  for (const group of groups) {
    for (const row of group.rows) {
      if (leaseRateOption(row.leaseRateOption) !== LEASE_STRIP_UNIT) continue
      if (publishLeaseRate({ listPrice: row.price, rateOption: row.leaseRateOption ?? null }) == null) continue
      plotted.push({ slug: group.slug, key: row.listingKey, rate: row.price as number, sqft: listedSqft(row) })
    }
  }
  if (plotted.length === 0) return null
  const top = Math.max(...plotted.map((p) => p.rate))
  const max = Math.max(0.5, Math.ceil(top * 2) / 2)
  const sizes = plotted.map((p) => p.sqft).filter((n): n is number => n != null)
  const lo = sizes.length > 0 ? Math.min(...sizes) : 0
  const hi = sizes.length > 0 ? Math.max(...sizes) : 0
  const diameter = (sqft: number | null): number | null => {
    if (sqft == null) return null
    if (hi <= lo) return (LEASE_STRIP_D_MIN + LEASE_STRIP_D_MAX) / 2
    const t = (Math.sqrt(sqft) - Math.sqrt(lo)) / (Math.sqrt(hi) - Math.sqrt(lo))
    return Number((LEASE_STRIP_D_MIN + t * (LEASE_STRIP_D_MAX - LEASE_STRIP_D_MIN)).toFixed(3))
  }
  const dots: Record<string, LeaseStripDot[]> = {}
  for (const p of plotted) {
    ;(dots[p.slug] ??= []).push({
      key: p.key,
      rate: p.rate,
      x: Number(((p.rate / max) * 100).toFixed(2)),
      d: diameter(p.sqft),
    })
  }
  const ticks: LeaseStripModel['ticks'] = []
  for (let value = 1; value < max; value += 1) {
    ticks.push({ value, x: Number(((value / max) * 100).toFixed(2)), label: `$${value}` })
  }
  return { max, ticks, dots }
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
  return `${spaces} in ${formatCount(groups.length)} more towns, busiest first. Each dot is one space's asking rent per sq ft per month, drawn to its size, on one scale for every town. Open a town for its spaces, each with its rent and its terms.`
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
  /** The square feet its leases list, as a share of the town that lists the most (the line under the bar). */
  also?: { weight: number; value: string }
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
  const sizes = new Map(groups.map((group) => [group.slug, leaseTownSize(group.rows)]))
  const mostSqft = Math.max(0, ...[...sizes.values()].map((size) => size.sqft))
  return groups.map((group) => ({
    href: `#${group.anchor}`,
    what: group.label,
    value: group.countLabel,
    weight: most > 0 ? group.rows.length / most : 0,
    // The second measure (2026-09-30, "the bars are flat"): the square feet
    // the town's spaces list, on its own scale. A town none of whose spaces
    // lists a size draws no line and prints no figure, never a zero.
    ...(() => {
      const size = sizes.get(group.slug)!
      return size.sized > 0 && mostSqft > 0
        ? { also: { weight: size.sqft / mostSqft, value: `${formatCount(size.sqft)} sq ft` } }
        : {}
    })(),
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
  const where = groups.length === 1 ? top.label : towns
  // The floor the spaces list between them, and how many list none, so the
  // sum never reads as every space's size (2026-09-30: the second measure).
  const size = leaseTownSize(groups.flatMap((group) => group.rows))
  const unsized = total - size.sized
  const floor =
    size.sized > 0
      ? `, ${formatCount(size.sqft)} sq ft listed between them${
          unsized > 0 ? ` (${formatCount(unsized)} ${unsized === 1 ? 'lists' : 'list'} no size)` : ''
        }`
      : ''
  return `${spaces} in ${where}${floor}.`
}

/**
 * The key over the town bars: the count is the bar, the listed square feet the
 * line under it, each on its own scale. No line, no second key.
 */
export function leaseLedgerKey(groups: readonly LeaseCityGroup[]): { value: string; also?: string } {
  const anySized = groups.some((group) => leaseTownSize(group.rows).sized > 0)
  return anySized
    ? { value: 'Spaces for lease', also: 'Square feet listed' }
    : { value: 'Spaces for lease' }
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
