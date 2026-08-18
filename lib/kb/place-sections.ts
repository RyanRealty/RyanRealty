/**
 * Shared section shaping for the three KB "place" pages:
 *
 *   app/cities/[slug]/page.tsx                      — city scope
 *   app/cities/[slug]/[neighborhoodSlug]/page.tsx   — neighborhood scope
 *   app/communities/[slug]/page.tsx                 — community scope
 *
 * Those three pages are near-duplicates BY DESIGN — the same KB section library
 * (components/site/kb/*, single-sourced by ci:kb-single-source G50), the same
 * funnel order, three different geographies. The section COMPONENTS were already
 * shared; the row-to-prop shaping under them was not, so the open-house
 * formatter, the activity-kind table, the article/ticker/map-feature builders and
 * the other-cities ledger existed as three byte-identical private copies. A fix
 * landed on one page and drifted on the other two (that is how the city page got
 * the stale-"New" relabel and the neighborhood page did not). This module is the
 * one copy.
 *
 * WHAT LIVES HERE: pure row-in / KB-prop-out shaping. No DAL calls, no scope
 * decisions, no labels.
 *
 * WHAT DELIBERATELY DOES NOT (§0 — a neighborhood page rendering city data under
 * a neighborhood label is far worse than a long file):
 *   · Which DAL function produced the rows, and with which geo key. City,
 *     neighborhood and community read different tables with different slug
 *     shapes; unifying that is how one scope's number ends up under another
 *     scope's heading.
 *   · Every eyebrow / heading / subtitle string. The open-house and activity
 *     feeds are fetched CITY-wide on all three pages, so each page labels them
 *     with the city on purpose. The hero count continuation is the exception:
 *     it goes through `placeHeroLead` so a neighborhood/community count cannot
 *     read as the parent city's.
 *   · The active-count resolution. Each page has its own priority chain
 *     (alias-aware resort count · in-boundary pins · pulse · snapshot) and
 *     ci:count-degraded-read Rule 1 reads the `activeCount` declaration inside
 *     the page file. It stays where the gate can see it, typed `number | null`.
 */

import { formatDate } from '@/lib/format/date'
import { cityHero } from '@/lib/geo-images'
import { publishStreetLine, publishUnparsedStreetLine } from '@/lib/listing/publish-street-line'
import { listingTileHref } from '@/lib/slug'
import type { KbActivityItem } from '@/components/site/kb/KbActivity.client'
import type { KbArticlePost } from '@/components/site/kb/KbArticles'
import type { KbMapFeature } from '@/components/site/kb/KbListingMap.client'
import type { KbOpenHouseItem } from '@/components/site/kb/KbOpenHouses.client'
import type { KbTickerItem, KbTownItem } from '@/components/site/kb/types'

/**
 * Central Oregon service area — the only city slugs the "Explore other cities"
 * ledger may link. getAllCitySnapshots returns the statewide MLS set, so without
 * the allowlist a Bend page starts linking Medford.
 */
export const CENTRAL_OREGON_CITY_SLUGS = new Set([
  'bend', 'redmond', 'sisters', 'la-pine', 'sunriver', 'madras',
  'prineville', 'culver', 'terrebonne', 'tumalo', 'powell-butte',
])

// ── Structural row shapes ────────────────────────────────────────────────────
// Deliberately structural (the pattern lib/kb/resort-active-counts.ts uses) so
// this module does not depend on app/actions/*. TypeScript is structural, so the
// real DAL/action row types satisfy these without an import cycle.

/** A listing_tile_mv row, as far as the map / ticker are concerned. */
type TileRow = {
  listingKey?: string | null
  listNumber?: string | null
  listPrice: number | null
  beds: number | null
  baths: number | null
  sqft: number | null
  streetNumber: string | null
  streetName: string | null
  streetSuffix?: string | null
  subdivisionName: string | null
  city: string | null
  photoUrl: string | null
  lat: number | null
  lng: number | null
  boundaryCity?: string | null
  boundaryNeighborhood?: string | null
}

/** An open_houses row joined to its listing (app/actions/open-houses). */
type OpenHouseRow = {
  listing_key: string
  street_number: string | null
  street_name: string | null
  city: string | null
  photo_url: string | null
  list_price: number | null
  unparsed_address: string | null
  subdivision_name: string | null
  beds_total: number | null
  baths_full: number | null
  living_area: number | null
  event_date: string
  start_time: string | null
  end_time: string | null
}

/** An activity_events row joined to its listing (ActivityFeedItem). */
type ActivityRow = {
  event_type: string
  event_at: string
  listing_key: string
  StreetNumber?: string | null
  StreetName?: string | null
  StreetSuffix?: string | null
  City?: string | null
  SubdivisionName?: string | null
  ListPrice?: number | null
  PhotoURL?: string | null
}

/** A published blog_posts card (BlogPostCard). */
type BlogPostRow = {
  title: string
  slug: string
  excerpt: string | null
  heroImageUrl: string | null
  publishedAt: string | null
}

/** A geo_snapshot_mv city row (GeoSnapshot). */
type CitySnapshotRow = {
  geoKey: string
  geoLabel: string
  activeSfrCount: number
  medianListPrice: number | null
}

/** A market_stats_cache monthly point (getPriceHistory). */
type PricePoint = {
  periodStart: string
  medianSalePrice: number | null
}

// ── Formatting ───────────────────────────────────────────────────────────────
//
// Every date here is a CALENDAR DATE out of the MLS / market cache (an
// open-house day, a period_start month, an event day), not an instant. They
// format in UTC on purpose: rendering a bare `2026-03-01` in the brand's Pacific
// zone shifts it to Feb 28, which would date an open house a day early and label
// a monthly median with the wrong month (§0). The `timeZone: 'UTC'` override on
// the canonical formatDate is that intent, written down.

/** "2026-03-01" -> "Mar". */
export function monthLabel(iso?: string): string {
  return iso ? formatDate(iso, { month: 'short', day: undefined, year: undefined, timeZone: 'UTC' }) : ''
}

/**
 * "Sat, Mar 14 · 11am-1pm" from an open-house date + time window. Minutes are
 * dropped when they are :00 so the common case reads as a clean hour. Noon UTC
 * anchors the day so no rounding can walk it across a date boundary.
 */
export function formatOpenHouseWhen(eventDate: string, start: string | null, end: string | null): string {
  const day = formatDate(eventDate + 'T12:00:00Z', {
    weekday: 'short', month: 'short', day: 'numeric', year: undefined, timeZone: 'UTC',
  })
  const t = (s: string | null) => {
    if (!s) return ''
    const [h, m] = s.split(':')
    const hr = Number(h)
    const ap = hr >= 12 ? 'pm' : 'am'
    const h12 = hr % 12 === 0 ? 12 : hr % 12
    return m && m !== '00' ? `${h12}:${m}${ap}` : `${h12}${ap}`
  }
  const range = start && end ? `${t(start)}-${t(end)}` : start ? t(start) : ''
  return [day, range].filter(Boolean).join(' · ')
}

/** MLS event_type -> the KB activity row's kind + display label. */
export const ACTIVITY_KIND: Record<string, { kind: string; label: string }> = {
  new_listing: { kind: 'new', label: 'New' },
  price_drop: { kind: 'price_drop', label: 'Price cut' },
  status_pending: { kind: 'pending', label: 'Pending' },
  status_closed: { kind: 'sold', label: 'Sold' },
  back_on_market: { kind: 'new', label: 'Back on market' },
  status_expired: { kind: 'expired', label: 'Off market' },
}

// ── Builders ─────────────────────────────────────────────────────────────────

/** Open-house rows -> KbOpenHouses cards, newest window first (source order). */
export function buildOpenHouseItems(rows: readonly OpenHouseRow[], limit = 6): KbOpenHouseItem[] {
  return rows.slice(0, limit).map((oh) => ({
    href: listingTileHref({
      listingKey: oh.listing_key, streetNumber: oh.street_number, streetName: oh.street_name, city: oh.city,
    }),
    photoUrl: oh.photo_url,
    price: oh.list_price,
    address:
      publishUnparsedStreetLine(oh.unparsed_address) ??
      publishStreetLine({ streetNumber: oh.street_number, streetName: oh.street_name }) ??
      'Address on request',
    cityLine: [oh.city, oh.subdivision_name].filter(Boolean).join(' · '),
    beds: oh.beds_total,
    baths: oh.baths_full,
    sqft: oh.living_area,
    whenLabel: formatOpenHouseWhen(oh.event_date, oh.start_time, oh.end_time),
  }))
}

/**
 * Activity rows -> KbActivity ledger rows.
 *
 * `staleNewAfterDays` (design-audit TRU-2): a `new_listing` event older than the
 * cutoff keeps its real date but drops the "New" tag for "Listed", so a stale
 * feed stops reading as brand-new. It relabels only — no market figure moves.
 * Pass nothing to leave every event labeled exactly as the feed reports it.
 */
export function buildActivityItems(
  rows: readonly ActivityRow[],
  opts: { limit?: number; staleNewAfterDays?: number } = {},
): KbActivityItem[] {
  const { limit = 8, staleNewAfterDays } = opts
  return rows.slice(0, limit).map((a) => {
    const km = ACTIVITY_KIND[a.event_type] ?? { kind: a.event_type, label: a.event_type }
    const daysOld = a.event_at ? (Date.now() - new Date(a.event_at).getTime()) / 86_400_000 : Infinity
    const staleNew = staleNewAfterDays != null && km.label === 'New' && daysOld > staleNewAfterDays
    return {
      kind: staleNew ? 'listed' : km.kind,
      label: staleNew ? 'Listed' : km.label,
      address:
        publishStreetLine({
          streetNumber: a.StreetNumber,
          streetName: a.StreetName,
          streetSuffix: a.StreetSuffix,
        }) || 'Address on request',
      cityLine: [a.City, a.SubdivisionName].filter(Boolean).join(' · '),
      price: a.ListPrice ?? null,
      imageUrl: a.PhotoURL ?? null,
      href: listingTileHref({ listingKey: a.listing_key, streetNumber: a.StreetNumber ?? null, streetName: a.StreetName ?? null, city: a.City ?? null }),
      whenLabel: a.event_at
        ? formatDate(a.event_at, { month: 'short', day: 'numeric', year: undefined, timeZone: 'UTC' })
        : '',
    }
  })
}

/** Published blog posts -> KbArticles cards. */
export function buildArticlePosts(posts: readonly BlogPostRow[]): KbArticlePost[] {
  return posts.map((p) => ({
    title: p.title,
    href: `/blog/${p.slug}`,
    excerpt: p.excerpt,
    imageUrl: p.heroImageUrl,
    dateLabel: p.publishedAt ? formatDate(p.publishedAt, { timeZone: 'UTC' }) : null,
  }))
}

/**
 * City snapshots -> the "Explore other cities" ledger, filtered to the service
 * area. `excludeSlug` drops the city the reader is already on (the city page
 * passes it; a neighborhood/community page links its own parent city on purpose).
 * Imagery resolves ONLY through the verified cityHero registry — an unverified
 * city renders no thumbnail rather than a wrong-city photo (§D86).
 */
export function buildOtherCityItems(
  snapshots: readonly CitySnapshotRow[],
  opts: { excludeSlug?: string; limit?: number } = {},
): KbTownItem[] {
  const { excludeSlug, limit = 8 } = opts
  return snapshots
    .map((s) => ({ s, cs: s.geoKey.replace(/\s+/g, '-') }))
    .filter(({ cs }) => cs !== excludeSlug && CENTRAL_OREGON_CITY_SLUGS.has(cs))
    .slice(0, limit)
    .map(({ s, cs }) => {
      const hero = cityHero(cs)
      return {
        name: s.geoLabel,
        href: `/cities/${cs}`,
        activeCount: s.activeSfrCount > 0 ? s.activeSfrCount : 0,
        medianPrice: s.medianListPrice ?? null,
        img: hero.verified ? hero.src : '',
      }
    })
}

/** Listing tiles -> KbListingMap Point features. Tiles without coords are dropped. */
export function buildMapPointFeatures(tiles: readonly TileRow[]): KbMapFeature[] {
  return tiles
    .filter((t) => t.lat != null && t.lng != null)
    .map((t) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [Number(t.lng), Number(t.lat)] as [number, number] },
      properties: {
        p: t.listPrice, bd: t.beds, ba: t.baths, sf: t.sqft,
        a:
          publishStreetLine({
            streetNumber: t.streetNumber,
            streetName: t.streetName,
            streetSuffix: t.streetSuffix,
          }) ?? '',
        sub: t.subdivisionName ?? '', city: t.city ?? '', img: t.photoUrl ?? '',
        k: t.listingKey ?? undefined,
        // Popup + pin must open the listing detail page (not a dead info card).
        href: t.listingKey
          ? listingTileHref({
              listingKey: t.listingKey,
              listNumber: t.listNumber,
              streetNumber: t.streetNumber,
              streetName: t.streetName,
              city: t.city,
              subdivisionName: t.subdivisionName,
              boundaryCity: t.boundaryCity,
              boundaryNeighborhood: t.boundaryNeighborhood,
            })
          : undefined,
      },
    }))
}

/**
 * Listing tiles -> the price/address tape. `fallbackTown` is what a tile with no
 * City renders: the city page passes '' (the tape spans one city and the column
 * would be noise), a neighborhood/community page passes its city name.
 */
export function buildTickerItems(tiles: readonly TileRow[], fallbackTown: string, limit = 6): KbTickerItem[] {
  return tiles.slice(0, limit).map((t) => ({
    price: t.listPrice,
    address:
      publishStreetLine({
        streetNumber: t.streetNumber,
        streetName: t.streetName,
        streetSuffix: t.streetSuffix,
      }) ?? '',
    town: t.city ?? fallbackTown,
  }))
}

/** Monthly close-price history -> the HUD trend series (most recent `months`). */
export function buildMonthlyTrend(rows: readonly PricePoint[], months = 13): { label: string; value: number }[] {
  return rows
    .slice(-months)
    .filter((p) => p.medianSalePrice != null)
    .map((p) => ({ label: monthLabel(p.periodStart), value: p.medianSalePrice as number }))
}

/**
 * Is this close-sale series too thin to draw a real multi-year trend?
 *
 * Subdivision and neighborhood sales are sparse — often only the last month or
 * two are cached — which renders a degenerate one-point stub on a flat axis. Under
 * 8 monthly points OR under 2 calendar years, the caller falls back to the parent
 * CITY's series and MUST relabel it (chartScopeLabel) so a city figure is never
 * passed off as the smaller geography's (§0).
 */
export function isTrendSeriesTooSparse(rows: readonly PricePoint[]): boolean {
  const points = rows.filter((p) => p.medianSalePrice != null)
  const years = new Set(points.map((p) => new Date(p.periodStart).getUTCFullYear()))
  return points.length < 8 || years.size < 2
}
