import type { Metadata } from 'next'
import { getBannerUrl } from '../../actions/banners'
import { getSubdivisionDescription } from '../../actions/subdivision-descriptions'
import { shareDescription, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT } from '../../../lib/share-metadata'
import { getCityContent, getSubdivisionBlurb } from '../../../lib/city-content'
import { cityEntityKey, subdivisionEntityKey, getSubdivisionDisplayName } from '../../../lib/slug'
import { isSortOnlyPreset } from '@/lib/site/preset-faq'
import { shouldNoIndexSearchVariant } from '../../../lib/seo-routing'
import { resolveMatrixNoIndex } from '@/lib/seo/getSearchMatrixEntries'
import { withTimeout } from './fetch-guards'
import { resolveSlug, buildCanonicalPath } from './resolve-slug'

/**
 * Full metadata assembly for the slug search route. page.tsx's generateMetadata
 * wrapper attaches `alternates: { canonical: canonicalUrl }` — the canonical
 * contract stays pinned in the route file (ci:seo-routes file contract).
 */
export async function buildSearchSlugMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<{ canonicalUrl: string; metadata: Metadata }> {
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
      ? `${preset.label} in ${placeName}, Central Oregon. Live listings from the regional MLS, with price, size, and the map.`
      : `Homes for sale in ${displayName}, Central Oregon. Live listings from the regional MLS, with price, size, and the map.`)
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
        hasInvalidPresetSegment || (!!preset && isSortOnlyPreset(preset)) || shouldNoIndexSearchVariant(sp) || matrixNoIndex
          ? { index: false, follow: true }
          : undefined,
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
