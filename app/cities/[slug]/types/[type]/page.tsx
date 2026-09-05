/**
 * /cities/[slug]/types/[type] — one property type in one city.
 *
 * H1 `{Type} in {Place}`. Face is leftover / segment stats that back the
 * type card. Atlas is the parent city map, type-filtered on dots when the
 * leftover type is 1:1 with the atlas. Photographed listings are their own
 * set. Miss omits. Do not invent a count from list length.
 *
 * Parity: design_system/ryan-realty/ui_kits/place-type/parity.json.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  getBoundaryGeoJSON,
  getCityBoundaryGeoJSON,
  getCityDetachedInventory,
  getCityDetachedMarket,
  getGeoSnapshot,
  getListingTiles,
} from '@/lib/data'
import { EMPTY_PUBLIC_PACE, getPublicDetachedPace } from '@/lib/data/market-truth/public-pace'
import { getPublicPlaceSegments } from '@/lib/data/market-truth/public-segments'
import { leftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { pageMetadata } from '@/lib/site/page-metadata'
import { withTimeoutFallback, withTimeoutFallbackResult } from '@/lib/with-timeout-fallback'
import { PRIMARY_CITIES } from '@/lib/cities'
import { slugify } from '@/lib/slug'
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
import '@/components/search/search-ledger.css'
import './_v3/place-type-page.css'

export async function generateStaticParams(): Promise<Array<{ slug: string; type: string }>> {
  return PRIMARY_CITIES.flatMap((name) =>
    PLACE_TYPE_PAGE_SLUGS.map((type) => ({ slug: slugify(name), type })),
  )
}
export const dynamicParams = true
export const revalidate = 60

type Props = {
  params: Promise<{ slug: string; type: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, type } = await params
  const spec = resolvePlaceTypePage(type)
  if (!spec) notFound()
  const snapshot = await getGeoSnapshot({ geoType: 'city', geoKey: slug })
  if (!snapshot) notFound()
  const cityName = snapshot.geoLabel
  const [detached, detachedInv, publicPace, publicSegments] = await Promise.all([
    withTimeoutFallback(getCityDetachedMarket(slug), null, 3000, 'city-type:detached'),
    withTimeoutFallback(getCityDetachedInventory(slug), null, 3000, 'city-type:detachedInv'),
    withTimeoutFallback(
      getPublicDetachedPace({ geoType: 'city', geoSlug: slug }),
      EMPTY_PUBLIC_PACE,
      3000,
      'city-type:pace',
    ),
    withTimeoutFallback(getPublicPlaceSegments({ geoType: 'city', geoSlug: slug }), [], 3000, 'city-type:segments'),
  ])
  const hud = leftoverHudKpis({
    grain: 'city',
    headlines: detached,
    inventory: detachedInv,
    pace: publicPace,
  })
  const segment = publicSegments.find((row) => row.segment === spec.key)
  const count = spec.key === 'sfr' ? hud.active : (segment?.activeCount ?? null)
  const copy = placeTypeMetadataCopy({ spec, placeName: cityName, count })
  return pageMetadata({
    title: copy.title,
    description: copy.description,
    path: `/cities/${slug}/types/${spec.slug}`,
  })
}

export default async function CityPlaceTypePage({ params }: Props) {
  const { slug, type } = await params
  const spec = resolvePlaceTypePage(type)
  if (!spec) notFound()

  const snapshot = await getGeoSnapshot({ geoType: 'city', geoKey: slug })
  if (!snapshot) notFound()
  const cityName = snapshot.geoLabel
  const placeHref = `/cities/${slug}`
  const pagePath = `/cities/${slug}/types/${spec.slug}`

  const [detached, detachedInv, publicPace, publicSegments, cityBoundary, cityBoundaryFallback, listRead] =
    await Promise.all([
      withTimeoutFallback(getCityDetachedMarket(slug), null, 3000, 'city-type:detached'),
      withTimeoutFallback(getCityDetachedInventory(slug), null, 3000, 'city-type:detachedInv'),
      withTimeoutFallback(
        getPublicDetachedPace({ geoType: 'city', geoSlug: slug }),
        EMPTY_PUBLIC_PACE,
        3000,
        'city-type:pace',
      ),
      withTimeoutFallback(getPublicPlaceSegments({ geoType: 'city', geoSlug: slug }), [], 3000, 'city-type:segments'),
      withTimeoutFallback(getBoundaryGeoJSON({ geoType: 'city', geoSlug: slug }), null, 2000, 'city-type:boundary'),
      withTimeoutFallback(getCityBoundaryGeoJSON(cityName), null, 2000, 'city-type:boundaryFallback'),
      withTimeoutFallbackResult(
        getListingTiles({
          city: cityName,
          status: 'active',
          sort: 'newest',
          limit: 120,
          ...spec.listingFilter,
        }),
        [],
        4500,
        'city-type:list',
      ),
    ])

  const hud = leftoverHudKpis({
    grain: 'city',
    headlines: detached,
    inventory: detachedInv,
    pace: publicPace,
  })
  const segment = publicSegments.find((row) => row.segment === spec.key)
  const count = spec.key === 'sfr' ? hud.active : (segment?.activeCount ?? null)
  const median = spec.key === 'sfr' ? hud.medianList : (segment?.medianList ?? null)
  const mos = spec.key === 'sfr' ? hud.monthsSupply : (segment?.monthsOfSupply ?? null)
  const face = placeTypeFaceStats({ spec, count, median, mos })
  const headline = placeTypeHeadline(spec, cityName)
  const copy = placeTypeMetadataCopy({ spec, placeName: cityName, count })
  const listOk = listRead.ok
  const rows = listOk ? placeTypeListingRows(listRead.value) : []

  const atlasBoundary = asPlaceBoundary(cityBoundary) ?? asPlaceBoundary(cityBoundaryFallback)
  const atlas = atlasBoundary
    ? await withTimeoutFallback(
        buildPlaceAtlas({ cities: [cityName], boundary: atlasBoundary, label: cityName }),
        null,
        6000,
        'city-type:atlas',
      )
    : null
  const atlasView = atlas ?? EMPTY_PLACE_ATLAS
  const typedAtlas = atlasViewForType(atlasView, spec.atlasDotType)
  const atlasRegions: AtlasRegion[] = atlasBoundary
    ? [
        {
          id: `city:${slug}`,
          kind: 'town',
          kindLabel: 'City',
          name: cityName,
          href: placeHref,
          geometry: atlasBoundary,
        },
      ]
    : []
  const schemas = placeTypeSchemas({
    spec,
    placeName: cityName,
    placeHref,
    pagePath,
    description: copy.description,
    listings: rows,
  })

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <MetadataBlock schemas={schemas} />
        <V3Breadcrumb trail={[{ label: cityName, href: placeHref }, { label: spec.h1Type }]} />
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
                : `${spec.h1Type} in ${cityName}`,
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
          heading={`${cityName} homes`}
          items={[{ label: `${cityName} homes for sale`, href: placeHref }]}
        />
      </main>
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
