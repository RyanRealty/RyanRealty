import type { Metadata } from 'next'
import { getSearchListings, getSearchMapListings } from '@/app/actions/search'
import { getGeocodedListings } from '@/app/actions/geocode'
import SearchFilters from '@/components/search/SearchFilters'
import SearchResults from '@/components/search/SearchResults'
import ListingMapGoogle from '@/components/ListingMapGoogle'
import TrackSearchView from '@/components/tracking/TrackSearchView'

const PAGE_SIZE = 24
const DEFAULT_VIEW = 'split'

type SearchParams = {
  city?: string
  subdivision?: string
  minPrice?: string
  maxPrice?: string
  beds?: string
  baths?: string
  status?: string
  sort?: string
  view?: string
  page?: string
  minSqFt?: string
  maxSqFt?: string
  lotAcresMin?: string
  lotAcresMax?: string
  yearBuiltMin?: string
  yearBuiltMax?: string
  propertyType?: string
  hasPool?: string
  hasView?: string
  hasWaterfront?: string
  garageMin?: string
  daysOnMarket?: string
  keywords?: string
}

function parseFilters(sp: SearchParams) {
  return {
    city: sp.city?.trim(),
    subdivision: sp.subdivision?.trim(),
    minPrice: sp.minPrice ? Number(sp.minPrice) : undefined,
    maxPrice: sp.maxPrice ? Number(sp.maxPrice) : undefined,
    beds: sp.beds ? Number(sp.beds) : undefined,
    baths: sp.baths ? Number(sp.baths) : undefined,
    status: sp.status?.trim() || 'Active',
    sort: sp.sort?.trim() || 'newest',
    minSqFt: sp.minSqFt ? Number(sp.minSqFt) : undefined,
    maxSqFt: sp.maxSqFt ? Number(sp.maxSqFt) : undefined,
    lotAcresMin: sp.lotAcresMin != null ? Number(sp.lotAcresMin) : undefined,
    lotAcresMax: sp.lotAcresMax != null ? Number(sp.lotAcresMax) : undefined,
    yearBuiltMin: sp.yearBuiltMin ? Number(sp.yearBuiltMin) : undefined,
    yearBuiltMax: sp.yearBuiltMax ? Number(sp.yearBuiltMax) : undefined,
    propertyType: sp.propertyType?.trim(),
    hasPool: sp.hasPool === '1',
    hasView: sp.hasView === '1',
    hasWaterfront: sp.hasWaterfront === '1',
    garageMin: sp.garageMin != null ? Number(sp.garageMin) : undefined,
    daysOnMarket: sp.daysOnMarket?.trim(),
    keywords: sp.keywords?.trim(),
  }
}

function buildSearchTitle(filters: ReturnType<typeof parseFilters>): string {
  const parts: string[] = []
  if (filters.beds != null && filters.beds > 0) parts.push(`${filters.beds}+ Bedroom`)
  if (filters.baths != null && filters.baths > 0) parts.push(`${filters.baths}+ Bath`)
  const loc = [filters.subdivision, filters.city].filter(Boolean).join(', ')
  if (loc) parts.push(loc)
  if (parts.length === 0) return 'Homes for Sale | Ryan Realty'
  return `${parts.join(' ')} Homes for Sale | Ryan Realty`
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}): Promise<Metadata> {
  const sp = await searchParams
  const filters = parseFilters(sp)
  const title = buildSearchTitle(filters)
  const description =
    filters.city || filters.subdivision
      ? `Search homes for sale in ${filters.subdivision ?? ''} ${filters.city ?? 'Central Oregon'}. Filter by price, beds, baths, and more.`
      : 'Search homes for sale in Central Oregon. Filter by city, price, beds, baths, and more.'
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryanrealty.com').replace(/\/$/, '')
  const canonical = new URL('/search', siteUrl)
  Object.entries(sp).forEach(([k, v]) => {
    if (v != null && v !== '') canonical.searchParams.set(k, String(v))
  })
  return {
    title,
    description,
    alternates: { canonical: canonical.toString() },
    openGraph: { title, description, url: canonical.toString() },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export const dynamic = 'force-dynamic'

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const filters = parseFilters(sp)
  const view = (sp.view === 'list' || sp.view === 'map' ? sp.view : 'split') as 'split' | 'list' | 'map'
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)

  const [{ listings, totalCount }, mapListings] = await Promise.all([
    getSearchListings(filters, page),
    view !== 'list' ? getSearchMapListings(filters) : Promise.resolve([]),
  ])

  const listingsWithCoords =
    view !== 'list' && listings.length > 0 ? await getGeocodedListings(listings) : listings

  const mapListingsWithCoords =
    mapListings.length > 0 ? await getGeocodedListings(mapListings) : mapListings

  const initialFiltersFromUrl = {
    city: sp.city ?? '',
    subdivision: sp.subdivision ?? '',
    minPrice: sp.minPrice ?? '',
    maxPrice: sp.maxPrice ?? '',
    beds: sp.beds ?? '',
    baths: sp.baths ?? '',
    status: sp.status ?? 'Active',
    sort: sp.sort ?? 'newest',
    view: sp.view ?? DEFAULT_VIEW,
    minSqFt: sp.minSqFt ?? '',
    maxSqFt: sp.maxSqFt ?? '',
    lotAcresMin: sp.lotAcresMin ?? '',
    lotAcresMax: sp.lotAcresMax ?? '',
    yearBuiltMin: sp.yearBuiltMin ?? '',
    yearBuiltMax: sp.yearBuiltMax ?? '',
    propertyType: sp.propertyType ?? '',
    hasPool: sp.hasPool ?? '',
    hasView: sp.hasView ?? '',
    hasWaterfront: sp.hasWaterfront ?? '',
    garageMin: sp.garageMin ?? '',
    daysOnMarket: sp.daysOnMarket ?? '',
    keywords: sp.keywords ?? '',
  }

  return (
    <div className="min-h-screen bg-[var(--brand-cream)]">
      <TrackSearchView
        city={filters.city ?? undefined}
        subdivision={filters.subdivision ?? undefined}
        resultsCount={totalCount}
      />
      <div className="sticky top-0 z-20 bg-white border-b border-[var(--gray-border)] shadow-sm">
        <SearchFilters initialFilters={initialFiltersFromUrl} />
      </div>
      <div className="max-w-[1920px] mx-auto">
        {view === 'map' && (
          <div className="h-[calc(100vh-120px)] min-h-[400px]">
            <ListingMapGoogle
              listings={mapListingsWithCoords}
              centerOnBend={!filters.city && !filters.subdivision}
              fitBounds={mapListingsWithCoords.length > 0}
            />
          </div>
        )}
        {(view === 'split' || view === 'list') && (
          <div className={view === 'split' ? 'grid grid-cols-1 lg:grid-cols-[1fr_420px]' : ''}>
            <div className={view === 'split' ? 'min-h-[60vh] overflow-auto' : ''}>
              <SearchResults
                initialListings={listings}
                totalCount={totalCount}
                initialPage={page}
                filters={initialFiltersFromUrl}
                view={view}
              />
            </div>
            {view === 'split' && (
              <div className="hidden lg:block sticky top-[120px] h-[calc(100vh-120px)] min-h-[400px] border-l border-[var(--gray-border)]">
                <ListingMapGoogle
                  listings={listingsWithCoords.length > 0 ? listingsWithCoords : mapListingsWithCoords}
                  centerOnBend={!filters.city && mapListingsWithCoords.length === 0}
                  fitBounds={listingsWithCoords.length > 0}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
