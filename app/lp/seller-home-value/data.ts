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
  /** "56628 Sunstone Loop" — never reveals price (Matt's directive). */
  addressLine: string
  /** Sub-label: neighborhood or context. */
  neighborhood: string | null
  /** Soft status pill — never says "sold for $X". */
  badge: 'Featured' | 'Currently Listed' | 'Recently Represented'
  /** Whether to render with marquee emphasis (gold-tinted ring, etc). */
  emphasis?: boolean
  beds: number | null
  baths: number | null
  sqft: number | null
}

// ─── Schoolhouse Road — hard-coded marquee entry ───────────────────────────
// $3M premarketing build that hasn't been entered into MLS yet. Photo sourced
// from the listing_video_v4 video build assets (already on disk).
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
}

// MLS ListingKeys for the Ryan Realty listings we want to feature. Pulled fresh
// each request from the Supabase listings cache, in display order. Status-agnostic
// (canceled / closed / active all OK) — the badge surfaces context, the price
// is intentionally hidden per Matt's directive ("we don't have to say what they
// sold for. We can just say our listings.").
const NAMED_LISTING_KEYS = [
  '20250321125955542501000000', // 56628 Sunstone Loop (Caldera Springs) — $2.375M Canceled, Matt Ryan
  '20260225192329433521000000', // 19496 Tumalo Reservoir — $1.225M Active, Matt Ryan
  '20250707185011121446000000', // 64350 Old Bend Redmond Hwy — $1.099M Closed, Matt Ryan
  '20250618140805091287000000', // 363 Bluff Dr (Plaza Condominiums) — $899,900 Canceled, Matt Ryan
] as const

/**
 * Hand-curated street-name overrides so the "addressLine" copy reads cleanly
 * (MLS abbreviates suffixes inconsistently, sometimes omits Loop/Dr/etc).
 */
const ADDRESS_OVERRIDES: Record<string, { address: string; neighborhood: string | null }> = {
  '20250321125955542501000000': { address: '56628 Sunstone Loop', neighborhood: 'Caldera Springs' },
  '20260225192329433521000000': { address: '19496 Tumalo Reservoir Rd', neighborhood: 'Tumalo Acreage' },
  '20250707185011121446000000': { address: '64350 Old Bend Redmond Hwy', neighborhood: 'Tumalo · 9 acres' },
  '20250618140805091287000000': { address: '363 NW Bluff Dr · #207', neighborhood: 'Downtown · Plaza Condos' },
}

/**
 * The "Our listings" grid for the seller LP.
 *
 * Returns Schoolhouse Road (hard-coded marquee) followed by the four named MLS
 * listings, in curated display order. Hides price entirely. Hides any row whose
 * MLS PhotoURL is null (graceful degradation — no broken card art).
 */
export async function getOurListings(): Promise<OurListing[]> {
  const out: OurListing[] = [SCHOOLHOUSE_FEATURED]
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('listings')
      .select(
        'ListingKey, StreetNumber, StreetName, City, StandardStatus, PhotoURL, BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt, SubdivisionName'
      )
      .in('ListingKey', NAMED_LISTING_KEYS as unknown as string[])
    if (error || !data) return out

    // Preserve the curated NAMED_LISTING_KEYS order.
    const order = new Map<string, number>(
      (NAMED_LISTING_KEYS as readonly string[]).map((k, i) => [k, i])
    )
    const sorted = [...data].sort(
      (a, b) =>
        (order.get(String(a['ListingKey'])) ?? 99) -
        (order.get(String(b['ListingKey'])) ?? 99)
    )

    for (const r of sorted as Array<Record<string, unknown>>) {
      const photoUrl = String(r['PhotoURL'] ?? '').trim()
      if (!photoUrl) continue

      const key = String(r['ListingKey'])
      const override = ADDRESS_OVERRIDES[key]
      const mlsAddress = `${r['StreetNumber'] ?? ''} ${r['StreetName'] ?? ''}`.trim()
      const addressLine = override?.address ?? (mlsAddress || '—')
      const neighborhood =
        override?.neighborhood ?? ((r['SubdivisionName'] as string | null) || (r['City'] as string | null) || null)

      const status = String(r['StandardStatus'] ?? '').toLowerCase()
      const badge: OurListing['badge'] = status.includes('active')
        ? 'Currently Listed'
        : 'Recently Represented'

      out.push({
        key,
        photoUrl,
        addressLine,
        neighborhood,
        badge,
        beds: typeof r['BedroomsTotal'] === 'number' ? (r['BedroomsTotal'] as number) : null,
        baths: typeof r['BathroomsTotal'] === 'number' ? (r['BathroomsTotal'] as number) : null,
        sqft:
          typeof r['TotalLivingAreaSqFt'] === 'number'
            ? (r['TotalLivingAreaSqFt'] as number)
            : null,
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

/**
 * Compact USD formatter — "$894K" for $894,000, "$1.2M" for $1,200,000.
 * Kept for the market-snapshot tiles; "Our listings" deliberately omits price.
 */
export function formatPriceCompact(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '—'
  if (value >= 1_000_000) {
    const m = value / 1_000_000
    return `$${m.toFixed(m >= 10 ? 0 : 1)}M`
  }
  const k = Math.round(value / 1_000)
  return `$${k}K`
}

// ─── Social proof: seller-resonant Google reviews ──────────────────────────

export type SellerTestimonial = Testimonial & {
  /** Compact pull-quote (60–110 chars) for tighter card layouts. */
  pull: string
}

/**
 * Hand-picked pull-quotes from the longer Google reviews. Sellers respond to
 * specific signals: "sold faster than expected", "patient, low pressure",
 * "marketed our home professionally". These pulls surface that without forcing
 * the visitor to read a wall of text.
 */
const PULL_OVERRIDES: Record<string, string> = {
  'Audra Hedberg': 'Even in a tough market, he sold our home faster than we expected.',
  'Doug Millard': 'Selling a house is an emotional roller coaster — Matt managed the downs and predicted the ups.',
  'Gary Timms': 'His marketing was professional and thorough. Patient, low pressure, expert guidance.',
  'SwankHQ': 'He went the extra mile to help us sell our house while we were out of the country.',
  'Helen Luna Fess':
    'As a Realtor of 23 years myself, I know what it takes. Matt guided our sale to the finish line.',
  'D Detweiler': 'Worked hard representing us in the sale. We plan to use Matt again.',
  'David Town': 'Matt worked diligently — even when we decided to rent instead. So grateful.',
}

/** Returns the six seller-resonant testimonials in the order they should display. */
export function getSellerTestimonials(): SellerTestimonial[] {
  const SELLER_AUTHORS = [
    'Audra Hedberg',
    'Helen Luna Fess',
    'Doug Millard',
    'Gary Timms',
    'SwankHQ',
    'D Detweiler',
  ] as const
  const map = new Map<string, Testimonial>(TESTIMONIALS.map((t) => [t.author, t]))
  const out: SellerTestimonial[] = []
  for (const author of SELLER_AUTHORS) {
    const t = map.get(author)
    if (!t) continue
    out.push({ ...t, pull: PULL_OVERRIDES[author] ?? t.quote })
  }
  return out
}
