import type { V3FieldItem } from '@/components/site/v3'
import { formatPrice } from '@/lib/format/money'
import { isWeekendIso, openHouseWhen } from './oh-when'
import type { OpenHouseListing } from './oh-listings'
import { listingMlsStreetLine } from '@/lib/listing/publish-street-line'
import { listingRowPhotoSrc } from '@/lib/listing/row-photo'

export type OpenHouseFieldItem = V3FieldItem & {
  when?: string
  eventDate: string
  weekend: boolean
}

function compareOpenHouseOrder(a: OpenHouseListing, b: OpenHouseListing): number {
  const aWeekend = isWeekendIso(a.eventDate) ? 0 : 1
  const bWeekend = isWeekendIso(b.eventDate) ? 0 : 1
  if (aWeekend !== bWeekend) return aWeekend - bWeekend
  if (a.eventDate !== b.eventDate) return a.eventDate.localeCompare(b.eventDate)
  return (a.startTime ?? '').localeCompare(b.startTime ?? '')
}

export function openHouseFieldItems(houses: readonly OpenHouseListing[]): OpenHouseFieldItem[] {
  const items: OpenHouseFieldItem[] = []
  for (const oh of [...houses].sort(compareOpenHouseOrder)) {
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
    const meta = [when || null, specs || null]
      .filter((part): part is string => Boolean(part))
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
      eventDate: oh.eventDate,
      weekend: isWeekendIso(oh.eventDate),
      ...(when ? { when } : {}),
      ...(meta ? { meta } : {}),
      ...(photoSrc ? { photoSrc: listingRowPhotoSrc(photoSrc) } : {}),
      lat: oh.lat,
      lng: oh.lng,
    })
  }
  return items
}
