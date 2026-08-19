import type { V3FieldItem } from '@/components/site/v3'
import { formatPrice } from '@/lib/format/money'
import { openHouseWhen } from './oh-when'
import type { OpenHouseListing } from './oh-listings'

export type OpenHouseFieldItem = V3FieldItem & { when?: string }

export function openHouseFieldItems(houses: readonly OpenHouseListing[]): OpenHouseFieldItem[] {
  const items: OpenHouseFieldItem[] = []
  for (const oh of houses) {
    const street = (
      oh.unparsedAddress ||
      [oh.streetNumber, oh.streetName, oh.streetSuffix].filter(Boolean).join(' ')
    ).trim()
    if (!street) continue

    const when = openHouseWhen(oh.eventDate, oh.startTime, oh.endTime)
    const specs = [
      when || null,
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
      title: street,
      ...(when ? { when } : {}),
      ...(specs ? { meta: specs } : {}),
      ...(photoSrc ? { photoSrc } : {}),
      lat: oh.lat,
      lng: oh.lng,
    })
  }
  return items
}
