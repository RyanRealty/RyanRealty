/**
 * Buyer-facing place / search heading.
 *
 * Matt P0 2026-09-17: nobody says "Every home for sale in Lazy River South"
 * or "Homes for sale in Lazy River South". Redfin-like "{Place} homes for sale".
 */

export function placeHomesForSaleHeading(placeName: string): string {
  const place = placeName.trim()
  if (!place) return 'Homes for sale'
  if (/homes for sale$/i.test(place)) return place
  return `${place} homes for sale`
}

/** City grain only. Inventory query stays on /homes-for-sale/{city}. */
export function placeCityRealEstateHeading(cityName: string): string {
  const city = cityName.trim()
  if (!city) return 'Real estate'
  if (/real estate$/i.test(city)) return city
  return `${city} real estate`
}
