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
}

export async function getGolfHomesForLanding(city: string, limit = 24): Promise<GolfHomeRow[]> {
  const sb = supabaseAnon()
  if (!sb) return []
  const { data, error } = await sb.rpc('search_golf_homes', { p_city: city, p_limit: limit })
  if (error || !data) {
    if (error) console.error('[getGolfHomesForLanding]', error.message)
    return []
  }
  return data as GolfHomeRow[]
}
