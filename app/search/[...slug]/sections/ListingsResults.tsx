import { type ListingCardData } from '@/components/site/ListingCard'
import HideAwareListingGrid, { type HideAwareItem } from '@/components/search/HideAwareListingGrid'
import { publishListingStatusBadge } from '@/lib/search/publish-search-status'
import { Body, CTAButton, Eyebrow, H3 } from '@/components/site/primitives'
import SearchListingsToolbar from '../../../../components/SearchListingsToolbar'
import { listingTileHref } from '../../../../lib/slug'
import { type getListingsWithAdvanced } from '../../../actions/listings'
import { type SearchParams } from '../page-filters'
import { listingsResultsKind } from './listings-results-kind'

export { listingsResultsKind } from './listings-results-kind'

/** Listings grid (design-system ListingCard) + sort/pagination toolbar, with
 *  the no-scope / timeout / zero-result empty states (see page.tsx call site). */
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
  degraded = false,
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
  /** Timeout or data-layer error — do not paint as an empty market. */
  degraded?: boolean
}) {
  const kind = listingsResultsKind({
    city,
    hasFilterOnly,
    listingCount: listings.length,
    degraded,
  })
  if (kind === 'no-scope') {
    return <p className="mt-10">Select a city or subdivision to see listings.</p>
  }
  if (kind === 'degraded') {
    return (
      <div className="mt-10 text-center">
        <Eyebrow>Search delayed</Eyebrow>
        <H3 className="mt-2">We could not load listings in time</H3>
        <Body className="mx-auto mt-2 max-w-md text-muted-foreground">
          This is a connection or timeout problem, not an empty market. Try again.
        </Body>
        <form>
          <CTAButton type="submit" tone="outline" className="mt-6">
            Reload page
          </CTAButton>
        </form>
      </div>
    )
  }
  if (kind === 'empty') {
    return (
      <p className="mt-10">No homes match this search right now. Adjust the filters or try a related search below.</p>
    )
  }
  return (
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
            // The card publishes the ask and the $/sq ft; both publishers ask
            // what kind of listing this is (a commercial lease carries rent in
            // ListPrice, a fractional share buys part of the home).
            propertyType: listing.PropertyType ?? null,
            propertySubType: listing.PropertySubType ?? null,
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
