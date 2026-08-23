/**
 * GET /data/market/<geoType>/<geoSlug>  — machine-readable per-geography market JSON.
 *
 * Audit item 12: the live per-geography market layer (market_pulse_live) with a
 * published methodology is the site's most citable asset — make it fetchable
 * as data, not just prose baked into a rendered page.
 *
 * URL examples (verified live 2026-08-03):
 *   /data/market/city/bend                 — city
 *   /data/market/city/la-pine               — city (hyphens normalized to the
 *                                             DB's space-separated slug, see below)
 *   /data/market/community/tetherow         — resort community ('community' is
 *                                             an alias for the DB's geo_type='neighborhood')
 *   /data/market/neighborhood/tetherow      — same row, DB-native alias
 *   /data/market/neighborhood/bend-awbrey-butte — in-city Bend neighborhood
 *   /data/market/region/central-oregon      — region roll-up
 *
 * A trailing `-market.json` or `.json` on the slug is accepted and stripped, so
 * the endpoint is also reachable as the LLM-citation-friendly
 * /data/market/city/bend-market.json — the flat-file shape a crawler expects.
 *
 * Data ONLY through @/lib/data/market/getMarketPulseJsonFeed, which reads
 * ONLY through the existing getMarketPulseRowForGeo DAL export (G1 — no raw
 * `.from()` in this file).
 *
 * §0 degraded-read contract: a failed or empty pulse read returns explicit
 * nulls + a note, never a fabricated 0 (scripts/check-count-from-degraded-read.mjs).
 * The months-of-supply formula text comes from MOS_METHODOLOGY_CLAUSE and the
 * verdict from marketVerdict() — both imported, never recomputed here.
 */

import { NextResponse } from 'next/server'
import {
  getMarketPulseJsonFeed,
  type PulseGeoType,
} from '@/lib/data/market/getMarketPulseJsonFeed'
import { CACHE_WINDOWS } from '@/lib/data/cache/unstable-cache'

// market_pulse_live refreshes on a 15-minute cadence (CACHE_WINDOWS.marketPulse
// = 900, docs/DATABASE_FOR_AI_AGENTS.md). Cache the JSON response to that same
// window rather than inventing a different number.
//
// Written as a LITERAL on purpose. Next requires segment config exports to be
// statically analyzable, so `export const revalidate = CACHE_WINDOWS.marketPulse`
// fails the build with "Invalid segment configuration export detected" — and the
// message names no file, so it is worth a comment. The assertion below keeps the
// literal honest: if CACHE_WINDOWS.marketPulse ever moves off 900, typecheck fails
// here instead of this route silently drifting out of step with the data.
export const revalidate = 900

const _revalidateMatchesCacheWindow: 900 = CACHE_WINDOWS.marketPulse

const ALLOWED_GEO_TYPES = new Set(['city', 'neighborhood', 'community', 'region'])

/** 'community' is the site's public vocabulary for the DB's geo_type='neighborhood' rows. */
function resolveDbGeoType(pathGeoType: string): PulseGeoType | null {
  const lower = pathGeoType.toLowerCase().trim()
  if (lower === 'community') return 'neighborhood'
  if (lower === 'city' || lower === 'neighborhood' || lower === 'region') return lower
  return null
}

/** Strip an optional `-market.json` / `.json` suffix so the flat-file-looking URL still resolves. */
function stripJsonSuffix(rawSlug: string): string {
  return rawSlug.replace(/-market\.json$/i, '').replace(/\.json$/i, '')
}

/**
 * market_pulse_live city rows are keyed space-separated ('la pine', 'black
 * butte ranch' — verified live 2026-08-03), but every on-site city URL is
 * hyphenated ('la-pine'). Neighborhood + region rows are keyed hyphenated
 * already ('bend-awbrey-butte', 'central-oregon') and must NOT be touched —
 * see lib/data/geo/getGeoSnapshot.ts for the identical precedent.
 */
function normalizeSlug(dbGeoType: PulseGeoType, rawSlug: string): string {
  const cleaned = decodeURIComponent(stripJsonSuffix(rawSlug)).toLowerCase().trim()
  return dbGeoType === 'city' ? cleaned.replace(/-/g, ' ') : cleaned
}

const SOURCE = {
  name: 'Oregon Data Share',
  via: 'Ryan Realty market_pulse_live cache',
  table: 'public.market_pulse_live',
} as const

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ geoType: string; geoSlug: string }> },
) {
  const { geoType: rawGeoType, geoSlug: rawGeoSlug } = await params

  if (!ALLOWED_GEO_TYPES.has(rawGeoType.toLowerCase().trim())) {
    return NextResponse.json(
      {
        error: 'invalid_geo_type',
        message: `geoType must be one of: ${[...ALLOWED_GEO_TYPES].join(', ')}. Got '${rawGeoType}'.`,
      },
      { status: 400 },
    )
  }

  const dbGeoType = resolveDbGeoType(rawGeoType)
  if (!dbGeoType || !rawGeoSlug) {
    return NextResponse.json({ error: 'invalid_geo_type' }, { status: 400 })
  }

  const geoSlug = normalizeSlug(dbGeoType, rawGeoSlug)
  if (!geoSlug) {
    return NextResponse.json({ error: 'invalid_geo_slug' }, { status: 400 })
  }

  const feed = await getMarketPulseJsonFeed({ geoType: dbGeoType, geoSlug })

  // NextResponse.json sets Content-Type: application/json (with charset) on
  // its own — only Cache-Control needs to be stated here. Matches
  // market_pulse_live's own refresh cadence (15 min): public CDN cache for
  // that long, serve stale for a further 30 min while revalidation runs.
  const headers = {
    'Cache-Control': `public, max-age=${CACHE_WINDOWS.marketPulse}, stale-while-revalidate=1800`,
  }

  if (feed.status === 'not_found') {
    return NextResponse.json(
      {
        geography: { requestedType: rawGeoType, dbGeoType, slug: geoSlug, label: null },
        available: false,
        degraded: false,
        note: feed.note,
        source: SOURCE,
      },
      { status: 404, headers },
    )
  }

  if (feed.status === 'degraded') {
    // Transient DB error, not a genuine miss — the endpoint itself is healthy,
    // so 200 with an honest "unavailable" body rather than a 404 or 500 that
    // would misrepresent a temporary blip as a permanently missing resource.
    return NextResponse.json(
      {
        geography: { requestedType: rawGeoType, dbGeoType, slug: geoSlug, label: null },
        available: false,
        degraded: true,
        note: feed.note,
        source: SOURCE,
      },
      { status: 200, headers: { ...headers, 'Cache-Control': 'no-store' } },
    )
  }

  return NextResponse.json(
    {
      geography: {
        requestedType: rawGeoType,
        dbGeoType: feed.geoType,
        slug: feed.geoSlug,
        label: feed.geoLabel,
      },
      available: true,
      degraded: false,
      note: feed.note,
      period: {
        collectionPeriod: 'current snapshot, not a date range',
        collectedAt: feed.collectedAt,
        refreshFrequency: '10-15 minutes',
        propertyType:
          feed.geoType === 'city' || feed.geoType === 'region'
            ? "Detached single-family (PropertyType='A' AND property_sub_type='Single Family Residence')"
            : "SFR only (MLS PropertyType = 'A')",
      },
      figures: feed.figures,
      leftover: feed.leftover,
      methodology: feed.methodology,
      source: SOURCE,
    },
    { status: 200, headers },
  )
}
