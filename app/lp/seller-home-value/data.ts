/**
 * Data fetchers for the seller LP. Server-only. Reuses the existing
 * Supabase service client + market-stats patterns so the same data the
 * rest of the platform sees is what shows on the page — never invented.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { getLiveMarketPulse } from '@/app/actions/market-stats'
import { TESTIMONIALS, type Testimonial } from '@/lib/testimonials'

export type BendMarketSnapshot = {
  medianListPrice: number | null
  activeCount: number | null
  newCount30d: number | null
  marketHealthLabel: string | null
}

/** A single Ryan Realty listing card for the LP social-proof grid. */
export type OurListing = {
  /** Stable React key. */
  key: string
  /** Photo URL — either a Spark MLS CDN or a local /public asset. */
  photoUrl: string
  /** "56628 Sunstone Loop" */
  addressLine: string
  /** Sub-label: neighborhood or context. */
  neighborhood: string | null
  /** Soft status pill. */
  badge: 'Featured' | 'Currently Listed' | 'Sold' | 'Represented'
  /** Whether to render with marquee emphasis. */
  emphasis?: boolean
  beds: number | null
  baths: number | null
  sqft: number | null
  /** Pre-computed display price ("$3,000,000", "Sold · $1.7M", "Listed · $899K"). */
  displayPrice: string
  /** Listing agent first name only (for "Marketed by Rebecca" attribution). */
  agentFirstName: string | null
}

// ─── Schoolhouse Road — hard-coded marquee entry ───────────────────────────
const SCHOOLHOUSE_FEATURED: OurListing = {
  key: 'schoolhouse-rd-bend',
  photoUrl: '/images/lp/schoolhouse-rd-hero.jpg',
  addressLine: 'Schoolhouse Road',
  neighborhood: 'Westside Bend',
  badge: 'Featured',
  emphasis: true,
  beds: 4,
  baths: 4,
  sqft: 4200,
  displayPrice: '$3,000,000',
  agentFirstName: 'Matt',
}

// MLS ListingKeys for the Ryan Realty listings we feature, in display order.
const NAMED_LISTING_KEYS = [
  '20250321125955542501000000', // 56628 Sunstone Loop (Caldera Springs) — $2.375M Canceled, Matt
  '20250429180931847661000000', // 2354 Drouillard (NW Crossing) — $1.75M Closed at $1.715M, Rebecca
  '20260225192329433521000000', // 19496 Tumalo Reservoir — $1.225M Active, Matt
  '20250707185011121446000000', // 64350 Old Bend Redmond Hwy — $1.099M Closed, Matt
  '20250618140805091287000000', // 363 Bluff Dr (Plaza Condominiums) — $899,900 Canceled, Matt
] as const

/**
 * Hand-curated overrides. Two reasons we need these:
 * 1) MLS abbreviates suffixes inconsistently — clean up addressLine + neighborhood.
 * 2) Some rows have NULL PhotoURL in the Supabase cache even though the MLS has
 *    photos. For Drouillard ($1.715M closed by Rebecca), we hard-code the Spark
 *    CDN primary photo URL captured live from the v1 Spark API on 2026-05-14.
 */
const ADDRESS_OVERRIDES: Record<
  string,
  { address: string; neighborhood: string | null; photoUrl?: string }
> = {
  '20250321125955542501000000': {
    address: '56628 Sunstone Loop',
    neighborhood: 'Caldera Springs',
  },
  '20250429180931847661000000': {
    address: '2354 NW Drouillard Ave',
    neighborhood: 'NorthWest Crossing',
    // Primary photo "Front of House" — Spark API, fetched 2026-05-14
    photoUrl:
      'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/20250430164921814250000000-o.jpg',
  },
  '20260225192329433521000000': {
    address: '19496 Tumalo Reservoir Rd',
    neighborhood: 'Tumalo Acreage',
  },
  '20250707185011121446000000': {
    address: '64350 Old Bend Redmond Hwy',
    neighborhood: 'Tumalo · 9 acres',
  },
  '20250618140805091287000000': {
    address: '363 NW Bluff Dr · #207',
    neighborhood: 'Downtown · Plaza Condos',
  },
}

/** Compact USD formatter — "$894K" / "$1.2M" / "$3M". */
export function formatPriceCompact(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '—'
  if (value >= 1_000_000) {
    const m = value / 1_000_000
    return `$${m.toFixed(m >= 10 ? 0 : m >= 3 ? 1 : 2).replace(/\.?0+$/, '')}M`
  }
  const k = Math.round(value / 1_000)
  return `$${k}K`
}

/**
 * Derive the display price + badge from raw status + list/close prices.
 *
 * Rules per Matt (2026-05-14):
 *  - Active   → "Currently Listed · $X" using ListPrice
 *  - Closed   → "Sold · $X" using ClosePrice (or ListPrice as fallback)
 *  - Canceled → "Listed at $X" using ListPrice (we represented but it didn't close on MLS)
 */
function deriveBadgeAndPrice(
  status: string,
  listPrice: number | null,
  closePrice: number | null
): { badge: OurListing['badge']; displayPrice: string } {
  const s = status.toLowerCase()
  if (s.includes('active')) {
    return {
      badge: 'Currently Listed',
      displayPrice: `Listed · ${formatPriceCompact(listPrice)}`,
    }
  }
  if (s.includes('closed') || s.includes('sold')) {
    return {
      badge: 'Sold',
      displayPrice: `Sold · ${formatPriceCompact(closePrice ?? listPrice)}`,
    }
  }
  // Canceled / Withdrawn / Expired — we represented it, MLS didn't close.
  return {
    badge: 'Represented',
    displayPrice: `Listed at ${formatPriceCompact(listPrice)}`,
  }
}

/**
 * The "Our listings" grid for the seller LP.
 *
 * Returns Schoolhouse Road (hard-coded marquee) followed by five named MLS
 * listings, in curated display order. Shows price + agent first name on each
 * card. Hides any row whose photo can't be resolved (graceful degradation).
 */
export async function getOurListings(): Promise<OurListing[]> {
  const out: OurListing[] = [SCHOOLHOUSE_FEATURED]
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('listings')
      .select(
        'ListingKey, StreetNumber, StreetName, City, StandardStatus, ListPrice, ClosePrice, PhotoURL, BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt, SubdivisionName, ListAgentName'
      )
      .in('ListingKey', NAMED_LISTING_KEYS as unknown as string[])
    if (error || !data) return out

    const order = new Map<string, number>(
      (NAMED_LISTING_KEYS as readonly string[]).map((k, i) => [k, i])
    )
    const sorted = [...data].sort(
      (a, b) =>
        (order.get(String(a['ListingKey'])) ?? 99) -
        (order.get(String(b['ListingKey'])) ?? 99)
    )

    for (const r of sorted as Array<Record<string, unknown>>) {
      const key = String(r['ListingKey'])
      const override = ADDRESS_OVERRIDES[key]

      const photoUrl = String(r['PhotoURL'] ?? '').trim() || override?.photoUrl || ''
      if (!photoUrl) continue

      const mlsAddress = `${r['StreetNumber'] ?? ''} ${r['StreetName'] ?? ''}`.trim()
      const addressLine = override?.address ?? (mlsAddress || '—')
      const neighborhood =
        override?.neighborhood ??
        ((r['SubdivisionName'] as string | null) ||
          (r['City'] as string | null) ||
          null)

      const status = String(r['StandardStatus'] ?? '')
      const listPrice =
        typeof r['ListPrice'] === 'number' ? (r['ListPrice'] as number) : null
      const closePrice =
        typeof r['ClosePrice'] === 'number' ? (r['ClosePrice'] as number) : null
      const { badge, displayPrice } = deriveBadgeAndPrice(status, listPrice, closePrice)

      const agentName = String(r['ListAgentName'] ?? '').trim()
      const agentFirstName = agentName ? agentName.split(/\s+/)[0] : null

      out.push({
        key,
        photoUrl,
        addressLine,
        neighborhood,
        badge,
        beds: typeof r['BedroomsTotal'] === 'number' ? (r['BedroomsTotal'] as number) : null,
        baths:
          typeof r['BathroomsTotal'] === 'number' ? (r['BathroomsTotal'] as number) : null,
        sqft:
          typeof r['TotalLivingAreaSqFt'] === 'number'
            ? (r['TotalLivingAreaSqFt'] as number)
            : null,
        displayPrice,
        agentFirstName,
      })
    }
  } catch (e) {
    console.warn('[seller-lp/data] getOurListings failed:', e)
  }
  return out
}

/**
 * Live Bend market snapshot (city-level residential).
 * Pulled from market_pulse_live so the LP shows the same figures as the
 * weekly market packets and city pages. Never invented.
 */
export async function getBendMarketSnapshot(): Promise<BendMarketSnapshot | null> {
  try {
    const pulse = await getLiveMarketPulse({ geoType: 'city', geoSlug: 'bend' })
    if (!pulse) return null
    return {
      medianListPrice: pulse.median_list_price,
      activeCount: pulse.active_count ?? null,
      newCount30d: pulse.new_count_30d ?? null,
      marketHealthLabel: pulse.market_health_label ?? null,
    }
  } catch (e) {
    console.warn('[seller-lp/data] getBendMarketSnapshot failed:', e)
    return null
  }
}

// ─── Social proof: seller-resonant Google reviews ──────────────────────────

export type SellerTestimonial = Testimonial & {
  /** Compact pull-quote for tighter card layouts. */
  pull: string
  /** 2-letter initials for the avatar (e.g. "AH"). */
  initials: string
  /** Brand-tinted avatar palette key. */
  avatarTint: 'navy' | 'navy-deep' | 'gold'
  /** True if this is the featured (larger) quote in the section. */
  featured?: boolean
}

const PULL_OVERRIDES: Record<string, string> = {
  'Audra Hedberg': 'Even in a tough market, he sold our home faster than we expected. Truly the best.',
  'Doug Millard':
    'Selling a house is an emotional roller coaster — Matt managed the downs and predicted the ups.',
  'Gary Timms': 'His marketing was professional and thorough. Patient, low pressure, expert guidance.',
  'SwankHQ': 'He went the extra mile to help us sell our house while we were out of the country.',
  'Helen Luna Fess':
    "As a Realtor of 23 years myself, I know what it takes. Matt guided our sale to the finish line — and exceeded the bar.",
  'D Detweiler': 'Worked hard representing us in the sale. We plan to use Matt again.',
}

function getInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '—'
  )
}

/**
 * Returns the seller-resonant testimonials.
 * First entry is the FEATURED (larger) quote — Helen Luna Fess, since the
 * "Realtor of 23 years myself" framing is the highest-credibility seller signal.
 */
export function getSellerTestimonials(): SellerTestimonial[] {
  const SELLER_AUTHORS_IN_ORDER = [
    'Helen Luna Fess',
    'Audra Hedberg',
    'Doug Millard',
    'Gary Timms',
    'SwankHQ',
    'D Detweiler',
  ] as const
  const tints: SellerTestimonial['avatarTint'][] = [
    'navy',
    'gold',
    'navy-deep',
    'navy',
    'navy-deep',
    'gold',
  ]
  const map = new Map<string, Testimonial>(TESTIMONIALS.map((t) => [t.author, t]))
  const out: SellerTestimonial[] = []
  SELLER_AUTHORS_IN_ORDER.forEach((author, i) => {
    const t = map.get(author)
    if (!t) return
    out.push({
      ...t,
      pull: PULL_OVERRIDES[author] ?? t.quote,
      initials: getInitials(author),
      avatarTint: tints[i % tints.length] ?? 'navy',
      featured: i === 0,
    })
  })
  return out
}

/** Aggregate trust stats shown above the testimonials grid. */
export function getTestimonialAggregate(): { count: number; rating: '5.0' } {
  return { count: getSellerTestimonials().length, rating: '5.0' }
}
