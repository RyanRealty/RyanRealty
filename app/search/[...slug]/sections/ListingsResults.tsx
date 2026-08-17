import { type ListingCardData } from '@/components/site/ListingCard'
import HideAwareListingGrid, { type HideAwareItem } from '@/components/search/HideAwareListingGrid'
import { publishListingStatusBadge } from '@/lib/search/publish-search-status'
import SearchListingsToolbar from '../../../../components/SearchListingsToolbar'
import { listingTileHref } from '../../../../lib/slug'
import { type getListingsWithAdvanced } from '../../../actions/listings'
import { type SearchParams } from '../page-filters'

/** Listings grid (design-system ListingCard) + sort/pagination toolbar, with
 *  the no-scope / zero-result empty states (see page.tsx call site). */
export function ListingsResults({
  city,
  hasFilterOnly,
  listings,
  totalCount,
  page,
  pageSize,
  viewParam,
  perPageParam,
  sp,
  searchPagePath,
  priceChangeKeys,
}: {
  city: string | undefined
  hasFilterOnly: boolean
  listings: Awaited<ReturnType<typeof getListingsWithAdvanced>>['listings']
  totalCount: number
  page: number
  pageSize: number
  viewParam: '1' | '2' | '3' | '4' | '5'
  perPageParam: string
  sp: SearchParams
  searchPagePath: string
  priceChangeKeys: Set<string>
}) {
  return !city && !hasFilterOnly ? (
    <p className="mt-10">Select a city or subdivision to see listings.</p>
  ) : listings.length === 0 ? (
    <p className="mt-10">No homes match this search right now. Adjust the filters or try a related search below.</p>
  ) : (
    <div className="mt-6">
      <SearchListingsToolbar
        pathname={searchPagePath}
        totalCount={totalCount}
        page={page}
        pageSize={pageSize}
        viewParam={viewParam}
        perPageParam={perPageParam}
        searchParams={{
          minPrice: sp.minPrice,
          maxPrice: sp.maxPrice,
          beds: sp.beds,
          baths: sp.baths,
          minSqFt: sp.minSqFt,
          propertyType: sp.propertyType,
          sort: sp.sort ?? 'newest',
          statusFilter: sp.statusFilter ?? (sp.includeClosed === '1' ? 'all' : 'active'),
          includeClosed: sp.includeClosed,
          page: String(page),
          view: viewParam,
          perPage: perPageParam,
        }}
      />
      {/* HideAwareListingGrid: per-user hidden-home subtraction at the edge of render (W7.2); signed-out sees the full set. */}
      <HideAwareListingGrid
        items={listings.map((listing, i): HideAwareItem => {
          const key = (listing.ListNumber ?? listing.ListingKey ?? `listing-${i}`).toString().trim()
          const street = [listing.StreetNumber, listing.StreetName, listing.StreetSuffix].filter(Boolean).join(' ').trim()
          const cityLine = [[listing.City ?? city, 'OR'].filter(Boolean).join(', '), listing.PostalCode].filter(Boolean).join(' ').trim()
          const card: ListingCardData = {
            listingKey: key,
            href: listingTileHref({
              listingKey: listing.ListingKey,
              listNumber: listing.ListNumber,
              streetNumber: listing.StreetNumber,
              streetName: listing.StreetName,
              city: listing.City,
              subdivisionName: listing.SubdivisionName,
            }),
            photoUrl: listing.PhotoURL ?? null,
            price: listing.ListPrice ?? null,
            addressLine: street || 'Address available on request',
            cityLine: cityLine || 'Central Oregon',
            beds: listing.BedroomsTotal ?? null,
            baths: listing.BathroomsTotal ?? null,
            sqft: listing.TotalLivingAreaSqFt ?? null,
            badge:
              publishListingStatusBadge(listing.StandardStatus) ??
              (key && priceChangeKeys.has(key) ? { kind: 'drop' as const, label: 'Price drop' } : undefined),
          }
          return { card, ListingKey: listing.ListingKey ?? null, ListNumber: listing.ListNumber ?? null }
        })}
      />
    </div>
  )
}
