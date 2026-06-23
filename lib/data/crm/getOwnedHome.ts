/**
 * getOwnedHomeMatches — MLS records for the home a CRM lead owns.
 *
 * Given the geocoded point of a lead's address (fub_person_geo.latitude /
 * longitude), find listing rows for the same physical property via a small
 * bounding box (~40m). Closed rows are the home's sale history; an active row
 * means the home is on the market right now. Read path: listing_tile_mv
 * (snake_case projection, hourly refresh) using listing_tile_mv_latlng_all.
 *
 * Proximity is only a CANDIDATE finder — a ~40m box can land on a neighbor's
 * house. When the owner's street address is known (fub_person_geo.source_address
 * / formatted_address), every candidate is gated by addressMatches(): a row's
 * photo is only surfaced as the owner's home (addressMatched=true) when its
 * street number + street name actually match the owner's. A near miss keeps the
 * row (sale history near the point can still be useful) but with addressMatched
 * = false and photoUrl = null, so the panel never shows the wrong house.
 *
 * DAL boundary: the raw .from() lives here, inside lib/data/ (G1).
 */
import { createServiceClient } from '@/lib/data/client'
import { addressMatches, parseStreetAddress } from '@/lib/data/crm/addressMatch'

export type OwnedHomeMatch = {
  listingKey: string | null
  address: string
  city: string | null
  status: string | null
  photoUrl: string | null
  listPrice: number | null
  closePrice: number | null
  closeDate: string | null
  beds: number | null
  baths: number | null
  sqft: number | null
  yearBuilt: number | null
  addressSlug: string | null
  /**
   * True only when this candidate's street address matches the owner's. When
   * no owner address was supplied this stays false (we cannot confirm the
   * match) and photoUrl is withheld — a photo only renders on a confirmed row.
   */
  addressMatched: boolean
}

// ~40m box at 44°N: 0.00036° lat ≈ 40m, 0.00050° lng ≈ 40m
const LAT_EPS = 0.00036
const LNG_EPS = 0.0005

export async function getOwnedHomeMatches(
  lat: number,
  lng: number,
  ownerAddress?: string | null,
): Promise<OwnedHomeMatch[]> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return []
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('listing_tile_mv')
    .select(
      'listing_key,street_number,street_name,city,standard_status,photo_url,list_price,close_price,close_date,beds,baths,sqft,year_built,address_slug',
    )
    .gte('lat', lat - LAT_EPS)
    .lte('lat', lat + LAT_EPS)
    .gte('lng', lng - LNG_EPS)
    .lte('lng', lng + LNG_EPS)
    .order('close_date', { ascending: false, nullsFirst: false })
    .limit(8)
  if (error || !data) return []

  // Parse the owner's freeform address once into a structured shape to compare
  // each candidate against. No owner address → no row can clear the gate.
  const owner = parseStreetAddress(ownerAddress)
  const hasOwnerAddress = owner.streetNumber !== null && owner.streetName !== null

  return data.map((r) => {
    const streetNumber = (r.street_number as string | null) ?? null
    const streetName = (r.street_name as string | null) ?? null
    const addressMatched = hasOwnerAddress && addressMatches(owner, { streetNumber, streetName })
    const photoUrl = (r.photo_url as string | null) ?? null
    return {
      listingKey: (r.listing_key as string | null) ?? null,
      address: [streetNumber, streetName].filter(Boolean).join(' '),
      city: (r.city as string | null) ?? null,
      status: (r.standard_status as string | null) ?? null,
      // Only surface a photo on a confirmed address match — never a neighbor's.
      photoUrl: addressMatched ? photoUrl : null,
      listPrice: r.list_price === null ? null : Number(r.list_price),
      closePrice: r.close_price === null ? null : Number(r.close_price),
      closeDate: (r.close_date as string | null) ?? null,
      beds: r.beds === null ? null : Number(r.beds),
      baths: r.baths === null ? null : Number(r.baths),
      sqft: r.sqft === null ? null : Number(r.sqft),
      yearBuilt: r.year_built === null ? null : Number(r.year_built),
      addressSlug: (r.address_slug as string | null) ?? null,
      addressMatched,
    }
  })
}
