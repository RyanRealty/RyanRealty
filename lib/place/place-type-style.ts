/**
 * One color + card key per leftover property type.
 * Pins, type-card ticks, and search hrefs share this map so a condo on the
 * map is the same color as the Condo card that opens its search.
 *
 * Hex lives here and in v3 tokens (Maps overlays cannot read CSS variables).
 */
export const PLACE_TYPE_KEYS = [
  'sfr',
  'condo',
  'townhome',
  'manufactured_land',
  'manufactured_park',
  'multifamily_2_4',
  'land',
  'farm',
  'commercial_sale',
  'business',
] as const

export type PlaceTypeKey = (typeof PLACE_TYPE_KEYS)[number]

/** Map-overlay fills (also declared as --place-type-* in v3 tokens). */
export const PLACE_TYPE_PIN_FILL: Record<PlaceTypeKey, string> = {
  sfr: '#102742',
  condo: '#1f5c66',
  townhome: '#3d5a3c',
  manufactured_land: '#7a5c2e',
  manufactured_park: '#6e3f2d',
  multifamily_2_4: '#3f3a5c',
  land: '#4d6a45',
  farm: '#5c6b32',
  commercial_sale: '#3a4654',
  business: '#5a4638',
}

const SUBTYPE_TO_KEY: Record<string, PlaceTypeKey> = {
  'Single Family Residence': 'sfr',
  Condominium: 'condo',
  Townhouse: 'townhome',
  'Manufactured On Land': 'manufactured_land',
  'In Park': 'manufactured_park',
  'On Leased Land': 'manufactured_park',
  Duplex: 'multifamily_2_4',
  Triplex: 'multifamily_2_4',
  Quadruplex: 'multifamily_2_4',
  'Multi Family': 'multifamily_2_4',
  'Residential Lots': 'land',
}

const TYPE_TO_KEY: Record<string, PlaceTypeKey> = {
  A: 'sfr',
  B: 'manufactured_park',
  C: 'multifamily_2_4',
  D: 'land',
  E: 'farm',
  F: 'commercial_sale',
  H: 'business',
  Land: 'land',
  land: 'land',
  farm: 'farm',
  Commercial: 'commercial_sale',
  'multi-family': 'multifamily_2_4',
  business: 'business',
}

export function placeTypeKey(
  propertyType?: string | null,
  propertySubType?: string | null,
): PlaceTypeKey {
  const sub = (propertySubType ?? '').trim()
  if (sub && SUBTYPE_TO_KEY[sub]) return SUBTYPE_TO_KEY[sub]
  const type = (propertyType ?? '').trim()
  if (type && TYPE_TO_KEY[type]) return TYPE_TO_KEY[type]
  return 'sfr'
}

export function placeTypePinFill(
  propertyType?: string | null,
  propertySubType?: string | null,
): string {
  return PLACE_TYPE_PIN_FILL[placeTypeKey(propertyType, propertySubType)]
}
