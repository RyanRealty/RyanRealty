import type { Metadata } from 'next'
import { getBannerUrl } from '../../actions/banners'
import { getSubdivisionDescription } from '../../actions/subdivision-descriptions'
import { shareDescription, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT } from '../../../lib/share-metadata'
import { getCityContent, getSubdivisionBlurb } from '../../../lib/city-content'
import { cityEntityKey, subdivisionEntityKey } from '../../../lib/slug'
import { isSortOnlyPreset } from '@/lib/site/preset-faq'
import { shouldNoIndexSearchVariant } from '../../../lib/seo-routing'
import { resolveMatrixNoIndex, resolvePresetTypeTwinPath } from '@/lib/seo/getSearchMatrixEntries'
import { isRefusedBrowsePair } from '@/lib/seo/browse-pair-decision'
import { withTimeout } from './fetch-guards'
import { refusalPlatDoor, searchAreaUnavailableHeading } from './sections/AreaUnavailable'
import { resolveSlug, buildCanonicalPath, printableAreaName, unnamedAreaPhrase } from './resolve-slug'
import { placeHomesForSaleHeading } from '@/lib/site/place-homes-heading'
import { selfCitySearchCanonicalPath, selfCitySearchHeading } from '@/lib/communities/self-city-community'
import { luxuryPresetDescription, luxuryPresetHeading } from '@/lib/site/bend-luxury-homes'
import {
  BEND_NEW_CONSTRUCTION_CANONICAL_PATH,
  isBendNewConstructionSearchTwinSlug,
} from '@/lib/routing/bend-new-construction-search-twin'

/**
 * Metadata for an area segment that names no place (SEO-1, visibility audit
 * 2026-09-22). The route cannot answer 404 under app/loading.tsx, so noindex is
 * what keeps the 200 out of the index, and the title says what is true instead
 * of title-casing the slug into a place. No canonical: never canonicalise a URL
 * we are refusing to serve. Same contract as SUBDIVISION_UNAVAILABLE_METADATA.
 */
export const SEARCH_AREA_UNAVAILABLE_METADATA = {
  title: 'No area at this address',
  robots: { index: false, follow: true },
} as const satisfies Metadata

/**
 * Full metadata assembly for the slug search route. page.tsx's generateMetadata
 * wrapper attaches `alternates: { canonical: canonicalUrl }` — the canonical
 * contract stays pinned in the route file (ci:seo-routes file contract). A null
 * canonicalUrl is the refusal: the wrapper emits no canonical.
 */
export async function buildSearchSlugMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<{ canonicalUrl: string | null; metadata: Metadata }> {
  const { slug = [] } = await params
  const sp = await searchParams
  const resolved = await resolveSlug(slug)
  const { city, subdivisionDisplayName, subdivisionSlug, presetSlug, preset, area } = resolved
  const hasInvalidPresetSegment = slug.length >= 3 && !!presetSlug && !preset

  // SEO-1: an area segment no source knows fails CLOSED — honest title,
  // noindex,follow, no canonical — instead of an indexable page about a place
  // title-cased out of the URL.
  if (area && isRefusedBrowsePair(area)) {
    const title = searchAreaUnavailableHeading(refusalPlatDoor(resolved.areaFacts))
    return { canonicalUrl: null, metadata: { ...SEARCH_AREA_UNAVAILABLE_METADATA, title } }
  }

  // What the page may PRINT for the area: a withheld MLS code or an unknown
  // area is never a place name (publishPlatDisplayName).
  const areaPrint = subdivisionSlug ? printableAreaName(resolved) : null
  const placeName = subdivisionSlug
    ? (areaPrint ?? unnamedAreaPhrase(city, area?.kind))
    : (city ?? 'Central Oregon')
  const displayName = preset ? `${placeName} ${preset.shortLabel}` : placeName
  const content = city ? getCityContent(city) : null
  const subdivisionDesc =
    areaPrint && subdivisionDisplayName && city
      ? await withTimeout(getSubdivisionDescription(city, subdivisionDisplayName), null, 1200)
      : null
  // SITE-185: the luxury preset page is the one winner for "{place} luxury
  // homes for sale", so its description opens on that query instead of the
  // city's generic meta description (which never says "luxury").
  // SITE-196: an area page with no description of its own used to inherit
  // the CITY's meta description ("Homes for sale in Bend, Oregon. Browse Bend
  // real estate listings..."), so /homes-for-sale/bend/fawnview described
  // Bend and collected "bend oregon real estate" impressions that belong to
  // /cities/bend. An area page now describes its own place.
  const rawMetaDesc =
    luxuryPresetDescription(preset, placeName) ??
    (areaPrint && subdivisionDisplayName ? (subdivisionDesc ?? getSubdivisionBlurb(subdivisionDisplayName)) : null) ??
    (subdivisionSlug ? null : content?.metaDescription) ??
    (preset
      ? `${preset.label} in ${placeName}, Central Oregon. Live listings from the regional MLS, with price, size, and the map.`
      : subdivisionSlug && areaPrint && city
        ? `${placeHomesForSaleHeading(areaPrint)} in ${city}, Oregon. Live listings from the regional MLS, with price, size, and the map.`
        : `Homes for sale in ${displayName}, Central Oregon. Live listings from the regional MLS, with price, size, and the map.`)
  const metaDesc = shareDescription(rawMetaDesc)
  const bannerUrl =
    city &&
    (subdivisionDisplayName
      ? await withTimeout(getBannerUrl('subdivision', subdivisionEntityKey(city, subdivisionDisplayName)), null, 1200)
      : await withTimeout(getBannerUrl('city', cityEntityKey(city)), null, 1200))
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
  const defaultOgImage = `${siteUrl}/api/og?type=default`
  const isBendNewConstructionTwin = isBendNewConstructionSearchTwinSlug(slug, sp)

  // EXP-6: a type preset with a verified-positive count has a richer twin at
  // /cities/{city}/types/{type} or /communities/{c}/types/{type}; the preset
  // page points its canonical there (the sitemap submits the type page and
  // drops this one — lib/seo/place-type-twin.ts, one rule for both). A query
  // variant keeps the preset canonical: its own facets are a different page.
  const typeTwinPath =
    preset && !hasInvalidPresetSegment && !shouldNoIndexSearchVariant(sp)
      ? await withTimeout(resolvePresetTypeTwinPath(slug, preset.slug), null, 2500)
      : null

  // SITE-187 / SITE-184: the plain city search for a self-city community
  // (Sunriver, Black Butte Ranch) is the same inventory as /communities/<slug>,
  // which PAGE_OUTLINE names as the one winner for "{place} homes for sale".
  // The page still renders for the search app's city switcher; it just stops
  // competing, and its title stops repeating the winner's exact string. Area
  // and preset variants keep their own canonical and title.
  const selfCityShape = city
    ? {
        citySlug: cityEntityKey(city),
        hasArea: Boolean(subdivisionDisplayName || subdivisionSlug),
        hasPreset: Boolean(presetSlug),
      }
    : null
  const selfCityCanonical = selfCityShape ? selfCitySearchCanonicalPath(selfCityShape) : null
  const selfCityTitle = selfCityShape ? selfCitySearchHeading({ ...selfCityShape, placeName }) : null

  const canonicalPath = isBendNewConstructionTwin
    ? BEND_NEW_CONSTRUCTION_CANONICAL_PATH
    : typeTwinPath
      ? typeTwinPath
      : selfCityCanonical
        ? selfCityCanonical
        : area && slug.length === 2
          ? // EXP-4 / SEO-6: a plat twin or a community twin consolidates onto its
            // place page; every other pair is self-canonical.
            (area.canonicalPath ?? buildCanonicalPath(city, subdivisionDisplayName, subdivisionSlug, presetSlug))
          : buildCanonicalPath(city, subdivisionDisplayName, subdivisionSlug, presetSlug)
  // The OG card route title-cases the URL segments, so an area with no
  // printable name (an MLS code, or a read that could not name it) takes the
  // default card rather than a picture of the code.
  const dynamicOgImage = slug.length > 0 && (!subdivisionSlug || areaPrint)
    ? `${siteUrl}/search/og/${slug.map((part) => encodeURIComponent(part)).join('/')}`
    : defaultOgImage
  // SITE-185: the luxury preset's title is the win query in human form
  // ("Bend luxury homes for sale"); the layout template adds the brand.
  // SITE-184: the plain city search of a self-city community reads "Search
  // {place} homes" so no second page carries the community's title.
  const title =
    luxuryPresetHeading(preset, placeName) ??
    (preset
      ? `${preset.label} in ${placeName}`
      : (selfCityTitle ??
        (areaPrint || !subdivisionSlug ? placeHomesForSaleHeading(placeName) : `Homes for sale in ${placeName}`)))
  // W3.2 search-matrix noindex: a 3-segment {city}/{area}/{preset} combo with a
  // VERIFIED zero active-inventory count stays renderable but is noindexed —
  // the sitemap (lib/seo/getSearchMatrixEntries.ts) only submits combos with
  // >= 1 verified match AND depth content. Unknown states (failed inventory
  // read, uncurated geo, non-derivable preset, timeout) fail OPEN.
  // W3.2 (3-seg) + W3.1 (2-seg) verified-zero-inventory noindex; fail-OPEN.
  const matrixNoIndex = await withTimeout(
    resolveMatrixNoIndex(slug, preset?.slug ?? null, hasInvalidPresetSegment),
    false,
    2500,
  )
  // EXP-2 / SEO-1: the shared browse-pair decision. A 2-segment pair indexes
  // only with real content (sold-history depth or homes for sale now) and a
  // printable name; a 3-segment combo on an MLS-coded or unknown area never
  // indexes (its title cannot name the place).
  const areaNoIndex = area ? (slug.length === 2 ? !area.index : area.publicName == null) : false
  const canonicalUrl = `${siteUrl}${canonicalPath}`
  return {
    canonicalUrl,
    metadata: {
      title,
      description: metaDesc,
      // Sort-only presets (price-low-to-high / price-high-to-low) reorder the
      // same inventory the parent page shows — noindex the duplicate, keep links
      // followable. They are also excluded from the sitemap preset loop.
      robots:
        isBendNewConstructionTwin ||
        hasInvalidPresetSegment ||
        (!!preset && isSortOnlyPreset(preset)) ||
        shouldNoIndexSearchVariant(sp) ||
        matrixNoIndex ||
        areaNoIndex
          ? { index: false, follow: true }
          : { index: true, follow: true },
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
    },
  }
}
