// @no-parity — content-engine route, not a Wave-3 mockup contract.
/**
 * /central-oregon/venues/[slug] — venue detail on the v3 barrel.
 *
 * Places open on Instrument then Field. Order: Breadcrumb, Instrument (nearby
 * homes), Field (venue pin + list), Sheet (city SFR alerts), Quiet (facts, FAQ,
 * calendar outbound, related, edges), Footer outside main.
 *
 * THE PAGE CONTRACT: generateStaticParams from CO_VENUES, dynamicParams false,
 * revalidate 300, generateMetadata from the registry, Place subtype + FAQPage +
 * breadcrumb via MetadataBlock, V3SectionTracker pageType="venues".
 * getVenueDetail degrades on a listings timeout (check-prerender-db-safety).
 * We never scrape a lineup. The calendar URL is an outbound Quiet edge.
 *
 * KB-era deletions: photo hero / VENUE_HERO_CREDITS, VenueMap, KbFeatured,
 * AreaMarketBand, KbBreadcrumb, KbFooter, SmoothScrollProvider, kb.css,
 * events.css, contact CTA band.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getVenueDetail } from '@/lib/data'
import { CO_VENUES, getVenueBySlug, VENUE_TYPE_LABEL, type CoVenue } from '@/data/co-venues'
import { buildVenueFaq, venueKindLabel } from '@/lib/venues-format'
import { pageMetadata } from '@/lib/site/page-metadata'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import type { SchemaInput } from '@/lib/site/json-ld'
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
import {
  nearbyFieldItems,
  fieldMapPins,
  medianListLabel,
  faqQuietItems,
} from '@/app/central-oregon/_v3/nearby-field-items'

export const dynamicParams = false
export const revalidate = 300

const SCHEMA_TYPE: Record<CoVenue['kind'], 'MusicVenue' | 'PerformingArtsTheater' | 'EventVenue'> = {
  music: 'MusicVenue',
  'performing-arts': 'PerformingArtsTheater',
  both: 'EventVenue',
}

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams(): Array<{ slug: string }> {
  return CO_VENUES.map((v) => ({ slug: v.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const venue = getVenueBySlug(slug)
  if (!venue) notFound()
  const desc = `${venue.name} in ${venue.city}, Central Oregon. See what is on, the venue details, and the homes for sale nearby, from Ryan Realty, a local Central Oregon brokerage.`
  return pageMetadata({
    title: `${venue.name} | Central Oregon Live Music & Shows`,
    description: desc,
    path: `/central-oregon/venues/${slug}`,
  })
}

export default async function VenueDetailPage({ params }: Props) {
  const { slug } = await params

  const detail = await getVenueDetail(slug).catch(() => null)
  const venue = detail?.venue ?? getVenueBySlug(slug)
  if (!venue) notFound()

  const homes = detail?.homes ?? []
  const stats = detail?.stats ?? { count: 0, medianListPrice: null }
  const relatedVenues =
    detail?.relatedVenues ?? CO_VENUES.filter((v) => v.slug !== venue.slug && v.city === venue.city)
  const eventsHere = detail?.eventsHere ?? []
  const cityMarket = detail?.cityMarket ?? null

  const fieldItems = nearbyFieldItems(homes)
  const pins = fieldMapPins(fieldItems)
  const seeAllHref = `/search?city=${encodeURIComponent(venue.city)}`
  const hasGeo = typeof venue.lat === 'number' && typeof venue.lng === 'number'
  const venueName = venue.name.trim()
  const medianLabel = medianListLabel(stats.medianListPrice)
  const faq = buildVenueFaq(venue, { count: stats.count, medianLabel, cityMarket })

  const figures: V3InstrumentFigure[] = [
    {
      value: v3Text(stats.count.toLocaleString('en-US')),
      label: v3Text('homes for sale nearby'),
      href: seeAllHref,
    },
  ]
  if (medianLabel) {
    figures.push({
      value: v3Text(medianLabel),
      label: v3Text('median list price of those homes'),
      href: seeAllHref,
    })
  }
  const [firstFigure, ...restFigures] = figures

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Live music & shows', url: '/central-oregon/venues' },
        { name: venue.name, url: `/central-oregon/venues/${slug}` },
      ],
    },
    {
      type: 'place',
      placeType: SCHEMA_TYPE[venue.kind],
      name: venue.name,
      description: venue.blurb,
      url: `/central-oregon/venues/${slug}`,
      address: { street: venue.address, city: venue.city, state: 'OR', country: 'US' },
      geo: hasGeo ? { lat: venue.lat as number, lng: venue.lng as number } : undefined,
    },
    { type: 'faqPage', items: faq },
  ]

  const quietItems: V3QuietItem[] = []
  if (venue.blurb.trim()) {
    quietItems.push({ kind: 'prose', term: venueName, body: venue.blurb.trim() })
  }
  quietItems.push({ kind: 'prose', term: 'What is on', body: venueKindLabel(venue) })
  if (typeof venue.capacity === 'number') {
    quietItems.push({
      kind: 'prose',
      term: 'Capacity',
      body: `${venue.capacity.toLocaleString('en-US')} people.`,
    })
  }
  quietItems.push({
    kind: 'prose',
    term: 'Where',
    body: `${venue.name}, ${venue.city}, Oregon.`,
  })
  quietItems.push(...faqQuietItems(faq))
  if (venue.calendarUrl.trim()) {
    quietItems.push({
      label: eventsHere.length > 0 ? `Full calendar at ${venueName}` : `Upcoming shows at ${venueName}`,
      href: venue.calendarUrl.trim(),
    })
  }
  if (venue.officialUrl.trim()) {
    quietItems.push({ label: 'Official site', href: venue.officialUrl.trim() })
  }
  for (const e of eventsHere) {
    const n = e.name.trim()
    const s = e.slug.trim()
    if (!n || !s) continue
    quietItems.push({ label: n, href: `/central-oregon/events/${s}` })
  }
  quietItems.push({ label: `${venue.city} market`, href: `/cities/${venue.geoSlug}` })
  for (const v of relatedVenues) {
    const n = v.name.trim()
    const s = v.slug.trim()
    if (!n || !s) continue
    quietItems.push({ label: n, href: `/central-oregon/venues/${s}` })
  }
  quietItems.push({ label: 'All Central Oregon venues', href: '/central-oregon/venues' })
  quietItems.push({ label: `Homes in ${venue.city}`, href: seeAllHref })
  quietItems.push({ label: 'Value my home', href: valuationHref(`/central-oregon/venues/${slug}`) })
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
            { label: 'Live music & shows', href: '/central-oregon/venues' },
            { label: venueName },
          ]}
        />

        {firstFigure ? (
          <V3Instrument
            id="venue"
            level={1}
            eyebrow={v3Text(`${VENUE_TYPE_LABEL[venue.venueType]} · ${venue.city}`)}
            headline={v3Text(venueName)}
            figures={[firstFigure, ...restFigures]}
            source={v3Text(
              'active single-family listings (PropertyType A) within about 1.5 miles of the venue, from the MLS. A listings timeout renders this venue with a zero count and lets ISR retry.',
            )}
            action={{
              label: v3Text('Value my home'),
              href: valuationHref(`/central-oregon/venues/${slug}`),
            }}
          />
        ) : null}

        <V3Field
          id="homes"
          ariaLabel={`Homes for sale near ${venueName}`}
          items={fieldItems}
          count={{
            value: stats.count.toLocaleString('en-US'),
            label: `homes for sale near ${venueName}`,
            source:
              'active single-family listings within about 1.5 miles of the venue, from the MLS. The rows below are a slice of that set.',
          }}
          mapSlot={
            hasGeo ? (
              <PlaceFieldMap
                pins={pins}
                placeName={venueName}
                centerLonLat={[venue.lng as number, venue.lat as number]}
                placePin={{ lat: venue.lat as number, lng: venue.lng as number, title: venueName }}
              />
            ) : undefined
          }
          mapNote={
            hasGeo
              ? 'The marked point is the venue. Pins are active single-family homes within about 1.5 miles.'
              : undefined
          }
          footNote={
            stats.count > fieldItems.length
              ? `Showing ${fieldItems.length} of ${stats.count.toLocaleString('en-US')} homes. The count above is the full nearby set.`
              : undefined
          }
          emptyMessage={`No active single-family listings within about 1.5 miles of ${venueName} in the latest pull.`}
        />

        <RegionalAlertSheet placeLabel={venue.city} city={venue.city} />

        <V3Quiet id="about" eyebrow="This venue" heading={`${venueName} details`} items={quietItems} />
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
