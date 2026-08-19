// @no-parity — content-engine route, not a Wave-3 mockup contract.
/**
 * /central-oregon/events/[slug] — event detail on the v3 barrel.
 *
 * Places open on Instrument then Field. Order: Breadcrumb, Instrument (nearby
 * homes), Field (venue pin + list), Sheet (city SFR alerts), Quiet (facts, FAQ,
 * related, edges), Footer outside main.
 *
 * THE PAGE CONTRACT: generateStaticParams from CO_EVENTS, dynamicParams false,
 * revalidate 300, generateMetadata from the registry, Event JSON-LD ONLY when
 * nextConfirmedDate exists, FAQPage from buildEventFaq, breadcrumb via
 * MetadataBlock, V3SectionTracker pageType="events". getEventDetail degrades on
 * a listings timeout (check-prerender-db-safety).
 *
 * KB-era deletions: photo hero / EVENT_HERO_CREDITS, VenueMap, KbFeatured,
 * AreaMarketBand, KbBreadcrumb, KbFooter, SmoothScrollProvider, kb.css,
 * events.css, contact CTA band. City market figures still feed the FAQ builder
 * when the DAL returns them. They do not reprint as a second Instrument.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getEventDetail } from '@/lib/data'
import { CO_EVENTS, getEventBySlug, EVENT_CATEGORY_LABEL } from '@/data/co-events'
import { CO_VENUES } from '@/data/co-venues'
import { formatEventDate, buildEventFaq } from '@/lib/events-format'
import { publishPlaceInCity } from '@/lib/place/publish-place-in-city'
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

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams(): Array<{ slug: string }> {
  return CO_EVENTS.map((e) => ({ slug: e.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const event = getEventBySlug(slug)
  if (!event) notFound()

  const when = formatEventDate(event.nextConfirmedDate, event.endDate)
  const timing = when ? `${when}.` : `${event.recurrence}.`
  const desc = `${event.name} in ${event.city}, Central Oregon. ${timing} See the details and the homes for sale near the venue, from Ryan Realty, a local Central Oregon brokerage.`

  return pageMetadata({
    title: `${event.name} | Central Oregon Events`,
    description: desc,
    path: `/central-oregon/events/${slug}`,
  })
}

export default async function EventDetailPage({ params }: Props) {
  const { slug } = await params

  const detail = await getEventDetail(slug).catch(() => null)
  const event = detail?.event ?? getEventBySlug(slug)
  if (!event) notFound()

  const homes = detail?.homes ?? []
  const stats = detail?.stats ?? { count: 0, medianListPrice: null }
  const relatedEvents =
    detail?.relatedEvents ?? CO_EVENTS.filter((e) => e.slug !== event.slug && e.city === event.city)
  const cityMarket = detail?.cityMarket ?? null

  const fieldItems = nearbyFieldItems(homes)
  const pins = fieldMapPins(fieldItems)
  const seeAllHref = `/search?city=${encodeURIComponent(event.city)}`
  const hasVenueGeo = typeof event.lat === 'number' && typeof event.lng === 'number'
  const eventName = event.name.trim()
  const when = formatEventDate(event.nextConfirmedDate, event.endDate)
  const medianLabel = medianListLabel(stats.medianListPrice)
  const faq = buildEventFaq(event, { count: stats.count, medianLabel, cityMarket })

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
        { name: 'Central Oregon events', url: '/central-oregon/events' },
        { name: event.name, url: `/central-oregon/events/${slug}` },
      ],
    },
  ]
  if (event.nextConfirmedDate) {
    schemas.push({
      type: 'event',
      eventType: event.schemaType,
      name: event.name,
      description: event.blurb,
      url: `/central-oregon/events/${slug}`,
      startDate: event.nextConfirmedDate,
      endDate: event.endDate ?? undefined,
      locationName: event.venue,
      address: {
        street: CO_VENUES.find((v) => event.venue.toLowerCase().includes(v.name.toLowerCase()))
          ?.address,
        city: event.city,
        state: 'OR',
        country: 'US',
      },
      geo: hasVenueGeo ? { lat: event.lat as number, lng: event.lng as number } : undefined,
      organizerName: event.organizer,
      organizerUrl: event.officialUrl,
      offers: event.priceInfo === 'Free' ? { isFree: true, url: event.officialUrl } : undefined,
    })
  }
  schemas.push({ type: 'faqPage', items: faq })

  const quietItems: V3QuietItem[] = []
  if (event.blurb.trim()) {
    quietItems.push({ kind: 'prose', term: eventName, body: event.blurb.trim() })
  }
  quietItems.push({
    kind: 'prose',
    term: when ? 'Next date' : 'When',
    body: when ? `${when}. ${event.recurrence}.` : event.recurrence,
  })
  quietItems.push({
    kind: 'prose',
    term: 'Where',
    body: `${publishPlaceInCity(event.venue, event.city)}.`,
  })
  if (event.priceInfo?.trim()) {
    quietItems.push({ kind: 'prose', term: 'Admission', body: event.priceInfo.trim() })
  }
  if (event.organizer?.trim()) {
    quietItems.push({ kind: 'prose', term: 'Organizer', body: event.organizer.trim() })
  }
  if (event.brokerPov?.trim()) {
    quietItems.push({ kind: 'prose', term: 'From the team', body: event.brokerPov.trim() })
  }
  quietItems.push(...faqQuietItems(faq))
  if (event.officialUrl.trim()) {
    quietItems.push({ label: 'Official event site', href: event.officialUrl.trim() })
  }
  if (event.venueParkSlug?.trim()) {
    quietItems.push({ label: `View the park in ${event.city}`, href: `/parks/${event.venueParkSlug.trim()}` })
  }
  for (const e of relatedEvents) {
    const n = e.name.trim()
    const s = e.slug.trim()
    if (!n || !s) continue
    quietItems.push({ label: n, href: `/central-oregon/events/${s}` })
  }
  quietItems.push({ label: 'All Central Oregon events', href: '/central-oregon/events' })
  quietItems.push({ label: `Homes in ${event.city}`, href: seeAllHref })
  quietItems.push({ label: 'Value my home', href: valuationHref(`/central-oregon/events/${slug}`) })
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
            { label: 'Central Oregon events', href: '/central-oregon/events' },
            { label: eventName },
          ]}
        />

        {firstFigure ? (
          <V3Instrument
            id="event"
            level={1}
            eyebrow={v3Text(`${EVENT_CATEGORY_LABEL[event.category]} · ${event.city}`)}
            headline={v3Text(eventName)}
            figures={[firstFigure, ...restFigures]}
            source={v3Text(
              'active single-family listings (PropertyType A) within about 1.5 miles of the venue, from the MLS. A listings timeout renders this event with a zero count and lets ISR retry.',
            )}
            action={{
              label: v3Text('Value my home'),
              href: valuationHref(`/central-oregon/events/${slug}`),
            }}
          />
        ) : null}

        <V3Field
          id="homes"
          ariaLabel={`Homes for sale near ${event.venue}`}
          items={fieldItems}
          count={{
            value: stats.count.toLocaleString('en-US'),
            label: `homes for sale near ${event.venue}`,
            source:
              'active single-family listings within about 1.5 miles of the venue, from the MLS. The rows below are a slice of that set.',
          }}
          mapSlot={
            hasVenueGeo ? (
              <PlaceFieldMap
                pins={pins}
                placeName={event.venue}
                centerLonLat={[event.lng as number, event.lat as number]}
                placePin={{ lat: event.lat as number, lng: event.lng as number, title: event.venue }}
              />
            ) : undefined
          }
          mapNote={
            hasVenueGeo
              ? 'The marked point is the venue. Pins are active single-family homes within about 1.5 miles.'
              : undefined
          }
          footNote={
            stats.count > fieldItems.length
              ? `Showing ${fieldItems.length} of ${stats.count.toLocaleString('en-US')} homes. The count above is the full nearby set.`
              : undefined
          }
          emptyMessage={`No active single-family listings within about 1.5 miles of ${event.venue} in the latest pull.`}
        />

        <RegionalAlertSheet placeLabel={event.city} city={event.city} />

        <V3Quiet id="about" eyebrow="This event" heading={`${eventName} details`} items={quietItems} />
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
