/**
 * lib/data/studio/triggers.ts — the real events the slate reacts to.
 *
 * Two column facts that are easy to get wrong and fail silently:
 *   - SFR is `property_sub_type` (bare lower case), NOT `PropertySubType`.
 *     The mixed-case name does not exist and PostgREST answers with an error
 *     the caller then swallows, so the slate quietly sees zero new listings.
 *   - Resort communities live in market_pulse_live under geo_type
 *     'neighborhood'. There are ZERO rows at geo_type 'community', so a
 *     community lookup returns null forever.
 *
 * Reads the market cache, not raw `listings` aggregates (CLAUDE.md §7). The
 * new-listing lookup is the one narrow exception: it needs individual rows,
 * so it is a tight, indexed, photo-required query with a hard limit rather
 * than an aggregate.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { getMarketPulseRowsByGeoType } from '@/lib/data/market/getMarketStatsCacheRows'
import type { StudioTrigger } from '@/lib/studio/slate'

/** How far back a listing still counts as news. */
const NEW_LISTING_DAYS = 3

/** A community needs enough on the market to be worth a film. */
const MIN_COMMUNITY_ACTIVE = 4

async function newListingTriggers(): Promise<StudioTrigger[]> {
  try {
    const sb = createServiceClient()
    const since = new Date(Date.now() - NEW_LISTING_DAYS * 86_400_000).toISOString()
    const { data, error } = await sb
      .from('listings')
      .select('ListingKey, ListNumber, StreetNumber, StreetName, City, ListPrice, PhotoURL, OnMarketDate')
      .eq('StandardStatus', 'Active')
      .eq('property_sub_type', 'Single Family Residence')
      .gte('OnMarketDate', since)
      .not('PhotoURL', 'is', null)
      .order('OnMarketDate', { ascending: false })
      .limit(10)
    if (error || !data) {
      // A swallowed error here reads as "nothing is on the market", which is
      // a lie the slate would act on. Say so.
      if (error) console.error('[studio/triggers] new listings query failed:', error.message)
      return []
    }

    return data
      .filter((row) => /^https?:\/\//i.test(String(row.PhotoURL ?? '')))
      .map((row) => {
        const street = [row.StreetNumber, row.StreetName].filter(Boolean).join(' ').trim()
        const city = String(row.City ?? '').trim()
        const price = Number(row.ListPrice)
        return {
          kind: 'new_listing' as const,
          // The MLS number is the least ambiguous handle we have.
          query: String(row.ListNumber ?? '').trim() || `${street}, ${city}`,
          label: [street, city].filter(Boolean).join(', '),
          // Newer and pricier listings earn the slot. Price is a proxy for
          // how much attention the post is worth, not for how good the house is.
          weight: Number.isFinite(price) ? Math.min(100, price / 25_000) : 10,
        }
      })
      .filter((t) => t.query.length > 0)
  } catch (err) {
    console.error('[studio/triggers] new listings threw:', err)
    return []
  }
}

async function communityTriggers(): Promise<StudioTrigger[]> {
  try {
    const rows = await getMarketPulseRowsByGeoType({
      geoType: 'neighborhood',
      minActiveCount: MIN_COMMUNITY_ACTIVE,
      columns: 'geo_slug, geo_label, active_count',
    })
    return rows
      .map((row) => ({
        kind: 'community_inventory' as const,
        query: String(row.geo_slug ?? ''),
        label: String(row.geo_label ?? row.geo_slug ?? ''),
        weight: Number(row.active_count ?? 0),
      }))
      .filter((t) => t.query.length > 0)
  } catch (err) {
    console.error('[studio/triggers] community pulse threw:', err)
    return []
  }
}

/** Everything the slate gets to choose from this morning. */
export async function getRecentStudioTriggers(): Promise<StudioTrigger[]> {
  const [listings, communities] = await Promise.all([newListingTriggers(), communityTriggers()])
  return [...listings, ...communities]
}
