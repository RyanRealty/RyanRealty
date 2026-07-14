/**
 * Open Houses city page — KB (kinetic-brutalist) design, Phase 9 convergence.
 * Reuses the KB section library (components/site/kb/*) and the existing
 * open-houses + market-pulse data actions. No parity.json exists for this
 * route; noted below.
 *
 * NOTE: No parity.json found for /open-houses/[city]. Rewrite uses KB chrome only.
 *
 * Section stack: nav · section-tracker · metadata · breadcrumb · hero ·
 * open-houses · map · sell · footer.
 *
 * The map (KbListingMap) restores the map view the pre-KB OpenHousesClient
 * rendered: every open house with coordinates as a navy/cream pin, uncapped
 * (the editorial KbOpenHouses board caps at 12; the map shows the full set).
 *
 * §0: all counts via getOpenHousesWithListings + getMarketPulse from @/lib/data.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getOpenHousesWithListings } from '@/app/actions/open-houses'
import type { OpenHouseWithListing } from '@/app/actions/open-houses'
import { getCityFromSlug } from '@/app/actions/listings'
import { getMarketPulse } from '@/lib/data'
import { listingTileHref, listingDetailPath } from '@/lib/slug'
import { pageMetadata } from '@/lib/site/page-metadata'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import type { SchemaInput } from '@/lib/site/json-ld'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbOpenHouses } from '@/components/site/kb/KbOpenHouses.client'
import { KbListingMap, type KbMapGeo } from '@/components/site/kb/KbListingMap.client'
import { KbSell } from '@/components/site/kb/KbSell.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import TrackSearchView from '@/components/tracking/TrackSearchView'
import '@/components/site/kb/kb.css'

export const dynamicParams = true
export const revalidate = 60

type Props = { params: Promise<{ city: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city: citySlug } = await params
  const cityName = await getCityFromSlug(citySlug)
  if (!cityName) return pageMetadata({ title: 'Open Houses', description: 'Open houses in Central Oregon.', path: `/open-houses/${citySlug}` })
  return pageMetadata({
    title: `Open Houses in ${cityName}, Oregon`,
    description: `Browse open houses this weekend and upcoming in ${cityName}, Oregon. Live list from the regional MLS with times, photos, and prices.`,
    path: `/open-houses/${citySlug}`,
  })
}

/** Format a 24h time string and event date into a short human label. */
function openHouseWhen(eventDate: string, start: string | null, end: string | null): string {
  const day = new Date(eventDate + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  })
  const t = (s: string | null) => {
    if (!s) return ''
    const [h, m] = s.split(':')
    const hr = Number(h)
    const ap = hr >= 12 ? 'pm' : 'am'
    const h12 = hr % 12 === 0 ? 12 : hr % 12
    return m && m !== '00' ? `${h12}:${m}${ap}` : `${h12}${ap}`
  }
  const range = start && end ? `${t(start)}-${t(end)}` : start ? t(start) : ''
  return [day, range].filter(Boolean).join(' · ')
}

/** Build the Event ItemList JSON-LD preserved from the original city page. */
function buildEventJsonLd(openHouses: OpenHouseWithListing[], cityName: string): string {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
  const events = openHouses.slice(0, 20).map((oh) => ({
    '@type': 'Event',
    name: `Open House at ${oh.unparsed_address || [oh.street_number, oh.street_name].filter(Boolean).join(' ') || 'Property'}`,
    startDate: `${oh.event_date}T${(oh.start_time ?? '09:00').toString().slice(0, 5)}:00`,
    endDate: `${oh.event_date}T${(oh.end_time ?? '12:00').toString().slice(0, 5)}:00`,
    location: {
      '@type': 'Place',
      name: cityName,
      address: oh.unparsed_address || [oh.street_number, oh.street_name, oh.city, oh.state, oh.postal_code].filter(Boolean).join(', '),
    },
    url: `${siteUrl}${listingDetailPath(
      oh.listing_key,
      { streetNumber: oh.street_number, streetName: oh.street_name, city: oh.city, state: oh.state, postalCode: oh.postal_code },
      { city: oh.city, subdivision: oh.subdivision_name },
      { mlsNumber: oh.list_number }
    )}`,
  }))
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: events.map((e, i) => ({ '@type': 'ListItem', position: i + 1, item: e })),
  })
}

type SearchParams = {
  dateFrom?: string
  dateTo?: string
  community?: string
  minPrice?: string
  maxPrice?: string
  beds?: string
  baths?: string
}

export default async function OpenHousesCityPage({
  params,
  searchParams,
}: {
  params: Promise<{ city: string }>
  searchParams: Promise<SearchParams>
}) {
  const { city: citySlug } = await params
  const cityName = await getCityFromSlug(citySlug)
  if (!cityName) notFound()

  const sp = await searchParams
  const filters = {
    dateFrom: sp.dateFrom?.trim(),
    dateTo: sp.dateTo?.trim(),
    community: sp.community ? sp.community.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
    city: cityName,
    minPrice: sp.minPrice ? Number(sp.minPrice) : undefined,
    maxPrice: sp.maxPrice ? Number(sp.maxPrice) : undefined,
    beds: sp.beds ? Number(sp.beds) : undefined,
    baths: sp.baths ? Number(sp.baths) : undefined,
  }

  // market_pulse_live stores city geo_slug SPACE-separated (e.g. "la pine")
  const geoSlug = citySlug.replace(/-/g, ' ')

  const [openHouses, pulse] = await Promise.all([
    withTimeoutFallback(getOpenHousesWithListings(filters), [], 4000, 'open-houses-city:list'),
    withTimeoutFallback(getMarketPulse({ geoType: 'city', geoSlug }), null, 3000, 'open-houses-city:pulse'),
  ])

  // §0: count from live data.
  const openHouseCount = openHouses.length

  // Map to KB open-house items.
  const openHouseItems = openHouses.slice(0, 12).map((oh) => ({
    href: listingTileHref({
      listingKey: oh.listing_key, streetNumber: oh.street_number, streetName: oh.street_name, city: oh.city,
    }),
    photoUrl: oh.photo_url,
    price: oh.list_price,
    address: oh.unparsed_address ?? [oh.street_number, oh.street_name].filter(Boolean).join(' '),
    cityLine: [oh.city, oh.subdivision_name].filter(Boolean).join(' · '),
    beds: oh.beds_total,
    baths: oh.baths_full,
    sqft: oh.living_area,
    whenLabel: openHouseWhen(oh.event_date, oh.start_time, oh.end_time),
  }))

  // Map geo — every open house with coordinates (uncapped). Restores the map
  // view the pre-KB OpenHousesClient rendered, in the KB navy/cream basemap.
  const mapFeatures = openHouses
    .filter((oh) => oh.latitude != null && oh.longitude != null)
    .map((oh) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [Number(oh.longitude), Number(oh.latitude)] as [number, number],
      },
      properties: {
        p: oh.list_price,
        bd: oh.beds_total,
        ba: oh.baths_full,
        sf: oh.living_area,
        a: oh.unparsed_address ?? [oh.street_number, oh.street_name].filter(Boolean).join(' '),
        sub: oh.subdivision_name ?? '',
        city: oh.city ?? '',
        img: oh.photo_url ?? '',
      },
    }))
  const mapGeo: KbMapGeo = { type: 'FeatureCollection', features: mapFeatures }

  const eventJsonLd = openHouses.length > 0 ? buildEventJsonLd(openHouses, cityName) : null

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Open houses', url: '/open-houses' },
        { name: cityName, url: `/open-houses/${citySlug}` },
      ],
    },
  ]

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="open-houses-city" />
      <TrackSearchView city={cityName} resultsCount={openHouseCount} />
      <MetadataBlock schemas={schemas} />
      {/* Preserved Event ItemList JSON-LD from the original city page */}
      {eventJsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: eventJsonLd }} />
      ) : null}
      <KbBreadcrumb overlay trail={[{ label: 'Home', href: '/' }, { label: 'Open houses', href: '/open-houses' }, { label: cityName }]} />
      <SmoothScrollProvider>
        <KbHero
          data={{
            activeCount: pulse?.activeCount ?? null,
            medianListPrice: pulse?.medianListPrice ?? null,
            medianDaysToPending: pulse?.medianDaysToPending ?? null,
          }}
          eyebrow={`${cityName} · Open houses`}
          titleTop="Open houses in"
          titleBottom={cityName}
          lead={`in ${cityName} this weekend. ${openHouseCount > 0 ? `${openHouseCount} open ${openHouseCount === 1 ? 'house' : 'houses'} on the calendar.` : ''}`}
          videoSrc={null}
          posterSrc="/images/kb/sunriver-deschutes-river.jpg"
        />
        <KbOpenHouses
          items={openHouseItems}
          eyebrow={`${cityName} · This week`}
          heading="Open houses"
          viewAllHref="/open-houses"
        />
        {/* Map — every open house on the real terrain (restores the pre-KB map view) */}
        {mapFeatures.length > 0 ? (
          <KbListingMap
            geojson={mapGeo}
            totalActive={mapFeatures.length}
            fitToFeatures
            showRegionMarkers={false}
            eyebrow={cityName}
            title={'Open houses\non the map'}
            subtitle={`Every open house in ${cityName} with a location, on the real terrain. Click any dot for the price, the beds, and the street.`}
          />
        ) : null}
        <KbSell
          data={{
            medianListPrice: pulse?.medianListPrice ?? null,
            medianDaysToPending: pulse?.medianDaysToPending ?? null,
            soldCount30d: pulse?.closedLast30Days ?? null,
          }}
        />
        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
