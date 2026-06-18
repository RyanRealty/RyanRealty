/**
 * Open Houses index — KB (kinetic-brutalist) design, Phase 9 convergence.
 * Reuses the KB section library (components/site/kb/*) and the existing
 * open-houses data action. No parity.json exists for this route; noted below.
 *
 * NOTE: No parity.json found for /open-houses. Rewrite uses KB chrome only.
 *
 * Section stack: nav · section-tracker · metadata · breadcrumb · hero ·
 * open-houses · sell · footer.
 *
 * §0: all counts via getOpenHousesWithListings + getRegionPulse from @/lib/data.
 */

import type { Metadata } from 'next'
import { getOpenHousesWithListings } from '@/app/actions/open-houses'
import type { OpenHouseWithListing } from '@/app/actions/open-houses'
import { getRegionPulse } from '@/lib/data'
import { listingTileHref, listingDetailPath } from '@/lib/slug'
import { pageMetadata } from '@/lib/site/page-metadata'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import type { SchemaInput } from '@/lib/site/json-ld'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbOpenHouses } from '@/components/site/kb/KbOpenHouses.client'
import { KbSell } from '@/components/site/kb/KbSell.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import '@/components/site/kb/kb.css'

export const revalidate = 60

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Open Houses in Central Oregon — This Weekend and Upcoming',
    description:
      'Browse open houses this weekend and upcoming in Bend, Redmond, Sisters, and Central Oregon. Live list from the regional MLS with times, photos, and prices.',
    path: '/open-houses',
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

/** Build the Event ItemList JSON-LD preserved from the original page. */
function buildEventJsonLd(openHouses: OpenHouseWithListing[]): string {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
  const events = openHouses.slice(0, 20).map((oh) => ({
    '@type': 'Event',
    name: `Open House at ${oh.unparsed_address || [oh.street_number, oh.street_name].filter(Boolean).join(' ') || 'Property'}`,
    startDate: `${oh.event_date}T${(oh.start_time ?? '09:00').toString().slice(0, 5)}:00`,
    endDate: `${oh.event_date}T${(oh.end_time ?? '12:00').toString().slice(0, 5)}:00`,
    location: {
      '@type': 'Place',
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
  city?: string
  minPrice?: string
  maxPrice?: string
  beds?: string
  baths?: string
}

export default async function OpenHousesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const filters = {
    dateFrom: sp.dateFrom?.trim(),
    dateTo: sp.dateTo?.trim(),
    community: sp.community ? sp.community.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
    city: sp.city?.trim(),
    minPrice: sp.minPrice ? Number(sp.minPrice) : undefined,
    maxPrice: sp.maxPrice ? Number(sp.maxPrice) : undefined,
    beds: sp.beds ? Number(sp.beds) : undefined,
    baths: sp.baths ? Number(sp.baths) : undefined,
  }

  const [openHouses, regionPulse] = await Promise.all([
    withTimeoutFallback(getOpenHousesWithListings(filters), [], 4000, 'open-houses:list'),
    withTimeoutFallback(getRegionPulse(), null, 3000, 'open-houses:regionPulse'),
  ])

  // §0: count from live data, not a hard-coded number.
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

  const eventJsonLd = openHouses.length > 0 ? buildEventJsonLd(openHouses) : null

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Open houses', url: '/open-houses' },
      ],
    },
  ]

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="open-houses" />
      <MetadataBlock schemas={schemas} />
      {/* Preserved Event ItemList JSON-LD from the original page */}
      {eventJsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: eventJsonLd }} />
      ) : null}
      <KbBreadcrumb overlay trail={[{ label: 'Home', href: '/' }, { label: 'Open houses' }]} />
      <SmoothScrollProvider>
        <KbHero
          data={{
            activeCount: regionPulse?.activeCount ?? null,
            medianListPrice: regionPulse?.medianListPrice ?? null,
            medianDaysToPending: regionPulse?.medianDaysToPending ?? null,
          }}
          eyebrow="Central Oregon · Open houses"
          titleTop="Open houses in"
          titleBottom="Central Oregon"
          lead={`across Central Oregon this weekend. ${openHouseCount > 0 ? `${openHouseCount} open ${openHouseCount === 1 ? 'house' : 'houses'} on the calendar.` : ''}`}
          videoSrc={null}
          posterSrc="/images/hero/hero-old-mill-master-4k.jpg"
        />
        <KbOpenHouses
          items={openHouseItems}
          eyebrow="Central Oregon · This week"
          heading="Open houses"
        />
        <KbSell
          data={{
            medianListPrice: regionPulse?.medianListPrice ?? null,
            medianDaysToPending: regionPulse?.medianDaysToPending ?? null,
            soldCount30d: regionPulse?.soldCount30d ?? null,
          }}
        />
        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
