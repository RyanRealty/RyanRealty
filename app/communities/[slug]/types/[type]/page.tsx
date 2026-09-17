/**
 * /communities/[slug]/types/[type] — one property type in one community.
 * Same place-type class as /cities/[slug]/types/[type], and it shares that
 * route's _v3 components so the two pages are one composition, not two.
 *
 * THE DEFECT THIS SHAPE FIXES (taste table 2026-09-08, place-type-community,
 * median 44, the lowest-scoring place page on the site): the Atlas rendered in
 * the 375 capture and was ENTIRELY ABSENT from the 1440 capture of the same
 * URL, because the section was gated on a boundary read that could time out,
 * leaving the desktop fold as eight identical listing rows. The map now
 * streams behind a standin of its own footprint and the section is
 * unconditional — see _v3/PlaceTypeAtlasSection.tsx.
 *
 * The polygon read still happens here as well, because the LIST depends on it:
 * the pins inside the recorded boundary are what "in this community" means for
 * Sunriver, whose subdivision name matches nothing (52 listings by polygon, 0
 * by subdivision, measured 2026-09-09). The Atlas re-reads the resort's own
 * outline on its own budget, so a miss on one is not a miss on both.
 *
 * Photographed listings are their own set. Miss omits.
 */

import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  getCommunityBySlug,
  getGeoBoundaryMapData,
  getListingTiles,
  getListingTilesCount,
  getResortCommunityBySlug,
  getAllResortCommunities,
} from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { runPublishedPageRender } from '@/lib/site/degraded-isr'
import { withTimeoutFallback, withTimeoutFallbackResult } from '@/lib/with-timeout-fallback'
import { formatDateTime } from '@/lib/format/date'
import { formatPriceExact } from '@/lib/format/money'
import { asPlaceBoundary } from '@/lib/place/place-type-page'
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
} from '@/app/cities/[slug]/types/[type]/_v3/PlaceTypeField.client'
import { PlaceTypeFilm } from './_v3/PlaceTypeFilm.client'
import { PlaceTypeAtlasSection } from '@/app/cities/[slug]/types/[type]/_v3/PlaceTypeAtlasSection'
import { PlaceTypeAtlasStandin } from '@/app/cities/[slug]/types/[type]/_v3/PlaceTypeAtlasStandin'
import boundarySanityBaseline from '@/data/boundary-sanity-baseline.json' assert { type: 'json' }
import '@/components/search/search-ledger.css'
import '@/components/place/place-opening.css'
import '@/app/cities/[slug]/types/[type]/_v3/place-type-page.css'

export async function generateStaticParams(): Promise<Array<{ slug: string; type: string }>> {
  return getAllResortCommunities().flatMap((community) =>
    PLACE_TYPE_PAGE_SLUGS.map((type) => ({ slug: community.slug, type })),
  )
}
export const dynamicParams = true
export const revalidate = 300

type Props = {
  params: Promise<{ slug: string; type: string }>
}

const UNRELIABLE_BOUNDARY_SLUGS = new Set(boundarySanityBaseline.allowed as string[])

/**
 * What "in this community" means for a listing read. The recorded boundary's
 * pins when we have them; the subdivision name when we do not. Shared by the
 * metadata count and the page so the head and the body cannot disagree.
 */
function communityScope(input: {
  pinKeys: readonly string[]
  city: string
  subdivision: string | null | undefined
}) {
  return input.pinKeys.length > 0
    ? { listingKeys: [...input.pinKeys].slice(0, 500) }
    : { city: input.city, subdivision: input.subdivision ?? undefined }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, type } = await params
  const spec = resolvePlaceTypePage(type)
  if (!spec) notFound()
  const community = await getCommunityBySlug(slug)
  if (!community) notFound()
  const publicName = getResortCommunityBySlug(slug)?.label ?? community.name
  const boundary = await withTimeoutFallbackResult(
    getGeoBoundaryMapData({ geoType: 'neighborhood', geoSlug: slug }),
    { polygon: null, pins: [] },
    3000,
    'comm-type:boundary',
  )
  const pinKeys = boundary.ok
    ? boundary.value.pins.map((pin) => pin.listingKey).filter(Boolean)
    : []
  const activeCount: number | null = await withTimeoutFallback(
    getListingTilesCount({
      ...communityScope({ pinKeys, city: community.city, subdivision: community.subdivision }),
      status: 'active',
      ...spec.listingFilter,
    }),
    null,
    3000,
    'comm-type:count',
  )
  const copy = placeTypeMetadataCopy({ spec, placeName: publicName, count: activeCount })
  /* SEO increment vs HEAD: live count in the title when measured. */
  const title =
    activeCount != null && activeCount > 0
      ? `${activeCount.toLocaleString('en-US')} ${
          activeCount === 1 ? spec.nounOne : spec.nounMany
        } for sale in ${publicName}, Oregon`
      : copy.title
  return pageMetadata({
    title,
    description: copy.description,
    path: `/communities/${slug}/types/${spec.slug}`,
  })
}

export default async function CommunityPlaceTypePage(props: Props) {
  return runPublishedPageRender('community-type', () => renderCommunityPlaceTypePage(props))
}

async function renderCommunityPlaceTypePage({ params }: Props) {
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

  const boundaryRead = await withTimeoutFallbackResult(
    getGeoBoundaryMapData({ geoType: 'neighborhood', geoSlug: slug }),
    { polygon: null, pins: [] },
    4500,
    'comm-type:boundary',
  )
  const boundaryReliable = !UNRELIABLE_BOUNDARY_SLUGS.has(slug)
  const storedBoundary = boundaryReliable ? asPlaceBoundary(boundaryRead.value.polygon) : null
  const pinKeys = boundaryRead.ok
    ? boundaryRead.value.pins.map((pin) => pin.listingKey).filter(Boolean)
    : []
  const scope = {
    ...communityScope({ pinKeys, city: cityName, subdivision: community.subdivision }),
    status: 'active' as const,
    ...spec.listingFilter,
  }

  const countProbe = await withTimeoutFallbackResult(
    getListingTilesCount(scope),
    null,
    4500,
    'comm-type:count',
  )
  const countForBand =
    countProbe.ok && countProbe.value != null && countProbe.value > 0
      ? countProbe.value
      : 20
  const topDecileLimit = Math.max(1, Math.min(80, Math.ceil(countForBand * 0.1)))

  const [countRead, lowRead, highRead, p90Read, listRead] = await Promise.all([
    Promise.resolve(countProbe),
    withTimeoutFallbackResult(
      getListingTiles({ ...scope, sort: 'price-asc', limit: 1 }),
      [],
      4500,
      'comm-type:low',
    ),
    withTimeoutFallbackResult(
      getListingTiles({ ...scope, sort: 'price-desc', limit: 1 }),
      [],
      4500,
      'comm-type:high',
    ),
    withTimeoutFallbackResult(
      getListingTiles({ ...scope, sort: 'price-desc', limit: topDecileLimit }),
      [],
      4500,
      'comm-type:p90',
    ),
    withTimeoutFallbackResult(
      getListingTiles({ ...scope, sort: 'newest', limit: 120 }),
      [],
      4500,
      'comm-type:list',
    ),
  ])

  const activeCount: number | null =
    countRead.ok && countRead.value != null && countRead.value > 0 ? countRead.value : null
  const measuredEmpty =
    countRead.ok && countRead.value === 0 && listRead.ok && listRead.value.length === 0
  const lowAsk = lowRead.ok ? (lowRead.value[0]?.listPrice ?? null) : null
  const highAsk = highRead.ok ? (highRead.value[0]?.listPrice ?? null) : null
  const p90Ask = (() => {
    if (!p90Read.ok || p90Read.value.length === 0) return highAsk
    const priced = p90Read.value
      .map((t) => t.listPrice)
      .filter((n): n is number => n != null && Number.isFinite(n) && n > 0)
    if (priced.length === 0) return highAsk
    return priced[priced.length - 1] ?? highAsk
  })()
  const bandHigh = p90Ask ?? highAsk
  const claimBase = placeTypeClaim({
    spec,
    placeName: publicName,
    inventory: {
      count: activeCount,
      low: lowAsk,
      high: bandHigh,
      stamp: formatDateTime(new Date()),
      /* The set is drawn one of two ways and the trace says which: the
         recorded polygon when we have its pins, the subdivision name when we
         do not. Sunriver reads 52 by polygon and 0 by name, so the difference
         is the figure, not a footnote. */
      scopeNote:
        pinKeys.length > 0
          ? `in ${publicName}`
          : `in the ${publicName} subdivision`,
    },
  })
  const claim = claimBase
    ? {
        sentence:
          activeCount != null && lowAsk != null && bandHigh != null
            ? `${activeCount.toLocaleString('en-US')} homes ask ${formatPriceExact(lowAsk)} to ${formatPriceExact(bandHigh)} for nine in ten.`
            : claimBase.sentence,
        source: claimBase.source,
      }
    : null

  const headline = placeTypeHeadline(spec, publicName)
  const copy = placeTypeMetadataCopy({ spec, placeName: publicName, count: activeCount })
  const listOk = listRead.ok
  const rows = listOk ? placeTypeListingRows(listRead.value) : []
  /* H1 already named the type. Atlas eyebrow is a section marker, not a
     second "Single-family…" Amboqia line (SITE-107 / taste table). */
  const eyebrow = placeTypeAtlasEyebrow(spec, false)
  const atlasCities = [...new Set([cityName, ...(registry?.mls_cities ?? [])])]

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
        <V3Breadcrumb
          trail={[
            { label: cityName, href: cityHref },
            { label: 'For sale' },
          ]}
        />
        <PlaceTypeField>
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
                  placeName={publicName}
                  state="loading"
                  placeHref={placeHref}
                />
              }
            >
              <PlaceTypeAtlasSection
                id="atlas"
                eyebrow={eyebrow}
                placeName={publicName}
                placeHref={placeHref}
                cities={atlasCities}
                spec={spec}
                region={{
                  id: `community:${slug}`,
                  kind: 'town',
                  kindLabel: 'Community',
                  name: publicName,
                  href: placeHref,
                }}
                listingsCount={activeCount}
                source={{ kind: 'community', geoSlug: slug, stored: storedBoundary }}
              />
            </Suspense>

            {rows.length > 0 ? (
              <PlaceTypeFilm
                rows={rows}
                label={`${spec.nounMany} in ${publicName}`}
                bandLow={lowAsk}
                bandHigh={bandHigh}
              />
            ) : null}
          </div>

          <section id="homes" className={cn(V3_ROOT_CLASS, 'place-type-homes')}>
            <div className="place-type-homes__head">
              <V3Heading level={2}>Homes for sale</V3Heading>
              {rows.length > 1 ? <PlaceTypeSortBar pagePath={pagePath} /> : null}
            </div>
            {rows.length > 0 ? (
              <PlaceTypeRows rows={rows} />
            ) : listOk && activeCount != null && activeCount > 0 ? (
              <V3Quiet
                ariaLabel="Homes for sale"
                items={[
                  {
                    kind: 'prose',
                    body: 'None with a photo in this refresh.',
                  },
                ]}
              />
            ) : measuredEmpty ? (
              <V3Quiet
                ariaLabel="Homes for sale"
                items={[{ kind: 'prose', body: 'None for sale in this refresh.' }]}
              />
            ) : null}
          </section>
        </PlaceTypeField>

        <V3Quiet
          ariaLabel={`${publicName} homes`}
          items={[
            { label: `${publicName} homes for sale`, href: placeHref },
            { label: `Browse ${spec.nounMany} on the map`, href: '#atlas' },
            { label: 'Homes for sale', href: '#homes' },
          ]}
        />
      </main>
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
