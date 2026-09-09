/**
 * One card key per leftover property type, shared by the type cards and the
 * search hrefs they open.
 *
 * SITE-44, 2026-09-09: the ten-hue pin palette that used to live here is gone.
 * It claimed to be mirrored by `--place-type-*` tokens in v3 tokens.css; those
 * tokens do not exist and never did, so the ten values were ten off-brand hexes
 * (§3: the public palette is navy and cream) with exactly one consumer, the
 * search map — where a teal condo beside an ochre manufactured home beside a
 * brown business is the "hue per rank" the dataviz method bans outright. Every
 * mark on the map is navy now; property type is a filter and a line on the
 * card, which is where a category belongs.
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
