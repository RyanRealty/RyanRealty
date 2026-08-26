/**
 * lib/data/studio/subjects.ts — what a draft is ABOUT, and the proof.
 *
 * Every figure that reaches a caption is resolved here, from a named source,
 * with a citation written beside it in the same function that read it. That
 * pairing is the point: a figure and its trace are produced together or not
 * at all, so a caption can never carry a number whose origin nobody recorded
 * (CLAUDE.md §0).
 *
 * Market figures come from the cache (market_pulse_live via getMarketPulse),
 * never from aggregating raw `listings`. Listing figures come from the same
 * CMA subject lookups the valuation product already trusts.
 */
import 'server-only'
import { getMarketPulse } from '@/lib/data/market/getMarketPulse'
import {
  getMarketPulseRowsByGeoType,
  getMarketPulseRowForGeo,
} from '@/lib/data/market/getMarketStatsCacheRows'
import { findCmaSubjectByAddress, findCmaSubjectByMls, type CmaListingRow } from '@/lib/data/cma/builderReads'
import type { MarketPulse } from '@/lib/data/types/market'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import type { StudioFormat } from '@/lib/studio/formats'
import type { StudioSubject } from '@/lib/studio/produce'
import resortCommunities from '@/data/resort-communities.json'

const SITE = 'https://ryan-realty.com'

/** The cache stamp every served figure actually carries. Never claim v4. */
const METHODOLOGY = 'v3-2026-05-07'

type CommunityRow = {
  slug: string
  label: string
  city: string
  city_slug: string
  is_resort?: boolean
}

const COMMUNITIES: CommunityRow[] = Array.isArray(
  (resortCommunities as { communities?: CommunityRow[] }).communities,
)
  ? ((resortCommunities as { communities: CommunityRow[] }).communities)
  : []

function usd(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`
}

function pulseCitation(pulse: MarketPulse, column: string, value: string): Record<string, unknown> {
  return {
    figure: value,
    source: 'Supabase',
    table: 'market_pulse_live (via getMarketPulse)',
    column,
    filter: `geo_type='${pulse.geoType}', geo_slug='${pulse.geoSlug}', property_type='A'`,
    methodology_version: METHODOLOGY,
    fetched_at: new Date().toISOString(),
    refreshed_at: pulse.refreshedAt,
  }
}

/**
 * Turn a pulse row into display figures plus their traces.
 * Null is not zero: a figure the cache withheld is omitted, never defaulted,
 * because a caption reading "0 active listings" would be a false statement
 * about the market rather than a missing one.
 */
function figuresFromPulse(pulse: MarketPulse): {
  figures: Record<string, string>
  citations: Array<Record<string, unknown>>
} {
  const figures: Record<string, string> = {}
  const citations: Array<Record<string, unknown>> = []

  if (pulse.activeCount != null) {
    const value = String(pulse.activeCount)
    figures['active listings'] = value
    citations.push(pulseCitation(pulse, 'active_count', value))
  }
  if (pulse.medianListPrice != null && Number.isFinite(pulse.medianListPrice)) {
    const value = usd(pulse.medianListPrice)
    figures['median list price'] = value
    citations.push(pulseCitation(pulse, 'median_list_price', value))
  }
  if (pulse.closedLast30Days > 0) {
    const value = String(pulse.closedLast30Days)
    figures['homes closed in the last 30 days'] = value
    citations.push(pulseCitation(pulse, 'closed_last_30_days', value))
  }
  if (pulse.monthsOfSupply != null && Number.isFinite(pulse.monthsOfSupply)) {
    // Never round MoS by hand: 4.04 printed as "4.0" reads as a seller's
    // market when the raw value is not one. formatMonthsOfSupply holds the
    // threshold away from the boundary (G: ci:market-formula).
    const value = formatMonthsOfSupply(pulse.monthsOfSupply)
    figures['months of supply'] = value
    citations.push(pulseCitation(pulse, 'months_of_supply', value))
  }
  if (pulse.medianDaysToPending != null && Number.isFinite(pulse.medianDaysToPending)) {
    const value = String(Math.round(pulse.medianDaysToPending))
    figures['median days to pending'] = value
    citations.push(pulseCitation(pulse, 'median_days_to_pending', value))
  }
  return { figures, citations }
}

function listingFigures(row: CmaListingRow): {
  label: string
  figures: Record<string, string>
  citations: Array<Record<string, unknown>>
  photoUrl: string | null
} {
  const street = [row.StreetNumber, row.StreetName].filter(Boolean).join(' ').trim()
  const city = String(row.City ?? '').trim()
  const label = [street, city].filter(Boolean).join(', ')
  const figures: Record<string, string> = {}
  const citations: Array<Record<string, unknown>> = []
  const fetchedAt = new Date().toISOString()
  const listingKey = String(row.ListingKey ?? '')

  const trace = (column: string, value: string) => ({
    figure: value,
    source: 'Supabase',
    table: 'listings (via CMA subject lookup)',
    column,
    filter: `ListingKey='${listingKey}', StandardStatus='Active'`,
    fetched_at: fetchedAt,
  })

  const price = Number(row.ListPrice)
  if (Number.isFinite(price) && price > 0) {
    const value = usd(price)
    figures['list price'] = value
    citations.push(trace('ListPrice', value))
  }
  const beds = Number(row.BedroomsTotal)
  if (Number.isFinite(beds) && beds > 0) {
    const value = String(Math.round(beds))
    figures.bedrooms = value
    citations.push(trace('BedroomsTotal', value))
  }
  const baths = Number(row.BathroomsTotal)
  if (Number.isFinite(baths) && baths > 0) {
    const value = String(baths)
    figures.bathrooms = value
    citations.push(trace('BathroomsTotal', value))
  }

  const photoUrl = String(row.PhotoURL ?? '').trim()
  return {
    label,
    figures,
    citations,
    photoUrl: /^https?:\/\//i.test(photoUrl) ? photoUrl : null,
  }
}

/**
 * Parse a typed address into the shape the CMA lookup wants.
 * Matt types "1234 NW Elm St, Bend" or an MLS number; neither is a query.
 */
function parseAddress(raw: string): {
  streetNumber: string
  streetNameIlike: string
  cityIlike?: string | null
} | null {
  const match = raw.trim().match(/^(\d+)\s+([^,]+)(?:,\s*([^,]+))?/)
  if (!match) return null
  const streetName = match[2].replace(/\s+(OR|Oregon)\s*$/i, '').trim()
  if (!streetName) return null
  const city = match[3]?.replace(/\s+(OR|Oregon)\s*$/i, '').trim()
  return { streetNumber: match[1], streetNameIlike: `%${streetName}%`, cityIlike: city || null }
}

/** First Active row with a usable photo. Both lookups return candidate lists. */
function firstUsable(rows: CmaListingRow[]): CmaListingRow | null {
  for (const row of rows) {
    if (String(row.StandardStatus ?? '') !== 'Active') continue
    if (!/^https?:\/\//i.test(String(row.PhotoURL ?? '').trim())) continue
    return row
  }
  return null
}

/**
 * Last-resort label when the cache has no geo_label.
 * Drops a leading city segment so "bend-old-bend" reads "Old Bend", not
 * "Bend Old Bend".
 */
function titleCaseSlug(slug: string): string {
  const parts = slug.split('-').filter(Boolean)
  const trimmed = parts.length > 1 && parts[0] === 'bend' ? parts.slice(1) : parts
  return trimmed
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function findCommunity(query: string): CommunityRow | null {
  const q = query.trim().toLowerCase()
  if (!q) return null
  return (
    COMMUNITIES.find((c) => c.slug.toLowerCase() === q) ??
    COMMUNITIES.find((c) => c.label.toLowerCase() === q) ??
    COMMUNITIES.find((c) => c.label.toLowerCase().includes(q)) ??
    null
  )
}

/**
 * Resolve a subject for one format. Returns null when nothing qualifies,
 * which the pipeline treats as "do not produce" rather than "produce
 * something generic".
 */
export async function resolveStudioSubject(
  format: StudioFormat,
  query: string | undefined,
): Promise<StudioSubject | null> {
  if (format.subject === 'listing') {
    const raw = (query ?? '').trim()
    if (!raw) return null

    let candidates: CmaListingRow[] = []
    if (/^\d{6,}$/.test(raw)) {
      candidates = await findCmaSubjectByMls(raw)
    } else {
      const parsed = parseAddress(raw)
      if (!parsed) return null
      candidates = await findCmaSubjectByAddress(parsed)
    }

    const row = firstUsable(candidates)
    if (!row) return null

    const shaped = listingFigures(row)
    if (!shaped.photoUrl) return null
    return {
      label: shaped.label,
      figures: shaped.figures,
      citations: shaped.citations,
      sourcePhotoUrl: shaped.photoUrl,
      // The actual property, not the browse page. /listing/<key> redirects to
      // the canonical SEO URL, so the link keeps working if the slug changes.
      ctaUrl: `${SITE}/listing/${String(row.ListingKey ?? '').trim()}`,
    }
  }

  if (format.subject === 'place') {
    const slug = (query ?? '').trim().toLowerCase()
    if (!slug) return null

    // geo_type 'community' has no rows in market_pulse_live. Resort
    // communities are stored as neighborhoods, so asking for 'community'
    // returns null every time.
    const pulse = await getMarketPulse({ geoType: 'neighborhood', geoSlug: slug })
    if (!pulse) return null
    const shaped = figuresFromPulse(pulse)
    if (shaped.citations.length === 0) return null

    // The cache carries the human label. Deriving one from the slug produced
    // "Bend Old Bend" for bend-old-bend, which is not a place anyone says.
    const community = findCommunity(slug)
    const row = community
      ? null
      : await getMarketPulseRowForGeo({
          geoType: 'neighborhood',
          geoSlug: slug,
          columns: 'geo_slug, geo_label',
        })
    const cacheLabel = typeof row?.geo_label === 'string' ? row.geo_label.trim() : ''
    const label = community
      ? `${community.label}, ${community.city}`
      : cacheLabel || titleCaseSlug(slug)
    const place = community
      ? `${community.label} near ${community.city}`
      : `${cacheLabel || titleCaseSlug(slug)}, Bend`

    return {
      label,
      place,
      figures: shaped.figures,
      citations: shaped.citations,
      ctaUrl: community ? `${SITE}/communities/${community.slug}` : `${SITE}/housing-market`,
    }
  }

  // subject === 'none': the region speaks for itself.
  const pulse = await getMarketPulse({ geoType: 'city', geoSlug: 'bend' })
  if (!pulse) return null
  const shaped = figuresFromPulse(pulse)
  if (shaped.citations.length === 0) return null
  return {
    label: 'Bend, Oregon',
    place: 'Bend',
    figures: shaped.figures,
    citations: shaped.citations,
    ctaUrl: `${SITE}/market`,
  }
}

/**
 * Places the console offers.
 *
 * Read from the live cache rather than the registry, so every option in the
 * dropdown is a place that will actually resolve. A registry-driven picker
 * offered communities the cache has never held a row for, and picking one
 * produced nothing with no explanation.
 */
export async function studioPlaceOptions(): Promise<Array<{ slug: string; label: string }>> {
  const rows = await getMarketPulseRowsByGeoType({
    geoType: 'neighborhood',
    minActiveCount: 4,
    columns: 'geo_slug, geo_label, active_count',
  })
  return rows
    .map((row) => {
      const slug = String(row.geo_slug ?? '')
      const known = findCommunity(slug)
      const label = known ? `${known.label} (${known.city})` : String(row.geo_label ?? titleCaseSlug(slug))
      return { slug, label: `${label}, ${row.active_count} active` }
    })
    .filter((option) => option.slug.length > 0)
}
