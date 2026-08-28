import type { V3FieldItem } from '@/components/site/v3'
import { formatPrice } from '@/lib/format/money'
import { openHouseWhen } from './oh-when'
import type { OpenHouseListing } from './oh-listings'
import { listingMlsStreetLine } from '@/lib/listing/publish-street-line'

export type OpenHouseFieldItem = V3FieldItem & { when?: string }

export function openHouseFieldItems(houses: readonly OpenHouseListing[]): OpenHouseFieldItem[] {
  const items: OpenHouseFieldItem[] = []
  for (const oh of houses) {
    const street = (
      oh.unparsedAddress ||
      listingMlsStreetLine(oh) ||
      [oh.streetNumber, oh.streetName, oh.streetSuffix].filter(Boolean).join(' ')
    ).trim()
    if (!street) continue
    // Card title carries the city (Matt 2026-08-27): open house cards mix
    // towns, and a bare street line made the reader guess which one.
    const cityName = oh.city?.trim()
    const title = cityName ? `${street}, ${cityName}` : street

    const when = openHouseWhen(oh.eventDate, oh.startTime, oh.endTime)
    const specs = [
      oh.beds != null ? `${oh.beds} bd` : null,
      oh.baths != null ? `${oh.baths} ba` : null,
      oh.sqft != null ? `${oh.sqft.toLocaleString('en-US')} sqft` : null,
    ]
      .filter((part): part is string => part !== null)
      .join(' · ')

    const priceLabel =
      oh.listPrice != null && Number.isFinite(oh.listPrice) && oh.listPrice > 0
        ? formatPrice(oh.listPrice)
        : null
    if (!priceLabel || !/\$/.test(priceLabel)) continue

    const photoSrc = oh.photoUrl?.trim()
    items.push({
      id: oh.id,
      href: oh.href,
      priceLabel,
      title,
      listingKey: oh.listingKey,
      ...(when ? { when, badge: when } : {}),
      ...(specs ? { meta: specs } : {}),
      ...(photoSrc ? { photoSrc } : {}),
      lat: oh.lat,
      lng: oh.lng,
    })
  }
  return items
}
