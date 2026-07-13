import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import {
  getListingKeysWithRecentPriceChange,
  getCityFromSlug,
  getSubdivisionNameFromSlug,
  getNeighborhoodNameForCitySlug,
  getListingsWithAdvanced,
  type AdvancedSort,
} from '../../actions/listings'
import { coerceRegistryParams } from '@/lib/search/field-registry'
import { pickSearchFeatureFilters } from '@/lib/data'
import { getSession } from '../../actions/auth'
import { getBannerUrl, getOrCreatePlaceBanner, getBannerSearchQuery } from '../../actions/banners'
import { shareDescription, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT } from '../../../lib/share-metadata'
import { getBestListingHeroForGeography } from '../../actions/photo-classification'
import SaveSearchButton from '../../../components/SaveSearchButton'
// design-audit NAV-1: KbNav comes from app/search/layout.tsx; these scrolling
// branches render a KbFooter so MLS reciprocity + legal survive the SiteFooter
// suppression on /homes-for-sale/** (lib/site/chrome-routes.ts).
import { KbFooter } from '../../../components/site/kb/KbFooter.client'
import { SearchAlertCapture } from '../../../components/search/SearchAlertCapture'
import { getCityContent, getSubdivisionBlurb } from '../../../lib/city-content'
import { cityEntityKey, subdivisionEntityKey, getSubdivisionDisplayName, homesForSalePath, listingDetailPath, listingsBrowsePath, listingTileHref } from '../../../lib/slug'
import { entityKeyToSlug } from '../../../lib/community-slug'
import { getPresetBySlug, isPresetSlug, resolvePresetYearBuiltMin } from '../../../lib/search-presets'
import { getPopularSearchesForCity, getAllCityHomesLink } from '../../../lib/popular-searches'
import ListingCard, { type ListingCardData } from '@/components/site/ListingCard'
import { Button } from '@/components/ui/button'
import { HugeiconsIcon } from '@hugeicons/react'
import { MapsLocation01Icon } from '@hugeicons/core-free-icons'
import { Container, Body, Grid, H1, H2 } from '@/components/site/primitives'
import MarketSnapshot from '@/components/site/MarketSnapshot'
import { FAQBlock } from '@/components/site/FAQBlock'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { buildMarketFaq } from '@/lib/site/market-faq'
import {
  buildPresetFaq,
  getAdjacentPriceBandLinks,
  getSamePresetCityLinks,
  isSortOnlyPreset,
} from '@/lib/site/preset-faq'
import { GolfLanding } from '@/components/site/golf/GolfLanding'
import { GOLF_COMMUNITIES } from '@/data/golf-landing'
import { getGolfImages, pickGolfImage, getGolfHomesForLanding, getMarketPulse } from '@/lib/data'
import AdvancedSearchFilters from '../../../components/AdvancedSearchFilters'
import ShareButton from '../../../components/ShareButton'
import { BreadcrumbNav } from '@/components/site/BreadcrumbNav'
import SearchPageJsonLd from './SearchPageJsonLd'
import ResortCommunityJsonLd from './ResortCommunityJsonLd'
import { isResortCommunity } from '../../../lib/resort-communities'
import { getResortEntityKeys } from '../../actions/subdivision-flags'
import {
  getSubdivisionDescription,
  getSubdivisionTabContent,
} from '../../actions/subdivision-descriptions'
import SearchListingsToolbar from '../../../components/SearchListingsToolbar'
import TrackSearchView from '../../../components/tracking/TrackSearchView'
import { ResultsStamp } from '@/components/search/ResultsStamp.client'
import { getSavedListingKeys } from '../../actions/saved-listings'
import { getLikedListingKeys } from '../../actions/likes'
import { getBuyingPreferences } from '../../actions/buying-preferences'
import { getCityBoundary } from '../../actions/cities'
import { getCommunityBySlug } from '../../actions/communities'
import { shouldNoIndexSearchVariant } from '../../../lib/seo-routing'
import { decodeMapPolygon } from '@/lib/map-polygon'

async function withTimeout<T>(promise: Promise<T>, fallback: T, timeoutMs = 2500): Promise<T> {
  return Promise.race([
    // A rejection (e.g. a 57014 statement-timeout on a cold heavy read) must
    // degrade to the fallback, NOT propagate and blank the whole page. The race
    // alone only handles HANGS — a promise that rejects before timeoutMs would
    // reject the race. Catch it so every guarded fetch fails soft.
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ])
}

/**
 * Timeout for the primary listings fetch. The common case resolves from the
 * slim MV in well under a second; this ceiling exists only to cover the heavy
 * search_listings_advanced RPC fallback (jsonb feature filters / deep pages),
 * whose cold scan can take ~8s. It is long enough that a real result is never
 * truncated to an empty fallback (the original bug, where a 2.5s timeout cut
 * off the ~8s cold RPC) and short enough to fail loud if the data layer is
 * genuinely stuck. The RPC warms to ~1-2s, so 12s comfortably covers a cold run.
 */
const LISTINGS_FETCH_TIMEOUT_MS = 12000

/** Resolve slug segments to city, subdivision (display name), and preset. */
async function resolveSlug(slug: string[]): Promise<{
  city: string | null
  subdivisionSlug: string | null
  subdivisionDisplayName: string | null
  presetSlug: string | null
  preset: ReturnType<typeof getPresetBySlug>
  /** Set when the second segment is a known boundary_neighborhood (e.g. Bend
   *  "Mountain View"). Drives the single-indexed neighborhood fast path. */
  neighborhoodName: string | null
}> {
  const citySlug = slug[0]
  const resolvedCity = citySlug ? (await getCityFromSlug(citySlug)) ?? decodeURIComponent(citySlug).trim() : null
  const city = resolvedCity ?? citySlug ?? null

  if (slug.length === 0) {
    return { city: null, subdivisionSlug: null, subdivisionDisplayName: null, presetSlug: null, preset: null, neighborhoodName: null }
  }
  if (slug.length === 1) {
    return { city, subdivisionSlug: null, subdivisionDisplayName: null, presetSlug: null, preset: null, neighborhoodName: null }
  }
  if (slug.length === 2) {
    const second = slug[1]!
    // A real neighborhood wins over a same-named preset. 'mountain-view' is BOTH
    // the Mountain View neighborhood AND a "mountain view" amenity preset; the
    // preset routed to the slow advanced RPC and timed out to an empty grid,
    // while the neighborhood resolves to one indexed boundary_neighborhood query.
    const neighborhoodName = citySlug ? await getNeighborhoodNameForCitySlug(citySlug, second) : null
    if (neighborhoodName) {
      return { city, subdivisionSlug: second, subdivisionDisplayName: neighborhoodName, presetSlug: null, preset: null, neighborhoodName }
    }
    if (isPresetSlug(second)) {
      return { city, subdivisionSlug: null, subdivisionDisplayName: null, presetSlug: second, preset: getPresetBySlug(second), neighborhoodName: null }
    }
    const subdivisionDisplayName = city ? (await getSubdivisionNameFromSlug(city, second)) ?? decodeURIComponent(second) : null
    return { city, subdivisionSlug: second, subdivisionDisplayName, presetSlug: null, preset: null, neighborhoodName: null }
  }
  // slug.length >= 3: [city, subdivision-or-neighborhood, preset]
  const subSlug = slug[1]!
  const nbhd3 = citySlug ? await getNeighborhoodNameForCitySlug(citySlug, subSlug) : null
  const subdivisionDisplayName = nbhd3 ?? (city ? (await getSubdivisionNameFromSlug(city, subSlug)) ?? decodeURIComponent(subSlug) : null)
  const presetSlug = slug[2] ?? null
  const preset = presetSlug ? getPresetBySlug(presetSlug) : null
  return { city, subdivisionSlug: subSlug, subdivisionDisplayName, presetSlug, preset, neighborhoodName: nbhd3 }
}

function buildCanonicalPath(city: string | null, subdivisionDisplayName: string | null, subdivisionSlug: string | null, presetSlug: string | null): string {
  if (!city) return listingsBrowsePath()
  const base = subdivisionDisplayName ?? subdivisionSlug
    ? homesForSalePath(city, subdivisionDisplayName ?? subdivisionSlug ?? null)
    : homesForSalePath(city, null)
  return presetSlug ? `${base}/${presetSlug}` : base
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
  const { slug = [] } = await params
  const sp = await searchParams
  const { city, subdivisionDisplayName, subdivisionSlug, presetSlug, preset } = await resolveSlug(slug)
  const hasInvalidPresetSegment = slug.length >= 3 && !!presetSlug && !preset
  const placeName = subdivisionDisplayName ? getSubdivisionDisplayName(subdivisionDisplayName) : (city ?? 'Central Oregon')
  const displayName = preset ? `${placeName} ${preset.shortLabel}` : placeName
  const content = city ? getCityContent(city) : null
  const subdivisionDesc =
    subdivisionDisplayName && city
      ? await withTimeout(getSubdivisionDescription(city, subdivisionDisplayName), null, 1200)
      : null
  const rawMetaDesc =
    (subdivisionDisplayName ? (subdivisionDesc ?? getSubdivisionBlurb(subdivisionDisplayName)) : null) ??
    content?.metaDescription ??
    (preset
      ? `Browse ${preset.label.toLowerCase()} in ${placeName}, Central Oregon. View listings and property details.`
      : `Browse homes for sale in ${displayName}, Central Oregon. View listings, map, and property details.`)
  const metaDesc = shareDescription(rawMetaDesc)
  const bannerUrl =
    city &&
    (subdivisionDisplayName
      ? await withTimeout(getBannerUrl('subdivision', subdivisionEntityKey(city, subdivisionDisplayName)), null, 1200)
      : await withTimeout(getBannerUrl('city', cityEntityKey(city)), null, 1200))
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
  const defaultOgImage = `${siteUrl}/api/og?type=default`
  const canonicalPath = buildCanonicalPath(city, subdivisionDisplayName, subdivisionSlug, presetSlug)
  const dynamicOgImage = slug.length > 0
    ? `${siteUrl}/search/og/${slug.map((part) => encodeURIComponent(part)).join('/')}`
    : defaultOgImage
  const title = preset ? `${preset.label} in ${placeName}` : `Homes for Sale in ${placeName}`
  return {
    title,
    description: metaDesc,
    alternates: { canonical: `${siteUrl}${canonicalPath}` },
    robots: hasInvalidPresetSegment || shouldNoIndexSearchVariant(sp) ? { index: false, follow: true } : undefined,
    openGraph: {
      title,
      description: metaDesc,
      url: `${siteUrl}${canonicalPath}`,
      siteName: 'Ryan Realty',
      type: 'website',
      images: [
        {
          url: dynamicOgImage || bannerUrl || defaultOgImage,
          width: OG_IMAGE_WIDTH,
          height: OG_IMAGE_HEIGHT,
          alt: `Real estate in ${placeName}, Central Oregon`,
        },
      ],
    },
    twitter: { card: 'summary_large_image', title, description: metaDesc, images: [dynamicOgImage || bannerUrl || defaultOgImage] },
  }
}

type SearchParams = {
  /** On the on-golf-course landing, ?all=1 falls through to the standard filterable list. */
  all?: string
  minPrice?: string
  maxPrice?: string
  beds?: string
  baths?: string
  minSqFt?: string
  maxSqFt?: string
  maxBeds?: string
  maxBaths?: string
  yearBuiltMin?: string
  yearBuiltMax?: string
  lotAcresMin?: string
  lotAcresMax?: string
  postalCode?: string
  propertyType?: string
  propertySubType?: string
  statusFilter?: string
  keywords?: string
  hasOpenHouse?: string
  garageMin?: string
  hasPool?: string
  hasView?: string
  hasWaterfront?: string
  newListingsDays?: string
  sort?: string
  includeClosed?: string
  page?: string
  perPage?: string
  view?: string
  poly?: string
}

/** Preset breadcrumb label for filter-only searches (e.g. Under $500K, Luxury). */
function getPresetSearchLabel(sp: SearchParams): string | null {
  if (sp.maxPrice === '500000') return 'Under $500K'
  if (sp.minPrice === '1000000') return 'Luxury'
  if (sp.keywords?.toLowerCase().includes('new construction')) return 'New Construction'
  if (sp.hasWaterfront === '1') return 'Waterfront'
  return null
}

function hasFilterOnlySearch(sp: SearchParams): boolean {
  return Boolean(sp.maxPrice || sp.minPrice || (sp.keywords?.trim()) || sp.hasWaterfront === '1')
}

/** Number -> string for the filter-bar props (the UI reflects the resolved
 *  filterOpts, including preset-supplied values), undefined when unset. */
function numStr(n: number | null | undefined): string | undefined {
  return n != null && !Number.isNaN(n) ? String(n) : undefined
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
  const hasFilterOnly = !city && hasFilterOnlySearch(sp)
  const presetLabel = !city ? getPresetSearchLabel(sp) : null

  const columns = [1, 2, 3, 4, 5].includes(Number(sp.view)) ? Number(sp.view) : 3
  const viewParam = String(columns) as '1' | '2' | '3' | '4' | '5'
  const ROWS = 3
  const defaultPageSize = columns * ROWS
  const perPageParam = sp.perPage ?? String(defaultPageSize)
  const pageSize = Math.min(100, Math.max(1, parseInt(perPageParam, 10) || defaultPageSize))
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const offset = (page - 1) * pageSize
  const initialPolygon = decodeMapPolygon(sp.poly)

  const filterOptsBase = {
    // Registry fields (fireplace, shop, well water, appliances, …) — without
    // this spread the AllFiltersSheet/chips on this surface would claim filters
    // the query ignores (review finding 2026-07-11).
    ...pickSearchFeatureFilters(coerceRegistryParams(sp as Record<string, string | undefined>)),
    city: city || undefined,
    subdivision: decodedSubdivision,
    neighborhood,
    minPrice: sp.minPrice ? Number(sp.minPrice) : undefined,
    maxPrice: sp.maxPrice ? Number(sp.maxPrice) : undefined,
    minBeds: sp.beds ? Number(sp.beds) : undefined,
    minBaths: sp.baths ? Number(sp.baths) : undefined,
    minSqFt: sp.minSqFt ? Number(sp.minSqFt) : undefined,
    maxSqFt: sp.maxSqFt ? Number(sp.maxSqFt) : undefined,
    maxBeds: sp.maxBeds ? Number(sp.maxBeds) : undefined,
    maxBaths: sp.maxBaths ? Number(sp.maxBaths) : undefined,
    yearBuiltMin: sp.yearBuiltMin ? Number(sp.yearBuiltMin) : undefined,
    yearBuiltMax: sp.yearBuiltMax ? Number(sp.yearBuiltMax) : undefined,
    lotAcresMin: sp.lotAcresMin != null ? Number(sp.lotAcresMin) : undefined,
    lotAcresMax: sp.lotAcresMax != null ? Number(sp.lotAcresMax) : undefined,
    postalCode: sp.postalCode?.trim() || undefined,
    propertyType: sp.propertyType?.trim() || undefined,
    propertySubType: sp.propertySubType?.trim() || undefined,
    statusFilter: sp.statusFilter?.trim() || undefined,
    keywords: sp.keywords?.trim() || undefined,
    hasOpenHouse: sp.hasOpenHouse === '1',
    garageMin: sp.garageMin != null ? Number(sp.garageMin) : undefined,
    hasPool: sp.hasPool === '1',
    hasView: sp.hasView === '1',
    hasWaterfront: sp.hasWaterfront === '1',
    newListingsDays: sp.newListingsDays ? Number(sp.newListingsDays) : undefined,
    sort:
      sp.sort === 'newest' || sp.sort === 'oldest' || sp.sort === 'price_asc' || sp.sort === 'price_desc' ||
      sp.sort === 'price_per_sqft_asc' || sp.sort === 'price_per_sqft_desc' || sp.sort === 'year_newest' || sp.sort === 'year_oldest'
        ? (sp.sort as AdvancedSort)
        : 'newest',
    includeClosed: sp.includeClosed === '1',
  }
  // Predefined preset: apply preset params (preset wins for its keys so the page shows the right results)
  const presetYearBuiltMin = preset ? resolvePresetYearBuiltMin(preset) : undefined
  // A preset only FILLS filters the visitor has not explicitly set in the URL.
  // An explicit query param (the visitor changed a filter) wins over the preset
  // for that one key. Without the `!sp.*` guards the preset always won, so
  // changing price / sort / status on a preset page did nothing — "if you change
  // a filter it breaks." Amenity presets (pool/view/golf/fireplace) have no
  // off-switch in the URL, so they stay preset-driven.
  const filterOpts = preset
    ? {
        ...filterOptsBase,
        ...(preset.params.maxPrice != null && !sp.maxPrice && { maxPrice: preset.params.maxPrice }),
        ...(preset.params.minPrice != null && !sp.minPrice && { minPrice: preset.params.minPrice }),
        ...(preset.params.statusFilter != null && !sp.statusFilter && { statusFilter: preset.params.statusFilter }),
        ...(preset.params.newListingsDays != null && !sp.newListingsDays && { newListingsDays: preset.params.newListingsDays }),
        ...(preset.params.hasOpenHouse != null && { hasOpenHouse: preset.params.hasOpenHouse }),
        ...(preset.params.hasPool != null && { hasPool: preset.params.hasPool }),
        ...(preset.params.hasView != null && { hasView: preset.params.hasView }),
        ...(preset.params.hasFireplace != null && { hasFireplace: preset.params.hasFireplace }),
        ...(preset.params.hasGolfCourse != null && { hasGolfCourse: preset.params.hasGolfCourse }),
        ...(preset.params.hasWaterfront != null && { hasWaterfront: preset.params.hasWaterfront }),
        ...(preset.params.viewContains != null && preset.params.viewContains !== '' && { viewContains: preset.params.viewContains }),
        ...(preset.params.lotAcresMin != null && !sp.lotAcresMin && { lotAcresMin: preset.params.lotAcresMin }),
        ...(presetYearBuiltMin != null && !sp.yearBuiltMin && { yearBuiltMin: presetYearBuiltMin }),
        ...(preset.params.propertySubType != null && preset.params.propertySubType !== '' && !sp.propertySubType && { propertySubType: preset.params.propertySubType }),
        ...(preset.params.keywords != null && preset.params.keywords !== '' && !sp.keywords && { keywords: preset.params.keywords }),
        ...(preset.params.sort != null && !sp.sort && { sort: preset.params.sort as AdvancedSort }),
      }
    : filterOptsBase

  // Golf landing — the on-golf-course preset renders a purpose-built, immersive
  // golf properties landing page (hero + community spotlight + stat band + the
  // real golf homes + FAQ). `?all=1` falls through to the standard filterable
  // list+map view of the same golf-filtered homes.
  if (preset?.landing === 'golf' && city && sp.all !== '1') {
    const [golfRows, golfImages] = await Promise.all([
      // Lightweight golf-homes fetch (search_golf_homes RPC, no full_count window)
      // returns in well under a second. The full search RPC's count(*) OVER ()
      // golf-filters all ~134K Bend rows (~7s, risks a serverless timeout).
      withTimeout(getGolfHomesForLanding(city, 24), [], 6000),
      withTimeout(getGolfImages(24), []),
    ])
    const heroImage = pickGolfImage(golfImages, city, null)
    const homes = golfRows.map((l): ListingCardData => {
      const street = [l.StreetNumber, l.StreetName].filter(Boolean).join(' ').trim()
      const cityLine = [[l.City, 'OR'].filter(Boolean).join(', '), l.PostalCode].filter(Boolean).join(' ').trim()
      return {
        listingKey: (l.ListNumber ?? l.ListingKey ?? '').toString().trim(),
        href: listingTileHref({
          listingKey: l.ListingKey,
          listNumber: l.ListNumber,
          streetNumber: l.StreetNumber,
          streetName: l.StreetName,
          city: l.City,
        }),
        photoUrl: l.PhotoURL ?? null,
        price: l.ListPrice ?? null,
        addressLine: street || 'Address available on request',
        cityLine: cityLine || 'Central Oregon',
        beds: l.BedroomsTotal ?? null,
        baths: l.BathroomsTotal ?? null,
        sqft: l.TotalLivingAreaSqFt ?? null,
      }
    })
    const citySlug = cityEntityKey(city)
    const cityCommunities = GOLF_COMMUNITIES.filter((c) => c.citySlug === citySlug)
    const communities = cityCommunities.length ? cityCommunities : GOLF_COMMUNITIES
    const allHomesHref = `${homesForSalePath(city)}/on-golf-course?all=1`
    return (
      <>
        <GolfLanding
          city={city}
          heroImage={heroImage}
          communities={communities}
          homes={homes}
          totalHomes={0}
          allHomesHref={allHomesHref}
        />
        {/* design-audit NAV-1: KbFooter replaces the suppressed SiteFooter. */}
        <div className="kb-root">
          <KbFooter towns={[]} />
        </div>
      </>
    )
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
    withTimeout(getListingKeysWithRecentPriceChange(), new Set<string>()),
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
  const entityType = subdivision ? ('subdivision' as const) : ('city' as const)
  const entityKey = subdivision ? subdivisionEntityKey(city!, decodedSubdivision!) : cityEntityKey(city!)
  const resortKeys = city && subdivision ? await withTimeout(getResortEntityKeys(), new Set<string>(), 1200) : new Set<string>()
  const isResortSubdivision = subdivision && city && decodedSubdivision ? resortKeys.has(entityKey) : false
  const bannerSearchQuery = city
    ? getBannerSearchQuery(
        subdivision ? 'subdivision' : 'city',
        subdivision ? decodedSubdivision! : city,
        city,
        subdivision ? isResortSubdivision : undefined
      )
    : ''
  // Banner URL is still resolved because the SearchPageJsonLd / ResortCommunityJsonLd
  // structured data references the place's hero image. The clean results page does
  // not render a photo hero band, so only the URL is needed (no attribution chrome).
  const [listingHero, bannerResult] =
    city
      ? await Promise.all([
          withTimeout(getBestListingHeroForGeography(city, decodedSubdivision ?? null), null, 1500),
          withTimeout(getOrCreatePlaceBanner(entityType, entityKey, bannerSearchQuery), { url: null, attribution: null }, 1500),
        ])
      : [null, { url: null, attribution: null }]
  // Prefer curated Central Oregon lifestyle image over generic Unsplash/AI banner
  const { CITY_HERO_IMAGES } = await import('@/lib/central-oregon-images')
  const curatedCityImage = city ? (CITY_HERO_IMAGES[city.toLowerCase().replace(/\s+/g, '-')] ?? null) : null
  const bannerUrl = curatedCityImage ?? listingHero?.url ?? bannerResult?.url ?? null

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
    const [{ default: UnifiedMapListingsView }, { default: SearchFilterBar }] = await Promise.all([
      import('../../../components/UnifiedMapListingsView'),
      import('../../../components/SearchFilterBar'),
    ])
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
            <Button asChild variant="secondary" size="sm" className="shrink-0">
              <Link href={gridViewHref} aria-label="Switch back to the grid view">
                Grid view
              </Link>
            </Button>
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
              locationLabel={displayName}
              locationHref={`${searchPagePath}?${new URLSearchParams({ ...sp, view: 'map' }).toString()}`}
              signedIn={!!session?.user}
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

  // Clean header copy — data-grounded. Active count = totalCount (the accurate
  // full_count of the filtered results). The median is intentionally omitted:
  // the only available source is a city-wide cached value that misrepresents a
  // price-filtered preset, so per the data-accuracy rule it is cut, not faked.
  const headerCount = totalCount > 0 ? totalCount : null
  const headerIntroParts: string[] = []
  if (headerCount != null) headerIntroParts.push(`${headerCount.toLocaleString()} ${headerCount === 1 ? 'home' : 'homes'} for sale.`)
  const headerIntro = headerIntroParts.join(' ')
  // Header title adapts: preset label folds into placeName, filter-only searches
  // use the derived presetLabel, everything else is "Homes for sale in <place>".
  const headerTitle = preset
    ? `Homes in ${placeName} ${preset.shortLabel.toLowerCase()}`
    : presetLabel
      ? `${presetLabel} homes in Central Oregon`
      : `Homes for sale in ${placeName}`

  // Related searches — SEO internal-linking for a city/preset page. Cross-link to
  // that city's other popular searches plus an "All [City] homes" link.
  const relatedCitySlug = city ? cityEntityKey(city) : null
  const relatedAllHomes = relatedCitySlug ? getAllCityHomesLink(relatedCitySlug) : null
  const relatedSearches = relatedCitySlug
    ? getPopularSearchesForCity(relatedCitySlug, 12).filter((l) => l.href !== searchPagePath).slice(0, 8)
    : []

  // City-page SEO depth — ONLY the plain /homes-for-sale/[city] page (not the
  // subdivision/preset/filtered variants, which are noindex). Brings this intent
  // route to parity with the /cities/[city] hub: a self-fetching market-stat band,
  // a verified FAQ, and Dataset + FAQPage JSON-LD, all single-sourced from
  // buildMarketFaq so the visible numbers and the markup never diverge. Every
  // figure is null-guarded (no invented stats, CLAUDE.md §0).
  const isPlainCityPage = !!(city && !subdivision && !preset)
  // Preset-page SEO depth (Family 3). The indexable /homes-for-sale/[city]/[preset]
  // pages get destination-page depth: an honest editorial intro, a preset-scoped
  // FAQ (+ FAQPage JSON-LD via FAQBlock), and cross-links. Gated to the CLEAN
  // canonical render: no subdivision segment, no user filter/sort/page params
  // (shouldNoIndexSearchVariant, those variants are noindex and their counts
  // would not match the preset copy), not a sort-only preset (a pure re-order of
  // the city page carries no segment of its own), and not a degraded fetch (a
  // timed-out count must never produce "none on the market" copy, CLAUDE.md §0).
  const isPresetDepthPage = !!(
    city &&
    !subdivision &&
    preset &&
    !isSortOnlyPreset(preset) &&
    !shouldNoIndexSearchVariant(sp)
  )
  const cityPulse = (isPlainCityPage || isPresetDepthPage) && relatedCitySlug
    ? await getMarketPulse({ geoType: 'city', geoSlug: relatedCitySlug }).catch(() => null)
    : null
  const cityMarketFaq = isPlainCityPage && city ? buildMarketFaq(city, cityPulse) : null
  const presetDepth =
    isPresetDepthPage && city && preset && !listingsResult.degraded
      ? buildPresetFaq(city, preset, totalCount, cityPulse)
      : null
  const presetBandLinks = isPresetDepthPage && city && preset ? getAdjacentPriceBandLinks(city, preset.slug) : []
  const presetCityLinks =
    isPresetDepthPage && preset && relatedCitySlug ? getSamePresetCityLinks(preset, relatedCitySlug) : []

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
  // renders UnifiedMapListingsView with the perf-safe bounds-scoped "Search this
  // area" loop. Carries the current filters/sort/perPage forward; only `view` flips.
  const mapViewHref = `${searchPagePath}?${new URLSearchParams({
    ...Object.fromEntries(
      Object.entries(sp).filter(([, v]) => typeof v === 'string' && v !== '') as [string, string][]
    ),
    view: 'split',
  }).toString()}`

  return (
    <main className="min-h-screen bg-background pt-16">
      {searchBreadcrumbItems.length > 1 && (
        <div className="border-b border-primary/20 bg-primary"><Container className="py-3"><BreadcrumbNav tone="on-navy" items={searchBreadcrumbItems} includeJsonLd={false} /></Container></div>
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

      <Container className="py-8">
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
          <H1>{headerTitle}</H1>
          {presetDepth ? (
            // Preset editorial intro carries the verified count plus labeled
            // city-wide context, so it replaces the bare count line.
            <Body size="large" className="mt-3 tabular-nums">
              {presetDepth.intro}
            </Body>
          ) : headerIntro ? (
            <Body size="large" className="mt-3 tabular-nums">
              {headerIntro}
            </Body>
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

      {/* 3. Filter bar — the existing URL-driven filters, presented as one tidy row. */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Suspense fallback={<div className="h-14 flex-1 rounded-lg border border-border bg-muted" />}>
          <AdvancedSearchFilters
            basePath={searchPagePath}
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
            propertySubType={filterOpts.propertySubType}
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
        <SaveSearchButton user={!!session?.user} />
      </div>

      {/* 4 + 5. Listings grid (design-system ListingCard) + sort/pagination toolbar. */}
      {!city && !hasFilterOnly ? (
        <Body className="mt-10">Select a city or subdivision to see listings.</Body>
      ) : listings.length === 0 ? (
        <Body className="mt-10">No homes match this search right now. Adjust the filters or explore a related search below.</Body>
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
          <Grid cols={4} gap="loose" className="mt-2">
            {listings.map((listing, i) => {
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
                ...(key && priceChangeKeys.has(key) ? { badge: { kind: 'drop' as const, label: 'Price drop' } } : {}),
              }
              return <ListingCard key={key} listing={card} />
            })}
          </Grid>
        </div>
      )}

      {/* City-page SEO depth — market band + verified FAQ (plain city page only). */}
      {isPlainCityPage && (
        <section className="mt-12">
          <MarketSnapshot citySlug={relatedCitySlug!} cityName={city!} />
        </section>
      )}
      {cityMarketFaq && cityMarketFaq.faqs.length > 0 && (
        <FAQBlock
          items={cityMarketFaq.faqs}
          eyebrow="Common questions"
          title={`${city!} real estate questions`}
        />
      )}

      {/* Preset-page depth: preset-scoped FAQ + FAQPage JSON-LD (FAQBlock emits
          the schema from the same items, so text and markup never diverge). */}
      {presetDepth && presetDepth.faqs.length > 0 && (
        <FAQBlock
          items={presetDepth.faqs}
          eyebrow="Common questions"
          title={presetDepth.faqTitle}
        />
      )}

      {/* Preset cross-links: adjacent price bands + the same search in other
          cities (only cities whose data-grounded popular-search list carries
          this preset, so no empty-inventory links). */}
      {(presetBandLinks.length > 0 || presetCityLinks.length > 0) && (
        <section className="mt-14 border-t border-border pt-10" aria-labelledby="preset-crosslinks-heading">
          <H2 id="preset-crosslinks-heading">Similar searches</H2>
          {presetBandLinks.length > 0 && (
            <div className="mt-5">
              <Body size="small">Nearby price ranges</Body>
              <div className="mt-2.5 flex flex-wrap gap-2.5">
                {presetBandLinks.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary/30 hover:shadow-sm"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {presetCityLinks.length > 0 && (
            <div className="mt-5">
              <Body size="small">{preset ? `${preset.shortLabel} in other cities` : 'In other cities'}</Body>
              <div className="mt-2.5 flex flex-wrap gap-2.5">
                {presetCityLinks.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary/30 hover:shadow-sm"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 6. Related searches — SEO internal links to this city's other popular searches. */}
      {(relatedAllHomes || relatedSearches.length > 0) && (
        <section className="mt-14 border-t border-border pt-10" aria-labelledby="related-searches-heading">
          <H2 id="related-searches-heading">Related searches</H2>
          <div className="mt-5 flex flex-wrap gap-2.5">
            {relatedAllHomes && (
              <Link
                href={relatedAllHomes.href}
                className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
              >
                {relatedAllHomes.label}
              </Link>
            )}
            {relatedSearches.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary/30 hover:shadow-sm"
              >
                {placeName} {l.label.toLowerCase()}
              </Link>
            ))}
          </div>
        </section>
      )}
      </Container>
      <div className="kb-root">
        <KbFooter towns={[]} />
      </div>
    </main>
  )
}
