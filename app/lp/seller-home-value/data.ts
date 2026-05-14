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
  /** Optional listing-tour video URL — when set, the card shows a play icon
   *  over the photo and tapping opens a Dialog with the player. */
  videoUrl?: string
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
// No videoUrl — Schoolhouse is pre-MLS. When it lists on MLS with a Videos
// entry, the unified MLS-video pipeline below will pick it up automatically.
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
// Each ListingKey is the canonical Spark/MLS row that backs the property card.
// `side`: 'list' = Ryan Realty represented the seller; 'buy' = represented the buyer.
//
// Floor: $1M+ list price OR $1M+ close price. Verified against Supabase 2026-05-14.
// Under-$1M deals (Mayfield $755K, Ordway $880K, Penhollow, etc.) are
// intentionally not shown on the LP per Matt's most-expensive-first rule.
const NAMED_LISTINGS: ReadonlyArray<{ key: string; side: 'list' | 'buy' }> = [
  { key: '20250321125955542501000000', side: 'list' }, // 56628 Sunstone Loop (Caldera Springs) — $2.375M list, Matt represented seller (status: Canceled; displayed as "Represented" — no expired/canceled language in UI)
  { key: '20250429180931847661000000', side: 'list' }, // 2354 Drouillard (NW Crossing) — $1.715M Closed, Rebecca
  { key: '20240529173913009450000000', side: 'buy' },  // 2680 Nordic (Valhalla Heights) — $1.350M Closed, Rebecca repped buyer
  { key: '20260225192329433521000000', side: 'list' }, // 19496 Tumalo Reservoir — $1.225M Active, Matt
  { key: '20250120214617650644000000', side: 'list' }, // 1974 Newport Hills (Forest Hills) — $1.191M Closed, Matt
  { key: '20250707185011121446000000', side: 'list' }, // 64350 Old Bend Redmond Hwy — $1.030M Closed, Matt
  { key: '20250516213626217599000000', side: 'list' }, // 534 Crowson (Ashland) — $1.020M Closed, Matt
] as const
const NAMED_LISTING_KEYS = NAMED_LISTINGS.map((l) => l.key)
const LISTING_SIDE: Record<string, 'list' | 'buy'> = Object.fromEntries(
  NAMED_LISTINGS.map((l) => [l.key, l.side])
)

/**
 * Hand-curated overrides. Two reasons we need these:
 * 1) MLS abbreviates suffixes inconsistently — clean up addressLine + neighborhood.
 * 2) Some rows have NULL PhotoURL in the Supabase cache even though the MLS has
 *    photos. For Drouillard ($1.715M closed by Rebecca), we hard-code the Spark
 *    CDN primary photo URL captured live from the v1 Spark API on 2026-05-14.
 */
// ADDRESS_OVERRIDES carries hand-curated patches for MLS data that Supabase's
// cache doesn't reliably surface:
//   • address/neighborhood text cleanup (MLS abbreviates suffixes inconsistently)
//   • photoUrl fallback when `PhotoURL` is null in the cache (we backfill from
//     a live Spark v1 lookup)
//   • videoUrl fallback when `details.Videos` is missing or stale (MLS uploaded
//     the video after the row was cached; we Spark-verified the URL and pin it
//     here until the cache catches up via the next sync)
const ADDRESS_OVERRIDES: Record<
  string,
  {
    address: string
    neighborhood: string | null
    photoUrl?: string
    videoUrl?: string
  }
> = {
  // 56628 Sunstone Loop — Matt represented seller. Status is Canceled on MLS,
  // but on this LP we surface it as "Represented" — accurate framing without
  // exposing the expired listing as a negative signal. Supabase cache has
  // the primary photo.
  '20250321125955542501000000': {
    address: '56628 Sunstone Loop',
    neighborhood: 'Caldera Springs',
  },
  // 2354 NW Drouillard Ave — Rebecca's listing. Supabase cache PhotoURL is
  // null even though MLS has photos. Fallback URL is the primary "Front of
  // House" pulled live from the Spark v1 API 2026-05-14. Spark v1 also
  // shows a "Home HIghlights" Aryeo video that the cached `details.Videos`
  // doesn't reflect yet — pin the URL until the cache catches up.
  '20250429180931847661000000': {
    address: '2354 NW Drouillard Ave',
    neighborhood: 'NorthWest Crossing',
    photoUrl:
      'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/20250430164921814250000000-o.jpg',
    videoUrl:
      'https://framed-visuals.aryeo.com/videos/019689d1-f124-7030-beb9-77dd5150ffb2',
  },
  // 2680 Nordic — Rebecca represented buyer.
  '20240529173913009450000000': {
    address: '2680 Nordic Pl',
    neighborhood: 'Valhalla Heights',
  },
  '20260225192329433521000000': {
    address: '19496 Tumalo Reservoir Rd',
    neighborhood: 'Tumalo Acreage',
  },
  // 1974 Newport Hills — Matt's listing, paired with Gary Timms's review.
  // Supabase PhotoURL null; Spark v1 primary photo, fetched 2026-05-14. Spark
  // v1 also shows a YouTube video tour that the cache hasn't picked up yet.
  '20250120214617650644000000': {
    address: '1974 NE Newport Hills Dr',
    neighborhood: 'Forest Hills',
    photoUrl:
      'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/20250528162215796761000000-o.jpg',
    videoUrl: 'https://www.youtube.com/embed/pNZJOg5aw5g',
  },
  '20250707185011121446000000': {
    address: '64350 Old Bend Redmond Hwy',
    neighborhood: 'Tumalo · 9 acres',
  },
  // 534 Crowson — Matt's listing in Ashland (out-of-Bend assist). SwankHQ
  // review pairing per Matt 2026-05-14. Supabase PhotoURL null; Spark fallback.
  '20250516213626217599000000': {
    address: '534 Crowson Rd',
    neighborhood: 'Ashland · Oak Knoll Meadows',
    photoUrl:
      'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/20250516220052932519000000-o.jpg',
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
  // Canceled / Withdrawn / Expired — we represented it. Display "Represented · $X"
  // (no "Canceled"/"Expired"/"Withdrawn" language — Matt 2026-05-14: we did
  // real marketing work for these sellers; status doesn't tell that story).
  return {
    badge: 'Represented',
    displayPrice: `Represented · ${formatPriceCompact(listPrice)}`,
  }
}

/**
 * Extract a clean, embeddable video URL from a Spark `Videos[].ObjectHtml`
 * payload. MLS-supplied videos arrive as either:
 *   - A full <iframe …> string (YouTube embed, Aryeo embed, etc.)
 *   - A protocol-relative iframe src ("//www.youtube.com/embed/…")
 *   - A bare URL ("https://framed-visuals.aryeo.com/videos/…")
 * Returns null if no recognizable URL can be parsed.
 *
 * Returned URL is always https-prefixed and ready to drop into an <iframe src>.
 */
export function extractVideoUrl(objectHtml: string | null | undefined): string | null {
  if (!objectHtml) return null
  const raw = String(objectHtml).trim()
  if (!raw) return null
  // Bare URL (https or http)
  if (/^https?:\/\//i.test(raw)) return raw
  // Protocol-relative URL ("//www.youtube.com/…")
  if (/^\/\//.test(raw)) return `https:${raw}`
  // Iframe wrapper — pull the src attribute
  const m = /<iframe[^>]+\bsrc=["']([^"']+)["']/i.exec(raw)
  if (m && m[1]) {
    const src = m[1].trim()
    if (src.startsWith('//')) return `https:${src}`
    if (/^https?:\/\//i.test(src)) return src
  }
  return null
}

/**
 * Pull the primary listing-tour video URL from a Supabase `details` blob
 * (the full Spark response stored as JSONB). Prefers the first Videos entry;
 * falls back to the first VirtualTours entry when no Video is present.
 */
function videoUrlFromDetails(details: unknown): string | undefined {
  if (!details || typeof details !== 'object') return undefined
  const d = details as Record<string, unknown>
  const videos = Array.isArray(d['Videos']) ? (d['Videos'] as Array<Record<string, unknown>>) : []
  for (const v of videos) {
    const parsed = extractVideoUrl(v['ObjectHtml'] as string | null | undefined)
    if (parsed) return parsed
  }
  const tours = Array.isArray(d['VirtualTours']) ? (d['VirtualTours'] as Array<Record<string, unknown>>) : []
  for (const t of tours) {
    const uri = t['Uri']
    if (typeof uri === 'string' && /^https?:\/\//i.test(uri)) return uri
  }
  return undefined
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
        'ListingKey, StreetNumber, StreetName, City, StandardStatus, ListPrice, ClosePrice, PhotoURL, BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt, SubdivisionName, ListAgentName, details'
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

      // Listing-tour video comes from the MLS Videos array (Spark response
      // cached in `details` JSONB). No local files, no marketing renders —
      // when the listing agent uploads a video to MLS, this page picks it up.
      // Fall back to a pinned ADDRESS_OVERRIDES.videoUrl when Supabase cache
      // is stale (e.g. video uploaded after last sync); the override is
      // always Spark-verified.
      const videoUrl = videoUrlFromDetails(r['details']) ?? override?.videoUrl

      out.push({
        key,
        photoUrl,
        videoUrl,
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

// ─── Social proof: Sold Stories ───────────────────────────────────────────
//
// "Sold Stories" pairs each Ryan Realty listing with a matching real Google
// review and the listing's broker. Drives the social-proof section of the
// seller LP. Pattern is the cross-industry winner across Opendoor, HomeLight,
// Compass, Orchard, Vercel, and Linear: lead with the THING transacted, name
// real people, never use stock photography of generic affluent couples.
// See scratch/social-proof-research.md for the full evidence brief.

export type BrokerSlug = 'ryan-matt' | 'stevenson-paul' | 'peterson-rebecca'

export type SellerTestimonial = Testimonial & {
  /** Compact pull-quote for tighter card layouts. */
  pull: string
}

export type SoldStory = {
  /** Stable React key — the underlying listing key. */
  key: string
  /** The actual property — photo, address, price, badge, neighborhood. */
  listing: OurListing
  /** The paired Google review. Null for active listings and for sold deals
   *  whose seller never left a review. Honest about what we have. */
  testimonial: SellerTestimonial | null
  /** Which broker represented this transaction. Drives the headshot. */
  brokerSlug: BrokerSlug
  /** First name only for "Marketed by [Matt|Rebecca|Paul]". */
  brokerFirstName: 'Matt' | 'Paul' | 'Rebecca'
  /** Did we represent the SELLER (list-side) or the BUYER (buy-side)?
   *  Drives the "Marketed by Matt" vs "Buyer rep · Matt" attribution. */
  side: 'list' | 'buy'
  /** Featured cards get the larger 3-up top-row treatment. The other six
   *  render in a compact 3-up grid below. */
  featured: boolean
}

const PULL_OVERRIDES: Record<string, string> = {
  'Audra Hedberg':
    'Even in a tough market, he sold our home faster than we expected. Truly the best.',
  'Doug Millard':
    'Selling a house is an emotional roller coaster — Matt managed the downs and predicted the ups.',
  'Gary Timms':
    'His marketing was professional and thorough. Patient, low pressure, expert guidance.',
  'SwankHQ':
    'He went the extra mile to help us sell our house while we were out of the country.',
  'Helen Luna Fess':
    "As a Realtor of 23 years myself, I know what it takes. Matt guided our sale to the finish line — and exceeded the bar.",
  'D Detweiler': 'Worked hard representing us in the sale. We plan to use Matt again.',
}

const BROKER_FIRST_NAME: Record<BrokerSlug, 'Matt' | 'Paul' | 'Rebecca'> = {
  'ryan-matt': 'Matt',
  'stevenson-paul': 'Paul',
  'peterson-rebecca': 'Rebecca',
}

/**
 * Deterministic listing × testimonial × broker pairing for the Sold Stories
 * section. Each entry references an existing listing key (or 'schoolhouse-rd-bend'
 * for the hardcoded marquee) and — when applicable — a real reviewer from
 * lib/testimonials.ts.
 *
 * Order matters: rendered top-to-bottom in price-descending order. First three
 * entries render as featured (3-up top row); the remaining six render as
 * compact (3-up bottom rows). Listings without a paired reviewer still render
 * as property cards — we don't fabricate reviews to fill them.
 *
 * Review-to-listing pairings confirmed by Matt 2026-05-14:
 *   Gary Timms     → Newport Hills (1974 NE)
 *   Doug Millard   → Old Bend-Redmond Hwy
 *   SwankHQ        → Crowson (Ashland)
 *
 * Off-matrix reviewer notes (kept here so future cards can pair correctly):
 *   Audra Hedberg  → Mayfield $755K (under $1M tier — not shown)
 *   Stephen Graham → Ordway $880K (buyer-side, under tier — not shown)
 *   Helen Luna Fess→ Huntington $583K (under tier — not shown)
 *   D Detweiler    → no confirmed listing-key match
 */
const STORY_PAIRINGS: ReadonlyArray<{
  listingKey: string
  reviewer: string | null
  broker: BrokerSlug
  featured: boolean
}> = [
  // ─── Featured row (2-up): the two highest-value transactions. ────────────
  {
    listingKey: 'schoolhouse-rd-bend', // $3M Featured — Matt
    reviewer: null,
    broker: 'ryan-matt',
    featured: true,
  },
  {
    listingKey: '20250321125955542501000000', // Sunstone Loop $2.375M Represented — Matt
    reviewer: null,
    broker: 'ryan-matt',
    featured: true,
  },
  // ─── Compact row (3-up x 2): $1.020M – $1.715M ───────────────────────────
  {
    listingKey: '20250429180931847661000000', // Drouillard $1.715M Closed — Rebecca list
    reviewer: null,
    broker: 'peterson-rebecca',
    featured: false,
  },
  {
    listingKey: '20240529173913009450000000', // Nordic / Valhalla Heights $1.35M Closed — Rebecca buyer
    reviewer: null,
    broker: 'peterson-rebecca',
    featured: false,
  },
  {
    listingKey: '20260225192329433521000000', // Tumalo Reservoir $1.225M Active — Matt
    reviewer: null,
    broker: 'ryan-matt',
    featured: false,
  },
  {
    listingKey: '20250120214617650644000000', // Newport Hills $1.191M Closed — Matt
    reviewer: 'Gary Timms',
    broker: 'ryan-matt',
    featured: false,
  },
  {
    listingKey: '20250707185011121446000000', // Old Bend-Redmond Hwy $1.030M Closed — Matt
    reviewer: 'Doug Millard',
    broker: 'ryan-matt',
    featured: false,
  },
  {
    listingKey: '20250516213626217599000000', // Crowson $1.020M Closed (Ashland) — Matt
    reviewer: 'SwankHQ',
    broker: 'ryan-matt',
    featured: false,
  },
]

function toSellerTestimonial(t: Testimonial): SellerTestimonial {
  return { ...t, pull: PULL_OVERRIDES[t.author] ?? t.quote }
}

/**
 * Build the Sold Stories list by joining listings × optional testimonials ×
 * brokers. Stories whose listing isn't resolvable (MLS row missing or photo
 * unavailable) are dropped — graceful degradation, never silent half-renders.
 * Stories without a paired reviewer still render — testimonial is just null.
 */
export async function getSoldStories(): Promise<SoldStory[]> {
  const listings = await getOurListings()
  const listingByKey = new Map(listings.map((l) => [l.key, l]))
  const reviewByAuthor = new Map(TESTIMONIALS.map((t) => [t.author, t]))

  const stories: SoldStory[] = []
  for (const p of STORY_PAIRINGS) {
    const listing = listingByKey.get(p.listingKey)
    if (!listing) continue
    const review = p.reviewer ? reviewByAuthor.get(p.reviewer) : null
    const testimonial = review ? toSellerTestimonial(review) : null
    const side: 'list' | 'buy' =
      p.listingKey === 'schoolhouse-rd-bend' ? 'list' : LISTING_SIDE[p.listingKey] ?? 'list'
    stories.push({
      key: p.listingKey,
      listing,
      testimonial,
      brokerSlug: p.broker,
      brokerFirstName: BROKER_FIRST_NAME[p.broker],
      side,
      featured: p.featured,
    })
  }
  return stories
}

/** Aggregate trust stats shown above the matrix. Counts every real Google
 *  review we have on file in lib/testimonials.ts — that's the number a
 *  visitor sees if they click through to Matt's actual Google profile.
 *  Defensible: comes from a single source-of-truth file. */
export function getTestimonialAggregate(): { count: number; rating: '5.0' } {
  return { count: TESTIMONIALS.length, rating: '5.0' }
}

// ─── Compat shim: keep getSellerTestimonials() for any consumer outside the
//     seller LP. Returns the same reviews in the same order, minus the
//     headshot/broker join. Safe to delete once nothing else imports it. ────
export function getSellerTestimonials(): SellerTestimonial[] {
  return STORY_PAIRINGS.map((p) => {
    const t = TESTIMONIALS.find((x) => x.author === p.reviewer)
    return t ? toSellerTestimonial(t) : null
  }).filter((x): x is SellerTestimonial => x !== null)
}
