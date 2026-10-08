/**
 * lib/data/studio/subjects.ts — what a draft is ABOUT, and the proof.
 *
 * Every figure that reaches a caption is resolved here, from a named source,
 * with a citation written beside it in the same function that read it. That
 * pairing is the point: a figure and its trace are produced together or not
 * at all, so a caption can never carry a number whose origin nobody recorded
 * (CLAUDE.md §0).
 *
 * Market figures come from getMarketPulse, never from aggregating raw
 * `listings`. At city, region, neighborhood and community grain that DAL
 * overlays Market Truth (market_metric mt-v1, segment detached) on the active
 * count, median list price and months of supply, so those traces name
 * market_metric; everything else is the market_pulse_live row. Months of supply
 * publishes only through publishMonthsOfSupply and closed-side figures only at a
 * grain whose closes are attributed like its actives (lib/market/geo-grain-trust.ts):
 * the neighborhood pulse row's closes come from a subdivision-name join and are
 * never a caption figure (audit DATA-7, 2026-09-22). Listing figures come from
 * the same CMA subject lookups the valuation product already trusts.
 */
import 'server-only'
import { getMarketPulse } from '@/lib/data/market/getMarketPulse'
import { resolveListingAgent } from '@/lib/data/brokers/resolveListingAgent'
import type { MotionAgent } from '@/lib/studio/motion/cues'
import {
  getMarketPulseRowsByGeoType,
  getMarketPulseRowForGeo,
} from '@/lib/data/market/getMarketStatsCacheRows'
import { findCmaSubjectByAddress, findCmaSubjectByMls, type CmaListingRow } from '@/lib/data/cma/builderReads'
import type { MarketPulse } from '@/lib/data/types/market'
import type { GeoType } from '@/lib/data/types/shared'
import {
  isSoldAttributionTrusted,
  publishMonthsOfSupply,
  publishSoldCount,
} from '@/lib/market/publish-months-of-supply'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import type { StudioFormat } from '@/lib/studio/formats'
import type { StudioSubject } from '@/lib/studio/produce'
import resortCommunities from '@/data/resort-communities.json'
import { communityPath } from '@/lib/communities/community-public-pair'
import { getBoundaryGeoJSON, type BoundaryGeometry } from '@/lib/data/geo/getBoundaryGeoJSON'
import { getCommunityOutlineGeoJSON } from '@/lib/data/geo/getCommunityOutline'
import { getNeighborhoodPublicInventory } from '@/lib/data/geo/neighborhood-public-inventory'
import { cityMarketPath } from '@/lib/market/canonical-market-path'
import type { MotionOutline, MotionSeries } from '@/lib/studio/motion/cues'
import { getStudioPriceSeries, type StudioSeriesMonth } from './series'

const SITE = 'https://ryan-realty.com'

/**
 * Where a caption's "Details at" sends someone, built only from the site's own
 * path helpers. A typed path went dead: market and trend captions linked
 * /market, which never existed (404, found live 2026-10-08).
 *   - a registry community: its community page;
 *   - a Bend district: the page the public inventory read names for it
 *     (/cities/bend/old-bend), the page that shows the same homes for sale;
 *   - anything else, and the region: Bend's market page.
 */
export function studioPlaceLink(community: { slug: string } | null, districtHref?: string | null): string {
  if (community) return `${SITE}${communityPath(community.slug)}`
  if (districtHref?.startsWith('/')) return `${SITE}${districtHref}`
  return `${SITE}${cityMarketPath('bend')}`
}

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

/**
 * Grains where getMarketPulse replaces the pulse active count, median list price
 * and months of supply with Market Truth cells (lib/data/market/getMarketPulse.ts).
 */
function overlaysMarketTruth(geoType: GeoType): boolean {
  return geoType === 'city' || geoType === 'region' || geoType === 'neighborhood' || geoType === 'community'
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

/** Trace for a figure getMarketPulse took from Market Truth rather than the pulse row. */
function marketTruthCitation(
  pulse: MarketPulse,
  statId: string,
  value: string,
  note?: string,
): Record<string, unknown> {
  // A community reads the neighborhood cell (same membership), per getMarketPulse.
  const geoType = pulse.geoType === 'community' ? 'neighborhood' : pulse.geoType
  return {
    figure: value,
    source: 'Supabase',
    table: 'market_metric (via getMarketPulse overlay)',
    column: 'value',
    filter: `stat_id='${statId}', geo_type='${geoType}', geo_slug='${pulse.geoSlug}', segment='detached', definition_id='mt-v1'`,
    ...(note ? { note } : {}),
    fetched_at: new Date().toISOString(),
    computed_at: pulse.refreshedAt,
  }
}

/**
 * Turn a pulse row into display figures plus their traces.
 * Null is not zero: a figure the cache withheld is omitted, never defaulted,
 * because a caption reading "0 active listings" would be a false statement
 * about the market rather than a missing one.
 */
export function figuresFromPulse(pulse: MarketPulse): {
  figures: Record<string, string>
  citations: Array<Record<string, unknown>>
} {
  const figures: Record<string, string> = {}
  const citations: Array<Record<string, unknown>> = []
  const grain = pulse.geoType
  const marketTruth = overlaysMarketTruth(grain)

  if (pulse.activeCount != null) {
    const value = String(pulse.activeCount)
    figures['active listings'] = value
    citations.push(
      marketTruth
        ? marketTruthCitation(pulse, 'active_count', value)
        : pulseCitation(pulse, 'active_count', value),
    )
  }
  if (pulse.medianListPrice != null && Number.isFinite(pulse.medianListPrice)) {
    const value = usd(pulse.medianListPrice)
    figures['median list price'] = value
    citations.push(
      marketTruth
        ? marketTruthCitation(
            pulse,
            'median_list_active',
            value,
            'getMarketPulse keeps the market_pulse_live median_list_price when the Market Truth inventory cell has no median',
          )
        : pulseCitation(pulse, 'median_list_price', value),
    )
  }
  // Closed-side figures publish only where closes are attributed like actives.
  const closed30 = publishSoldCount({
    value: pulse.closedLast30Days != null && pulse.closedLast30Days > 0 ? pulse.closedLast30Days : null,
    grain,
  })
  if (closed30 != null) {
    const value = String(closed30)
    figures['homes closed in the last 30 days'] = value
    citations.push(pulseCitation(pulse, 'sold_count_30d', value))
  }
  const mos = publishMonthsOfSupply({
    grain,
    pulseMos: pulse.monthsOfSupply,
    pulseActiveCount: pulse.activeCount,
    displayedActiveCount: pulse.activeCount,
    source: marketTruth ? 'market-truth' : 'pulse',
  })
  if (mos != null) {
    // Never round MoS by hand: 4.04 printed as "4.0" reads as a seller's
    // market when the raw value is not one. formatMonthsOfSupply holds the
    // threshold away from the boundary (G: ci:market-formula).
    const value = formatMonthsOfSupply(mos)
    figures['months of supply'] = value
    citations.push(
      marketTruth
        ? marketTruthCitation(pulse, 'months_of_supply', value)
        : pulseCitation(pulse, 'months_of_supply', value),
    )
  }
  if (
    isSoldAttributionTrusted(grain) &&
    pulse.medianDaysToPending != null &&
    Number.isFinite(pulse.medianDaysToPending)
  ) {
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
 * The listing agent, for the closing card. The listing-agent rule
 * (CLAUDE.md §3): a per-listing end card carries the LISTING agent's
 * headshot, resolved from the listings row (the CMA lookup already selects
 * list_agent_email and ListAgentName; email is not populated on every row,
 * so the name is the fallback). Another office's listing resolves to null and
 * gets no brand card.
 *
 * The roster falls back to Matt's portrait for a broker it has no file for,
 * so a portrait is accepted only when its file is named for this broker. A
 * card with the right name and no portrait beats a card with the wrong face.
 */
export async function studioListingAgent(row: CmaListingRow): Promise<MotionAgent | null> {
  const email = typeof row.list_agent_email === 'string' ? row.list_agent_email : null
  const name = typeof row.ListAgentName === 'string' ? row.ListAgentName : null
  if (!email && !name) return null
  try {
    const broker = await resolveListingAgent({ listAgentEmail: email, listAgentName: name })
    if (!broker) return null
    const lastName = broker.fullName.trim().split(/\s+/).pop()?.toLowerCase() ?? ''
    const path = broker.headshotPng ?? ''
    const ownPortrait =
      path.startsWith('/images/brokers/') && !path.includes('..') && lastName.length > 1 && path.toLowerCase().includes(lastName)
    return { name: broker.fullName, headshotPath: ownPortrait ? path : null }
  } catch {
    // An unreadable roster is the same as another office's listing: no brand card.
    return null
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

/** A trend film needs at least a year of published months to draw a line worth reading. */
const MIN_TREND_MONTHS = 12

function seriesCitation(geoSlug: string, month: StudioSeriesMonth, figureKey: string): Record<string, unknown> {
  return {
    figure: usd(month.value as number),
    // Two figures can print the same string; the key says which trace is whose.
    figure_key: figureKey,
    source: 'Supabase',
    table: 'market_metric (via getMetrics)',
    column: 'value',
    // The cell's own definition id, or none: a guessed one would not reproduce the row.
    filter: `stat_id='median_close', geo_type='city', geo_slug='${geoSlug}', segment='detached', window_months=1, period_end='${month.periodEnd}'${month.definitionId ? `, definition_id='${month.definitionId}'` : ''}`,
    rows: month.sampleN,
    fetched_at: new Date().toISOString(),
    computed_at: month.computedAt,
  }
}

/**
 * The trend film's line and its two labelled months, each with a §0 trace.
 * The unlabelled months are marks, not text, and their values ride in one
 * trace for the whole series, so a reviewer can check every point the line
 * passes through. Null when fewer than a year of months published.
 */
export async function studioTrend(geo: { geoSlug: string; place: string }): Promise<{
  series: MotionSeries
  figures: Record<string, string>
  citations: Array<Record<string, unknown>>
  /** What the film shows, exactly, for the caption writer. */
  describes: string
} | null> {
  const months = await getStudioPriceSeries({ geoType: 'city', geoSlug: geo.geoSlug })
  const plotted = months.filter((m) => m.value != null)
  if (plotted.length < MIN_TREND_MONTHS) return null
  const first = plotted[0]
  const last = plotted[plotted.length - 1]
  const firstKey = `median sale price, ${first.tick}`
  const lastKey = `median sale price, ${last.tick}`
  return {
    series: {
      title: 'Median sale price',
      scope: `Detached single-family homes sold in ${geo.place}, by month`,
      points: months.map((m) => ({ tick: m.tick, value: m.value })),
      firstKey,
      lastKey,
    },
    describes:
      `A navy line on cream paper of the median sale price of detached single-family homes in ${geo.place}, ` +
      `one point for each of ${plotted.length} published months from ${first.tick} to ${last.tick}` +
      `${plotted.length < months.length ? ` (${months.length - plotted.length} withheld months left as gaps)` : ''}, ` +
      `drawn on left to right, with the first and latest months labelled; then the months-of-supply meter.`,
    figures: { [firstKey]: usd(first.value as number), [lastKey]: usd(last.value as number) },
    citations: [
      seriesCitation(geo.geoSlug, first, firstKey),
      seriesCitation(geo.geoSlug, last, lastKey),
      {
        figure: 'the plotted line',
        source: 'Supabase',
        table: 'market_metric (via getMetrics)',
        column: 'value',
        filter: `stat_id='median_close', geo_type='city', geo_slug='${geo.geoSlug}', segment='detached', window_months=1, period_end ${months[0].periodEnd}..${months[months.length - 1].periodEnd}, published cells only`,
        rows: plotted.length,
        months: months.map((m) => ({ period_end: m.periodEnd, median_close: m.value, sample_n: m.sampleN })),
        fetched_at: new Date().toISOString(),
      },
    ],
  }
}

function ringsOf(geometry: BoundaryGeometry): Array<Array<[number, number]>> {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  return polygons.flatMap((polygon) => polygon.map((ring) => ring.map(([lng, lat]) => [lng, lat] as [number, number])))
}

/**
 * The map film's outlines: the place's recorded boundary (a registry
 * community's trusted outline, or the neighborhood row) and the city around
 * it. Null when the place has no stored outline; the city is optional.
 */
export async function studioOutline(
  slug: string,
  community: CommunityRow | null,
  citySlug: string,
): Promise<MotionOutline | null> {
  const [place, city] = await Promise.all([
    community ? getCommunityOutlineGeoJSON(community.slug) : getBoundaryGeoJSON({ geoType: 'neighborhood', geoSlug: slug }),
    getBoundaryGeoJSON({ geoType: 'city', geoSlug: citySlug }),
  ])
  if (!place) return null
  return { subject: ringsOf(place), context: city ? ringsOf(city) : null }
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
    const street = [row.StreetNumber, row.StreetName].filter(Boolean).join(' ').trim()
    return {
      label: shaped.label,
      heading: { eyebrow: String(row.City ?? '').trim(), line: street || shaped.label },
      agent: await studioListingAgent(row),
      figures: shaped.figures,
      citations: shaped.citations,
      sourcePhotoUrl: shaped.photoUrl,
      // The whole photo set, for formats that cut a sequence out of it.
      photoSetKey: String(row.ListingKey ?? '').trim(),
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
    const [row, district] = community
      ? [null, null]
      : await Promise.all([
          getMarketPulseRowForGeo({
            geoType: 'neighborhood',
            geoSlug: slug,
            columns: 'geo_slug, geo_label',
          }),
          getNeighborhoodPublicInventory(slug),
        ])
    const cacheLabel = typeof row?.geo_label === 'string' ? row.geo_label.trim() : ''
    const label = community
      ? `${community.label}, ${community.city}`
      : cacheLabel || titleCaseSlug(slug)
    const place = community
      ? `${community.label} near ${community.city}`
      : `${cacheLabel || titleCaseSlug(slug)}, Bend`

    const placeName = community ? community.label : cacheLabel || titleCaseSlug(slug)
    const cityName = community ? community.city : 'Bend'
    let outline: MotionOutline | undefined
    if (format.motion?.lead === 'map') {
      const found = await studioOutline(slug, community, community?.city_slug ?? 'bend')
      // A map film of a place with no recorded outline would be an invented
      // shape; there is no film to make.
      if (!found) return null
      outline = found
    }
    return {
      label,
      place,
      heading: { eyebrow: `${cityName}, Oregon`, line: placeName },
      figures: shaped.figures,
      citations: shaped.citations,
      ...(outline
        ? {
            outline,
            // The caption keeps to what the film shows: the count and the median under the map.
            captionKeys: ['active listings', 'median list price'],
            describes:
              `A map in navy on cream paper: ${outline.context ? `the ${cityName} city outline, the camera moving in to ` : ''}` +
              `${placeName}, its recorded outline drawing on and filling, then its live homes for sale and median list price.`,
          }
        : {}),
      ctaUrl: studioPlaceLink(community, district?.href),
    }
  }

  // subject === 'none': the region speaks for itself.
  const pulse = await getMarketPulse({ geoType: 'city', geoSlug: 'bend' })
  if (!pulse) return null
  const shaped = figuresFromPulse(pulse)
  if (shaped.citations.length === 0) return null
  if (format.motion?.lead === 'trend') {
    const trend = await studioTrend({ geoSlug: 'bend', place: 'Bend' })
    if (!trend) return null
    return {
      label: 'Bend, Oregon',
      place: 'Bend',
      figures: { ...shaped.figures, ...trend.figures },
      citations: [...shaped.citations, ...trend.citations],
      series: trend.series,
      describes: trend.describes,
      // The caption keeps to what the film shows: the two labelled months and the meter.
      captionKeys: [trend.series.firstKey, trend.series.lastKey, ...(shaped.figures['months of supply'] ? ['months of supply'] : [])],
      ctaUrl: studioPlaceLink(null),
    }
  }
  return {
    label: 'Bend, Oregon',
    place: 'Bend',
    figures: shaped.figures,
    citations: shaped.citations,
    ctaUrl: studioPlaceLink(null),
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
