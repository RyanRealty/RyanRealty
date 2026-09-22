import { listingTileHref } from '@/lib/slug'
import type { SchemaInput } from '@/lib/site/json-ld'
import type { OpenHouseListing } from './oh-listings'
import { openHouseWhen } from './oh-when'
import type { OpenHouseFieldItem } from './oh-field-items'

/** Clock slice "14:00:00" → "14:00". Empty in, empty out. Never invents a hour. */
function clockHm(raw: string | null | undefined): string {
  const hm = (raw ?? '').toString().slice(0, 5)
  return /^\d{2}:\d{2}$/.test(hm) ? hm : ''
}

function openHouseSchemaDates(oh: OpenHouseListing): { startDate: string; endDate?: string } {
  const start = clockHm(oh.startTime)
  const end = clockHm(oh.endTime)
  if (!start) return { startDate: oh.eventDate }
  return {
    startDate: `${oh.eventDate}T${start}:00`,
    ...(end ? { endDate: `${oh.eventDate}T${end}:00` } : {}),
  }
}

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
    const when = openHouseWhen(oh.eventDate, oh.startTime, oh.endTime)
    const dates = openHouseSchemaDates(oh)
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
      name: when ? `Open house ${when} at ${nameStreet}` : `Open house at ${nameStreet}`,
      startDate: dates.startDate,
      ...(dates.endDate ? { endDate: dates.endDate } : {}),
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

export function openHouseItemListSchema(
  items: readonly OpenHouseFieldItem[],
  siteUrl: string,
): SchemaInput | null {
  if (items.length === 0) return null
  return {
    type: 'itemList',
    name: 'Open houses in Central Oregon this week',
    items: items.slice(0, 24).map((item) => ({
      name: [item.when, item.priceLabel, item.title].filter(Boolean).join(' · '),
      url: item.href.startsWith('http') ? item.href : `${siteUrl}${item.href}`,
    })),
  }
}
