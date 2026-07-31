import { type ReactNode } from 'react'
import { getSession } from '../../../actions/auth'
import { getBuyingPreferences } from '../../../actions/buying-preferences'
import { getCityBoundary } from '../../../actions/cities'
import { getCommunityBySlug } from '../../../actions/communities'
import { subdivisionEntityKey, getSubdivisionDisplayName } from '../../../../lib/slug'
import { entityKeyToSlug } from '../../../../lib/community-slug'
import { Container } from '@/components/site/primitives'
import { BreadcrumbNav } from '@/components/site/BreadcrumbNav'
import SearchFilterBar from '../../../../components/SearchFilterBar'
import { decodeMapPolygon } from '@/lib/map-polygon'
import { withTimeout } from '../fetch-guards'
import { type ResolvedSearchSlug } from '../resolve-slug'
import { type SearchParams } from '../page-filters'

/** The bounds-driven map/split branch of the search page (see page.tsx call site). */
export async function renderMapSplitView(props: {
  sp: SearchParams
  slug: string[]
  resolved: ResolvedSearchSlug
  city: string | undefined
  decodedSubdivision: string | undefined
  displayName: string
  searchPagePath: string
  searchBreadcrumbItems: { label: string; href?: string }[]
  savedKeys: string[]
  likedKeys: string[]
  priceChangeKeys: Set<string>
  session: Awaited<ReturnType<typeof getSession>> | null
  prefs: Awaited<ReturnType<typeof getBuyingPreferences>> | null
  effectiveStatusFilter: string
  initialPolygon: ReturnType<typeof decodeMapPolygon>
  presetChips: readonly { label: string; param: string }[]
  perPageParam: string
  /** The "Grid view" return CTA (a shadcn Button) — rendered by page.tsx, which
   *  already owns the route's @/components/ui imports (G47 shadcn burn-down
   *  counts importing files; this section must not become a new one). */
  gridViewCta: ReactNode
}) {
  const {
    sp, slug, resolved, city, decodedSubdivision, displayName, searchPagePath,
    searchBreadcrumbItems, savedKeys, likedKeys, priceChangeKeys, session, prefs,
    effectiveStatusFilter, initialPolygon, presetChips, perPageParam, gridViewCta,
  } = props
  const { default: UnifiedMapListingsView } = await import('../../../../components/UnifiedMapListingsView')
  const placeQuery = city
    ? decodedSubdivision
      ? `${getSubdivisionDisplayName(decodedSubdivision)} ${city} Oregon`
      : `${city} Oregon`
    : 'Bend Oregon'
  const mapBoundaryGeojson = city
    ? decodedSubdivision
      ? (await withTimeout(getCommunityBySlug(entityKeyToSlug(subdivisionEntityKey(city, decodedSubdivision))), null, 1000))?.boundaryGeojson ?? null
      : await withTimeout(getCityBoundary(city), null, 1000)
    : null
  // design-audit NAV-1: clear the 64px fixed KbNav and size the app-frame to
  // the remaining viewport (overrides the shared .map-search-shell 100vh-120px
  // which assumed the in-flow 72px SiteHeader).
  return (
    <main className="flex flex-col map-search-shell overflow-hidden" style={{ marginTop: 64, height: 'calc(100vh - 64px)' }}>
      <div className="shrink-0 border-b border-primary/20 bg-primary">
        <Container className="flex items-center justify-between gap-3 py-3">
          {searchBreadcrumbItems.length > 1 ? (
            <BreadcrumbNav tone="on-navy" items={searchBreadcrumbItems} includeJsonLd={false} />
          ) : (
            <span />
          )}
          {gridViewCta}
        </Container>
      </div>
      <UnifiedMapListingsView
        containerClassName="flex-1 min-h-0 overflow-hidden"
        pageTitle={`${displayName} Real Estate & Homes For Sale`}
        basePath={searchPagePath}
        placeQuery={placeQuery}
        boundaryGeojson={mapBoundaryGeojson}
        city={city ?? undefined}
        subdivision={decodedSubdivision ?? undefined}
        savedKeys={savedKeys}
        likedKeys={likedKeys}
        priceChangeKeys={priceChangeKeys}
        signedIn={!!session?.user}
        userEmail={session?.user?.email ?? null}
        prefs={prefs}
        statusFilter={effectiveStatusFilter}
        includeClosed={sp.includeClosed === '1'}
        minPrice={sp.minPrice != null ? Number(sp.minPrice) : undefined}
        maxPrice={sp.maxPrice != null ? Number(sp.maxPrice) : undefined}
        minBeds={sp.beds != null ? Number(sp.beds) : undefined}
        maxBeds={sp.maxBeds != null ? Number(sp.maxBeds) : undefined}
        minBaths={sp.baths != null ? Number(sp.baths) : undefined}
        maxBaths={sp.maxBaths != null ? Number(sp.maxBaths) : undefined}
        minSqFt={sp.minSqFt != null ? Number(sp.minSqFt) : undefined}
        maxSqFt={sp.maxSqFt != null ? Number(sp.maxSqFt) : undefined}
        postalCode={sp.postalCode ?? undefined}
        propertyType={sp.propertyType ?? undefined}
        initialPolygon={initialPolygon}
        persistPolygonInUrl
        filterBar={
          <SearchFilterBar
            basePath={searchPagePath}
            presetChips={presetChips}
            locationLabel={displayName}
            locationHref={`${searchPagePath}?${new URLSearchParams({ ...sp, view: 'map' }).toString()}`}
            signedIn={!!session?.user}
            pathContext={{ ...resolved, city, citySlug: slug[0] }}
            minPrice={sp.minPrice}
            maxPrice={sp.maxPrice}
            beds={sp.beds}
            baths={sp.baths}
            minSqFt={sp.minSqFt}
            maxSqFt={sp.maxSqFt}
            maxBeds={sp.maxBeds}
            maxBaths={sp.maxBaths}
            yearBuiltMin={sp.yearBuiltMin}
            yearBuiltMax={sp.yearBuiltMax}
            lotAcresMin={sp.lotAcresMin}
            lotAcresMax={sp.lotAcresMax}
            postalCode={sp.postalCode}
            propertyType={sp.propertyType}
            statusFilter={sp.statusFilter}
            keywords={sp.keywords}
            hasOpenHouse={sp.hasOpenHouse}
            garageMin={sp.garageMin}
            hasPool={sp.hasPool}
            hasView={sp.hasView}
            hasWaterfront={sp.hasWaterfront}
            newListingsDays={sp.newListingsDays}
            includeClosed={sp.includeClosed}
            sort={sp.sort}
            view="map"
            perPage={perPageParam}
            poly={sp.poly}
          />
        }
      />
    </main>
  )
}
