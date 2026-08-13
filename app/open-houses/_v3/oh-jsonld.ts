import { listingDetailPath } from '@/lib/slug'
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
    const path = listingDetailPath(
      oh.listingKey,
      {
        streetNumber: oh.streetNumber,
        streetName: oh.streetName,
        city: oh.city,
        state: oh.state,
        postalCode: oh.postalCode,
      },
      { city: oh.city, subdivision: oh.subdivisionName },
      { mlsNumber: oh.listNumber },
    )
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
