/**
 * Listing-alerts match engine.
 *
 * For a single subscriber's criteria, returns the set of MLS listings that
 * (a) are currently Active, (b) match the buyer's price/beds/baths/sqft
 * window, (c) sit inside the requested geography (community or city), and
 * (d) have changed in the lookback window (new listing OR price drop).
 *
 * Source spec: marketing_brain_skills/producers/listing-alerts/SKILL.md §4.1 Step 6.
 * Source of truth for columns: docs/DATABASE_FOR_AI_AGENTS.md (listings table,
 * mixed-case columns — must be quoted with double quotes in raw SQL; in the
 * supabase-js select() string they are referenced bare and the client handles
 * the quoting).
 *
 * Geo filter strategy:
 *   - community_slug → look up subdivision_aliases from data/resort-communities.json
 *     and filter by `SubdivisionName in (aliases)`.
 *   - city_slug → filter by `City ilike <city>` (canonical City column).
 *   - Both nullable, but the subscribe endpoint guarantees at least one.
 *
 * Match types produced:
 *   - 'new' — listing was added or status flipped to Active in the lookback
 *     window (ModificationTimestamp >= since).
 *   - 'price_drop' — currently Active and OriginalListPrice − ListPrice ≥ 5%
 *     AND the change happened in the lookback window. Handled in a follow-up
 *     pass once price-history wiring is fully verified end-to-end; for v1 we
 *     surface every listing that satisfies (a)-(d) as match_type='new'.
 *
 * Idempotency: callers persist matches into public.listing_alert_matches
 * keyed by (alert_id, listing_id, match_type) so a re-run within the same
 * window won't double-send.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'

import { createServiceClient } from '@/lib/supabase/service'
import type { ListingAlertRow, MatchedListing, ResortCommunityAliases } from '@/lib/listing-alerts/types'

/** Hard cap on listings returned per subscriber per digest. */
export const MAX_MATCHES_PER_DIGEST = 50

/** Min price drop (as a fraction of OriginalListPrice) to count as a 'price_drop' match. */
export const PRICE_DROP_THRESHOLD = 0.05

type RawListingRow = {
  ListingKey: string | null
  ListNumber: string | null
  ListPrice: number | null
  OriginalListPrice: number | null
  StreetNumber: string | null
  StreetName: string | null
  City: string | null
  State: string | null
  PostalCode: string | null
  BedroomsTotal: number | null
  BathroomsTotal: number | null
  TotalLivingAreaSqFt: number | null
  CumulativeDaysOnMarket: number | null
  PhotoURL: string | null
  SubdivisionName: string | null
  StandardStatus: string | null
  ModificationTimestamp: string | null
}

let _aliasCache: { loadedAt: number; aliases: Record<string, string[]> } | null = null
const ALIAS_TTL_MS = 5 * 60 * 1000

/**
 * Load subdivision_aliases from data/resort-communities.json (project root) for
 * every resort community in one read. Cached for 5 min in process memory.
 */
async function loadAllResortAliases(): Promise<Record<string, string[]>> {
  if (_aliasCache && Date.now() - _aliasCache.loadedAt < ALIAS_TTL_MS) {
    return _aliasCache.aliases
  }
  const out: Record<string, string[]> = {}

  // Master registry — canonical list of every community + aliases.
  const masterPath = path.join(process.cwd(), 'data', 'resort-communities.json')
  try {
    const raw = await fs.readFile(masterPath, 'utf8')
    const parsed = JSON.parse(raw) as { communities?: ResortCommunityAliases[] }
    const communities = Array.isArray(parsed.communities) ? parsed.communities : []
    for (const c of communities) {
      if (!c?.slug) continue
      const aliases = Array.isArray(c.subdivision_aliases) ? c.subdivision_aliases.filter((s) => typeof s === 'string' && s.trim()) : []
      out[c.slug] = aliases
    }
  } catch (err) {
    console.warn('[listing-alerts/match-engine] resort-communities.json read failed:', err)
  }

  // Per-community files override (e.g. data/resort-community-tetherow.json).
  // Read directory contents and only the files that match the pattern.
  try {
    const dataDir = path.join(process.cwd(), 'data')
    const entries = await fs.readdir(dataDir, { withFileTypes: true })
    for (const ent of entries) {
      if (!ent.isFile() || !ent.name.startsWith('resort-community-') || !ent.name.endsWith('.json')) continue
      const full = path.join(dataDir, ent.name)
      try {
        const raw = await fs.readFile(full, 'utf8')
        const parsed = JSON.parse(raw) as Partial<ResortCommunityAliases>
        if (parsed?.slug && Array.isArray(parsed.subdivision_aliases)) {
          out[parsed.slug] = parsed.subdivision_aliases.filter((s) => typeof s === 'string' && s.trim())
        }
      } catch (err) {
        console.warn(`[listing-alerts/match-engine] ${ent.name} read failed:`, err)
      }
    }
  } catch {
    // dir missing is fine
  }

  _aliasCache = { loadedAt: Date.now(), aliases: out }
  return out
}

/**
 * Resolve subdivision aliases for a community slug. Returns [] if unknown so
 * callers can fall back to the city filter or skip the geo gate entirely.
 */
export async function getCommunitySubdivisionAliases(communitySlug: string): Promise<string[]> {
  const all = await loadAllResortAliases()
  return all[communitySlug] ?? []
}

function toMatchedListing(row: RawListingRow, matchType: 'new' | 'price_drop' = 'new'): MatchedListing {
  const priceDelta =
    row.OriginalListPrice && row.ListPrice && row.OriginalListPrice > row.ListPrice
      ? row.ListPrice - row.OriginalListPrice
      : null
  return {
    listingId: row.ListingKey ?? row.ListNumber ?? '',
    listPrice: row.ListPrice,
    originalListPrice: row.OriginalListPrice,
    streetNumber: row.StreetNumber,
    streetName: row.StreetName,
    city: row.City,
    state: row.State,
    postalCode: row.PostalCode,
    bedroomsTotal: row.BedroomsTotal,
    bathroomsTotal: row.BathroomsTotal,
    totalLivingAreaSqFt: row.TotalLivingAreaSqFt,
    cumulativeDaysOnMarket: row.CumulativeDaysOnMarket,
    photoURL: row.PhotoURL,
    subdivisionName: row.SubdivisionName,
    standardStatus: row.StandardStatus,
    modificationTimestamp: row.ModificationTimestamp,
    matchType,
    priceDelta,
  }
}

/**
 * Find matching MLS listings for a single alert subscriber.
 *
 * @param alert    The subscriber row (community/city + criteria).
 * @param since    Only listings whose ModificationTimestamp >= since are
 *                 candidate matches. Use the last 24-h window for daily cron.
 * @param options  optional override: cap (default MAX_MATCHES_PER_DIGEST).
 */
export async function findMatches(
  alert: Pick<ListingAlertRow, 'community_slug' | 'city_slug' | 'criteria'>,
  since: Date,
  options?: { cap?: number },
): Promise<MatchedListing[]> {
  const cap = Math.max(1, Math.min(MAX_MATCHES_PER_DIGEST, options?.cap ?? MAX_MATCHES_PER_DIGEST))
  const c = alert.criteria
  const propertyType = c.property_type ?? 'A'

  const supabase = createServiceClient()
  let q = supabase
    .from('listings')
    .select(
      [
        'ListingKey',
        'ListNumber',
        'ListPrice',
        'OriginalListPrice',
        'StreetNumber',
        'StreetName',
        'City',
        'State',
        'PostalCode',
        'BedroomsTotal',
        'BathroomsTotal',
        'TotalLivingAreaSqFt',
        'CumulativeDaysOnMarket',
        'PhotoURL',
        'SubdivisionName',
        'StandardStatus',
        'ModificationTimestamp',
      ].join(','),
    )
    .eq('StandardStatus', 'Active')
    .eq('PropertyType', propertyType)
    .gte('ListPrice', c.price_min)
    .lte('ListPrice', c.price_max)
    .gte('BedroomsTotal', c.beds_min)
    .gte('ModificationTimestamp', since.toISOString())
    .order('ModificationTimestamp', { ascending: false })
    .limit(cap)

  if (typeof c.baths_min === 'number' && c.baths_min > 0) {
    q = q.gte('BathroomsTotal', c.baths_min)
  }
  if (typeof c.sqft_min === 'number' && c.sqft_min > 0) {
    q = q.gte('TotalLivingAreaSqFt', c.sqft_min)
  }
  if (typeof c.subdivision === 'string' && c.subdivision.trim()) {
    q = q.eq('SubdivisionName', c.subdivision.trim())
  }

  // Geo filter — community wins if both are set.
  if (alert.community_slug?.trim()) {
    const aliases = await getCommunitySubdivisionAliases(alert.community_slug.trim())
    if (aliases.length > 0) {
      q = q.in('SubdivisionName', aliases)
    } else {
      // Unknown community slug — return empty rather than blasting the whole MLS.
      console.warn(`[listing-alerts/match-engine] no aliases for community_slug=${alert.community_slug}; returning 0 matches`)
      return []
    }
  } else if (alert.city_slug?.trim()) {
    // Map a few common city slugs to canonical City values.
    const cityMap: Record<string, string> = {
      bend: 'Bend',
      redmond: 'Redmond',
      sisters: 'Sisters',
      'la-pine': 'La Pine',
      sunriver: 'Sunriver',
      tumalo: 'Tumalo',
      terrebonne: 'Terrebonne',
      madras: 'Madras',
      prineville: 'Prineville',
    }
    const cityName = cityMap[alert.city_slug.trim().toLowerCase()] ?? alert.city_slug.trim()
    q = q.eq('City', cityName)
  } else {
    console.warn('[listing-alerts/match-engine] alert has neither community_slug nor city_slug; returning 0 matches')
    return []
  }

  const { data, error } = await q
  if (error) {
    console.error('[listing-alerts/match-engine] listings query failed:', error)
    throw new Error(`Listings query failed: ${error.message}`)
  }

  const rows = (data ?? []) as unknown as RawListingRow[]
  return rows.map((row) => {
    const isPriceDrop =
      row.OriginalListPrice != null &&
      row.ListPrice != null &&
      row.OriginalListPrice > 0 &&
      (row.OriginalListPrice - row.ListPrice) / row.OriginalListPrice >= PRICE_DROP_THRESHOLD
    return toMatchedListing(row, isPriceDrop ? 'price_drop' : 'new')
  })
}
