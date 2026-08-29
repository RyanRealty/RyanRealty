import { CTAButton } from '@/components/site/primitives'
import SearchListingsToolbar from '../../../../components/SearchListingsToolbar'
import { SearchHomesField } from '../../_v3/SearchHomesField'
import { type getListingsWithAdvanced } from '../../../actions/listings'
import { type SearchParams } from '../page-filters'
import { listingsResultsKind } from './listings-results-kind'

export { listingsResultsKind } from './listings-results-kind'

/** V3Field inventory (photo doors + map) + sort/pagination, with
 *  the no-scope / timeout / zero-result empty states (see page.tsx call site). */
export function ListingsResults({
  city,
  hasFilterOnly,
  listings,
  totalCount,
  page,
  pageSize,
  perPageParam,
  sp,
  searchPagePath,
  placeName,
  boundary,
  degraded = false,
}: {
  city: string | undefined
  hasFilterOnly: boolean
  listings: Awaited<ReturnType<typeof getListingsWithAdvanced>>['listings']
  totalCount: number
  page: number
  pageSize: number
  perPageParam: string
  sp: SearchParams
  searchPagePath: string
  placeName: string
  boundary?: unknown
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
        <p className="srch-label">Search delayed</p>
        <h3 className="mt-2 text-base font-semibold text-foreground">
          We could not load listings in time
        </h3>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          This is a connection or timeout problem, not an empty market. Try again.
        </p>
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
          perPage: perPageParam,
        }}
      />
      <SearchHomesField
        listings={listings}
        placeName={placeName}
        boundary={boundary}
        count={
          totalCount > 0
            ? {
                value: totalCount.toLocaleString('en-US'),
                label: city ? `homes in ${placeName}` : 'homes in this search',
                source: 'Regional MLS via listing_search_mv',
              }
            : undefined
        }
        emptyMessage={`No homes match this search in ${placeName} right now. Adjust the filters or try a related search below.`}
      />
    </div>
  )
}
