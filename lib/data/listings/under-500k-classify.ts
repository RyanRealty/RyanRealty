/**
 * Pure classification for the Central Oregon under-$500K hub.
 *
 * Query A (docs brief 2026-10-13): Active, PropertyType A, ListPrice < 500000.
 * Residential total is every PropertyType A row. The split columns are
 * single-family, condo+townhome, manufactured on land, and shared/leased-land
 * ownership. Lots, in-park manufactured, and other classes never enter.
 *
 * Per docs/DATABASE_FOR_AI_AGENTS.md §3: PropertyType A is the residential
 * bucket. Do not label lots as homes.
 */

export const UNDER_500K_PRICE_CAP = 500_000

/** Reciprocal door on each city /under-500k page. Exact anchor the brief named. */
export const UNDER_500K_HUB_HREF = '/buy/homes-under-500k-central-oregon'
export const UNDER_500K_HUB_ANCHOR = 'Compare homes under $500K across Central Oregon'

export const UNDER_500K_HEADLINE_TOWNS = [
  { slug: 'redmond', name: 'Redmond', cityLower: 'redmond' },
  { slug: 'bend', name: 'Bend', cityLower: 'bend' },
  { slug: 'la-pine', name: 'La Pine', cityLower: 'la pine' },
  { slug: 'prineville', name: 'Prineville', cityLower: 'prineville' },
] as const

export const UNDER_500K_FOOTNOTE_TOWNS = [
  { slug: 'sisters', name: 'Sisters', cityLower: 'sisters' },
  { slug: 'sunriver', name: 'Sunriver', cityLower: 'sunriver' },
] as const

export const UNDER_500K_TOWNS = [...UNDER_500K_HEADLINE_TOWNS, ...UNDER_500K_FOOTNOTE_TOWNS] as const

export type Under500kTownSlug = (typeof UNDER_500K_TOWNS)[number]['slug']

export type Under500kKind = 'sfr' | 'condoTownhome' | 'manufacturedOnLand' | 'sharedOrLeased' | 'otherResidential'

export type Under500kListingRow = {
  cityLower: string | null
  propertySubType: string | null
  listPrice: number | null
}

export type Under500kTownCounts = {
  slug: Under500kTownSlug
  name: string
  cityLower: string
  footnote: boolean
  residential: number
  sfr: number
  townhouse: number
  condo: number
  condoTownhome: number
  manufacturedOnLand: number
  sharedOrLeased: number
  otherResidential: number
  sfrMedianList: number | null
  sfrMedianN: number
}

function normalizeSubType(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

/** MLS property_sub_type → the hub's published split. Unknown A-types stay in the residential total. */
export function classifyResidentialSubType(subType: string | null | undefined): Under500kKind {
  const n = normalizeSubType(subType)
  if (n === 'single family residence') return 'sfr'
  if (n === 'townhouse' || n === 'condominium' || n === 'condo') return 'condoTownhome'
  if (n === 'manufactured on land') return 'manufacturedOnLand'
  if (n === 'tenancy in common' || n === 'residential leased land' || n === 'timeshare') {
    return 'sharedOrLeased'
  }
  return 'otherResidential'
}

export function isUnder500kResidential(row: Under500kListingRow): boolean {
  return row.listPrice != null && Number.isFinite(row.listPrice) && row.listPrice < UNDER_500K_PRICE_CAP
}

/** Ordered-set median. Even n averages the two middle values, matching percentile_cont(0.5). */
export function medianListPrice(values: readonly number[]): number | null {
  const xs = values.filter((n) => Number.isFinite(n) && n > 0).slice().sort((a, b) => a - b)
  if (xs.length === 0) return null
  const mid = Math.floor(xs.length / 2)
  if (xs.length % 2 === 1) return xs[mid] ?? null
  const a = xs[mid - 1]
  const b = xs[mid]
  if (a == null || b == null) return null
  return (a + b) / 2
}

function emptyTown(def: (typeof UNDER_500K_TOWNS)[number]): Under500kTownCounts {
  const footnote = UNDER_500K_FOOTNOTE_TOWNS.some((t) => t.slug === def.slug)
  return {
    slug: def.slug,
    name: def.name,
    cityLower: def.cityLower,
    footnote,
    residential: 0,
    sfr: 0,
    townhouse: 0,
    condo: 0,
    condoTownhome: 0,
    manufacturedOnLand: 0,
    sharedOrLeased: 0,
    otherResidential: 0,
    sfrMedianList: null,
    sfrMedianN: 0,
  }
}

export function aggregateUnder500kTowns(rows: readonly Under500kListingRow[]): Under500kTownCounts[] {
  const byLower = new Map<string, Under500kTownCounts>()
  const sfrPrices = new Map<string, number[]>()
  for (const def of UNDER_500K_TOWNS) {
    byLower.set(def.cityLower, emptyTown(def))
    sfrPrices.set(def.cityLower, [])
  }

  for (const row of rows) {
    const city = (row.cityLower ?? '').trim().toLowerCase()
    const town = byLower.get(city)
    if (!town) continue
    const price = row.listPrice
    if (classifyResidentialSubType(row.propertySubType) === 'sfr' && price != null && price > 0) {
      sfrPrices.get(city)?.push(price)
    }
    if (!isUnder500kResidential(row)) continue
    town.residential += 1
    const kind = classifyResidentialSubType(row.propertySubType)
    switch (kind) {
      case 'sfr':
        town.sfr += 1
        break
      case 'condoTownhome': {
        town.condoTownhome += 1
        const sub = normalizeSubType(row.propertySubType)
        if (sub === 'townhouse') town.townhouse += 1
        else town.condo += 1
        break
      }
      case 'manufacturedOnLand':
        town.manufacturedOnLand += 1
        break
      case 'sharedOrLeased':
        town.sharedOrLeased += 1
        break
      case 'otherResidential':
        town.otherResidential += 1
        break
      default: {
        const _never: never = kind
        void _never
      }
    }
  }

  return UNDER_500K_TOWNS.map((def) => {
    const town = byLower.get(def.cityLower) ?? emptyTown(def)
    const prices = sfrPrices.get(def.cityLower) ?? []
    return {
      ...town,
      sfrMedianList: medianListPrice(prices),
      sfrMedianN: prices.length,
    }
  })
}

export function headlineUnder500kTotals(towns: readonly Under500kTownCounts[]): {
  residential: number
  sfr: number
} {
  return towns
    .filter((t) => !t.footnote)
    .reduce(
      (acc, t) => ({ residential: acc.residential + t.residential, sfr: acc.sfr + t.sfr }),
      { residential: 0, sfr: 0 },
    )
}
