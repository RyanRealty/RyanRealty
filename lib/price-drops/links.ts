/**
 * Internal doors that already exist. Foreclosure URLs are omitted: this site
 * has no /foreclosures/[city] page. Under-$X links are the city+preset
 * routes already in popular searches or verified live on 2026-10-13.
 */

export type PriceDropDoor = { label: string; href: string }

const UNDER_PAGES: Record<string, readonly PriceDropDoor[]> = {
  bend: [
    { label: 'Bend homes under $400,000', href: '/homes-for-sale/bend/under-400k' },
    { label: 'Bend homes under $500,000', href: '/homes-for-sale/bend/under-500k' },
  ],
  redmond: [{ label: 'Redmond homes under $500,000', href: '/homes-for-sale/redmond/under-500k' }],
  'la-pine': [
    { label: 'La Pine homes under $400,000', href: '/homes-for-sale/la-pine/under-400k' },
    { label: 'La Pine homes under $500,000', href: '/homes-for-sale/la-pine/under-500k' },
  ],
}

const CITY_DOORS: Record<string, readonly PriceDropDoor[]> = {
  bend: [
    { label: 'Bend homes for sale', href: '/homes-for-sale/bend' },
    { label: 'Bend housing market', href: '/housing-market/bend' },
    { label: 'Bend city page', href: '/cities/bend' },
  ],
  redmond: [
    { label: 'Redmond homes for sale', href: '/homes-for-sale/redmond' },
    { label: 'Redmond housing market', href: '/housing-market/redmond' },
    { label: 'Redmond city page', href: '/cities/redmond' },
  ],
  sisters: [
    { label: 'Sisters homes for sale', href: '/homes-for-sale/sisters' },
    { label: 'Sisters housing market', href: '/housing-market/sisters' },
    { label: 'Sisters city page', href: '/cities/sisters' },
  ],
  'la-pine': [
    { label: 'La Pine homes for sale', href: '/homes-for-sale/la-pine' },
    { label: 'La Pine housing market', href: '/housing-market/la-pine' },
    { label: 'La Pine city page', href: '/cities/la-pine' },
  ],
}

const SHARED_DOORS: readonly PriceDropDoor[] = [
  { label: 'All Central Oregon price drops', href: '/price-drops' },
  { label: 'What buyers pay at closing', href: '/blog/closing-costs-buyers-bend-oregon' },
  { label: 'Buyer-broker agreement in Bend', href: '/blog/buyers-agent-bend-buyer-broker-agreement' },
  { label: 'Mortgage payment tool', href: '/tools/mortgage-calculator' },
  { label: 'Book a time', href: '/book' },
  { label: 'Fair housing', href: '/fair-housing' },
]

export function underPriceDoors(citySlug: string): PriceDropDoor[] {
  return [...(UNDER_PAGES[citySlug] ?? [])]
}

export function foreclosureDoors(_citySlug: string): PriceDropDoor[] {
  return []
}

export function priceDropCityDoors(citySlug: string): PriceDropDoor[] {
  return [
    ...(CITY_DOORS[citySlug] ?? []),
    ...underPriceDoors(citySlug),
    ...foreclosureDoors(citySlug),
    ...SHARED_DOORS,
  ]
}
