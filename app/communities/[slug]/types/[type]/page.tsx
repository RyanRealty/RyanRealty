/**
 * /communities/[slug]/types/[type] — one property type in one community.
 * Same place-type class as /cities/[slug]/types/[type].
 *
 * Face is leftover / segment stats that back the type card. Atlas is the
 * parent community map, type-filtered on dots when the leftover type is 1:1
 * with the atlas. Photographed listings are their own set. Miss omits.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  cityDetachedSlug,
  getCommunityBySlug,
  getDetachedOverlays,
  getGeoBoundaryMapData,
  getListingTiles,
  getResortBoundaryGeoJSON,
  getResortCommunityBySlug,
  getAllResortCommunities,
} from '@/lib/data'
import { EMPTY_PUBLIC_PACE, getPublicDetachedPace } from '@/lib/data/market-truth/public-pace'
import { getPublicPlaceSegments } from '@/lib/data/market-truth/public-segments'
import { leftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { pageMetadata } from '@/lib/site/page-metadata'
import { withTimeoutFallback, withTimeoutFallbackResult } from '@/lib/with-timeout-fallback'
import { basemapForRegions } from '@/lib/geo/basemap-source'
import { buildPlaceAtlas, EMPTY_PLACE_ATLAS } from '@/lib/atlas/build-place-atlas'
import { PLACE_TYPE_PAGE_SLUGS } from '@/lib/place/publish-place-type-cards'
import {
  asPlaceBoundary,
  atlasViewForType,
  placeTypeFaceStats,
  placeTypeHeadline,
  placeTypeListingRows,
  placeTypeMetadataCopy,
  placeTypeSchemas,
  resolvePlaceTypePage,
} from '@/lib/place/place-type-page'
import {
  V3_LEDGER_CLASS,
  V3_ROOT_CLASS,
  v3Text,
  V3Atlas,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Heading,
  V3ListingRow,
  V3Quiet,
  V3SectionTracker,
  MetadataBlock,
  type AtlasRegion,
} from '@/components/site/v3'
import { PlaceFaceStrip } from '@/components/place/PlaceFaceStrip'
import { cn } from '@/lib/utils'
import boundarySanityBaseline from '@/data/boundary-sanity-baseline.json' assert { type: 'json' }
import '@/components/search/search-ledger.css'
import '@/app/cities/[slug]/types/[type]/_v3/place-type-page.css'

export async function generateStaticParams(): Promise<Array<{ slug: string; type: string }>> {
  return getAllResortCommunities().flatMap((community) =>
    PLACE_TYPE_PAGE_SLUGS.map((type) => ({ slug: community.slug, type })),
  )
}
export const dynamicParams = true
export const revalidate = 60

type Props = {
  params: Promise<{ slug: string; type: string }>
}

const UNRELIABLE_BOUNDARY_SLUGS = new Set(boundarySanityBaseline.allowed as string[])

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, type } = await params
  const spec = resolvePlaceTypePage(type)
  if (!spec) notFound()
  const community = await getCommunityBySlug(slug)
  if (!community) notFound()
  const publicName = getResortCommunityBySlug(slug)?.label ?? community.name
  const [overlays, publicPace, publicSegments] = await Promise.all([
    withTimeoutFallback(
      getDetachedOverlays([{ geoType: 'neighborhood', geoSlug: slug }]),
      new Map(),
      3000,
      'comm-type:detached',
    ),
    withTimeoutFallback(
      getPublicDetachedPace({ geoType: 'neighborhood', geoSlug: slug }),
      EMPTY_PUBLIC_PACE,
      3000,
      'comm-type:pace',
    ),
    withTimeoutFallback(
      getPublicPlaceSegments({ geoType: 'neighborhood', geoSlug: slug }),
      [],
      3000,
      'comm-type:segments',
    ),
  ])
  const mt = overlays.get(`neighborhood:${cityDetachedSlug(slug)}`)
  const hud = leftoverHudKpis({
    grain: 'neighborhood',
    headlines: mt?.headlines ?? null,
    inventory: mt?.inventory ?? null,
    pace: publicPace,
  })
  const segment = publicSegments.find((row) => row.segment === spec.key)
  const count = spec.key === 'sfr' ? hud.active : (segment?.activeCount ?? null)
  const copy = placeTypeMetadataCopy({ spec, placeName: publicName, count })
  return pageMetadata({
    title: copy.title,
    description: copy.description,
    path: `/communities/${slug}/types/${spec.slug}`,
  })
}

export default async function CommunityPlaceTypePage({ params }: Props) {
  const { slug, type } = await params
  const spec = resolvePlaceTypePage(type)
  if (!spec) notFound()

  const community = await getCommunityBySlug(slug)
  if (!community) notFound()

  const registry = getResortCommunityBySlug(slug)
  const publicName = registry?.label ?? community.name
  const cityName = community.city
  const placeHref = `/communities/${slug}`
  const pagePath = `/communities/${slug}/types/${spec.slug}`
  const cityHref = community.citySlug ? `/cities/${community.citySlug}` : placeHref

  const [overlays, publicPace, publicSegments, boundaryRead, resortBoundary] = await Promise.all([
    withTimeoutFallback(
      getDetachedOverlays([{ geoType: 'neighborhood', geoSlug: slug }]),
      new Map(),
      3000,
      'comm-type:detached',
    ),
    withTimeoutFallback(
      getPublicDetachedPace({ geoType: 'neighborhood', geoSlug: slug }),
      EMPTY_PUBLIC_PACE,
      3000,
      'comm-type:pace',
    ),
    withTimeoutFallback(
      getPublicPlaceSegments({ geoType: 'neighborhood', geoSlug: slug }),
      [],
      3000,
      'comm-type:segments',
    ),
    withTimeoutFallbackResult(
      getGeoBoundaryMapData({ geoType: 'neighborhood', geoSlug: slug }),
      { polygon: null, pins: [] },
      4500,
      'comm-type:boundary',
    ),
    withTimeoutFallback(getResortBoundaryGeoJSON(slug), null, 4500, 'comm-type:resortBoundary'),
  ])

  const mt = overlays.get(`neighborhood:${cityDetachedSlug(slug)}`)
  const hud = leftoverHudKpis({
    grain: 'neighborhood',
    headlines: mt?.headlines ?? null,
    inventory: mt?.inventory ?? null,
    pace: publicPace,
  })
  const segment = publicSegments.find((row) => row.segment === spec.key)
  const count = spec.key === 'sfr' ? hud.active : (segment?.activeCount ?? null)
  const median = spec.key === 'sfr' ? hud.medianList : (segment?.medianList ?? null)
  const face = placeTypeFaceStats({ spec, count, median, mos: null })
  const headline = placeTypeHeadline(spec, publicName)
  const copy = placeTypeMetadataCopy({ spec, placeName: publicName, count })

  const boundaryReliable = !UNRELIABLE_BOUNDARY_SLUGS.has(slug)
  const stored = asPlaceBoundary(boundaryRead.value.polygon)
  const mapPolygon = asPlaceBoundary(resortBoundary) ?? (boundaryReliable ? stored : null)
  const pinKeys = boundaryRead.ok
    ? boundaryRead.value.pins.map((pin) => pin.listingKey).filter(Boolean)
    : []
  const listRead = await withTimeoutFallbackResult(
    getListingTiles({
      ...(pinKeys.length > 0
        ? { listingKeys: pinKeys.slice(0, 500) }
        : { city: cityName, subdivision: community.subdivision }),
      status: 'active',
      sort: 'newest',
      limit: 120,
      ...spec.listingFilter,
    }),
    [],
    4500,
    'comm-type:list',
  )
  const listOk = listRead.ok
  const rows = listOk ? placeTypeListingRows(listRead.value) : []

  const atlasCities = [...new Set([cityName, ...(registry?.mls_cities ?? [])])]
  const atlas = mapPolygon
    ? await withTimeoutFallback(
        buildPlaceAtlas({ cities: atlasCities, boundary: mapPolygon, label: publicName }),
        null,
        6000,
        'comm-type:atlas',
      )
    : null
  const atlasView = atlas ?? EMPTY_PLACE_ATLAS
  const typedAtlas = atlasViewForType(atlasView, spec.atlasDotType)
  const atlasRegions: AtlasRegion[] = mapPolygon
    ? [
        {
          id: `community:${slug}`,
          kind: 'town',
          kindLabel: 'Community',
          name: publicName,
          href: placeHref,
          geometry: mapPolygon,
        },
      ]
    : []
  const schemas = placeTypeSchemas({
    spec,
    placeName: publicName,
    placeHref,
    pagePath,
    description: copy.description,
    listings: rows,
    breadcrumbName: cityName,
    breadcrumbHref: cityHref,
  })

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <MetadataBlock schemas={schemas} />
        <V3Breadcrumb trail={[{ label: cityName, href: cityHref }, { label: spec.h1Type }]} />
        <div className="place-opening">
          <div className="place-opening__copy">
            <V3Heading level={1} size="field">
              {headline}
            </V3Heading>
            <PlaceFaceStrip stats={face} />
          </div>
        </div>
        {atlasRegions.length > 0 ? (
          <V3Atlas
            id="atlas"
            headingLevel={2}
            headline={v3Text(
              spec.atlasDotType && typedAtlas.dots !== atlasView.dots
                ? `${spec.h1Type} on the map`
                : `${spec.h1Type} in ${publicName}`,
            )}
            dots={typedAtlas.dots}
            regions={atlasRegions}
            basemap={basemapForRegions(atlasRegions)}
            types={typedAtlas.types}
            events={atlasView.events}
            source={atlasView.source}
            stamp={atlasView.stamp}
            incomplete={!atlasView.complete}
            noun={{ one: spec.nounOne, many: spec.nounMany }}
          />
        ) : null}

        <section id="homes" className={cn(V3_ROOT_CLASS, V3_LEDGER_CLASS, 'place-type-homes')}>
          <V3Heading level={2}>Photographed listings</V3Heading>
          {rows.length > 0 ? (
            <div className="v3-lrow-list">
              {rows.map((listing, index) => (
                <V3ListingRow
                  key={listing.listingKey}
                  listing={listing}
                  priority={index < 3}
                />
              ))}
            </div>
          ) : listOk && count != null && count > 0 ? (
            <V3Quiet
              ariaLabel="Photographed listings"
              items={[
                {
                  kind: 'prose',
                  body: 'None of these listings have a photograph in this refresh.',
                },
              ]}
            />
          ) : listOk && count === 0 ? (
            <V3Quiet
              ariaLabel="Photographed listings"
              items={[{ kind: 'prose', body: 'None for sale in this refresh.' }]}
            />
          ) : null}
        </section>

        <V3Quiet
          heading={`${publicName} homes`}
          items={[{ label: `${publicName} homes for sale`, href: placeHref }]}
        />
      </main>
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
