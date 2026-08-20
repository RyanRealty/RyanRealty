/**
 * getGolfHomesForLanding — a page of active golf-course homes for the
 * on-golf-course landing, via the lightweight search_golf_homes RPC.
 *
 * WHY A DEDICATED PATH: the full search_listings_advanced RPC computes a
 * count(*) OVER () full_count, which golf-filters every Bend row (~134K) to
 * count matches (~7s, risks a serverless timeout). The landing only needs a
 * page of homes, so this drops the window — with LIMIT + the City trigram
 * index it returns in well under a second.
 */
import { supabaseAnon } from '@/lib/data/client'
import { getListingTiles } from '@/lib/data/listings/getListingTiles'

export type GolfHomeRow = {
  ListNumber: string | null
  ListingKey: string | null
  ListPrice: number | null
  BedroomsTotal: number | null
  BathroomsTotal: number | null
  StreetNumber: string | null
  StreetName: string | null
  City: string | null
  State: string | null
  PostalCode: string | null
  PhotoURL: string | null
  TotalLivingAreaSqFt: number | null
  Latitude: number | null
  Longitude: number | null
  /**
   * What kind of listing this is. The landing card publishes an asking price
   * off ListPrice, and `search_golf_homes` selects a row whose remarks or View
   * mention golf WITHOUT constraining PropertyType — so 19 fractional-share
   * rows and 1 commercial lease qualify (listings, 2026-08-19). On a lease the
   * price is rent per square foot, so the card must be able to withhold it.
   * The RPC does not return these three columns; they are read from
   * listing_tile_mv for the same keys rather than changed under the RPC, so
   * the guard has a real value with no migration to wait on.
   *
   * `SubdivisionName` is here for the same guard: the sub type is only one of
   * the three dimensions that decide whether ListPrice buys the whole dwelling,
   * and eight Active quarter shares are filed under sub type "Condominium".
   */
  PropertyType: string | null
  PropertySubType: string | null
  SubdivisionName: string | null
}

export async function getGolfHomesForLanding(city: string, limit = 24): Promise<GolfHomeRow[]> {
  const sb = supabaseAnon()
  if (!sb) return []
  const { data, error } = await sb.rpc('search_golf_homes', { p_city: city, p_limit: limit })
  if (error || !data) {
    if (error) console.error('[getGolfHomesForLanding]', error.message)
    return []
  }
  const rows = data as GolfHomeRow[]
  const keys = rows.map((r) => r.ListingKey).filter((k): k is string => Boolean(k))
  if (keys.length === 0) return rows
  // One indexed read of at most 60 keys. A failure here leaves the codes null,
  // which the card's publishers read as "unknown" and treat as a sale — so the
  // read is awaited, not raced, and the tile MV is the same source the search
  // cards publish from.
  const tiles = await getListingTiles({ listingKeys: keys, status: 'all', limit: keys.length })
  const byKey = new Map(tiles.map((t) => [t.listingKey, t]))
  return rows.map((r) => {
    const tile = r.ListingKey ? byKey.get(r.ListingKey) : undefined
    return {
      ...r,
      PropertyType: tile?.propertyType ?? null,
      PropertySubType: tile?.propertySubType ?? null,
      SubdivisionName: tile?.subdivisionName ?? null,
    }
  })
}
