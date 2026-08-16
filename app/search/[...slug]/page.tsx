import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import {
  getListingKeysWithRecentPriceChange,
  getListingsWithAdvanced,
} from '../../actions/listings'
import { getSession } from '../../actions/auth'
import { SearchAlertCapture } from '../../../components/search/SearchAlertCapture'
import { getCityContent, getSubdivisionBlurb } from '../../../lib/city-content'
import { cityEntityKey, getSubdivisionDisplayName, homesForSalePath, listingDetailPath } from '../../../lib/slug'
import { getPopularSearchesForCity, getAllCityHomesLink } from '../../../lib/popular-searches'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { HugeiconsIcon } from '@hugeicons/react'
import { MapsLocation01Icon } from '@hugeicons/core-free-icons'
import { buildMarketFaq } from '@/lib/site/market-faq'
import {
  buildPresetFaq,
  getAdjacentPriceBandLinks,
  getParentCityPresetLink,
  getSamePresetCityLinks,
  isSortOnlyPreset,
} from '@/lib/site/preset-faq'
import { getMarketPulse, getDerivedPopularSearches } from '@/lib/data'
import { canonicalCityCacheSlug } from '@/lib/market/city-cache-slug'
import SearchFilterBar from '../../../components/SearchFilterBar'
import ShareButton from '../../../components/ShareButton'
import {
  V3_ROOT_CLASS,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Heading,
} from '@/components/site/v3'
import SearchPageJsonLd from './SearchPageJsonLd'
import ResortCommunityJsonLd from './ResortCommunityJsonLd'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { isResortCommunity } from '../../../lib/resort-communities'
import { getResortEntityKeys } from '../../actions/subdivision-flags'
import { getSubdivisionTabContent } from '../../actions/subdivision-descriptions'
import TrackSearchView from '../../../components/tracking/TrackSearchView'
import { ResultsStamp } from '@/components/search/ResultsStamp.client'
import { getSavedListingKeys } from '../../actions/saved-listings'
import { getLikedListingKeys } from '../../actions/likes'
import { getBuyingPreferences } from '../../actions/buying-preferences'
import { shouldNoIndexSearchVariant } from '../../../lib/seo-routing'
import { decodeMapPolygon } from '@/lib/map-polygon'
import { generateStaticParams as buildSearchStaticParams, IS_PRODUCTION_BUILD } from './search-static'
import { withTimeout, LISTINGS_FETCH_TIMEOUT_MS } from './fetch-guards'
import { resolveSlug, buildCanonicalPath } from './resolve-slug'
import { buildSearchSlugMetadata } from './search-metadata'
import { resolvePlaceBannerUrl } from './place-banner'
import {
  buildSearchFilters,
  getPresetSearchLabel,
  hasFilterOnlySearch,
  numStr,
  type SearchParams,
} from './page-filters'
import { renderGolfLanding } from './sections/GolfBranch'
import { renderMapSplitView } from './sections/MapSplitView'
import { ListingsResults } from './sections/ListingsResults'
import { SearchSeoTail } from './sections/SeoTail'
import { publishSearchCount } from '@/lib/search/publish-search-count'

export async function generateStaticParams() {
  return buildSearchStaticParams()
}
export const dynamicParams = true

export async function generateMetadata(props: {
  params: Promise<{ slug: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
  // The full assembly lives in ./search-metadata (file-size split 2026-07-31);
  // the alternates.canonical contract stays pinned in this route file
  // (ci:seo-routes file contract + lib/seo-route-contracts.test.ts).
  const { canonicalUrl, metadata } = await buildSearchSlugMetadata(props)
  return { ...metadata, alternates: { canonical: canonicalUrl } }
}

export const revalidate = 60

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string[] }>
  searchParams: Promise<SearchParams>
}) {
  const { slug = [] } = await params
  const sp = await searchParams
  const resolved = await resolveSlug(slug)
  if (slug.length >= 3 && resolved.presetSlug && !resolved.preset) {
    notFound()
  }
  const { city: cityResolved, preset } = resolved
  const city = cityResolved ?? undefined
  const subdivision = resolved.subdivisionSlug ?? undefined
  const decodedSubdivision = resolved.subdivisionDisplayName ?? (subdivision ? decodeURIComponent(subdivision) : undefined)
  // When the slug is a known neighborhood (boundary_neighborhood), drive the
  // single-indexed fast path. getListings prefers the neighborhood branch over
  // the subdivision-name match, so the page serves the full neighborhood (e.g.
  // Mountain View, Awbrey Butte) in ~4ms instead of the slow advanced RPC.
  const neighborhood = resolved.neighborhoodName ?? undefined
  // A path-resolved preset with no city (/homes-for-sale/manufactured) is a
  // filter-only search too — the preset IS the filter, no query params needed.
  const hasFilterOnly = !city && (Boolean(preset) || hasFilterOnlySearch(sp))
  const presetLabel = !city ? getPresetSearchLabel(sp) : null

  const columns = [1, 2, 3, 4, 5].includes(Number(sp.view)) ? Number(sp.view) : 3
  const viewParam = String(columns) as '1' | '2' | '3' | '4' | '5'
  const ROWS = 3
  const defaultPageSize = columns * ROWS
  const perPageParam = sp.perPage ?? String(defaultPageSize)
  const requestedPageSize = Math.min(100, Math.max(1, parseInt(perPageParam, 10) || defaultPageSize))
  const pageSize = IS_PRODUCTION_BUILD ? Math.min(requestedPageSize, 12) : requestedPageSize
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const offset = (page - 1) * pageSize
  const initialPolygon = decodeMapPolygon(sp.poly)

  const { filterOpts, presetChips } = buildSearchFilters({ sp, city, decodedSubdivision, neighborhood, preset })

  // Golf landing — the on-golf-course preset renders a purpose-built, immersive
  // golf properties landing page (hero + community spotlight + stat band + the
  // real golf homes + FAQ). `?all=1` falls through to the standard filterable
  // list+map view of the same golf-filtered homes.
  if (preset?.landing === 'golf' && city && sp.all !== '1') {
    return renderGolfLanding(city)
  }

  // Fetch the independent data the clean results page renders in one parallel batch:
  //   listings (grid + pagination), market stats (header median list price),
  //   recent price-change keys (map view), session (save-search + map view),
  //   resort entity keys (JSON-LD + breadcrumb resort flag).
  const [listingsResult, priceChangeKeys, session, resortEntityKeys] = await Promise.all([
    // Route through getListingsWithAdvanced: it serves the common city + base-
    // filter case from the slim, resilient-cached listing_tile_mv (sub-second,
    // with an EXACT count so pagination/header stay right) and only falls back
    // to the heavy search_listings_advanced RPC for jsonb-derived feature
    // filters or pagination deeper than the fast path can reach. A timeout or a
    // data-layer error yields `degraded: true` (the withTimeout fallback is
    // degraded too) so the page fails loud below instead of caching an empty
    // grid. This replaces the prior direct RPC call, whose cold ~8s scan blew
    // past the old 2.5s fetch timeout and silently rendered "no homes".
    withTimeout(
      getListingsWithAdvanced({ ...filterOpts, limit: pageSize, offset }),
      { listings: [], totalCount: 0, degraded: true },
      LISTINGS_FETCH_TIMEOUT_MS,
    ),
    IS_PRODUCTION_BUILD
      ? Promise.resolve(new Set<string>())
      : withTimeout(getListingKeysWithRecentPriceChange(), new Set<string>()),
    withTimeout(getSession(), null, 600),
    withTimeout(getResortEntityKeys(), new Set<string>()),
  ])
  // Fail loud: a timed-out or hard-errored listings fetch must NOT render — and
  // let ISR cache — an empty "no homes" grid (the poison-null pattern). Throwing
  // makes Next serve the last good ISR copy (stale-while-revalidate) and logs
  // the failure, instead of freezing zero results for the whole revalidate TTL.
  // A genuine zero-result search (clean fetch, 0 matches) has degraded=false and
  // still renders the friendly empty state further down.
  if (listingsResult.degraded) {
    // Poison-null protection (see getListingsWithAdvanced): an UNFILTERED CITY
    // scope returning degraded is never legitimate — a real city always has
    // inventory — so throw to serve the last good ISR copy instead of caching
    // "no homes in <city>". But a subdivision / neighborhood / preset / filtered
    // scope can LEGITIMATELY be empty, and a hard throw there just renders a BLANK
    // error page (the /homes-for-sale/bend/mountain-view bug: a Bend neighborhood
    // with no exact subdivision-name match). For those, fall through to the
    // friendly empty state below instead of blanking the page.
    const bareCityScope =
      !!city && !subdivision &&
      filterOpts.minPrice == null && filterOpts.maxPrice == null &&
      filterOpts.minBeds == null && filterOpts.minBaths == null && filterOpts.minSqFt == null &&
      (!filterOpts.propertyType || filterOpts.propertyType.trim() === '' || filterOpts.propertyType.trim() === 'all') &&
      !resolved.presetSlug
    if (bareCityScope) {
      throw new Error(
        `[search] listings fetch degraded (timeout or data-layer error) — city=${city ?? 'none'} offset=${offset}`,
      )
    }
    console.warn(
      `[search] listings degraded for a non-bare-city scope — rendering the empty state instead of blanking the page (city=${city ?? 'none'} subdivision=${subdivision ?? 'none'} preset=${resolved.presetSlug ?? 'none'})`,
    )
  }
  const { listings, totalCount } = listingsResult
  const effectiveStatusFilter = (filterOpts.statusFilter && ['active', 'active_and_pending', 'pending', 'closed', 'all'].includes(filterOpts.statusFilter))
    ? filterOpts.statusFilter
    : filterOpts.includeClosed
      ? 'all'
      : 'active'

  const placeName = subdivision && decodedSubdivision ? getSubdivisionDisplayName(decodedSubdivision) : (city ?? 'Central Oregon')
  const displayName = preset ? `${placeName} ${preset.shortLabel}` : (presetLabel ?? placeName)
  const cityContent = city ? getCityContent(city) : null
  const subdivisionTabContent =
    subdivision && city ? await withTimeout(getSubdivisionTabContent(city, decodedSubdivision!), null, 1200) : null
  const subdivisionBlurb =
    subdivision
      ? (subdivisionTabContent?.about ?? getSubdivisionBlurb(decodedSubdivision!))
      : null
  const bannerUrl = await resolvePlaceBannerUrl({ city, subdivision, decodedSubdivision })

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
  const searchPagePath = buildCanonicalPath(city ?? null, decodedSubdivision ?? null, subdivision ?? null, resolved.presetSlug)
  const [savedKeys, likedKeys, prefs] =
    session?.user
      ? await Promise.all([
          withTimeout(getSavedListingKeys(), [], 600),
          withTimeout(getLikedListingKeys(), [], 600),
          withTimeout(getBuyingPreferences(), null, 600),
        ])
      : ([[], [] as string[], null] as [string[], string[], Awaited<ReturnType<typeof getBuyingPreferences>>])

  const searchBreadcrumbItems: { label: string; href?: string }[] = [
    { label: 'Home', href: '/' },
    { label: 'Homes for sale', href: '/homes-for-sale' },
  ]
  const cityLabel = city ?? (slug[0] ? decodeURIComponent(slug[0]) : '')
  // Visible breadcrumb hrefs are RELATIVE so they use the client-side router and
  // are domain-agnostic. (Prefixing siteUrl made every city/subdivision crumb an
  // absolute URL that, when NEXT_PUBLIC_SITE_URL points at the vercel preview host,
  // navigated users off production onto the staging domain.) Absolute URLs live in
  // the JSON-LD BreadcrumbList (SearchPageJsonLd), where schema.org requires them.
  if (city) searchBreadcrumbItems.push({ label: cityLabel, href: subdivision || resolved.presetSlug ? homesForSalePath(city) : undefined })
  if (subdivision && decodedSubdivision) searchBreadcrumbItems.push({ label: getSubdivisionDisplayName(decodedSubdivision), href: resolved.presetSlug ? homesForSalePath(city!, decodedSubdivision) : undefined })
  if (preset) searchBreadcrumbItems.push({ label: preset.shortLabel })
  if (!city && presetLabel) searchBreadcrumbItems.push({ label: presetLabel })

  // Map split view: bounds-driven, Bend default; on city/community pages center on that place and scope search
  if ((sp.view === 'map' || sp.view === 'split') && (city || hasFilterOnly)) {
    // Grid-view href = the same search with `view`/`poly` dropped, so the toggle
    // returns to the static grid render of this exact city/preset page.
    const gridViewHref = (() => {
      const params = new URLSearchParams(
        Object.entries(sp).filter(
          ([k, v]) => typeof v === 'string' && v !== '' && k !== 'view' && k !== 'poly'
        ) as [string, string][]
      )
      const q = params.toString()
      return q ? `${searchPagePath}?${q}` : searchPagePath
    })()
    return renderMapSplitView({
      sp,
      slug,
      resolved,
      city,
      decodedSubdivision,
      displayName,
      searchPagePath,
      searchBreadcrumbItems,
      savedKeys,
      likedKeys,
      priceChangeKeys,
      session,
      prefs,
      effectiveStatusFilter,
      initialPolygon,
      presetChips,
      perPageParam,
      gridViewCta: (
        <Button asChild variant="secondary" size="sm" className="shrink-0">
          <Link href={gridViewHref} aria-label="Switch back to the grid view">
            Grid view
          </Link>
        </Button>
      ),
    })
  }

  // Clean header copy — data-grounded. Active count = totalCount (the accurate
  // full_count of the filtered results). The median is intentionally omitted:
  // the only available source is a city-wide cached value that misrepresents a
  // price-filtered preset, so per the data-accuracy rule it is cut, not faked.
  const headerCount = totalCount > 0 ? totalCount : null
  const headerPublished = publishSearchCount({
    value: headerCount,
    grain: filterOpts.propertyType ? 'filter-match' : 'all-types',
  })
  const headerIntro = headerPublished ? `${headerPublished.phrase}.` : ''
  // Header title adapts: preset label folds into placeName, filter-only searches
  // use the derived presetLabel, everything else is "Homes for sale in <place>".
  // The preset's own `label` is the grammatical noun phrase ("Duplexes for
  // Sale", "Manufactured Homes"); `shortLabel` is a chip word. Appending the
  // chip word produced broken English on every preset page — "Homes in Central
  // Oregon residential lots" (live 2026-07-31). Strip the label's trailing
  // "for Sale" (the H1 sits above a "for sale" count line) and read it as the
  // subject. Title Case is correct here: this is the page's hero H1.
  const headerTitle = preset
    ? `${preset.label.replace(/\s+for sale$/i, '')} in ${placeName}`
    : presetLabel
      ? `${presetLabel} homes in Central Oregon`
      : `Homes for sale in ${placeName}`

  // Related searches — SEO internal-linking for a city/preset page. Cross-link to
  // that city's other popular searches plus an "All [City] homes" link.
  const relatedCitySlug = city ? cityEntityKey(city) : null
  const relatedAllHomes = relatedCitySlug ? getAllCityHomesLink(relatedCitySlug) : null
  // Live-derived links ranked by actual active-tile counts (W3.4); the static
  // snapshot survives only as the resilience fallback when derivation is empty.
  const relatedDerived = relatedCitySlug && !IS_PRODUCTION_BUILD
    ? (await getDerivedPopularSearches(relatedCitySlug, 12)).filter((l) => l.href !== searchPagePath).slice(0, 8)
    : []
  const relatedSearches = relatedDerived.length > 0
    ? relatedDerived
    : relatedCitySlug
      ? getPopularSearchesForCity(relatedCitySlug, 12).filter((l) => l.href !== searchPagePath).slice(0, 8)
      : []

  // City-page SEO depth — ONLY the plain /homes-for-sale/[city] page (not the
  // subdivision/preset/filtered variants, which are noindex). Brings this intent
  // route to parity with the /cities/[city] hub: a self-fetching market-stat band,
  // a verified FAQ, and Dataset + FAQPage JSON-LD, all single-sourced from
  // buildMarketFaq so the visible numbers and the markup never diverge. Every
  // figure is null-guarded (no invented stats, CLAUDE.md §0).
  const isPlainCityPage = !!(city && !subdivision && !preset)
  // Preset-page SEO depth (Family 3 / W3.2): city AND {city}/{area}/{preset} pages.
  // Clean canonical only — no sort-only, no noindex variants, no degraded counts.
  const isPresetDepthPage = !!(
    city &&
    preset &&
    !isSortOnlyPreset(preset) &&
    !shouldNoIndexSearchVariant(sp)
  )
  // §0: area-scoped totalCount must name the area, not the city.
  const presetAreaLabel = subdivision ? placeName : null
  const cityPulse = (isPlainCityPage || isPresetDepthPage) && relatedCitySlug
    ? await getMarketPulse({
        geoType: 'city',
        geoSlug: canonicalCityCacheSlug(relatedCitySlug),
      }).catch(() => null)
    : null
  const cityMarketFaq = isPlainCityPage && city ? buildMarketFaq(city, cityPulse) : null
  const presetDepth =
    isPresetDepthPage && city && preset && !listingsResult.degraded
      ? buildPresetFaq(city, preset, totalCount, cityPulse, presetAreaLabel)
      : null
  const presetBandLinks =
    isPresetDepthPage && city && preset
      ? getAdjacentPriceBandLinks(
          city,
          preset.slug,
          subdivision ? { slug: subdivision, label: placeName } : null,
        )
      : []
  const presetCityLinks =
    isPresetDepthPage && preset && relatedCitySlug
      ? subdivision && city
        ? [getParentCityPresetLink(city, preset)]
        : getSamePresetCityLinks(preset, relatedCitySlug)
      : []

  // Path-derived filters for the guest listing-alert capture. On this route the
  // city/subdivision/preset live in the slug (not the query string), so the
  // anonymous alert strip — which reads live filters from useSearchParams — needs
  // them passed explicitly so the captured alert matches what the visitor sees.
  const guestAlertFilters: Record<string, string> = {}
  if (filterOpts.minPrice != null) guestAlertFilters.minPrice = String(filterOpts.minPrice)
  if (filterOpts.maxPrice != null) guestAlertFilters.maxPrice = String(filterOpts.maxPrice)
  if (filterOpts.minBeds != null) guestAlertFilters.beds = String(filterOpts.minBeds)
  if (filterOpts.minBaths != null) guestAlertFilters.baths = String(filterOpts.minBaths)
  if (filterOpts.keywords) guestAlertFilters.keywords = filterOpts.keywords

  // "Map view" link — routes to the split list+map branch above (line ~517), which
  // renders MapSearchView (flagship) with the perf-safe bounds-scoped "Search this
  // area" loop. Carries the current filters/sort/perPage forward; only `view` flips.
  const mapViewHref = `${searchPagePath}?${new URLSearchParams({
    ...Object.fromEntries(
      Object.entries(sp).filter(([, v]) => typeof v === 'string' && v !== '') as [string, string][]
    ),
    view: 'split',
  }).toString()}`

  return (
    <>
      <main className={cn(V3_ROOT_CLASS, 'min-h-screen bg-background')}>
      {searchBreadcrumbItems.length > 1 && (
        <V3Breadcrumb belowNav={false} trail={searchBreadcrumbItems} />
      )}

      {/* Guest listing-alert capture — anonymous visitors only. Signed-in users
          get the Save-search button in the filter row below instead. This is the
          email -> FUB buyer-lead path (audience:buyer), now present on the route
          most city/preset links land on, not just the bare /homes-for-sale page. */}
      {(city || hasFilterOnly) && (
        <SearchAlertCapture
          signedIn={!!session?.user}
          defaultCity={city ?? ''}
          defaultSubdivision={decodedSubdivision ?? ''}
          defaultFilters={guestAlertFilters}
        />
      )}

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {city && (
          <>
            <ResultsStamp />
            <TrackSearchView
              city={city}
              subdivision={decodedSubdivision ?? undefined}
              resultsCount={totalCount}
            />
          </>
        )}
        {city && (
        <>
          <SearchPageJsonLd
            displayName={displayName}
            city={city}
            subdivision={decodedSubdivision}
            subdivisionBlurb={subdivisionBlurb}
            cityMetaDescription={cityContent?.metaDescription}
            bannerUrl={bannerUrl ?? null}
            siteUrl={siteUrl}
            presetLabel={preset?.shortLabel ?? null}
            canonicalPath={searchPagePath}
            listings={listings}
            totalCount={totalCount}
            suppressPlace={
              // When we also render ResortCommunityJsonLd for this URL, suppress
              // the generic Place so two nodes do not declare the same entity.
              Boolean(city && subdivision && decodedSubdivision && isResortCommunity(city, decodedSubdivision, resortEntityKeys))
            }
          />
          {city && subdivision && decodedSubdivision && isResortCommunity(city, decodedSubdivision, resortEntityKeys) && (
            <ResortCommunityJsonLd
              displayName={displayName}
              city={city}
              subdivision={decodedSubdivision}
              siteUrl={siteUrl}
              description={subdivisionBlurb ?? subdivisionTabContent?.about ?? null}
              bannerUrl={bannerUrl ?? null}
              listingUrls={listings
                .slice(0, 10)
                .map((l) => {
                  const key = l.ListNumber ?? l.ListingKey
                  if (!key) return ''
                  return `${siteUrl}${listingDetailPath(
                    String(key),
                    {
                      streetNumber: l.StreetNumber ?? null,
                      streetName: l.StreetName ?? null,
                      city: l.City ?? city ?? null,
                      state: l.State ?? null,
                      postalCode: l.PostalCode ?? null,
                    },
                    {
                      city: l.City ?? city ?? null,
                      subdivision: l.SubdivisionName ?? decodedSubdivision ?? null,
                    },
                    {
                      mlsNumber: l.ListNumber ?? null,
                    }
                  )}`
                })
                .filter(Boolean)}
            />
          )}
          {cityMarketFaq && cityMarketFaq.datasetVariables.length > 0 && (
            <MetadataBlock
              schema={{
                type: 'dataset',
                name: `${city}, Oregon real estate market statistics${cityMarketFaq.asOfLabel ? `, ${cityMarketFaq.asOfLabel}` : ''}`,
                description: `Live single-family home market data for ${city}, Oregon. Includes median list price, active inventory, months of supply, and median days to pending. Sourced from the regional MLS via Ryan Realty.`,
                url: searchPagePath,
                dateModified: cityMarketFaq.asOfIso ?? undefined,
                spatialCoverageName: `${city}, OR`,
                variableMeasured: cityMarketFaq.datasetVariables,
              }}
            />
          )}
        </>
      )}

      {/* 2. Clean header — H1 + one-line data-grounded intro + share. */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <V3Heading level={1}>{headerTitle}</V3Heading>
          {presetDepth ? (
            <p className="mt-3 tabular-nums">
              {presetDepth.intro}
            </p>
          ) : headerIntro ? (
            <p className="mt-3 tabular-nums">
              {headerIntro}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {(city || hasFilterOnly) && (
            <Button asChild variant="outline">
              <Link href={mapViewHref} aria-label="Switch to the map view and search as you move the map">
                <HugeiconsIcon icon={MapsLocation01Icon} className="size-4" aria-hidden />
                Map view
              </Link>
            </Button>
          )}
          <ShareButton
            title={`Homes for sale in ${displayName}`}
            text={subdivisionBlurb ?? cityContent?.metaDescription ?? `Browse homes for sale in ${displayName}, Central Oregon.`}
            url={siteUrl ? `${siteUrl}${searchPagePath}` : undefined}
            variant="default"
          />
        </div>
      </header>

      {/* 3. Filter bar — the shared registry-driven chip bar + All-filters sheet
          (same components as /homes-for-sale and this route's map view). */}
      <div className="mt-6">
        <Suspense fallback={<div className="h-14 w-full rounded-lg border border-border bg-muted" />}>
          <SearchFilterBar
            basePath={searchPagePath}
            presetChips={presetChips}
            signedIn={!!session?.user}
            pathContext={{ ...resolved, city, citySlug: slug[0] }}
            minPrice={numStr(filterOpts.minPrice)}
            maxPrice={numStr(filterOpts.maxPrice)}
            beds={numStr(filterOpts.minBeds)}
            baths={numStr(filterOpts.minBaths)}
            minSqFt={numStr(filterOpts.minSqFt)}
            maxSqFt={numStr(filterOpts.maxSqFt)}
            maxBeds={numStr(filterOpts.maxBeds)}
            maxBaths={numStr(filterOpts.maxBaths)}
            yearBuiltMin={numStr(filterOpts.yearBuiltMin)}
            yearBuiltMax={numStr(filterOpts.yearBuiltMax)}
            lotAcresMin={numStr(filterOpts.lotAcresMin)}
            lotAcresMax={numStr(filterOpts.lotAcresMax)}
            postalCode={filterOpts.postalCode}
            propertyType={filterOpts.propertyType}
            statusFilter={filterOpts.statusFilter}
            keywords={filterOpts.keywords}
            hasOpenHouse={filterOpts.hasOpenHouse ? '1' : undefined}
            garageMin={numStr(filterOpts.garageMin)}
            hasPool={filterOpts.hasPool ? '1' : undefined}
            hasView={filterOpts.hasView ? '1' : undefined}
            hasWaterfront={filterOpts.hasWaterfront ? '1' : undefined}
            newListingsDays={numStr(filterOpts.newListingsDays)}
            sort={filterOpts.sort}
            includeClosed={filterOpts.includeClosed ? '1' : undefined}
            view={viewParam}
            perPage={perPageParam}
          />
        </Suspense>
      </div>

      {/* 4 + 5. Listings grid (design-system ListingCard) + sort/pagination toolbar. */}
      <ListingsResults
        city={city}
        hasFilterOnly={hasFilterOnly}
        listings={listings}
        totalCount={totalCount}
        page={page}
        pageSize={pageSize}
        viewParam={viewParam}
        perPageParam={perPageParam}
        sp={sp}
        searchPagePath={searchPagePath}
        priceChangeKeys={priceChangeKeys}
      />

      {/* Below-fold SEO depth. Results + filters stay the only above-fold job. */}
      <SearchSeoTail
        isPlainCityPage={isPlainCityPage}
        relatedCitySlug={relatedCitySlug}
        city={city}
        cityMarketFaq={cityMarketFaq}
        presetDepth={presetDepth}
        presetBandLinks={presetBandLinks}
        presetCityLinks={presetCityLinks}
        relatedAllHomes={relatedAllHomes}
        relatedSearches={relatedSearches}
        placeName={placeName}
        subdivision={subdivision}
        preset={preset}
      />
      </div>
    </main>
    {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
        when it is NOT nested in sectioning content. */}
    <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
