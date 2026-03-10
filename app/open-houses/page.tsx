import type { Metadata } from 'next'
import { getOpenHousesWithListings } from '@/app/actions/open-houses'
import OpenHousesClient from '@/components/open-houses/OpenHousesClient'
import type { OpenHouseWithListing } from '@/app/actions/open-houses'

export const metadata: Metadata = {
  title: 'Open Houses in Bend, Oregon — This Weekend & Upcoming | Ryan Realty',
  description: 'Browse open houses this weekend and upcoming in Bend, Redmond, Sisters and Central Oregon. Map, list and calendar views.',
  openGraph: {
    title: 'Open Houses in Bend, Oregon — This Weekend & Upcoming | Ryan Realty',
    description: 'Browse open houses this weekend and upcoming in Central Oregon.',
  },
}

function buildJsonLd(openHouses: OpenHouseWithListing[]): string {
  const events = openHouses.slice(0, 20).map((oh) => ({
    '@type': 'Event',
    name: `Open House at ${oh.unparsed_address || [oh.street_number, oh.street_name].filter(Boolean).join(' ') || 'Property'}`,
    startDate: `${oh.event_date}T${(oh.start_time ?? '09:00').toString().slice(0, 5)}:00`,
    endDate: `${oh.event_date}T${(oh.end_time ?? '12:00').toString().slice(0, 5)}:00`,
    location: {
      '@type': 'Place',
      address: oh.unparsed_address || [oh.street_number, oh.street_name, oh.city, oh.state, oh.postal_code].filter(Boolean).join(', '),
    },
    url: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryanrealty.com'}/listings/${encodeURIComponent(oh.listing_key)}`,
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
  const openHouses = await getOpenHousesWithListings(filters)
  const jsonLd = buildJsonLd(openHouses)

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <OpenHousesClient initialOpenHouses={openHouses} initialFilters={filters} />
    </>
  )
}
