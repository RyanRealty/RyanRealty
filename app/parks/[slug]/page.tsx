/**
 * /parks/[slug] — park detail on the v3 barrel.
 *
 * Places open on Instrument then Field. Order: Breadcrumb, Instrument (nearby
 * homes), Field (map + list), Sheet (city SFR alerts), Quiet (amenities, nearby
 * parks, edges), Footer outside main.
 *
 * THE PAGE CONTRACT: generateStaticParams from CO_PARKS, dynamicParams false,
 * revalidate 300, generateMetadata from the registry only, Place + BreadcrumbList
 * JSON-LD, V3SectionTracker pageType="parks". getParkDetail degrades on a
 * listings timeout so prerender cannot 500 the deploy (check-prerender-db-safety).
 *
 * KB-era deletions: KbHero, KbFeatured, NeighborhoodMap (replaced by V3Field +
 * PlaceFieldMap), KbBreadcrumb, KbFooter, SmoothScrollProvider, kb.css,
 * ParkDetailStyles, contact CTA band (Meet the team and the phone are Quiet
 * edges). Acres stay in Quiet so the Instrument trace covers only the MLS pull.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getParkDetail, getParkBoundaryGeoJSON } from '@/lib/data'
import { CO_PARKS, getParkBySlug, type ParkType } from '@/data/co-parks'
import { pageMetadata } from '@/lib/site/page-metadata'
import { publishNearbyListingsSource } from '@/lib/site/publish-nearby-listings-source'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import type { SchemaInput } from '@/lib/site/json-ld'
import { formatPrice } from '@/lib/format/money'
import { valuationHref } from '@/lib/site/valuation-href'
import { CONTACT } from '@/lib/brand/contact'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Instrument,
  V3Field,
  V3Quiet,
  V3SectionTracker,
  type V3InstrumentFigure,
  type V3QuietItem,
} from '@/components/site/v3'
import { RegionalAlertSheet } from '@/app/central-oregon/_v3/RegionalAlertSheet.client'
import { PlaceFieldMap } from '@/app/central-oregon/_v3/PlaceFieldMap.client'
import { nearbyFieldItems, fieldMapPins } from '@/app/central-oregon/_v3/nearby-field-items'

export const dynamicParams = false
export const revalidate = 300

const TYPE_LABEL: Record<ParkType, string> = {
  state: 'State park',
  city: 'City park',
  'natural-area': 'Natural area',
}

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams(): Array<{ slug: string }> {
  return CO_PARKS.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const park = getParkBySlug(slug)
  if (!park) notFound()

  const typeLabel = TYPE_LABEL[park.type].toLowerCase()
  const desc = `${park.name} is a ${typeLabel} in ${park.city}, Central Oregon. See what is there and the homes for sale nearby, from Ryan Realty, a local Central Oregon brokerage.`

  return pageMetadata({
    title: `${park.name} | Central Oregon Parks`,
    description: desc,
    path: `/parks/${slug}`,
  })
}

export default async function ParkDetailPage({ params }: Props) {
  const { slug } = await params
  const detail = await getParkDetail(slug).catch(() => null)
  const park = detail?.park ?? getParkBySlug(slug)
  if (!park) notFound()

  const homes = detail?.homes ?? []
  const stats = detail?.stats ?? { count: 0, medianListPrice: null }
  const nearbyParks =
    detail?.nearbyParks ?? CO_PARKS.filter((p) => p.slug !== park.slug && p.city === park.city)

  const polygon = park.hasPolygon
    ? await getParkBoundaryGeoJSON(slug).catch(() => null)
    : null

  const fieldItems = nearbyFieldItems(homes)
  const pins = fieldMapPins(fieldItems)
  const seeAllHref = `/search?city=${encodeURIComponent(park.city)}`
  const typeLabel = TYPE_LABEL[park.type]
  const parkName = park.name.trim()

  const figures: V3InstrumentFigure[] = [
    {
      value: v3Text(stats.count.toLocaleString('en-US')),
      label: v3Text('homes for sale nearby'),
      href: seeAllHref,
    },
  ]
  if (stats.medianListPrice != null && stats.medianListPrice > 0) {
    figures.push({
      value: v3Text(formatPrice(stats.medianListPrice)),
      label: v3Text('median list price of those homes'),
      href: seeAllHref,
    })
  }

  const additionalProperty: Array<{ name: string; value: string | number; unitText?: string }> = [
    { name: 'Homes for sale near this park', value: stats.count },
  ]
  if (typeof park.acres === 'number') {
    additionalProperty.push({ name: 'Area', value: park.acres, unitText: 'acre' })
  }
  if (stats.medianListPrice != null) {
    additionalProperty.push({
      name: 'Median list price of nearby homes',
      value: stats.medianListPrice,
      unitText: 'USD',
    })
  }

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Parks', url: '/parks' },
        { name: park.name, url: `/parks/${slug}` },
      ],
    },
    {
      type: 'place',
      placeType: 'Park',
      name: park.name,
      description: park.blurb,
      url: `/parks/${slug}`,
      address: { city: park.city, state: 'OR', country: 'US' },
      geo: { lat: park.lat, lng: park.lng },
      additionalProperty,
    },
  ]

  const quietItems: V3QuietItem[] = []
  if (park.blurb.trim()) {
    quietItems.push({ kind: 'prose', term: parkName, body: park.blurb.trim() })
  }
  if (typeof park.acres === 'number') {
    quietItems.push({
      kind: 'prose',
      term: 'Park size',
      body: `${park.acres.toLocaleString('en-US')} acres, from ${park.agency}.`,
    })
  }
  if (park.amenities.length > 0) {
    quietItems.push({ kind: 'prose', term: 'Amenities', body: park.amenities.join(', ') })
  }
  quietItems.push({
    kind: 'prose',
    term: 'Park information',
    body: park.agency,
  })
  quietItems.push({ label: 'View source', href: park.sourceUrl })
  for (const p of nearbyParks) {
    const n = p.name.trim()
    const s = p.slug.trim()
    if (!n || !s) continue
    quietItems.push({ label: n, href: `/parks/${s}` })
  }
  quietItems.push({ label: 'All Central Oregon parks', href: '/parks' })
  quietItems.push({ label: `Homes in ${park.city}`, href: seeAllHref })
  quietItems.push({ label: 'Value my home', href: valuationHref(`/parks/${slug}`) })
  quietItems.push({ label: 'Meet the team', href: '/contact' })
  quietItems.push({ label: `Call ${CONTACT.phoneDirect}`, href: `tel:${CONTACT.phoneDirectTel}` })

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <MetadataBlock schemas={schemas} />
        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Parks', href: '/parks' },
            { label: parkName },
          ]}
        />

        <V3Instrument
          id="park"
          level={1}
          eyebrow={v3Text(`${typeLabel} · ${park.city}`)}
          headline={v3Text(parkName)}
          figures={[figures[0], ...figures.slice(1)]}
          source={v3Text(
            publishNearbyListingsSource({
              grain: 'park',
              scope: 'within about 1.5 miles of the park centroid',
              listingCount: stats.count,
            }),
          )}
          action={{
            label: v3Text('Value my home'),
            href: valuationHref(`/parks/${slug}`),
          }}
        />

        <V3Field
          id="homes"
          ariaLabel={`Homes for sale near ${parkName}`}
          items={fieldItems}
          count={{
            value: stats.count.toLocaleString('en-US'),
            label: `homes for sale near ${parkName}`,
            source:
              'active single-family listings within about 1.5 miles of the park centroid, from the MLS. The rows below are a slice of that set.',
          }}
          mapSlot={
            <PlaceFieldMap
              pins={pins}
              boundary={polygon ?? undefined}
              placeName={parkName}
              centerLonLat={[park.lng, park.lat]}
            />
          }
          mapNote="Park boundary plus active single-family homes within about 1.5 miles."
          footNote={
            stats.count > fieldItems.length
              ? `Showing ${fieldItems.length} of ${stats.count.toLocaleString('en-US')} homes. The count above is the full nearby set.`
              : undefined
          }
          emptyMessage={`No active single-family listings within about 1.5 miles of ${parkName} in the latest pull.`}
        />

        <RegionalAlertSheet placeLabel={park.city} city={park.city} />

        <V3Quiet id="about" eyebrow="This park" heading={`${parkName} details`} items={quietItems} />
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
          when it is NOT nested in sectioning content, and <main> is sectioning
          content, so inside it the element is a generic and the page ships no
          contentinfo landmark. ci:default-chrome-footer counts footers without
          checking placement. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
