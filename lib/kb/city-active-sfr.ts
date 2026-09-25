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
    const page: unknown = await getListingTiles({ city: cityName, status: 'active', propertyType: 'A', limit: PAGE, offset })
    // A page that is not rows is a failed read, never an empty city. Say so,
    // so the caller's withTimeoutFallbackResult reports ok:false with this
    // message instead of "e is not iterable" (production build
    // dpl_57NPHyuPyFiSkL23TpQzyNQ1rV4L, city:resortTiles, 2026-09-25).
    if (!Array.isArray(page)) {
      throw new Error(
        `[fetchAllCityActiveSfr] ${cityName}: active SFR page at offset ${offset} came back ${page === null ? 'null' : typeof page}, not rows`,
      )
    }
    for (const t of page as ListingTile[]) byKey.set(t.listingKey, t)
    if (page.length < PAGE) break
  }
  return [...byKey.values()]
}
