/**
 * /cities/[slug]/types/[type] — one property type in one city.
 *
 * THE OPENING IS A TITLE, A CLAIM, AND A MAP, IN THAT ORDER (2026-09-09).
 * H1 `{Type} in {Place}`, then one plain sentence with the count and the price
 * band, then the Atlas wearing an eyebrow rather than a second display line —
 * the top of the page used to say "Single-family in Bend" and then
 * "Single-family on the map" in the same face at the same size and never state
 * a fact (taste table 2026-09-08).
 *
 * THE ATLAS IS GUARANTEED. It renders inside a Suspense boundary with a
 * standin of its own footprint, so the shell never waits on the boundary read
 * and the section is never simply absent. See _v3/PlaceTypeAtlasSection.tsx.
 *
 * ONE SOURCE FOR THE FIGURES (§0). Count and price band both come from the
 * listing tile MV, the same read the map's marks and the list's rows come
 * from, because a count from one pipeline beside a band from another describes
 * two different sets. Measured 2026-09-09, Bend single-family: leftover market
 * truth 658 active, tile MV 768.
 *
 * Photographed listings are their own set. Miss omits. Do not invent a count
 * from list length.
 *
 * Parity: design_system/ryan-realty/ui_kits/place-type/parity.json.
 */

import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getGeoSnapshot, getListingTiles, getListingTilesCount } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { withTimeoutFallback, withTimeoutFallbackResult } from '@/lib/with-timeout-fallback'
import { PRIMARY_CITIES } from '@/lib/cities'
import { slugify } from '@/lib/slug'
import { formatDateTime } from '@/lib/format/date'
import { PLACE_TYPE_PAGE_SLUGS } from '@/lib/place/publish-place-type-cards'
import {
  placeTypeAtlasEyebrow,
  placeTypeClaim,
  placeTypeHeadline,
  placeTypeListingRows,
  placeTypeMetadataCopy,
  placeTypeSchemas,
  resolvePlaceTypePage,
} from '@/lib/place/place-type-page'
import {
  V3_ROOT_CLASS,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Heading,
  V3Quiet,
  V3SectionTracker,
  MetadataBlock,
} from '@/components/site/v3'
import { cn } from '@/lib/utils'
import {
  PlaceTypeField,
  PlaceTypeRows,
  PlaceTypeSortBar,
} from './_v3/PlaceTypeField.client'
import { PlaceTypeAtlasSection } from './_v3/PlaceTypeAtlasSection'
import { PlaceTypeAtlasStandin } from './_v3/PlaceTypeAtlasStandin'
import '@/components/search/search-ledger.css'
import '@/components/place/place-opening.css'
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
  const activeCount: number | null = await withTimeoutFallback(
    getListingTilesCount({ city: cityName, status: 'active', ...spec.listingFilter }),
    null,
    3000,
    'city-type:count',
  )
  const copy = placeTypeMetadataCopy({ spec, placeName: cityName, count: activeCount })
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
  const scope = { city: cityName, status: 'active' as const, ...spec.listingFilter }

  /* ONE READ SET. The count, the cheapest ends of the price band, and the
     photographed rows all describe the same filter, so the sentence, the marks
     and the rows are the same listings. The band is two limit-1 reads on the
     MV's own price index rather than a scan: the whole active set can be 768
     rows and the sentence needs two of them. */
  const [countRead, lowRead, highRead, listRead] = await Promise.all([
    withTimeoutFallbackResult(getListingTilesCount(scope), null, 4500, 'city-type:count'),
    withTimeoutFallbackResult(
      getListingTiles({ ...scope, sort: 'price-asc', limit: 1 }),
      [],
      4500,
      'city-type:low',
    ),
    withTimeoutFallbackResult(
      getListingTiles({ ...scope, sort: 'price-desc', limit: 1 }),
      [],
      4500,
      'city-type:high',
    ),
    withTimeoutFallbackResult(
      getListingTiles({ ...scope, sort: 'newest', limit: 120 }),
      [],
      4500,
      'city-type:list',
    ),
  ])

  /* §0 and ci:count-degraded-read: a guarded read must be able to say unknown.
     The DAL's own resilient wrapper answers 0 on a failed count, so a zero is
     treated as unmeasured here — the sentence omits rather than claiming a
     market has nothing in it. */
  const activeCount: number | null =
    countRead.ok && countRead.value != null && countRead.value > 0 ? countRead.value : null
  /* A zero is only publishable when a SECOND, differently-shaped read agrees
     (§0: absence needs a second query shape). The count's own zero could be
     the resilient wrapper's fallback; a zero count beside an empty tile page is
     a measurement. */
  const measuredEmpty =
    countRead.ok && countRead.value === 0 && listRead.ok && listRead.value.length === 0
  const claim = placeTypeClaim({
    spec,
    placeName: cityName,
    inventory: {
      count: activeCount,
      low: lowRead.ok ? (lowRead.value[0]?.listPrice ?? null) : null,
      high: highRead.ok ? (highRead.value[0]?.listPrice ?? null) : null,
      stamp: formatDateTime(new Date()),
      scopeNote: `with a ${cityName} address`,
    },
  })

  const headline = placeTypeHeadline(spec, cityName)
  const copy = placeTypeMetadataCopy({ spec, placeName: cityName, count: activeCount })
  const listOk = listRead.ok
  const rows = listOk ? placeTypeListingRows(listRead.value) : []
  /* The map clips to the recorded city boundary; the claim above it counts
     every listing with this city's MLS address. Bend: 768 and 493. The label
     says which one the map is drawing so the two figures are two facts and not
     a contradiction. */
  const eyebrow = placeTypeAtlasEyebrow(
    spec,
    spec.atlasDotType != null,
    `inside the ${cityName} city limits`,
  )

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
            {claim ? (
              <>
                <p className="place-type-claim">{claim.sentence}</p>
                <p className="place-type-claim__source">{claim.source}</p>
              </>
            ) : null}
          </div>
        </div>

        <PlaceTypeField>
          <Suspense
            fallback={
              <PlaceTypeAtlasStandin
                id="atlas"
                eyebrow={eyebrow}
                placeName={cityName}
                state="loading"
                placeHref={placeHref}
              />
            }
          >
            <PlaceTypeAtlasSection
              id="atlas"
              eyebrow={eyebrow}
              placeName={cityName}
              placeHref={placeHref}
              cities={[cityName]}
              spec={spec}
              region={{
                id: `city:${slug}`,
                kind: 'town',
                kindLabel: 'City',
                name: cityName,
                href: placeHref,
              }}
              listingsCount={activeCount}
              source={{ kind: 'city', geoSlug: slug, cityName }}
            />
          </Suspense>

          <section id="homes" className={cn(V3_ROOT_CLASS, 'place-type-homes')}>
            <div className="place-type-homes__head">
              <V3Heading level={2}>Photographed listings</V3Heading>
              {rows.length > 1 ? <PlaceTypeSortBar pagePath={pagePath} /> : null}
            </div>
            {rows.length > 0 ? (
              <PlaceTypeRows rows={rows} />
            ) : listOk && activeCount != null && activeCount > 0 ? (
              <V3Quiet
                ariaLabel="Photographed listings"
                items={[
                  {
                    kind: 'prose',
                    body: 'None of these listings have a photograph in this refresh.',
                  },
                ]}
              />
            ) : measuredEmpty ? (
              <V3Quiet
                ariaLabel="Photographed listings"
                items={[{ kind: 'prose', body: 'None for sale in this refresh.' }]}
              />
            ) : null}
          </section>
        </PlaceTypeField>

        <V3Quiet
          ariaLabel={`${cityName} homes`}
          items={[{ label: `${cityName} homes for sale`, href: placeHref }]}
        />
      </main>
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
