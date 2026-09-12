/**
 * /cities/[slug]/types/[type] — one property type in one city.
 *
 * THE OPENING IS A TITLE, A CLAIM, AND A MAP (SITE-89 layout lock).
 * H1 `{Type} in {Place}`, then one plain sentence with the count and the price
 * band, then the Atlas wearing an eyebrow rather than a second display line.
 * A V3Carousel rail of photographed listings (shadcn → house `mode="rail"`)
 * follows Atlas in the fold so the lock stays H1 → claim → Atlas → rail.
 * Do not say the type twice as two Amboqia lines with no fact.
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
import { formatPriceExact } from '@/lib/format/money'
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
import { PlaceTypeFilm } from './_v3/PlaceTypeFilm.client'
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
  /* SEO increment vs HEAD: put the live count in the title when measured so
     the SERP states inventory, not only the type name. */
  const title =
    activeCount != null && activeCount > 0
      ? `${activeCount.toLocaleString('en-US')} ${
          activeCount === 1 ? spec.nounOne : spec.nounMany
        } for sale in ${cityName}, Oregon`
      : copy.title
  return pageMetadata({
    title,
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

  /* ONE READ SET (listing_tile_mv). Count + floor come from the MV; the useful
     upper band is ~p90 (cheapest row in the top decile by ask) so the sentence
     is not "$397K to $11.9M". Absolute ceiling stays available for the source
     line. Photographed rows share the same filter. */
  const countProbe = await withTimeoutFallbackResult(
    getListingTilesCount(scope),
    null,
    4500,
    'city-type:count',
  )
  const countForBand =
    countProbe.ok && countProbe.value != null && countProbe.value > 0
      ? countProbe.value
      : 100
  const topDecileLimit = Math.max(1, Math.min(80, Math.ceil(countForBand * 0.1)))

  const [countRead, lowRead, highRead, p90Read, listRead] = await Promise.all([
    Promise.resolve(countProbe),
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
      getListingTiles({ ...scope, sort: 'price-desc', limit: topDecileLimit }),
      [],
      4500,
      'city-type:p90',
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
  const lowAsk = lowRead.ok ? (lowRead.value[0]?.listPrice ?? null) : null
  const highAsk = highRead.ok ? (highRead.value[0]?.listPrice ?? null) : null
  /* ~p90: last (cheapest) row of the price-desc top decile. Falls back to the
     absolute high when that read misses. */
  const p90Ask = (() => {
    if (!p90Read.ok || p90Read.value.length === 0) return highAsk
    const priced = p90Read.value
      .map((t) => t.listPrice)
      .filter((n): n is number => n != null && Number.isFinite(n) && n > 0)
    if (priced.length === 0) return highAsk
    return priced[priced.length - 1] ?? highAsk
  })()
  const bandHigh = p90Ask ?? highAsk
  /* Claim: H1 already named the type — do not say it again. Address census +
     city-limits caveat so Atlas's clipped count is not a second "for sale"
     figure fighting the lead. Same MV for count + band. */
  const stamp = formatDateTime(new Date())
  const claimBase = placeTypeClaim({
    spec,
    placeName: cityName,
    inventory: {
      count: activeCount,
      low: lowAsk,
      high: bandHigh,
      stamp,
      scopeNote: `with a ${cityName} address`,
    },
  })
  const claim = claimBase
    ? {
        sentence:
          activeCount != null && lowAsk != null && bandHigh != null
            ? `${activeCount.toLocaleString('en-US')} homes with a ${cityName} address ask ${formatPriceExact(lowAsk)} to ${formatPriceExact(bandHigh)} for nine in ten. The map marks for-sale homes inside city limits.`
            : claimBase.sentence,
        /* Absolute ceiling stays off the fold — naming $11.9M next to a p90
           band made the range look like a fight (grok-4.6 blocking). */
        source: claimBase.source,
      }
    : null

  const headline = placeTypeHeadline(spec, cityName)
  const copy = placeTypeMetadataCopy({ spec, placeName: cityName, count: activeCount })
  const listOk = listRead.ok
  const rows = listOk ? placeTypeListingRows(listRead.value) : []
  /* H1 already named the type. Atlas eyebrow is a section marker ("Listings
     inside the … city limits"), not a second "Single-family…" Amboqia line
     (SITE-89 / taste table). */
  const eyebrow = placeTypeAtlasEyebrow(
    spec,
    false,
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
        <V3Breadcrumb
          trail={[
            { label: cityName, href: placeHref },
            /* Not the H1 type string — breadcrumb + H1 both saying
               "Single-family" read as two display lines (grok-4.6). */
            { label: 'For sale' },
          ]}
        />
        <PlaceTypeField>
          {/* SITE-89: H1 → claim → Atlas → photographed rail (layout lock). */}
          <div className="place-type-fold">
            <div className="place-opening place-type-opening">
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

            {rows.length > 0 ? (
              <PlaceTypeFilm
                rows={rows}
                label={`Photographed ${spec.nounMany} in ${cityName}`}
                bandLow={lowAsk}
                bandHigh={bandHigh}
              />
            ) : null}
          </div>

          <section id="homes" className={cn(V3_ROOT_CLASS, 'place-type-homes')}>
            <div className="place-type-homes__head">
              <V3Heading level={2}>All photographed listings</V3Heading>
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
          items={[
            { label: `${cityName} homes for sale`, href: placeHref },
            { label: `Browse ${spec.nounMany} on the map`, href: '#atlas' },
            { label: 'All photographed listings', href: '#homes' },
          ]}
        />
      </main>
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
