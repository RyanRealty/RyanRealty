import { listingTileHref } from '@/lib/slug'
import type { SchemaInput } from '@/lib/site/json-ld'
import type { OpenHouseListing } from './oh-listings'

export function openHouseEventSchemas(
  houses: readonly OpenHouseListing[],
  siteUrl: string,
): SchemaInput[] {
  const events: SchemaInput[] = []
  for (const oh of houses.slice(0, 20)) {
    const nameStreet =
      oh.unparsedAddress ||
      [oh.streetNumber, oh.streetName].filter(Boolean).join(' ') ||
      'Property'
    const start = `${oh.eventDate}T${(oh.startTime ?? '09:00').toString().slice(0, 5)}:00`
    const end = `${oh.eventDate}T${(oh.endTime ?? '12:00').toString().slice(0, 5)}:00`
    // Same fields, same builder, same URL as the card's own href (SITE-22).
    const path = listingTileHref({
      listingKey: oh.listingKey,
      listNumber: oh.listNumber,
      streetNumber: oh.streetNumber,
      streetName: oh.streetName,
      city: oh.city,
      boundaryCity: oh.boundaryCity,
      boundaryNeighborhood: oh.boundaryNeighborhood,
      subdivisionName: oh.subdivisionName,
    })
    events.push({
      type: 'event',
      name: `Open House at ${nameStreet}`,
      startDate: start,
      endDate: end,
      url: `${siteUrl}${path}`,
      locationName: oh.city ?? undefined,
      address: {
        street: oh.unparsedAddress || [oh.streetNumber, oh.streetName].filter(Boolean).join(' ') || undefined,
        city: oh.city ?? undefined,
        state: oh.state ?? undefined,
        postalCode: oh.postalCode ?? undefined,
      },
    })
  }
  return events
}
