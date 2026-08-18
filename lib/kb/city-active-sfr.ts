import { getListingTiles, type ListingTile } from '@/lib/data'

/**
 * Every active single-family tile in a city, PAGINATED past PostgREST's 1000-row
 * cap (Bend alone has ~1044).
 *
 * The alias-aware resort counts (lib/kb/resort-active-counts.ts) must see the
 * COMPLETE active set or they undercount every community whose older listings
 * fall past the first page — and the city page's golf ledger, the community
 * page's hero, and the communities rail all read that same number, so a short
 * read publishes three disagreeing figures (§0).
 *
 * Shared by the city page and the community page so the community hero count
 * MATCHES the city ledger by construction rather than by two copies staying in
 * sync (they did not: this function was duplicated in both pages).
 */
export async function fetchAllCityActiveSfr(cityName: string): Promise<ListingTile[]> {
  const PAGE = 1000
  // Dedupe by listingKey across pages — offset pagination over a newest-sorted
  // set can repeat a row if inventory shifts between page fetches.
  const byKey = new Map<string, ListingTile>()
  for (let offset = 0; offset < 6000; offset += PAGE) {
    const page = await getListingTiles({ city: cityName, status: 'active', propertyType: 'A', limit: PAGE, offset })
    for (const t of page) byKey.set(t.listingKey, t)
    if (page.length < PAGE) break
  }
  return [...byKey.values()]
}

/** Registry city plus mls_cities so alias matching sees every door a community lists under. */
export async function fetchCommunityCitySfr(cityName: string, extraCities: string[] = []): Promise<ListingTile[]> {
  const sets = await Promise.all([...new Set([cityName, ...extraCities])].map((c) => fetchAllCityActiveSfr(c)))
  return sets.flat()
}
