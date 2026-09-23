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

/**
 * SITE-177. Buyer groups on the community Field. Cabins are only a group when
 * the MLS sub-type itself names a cabin — never remarks, never a size band.
 * Land is "Lots" so the page can name lots only when those rows exist.
 */
export const PLACE_BUYER_GROUPS = [
  'homes',
  'cabins',
  'attached',
  'multifamily',
  'lots',
  'other',
] as const

export type PlaceBuyerGroup = (typeof PLACE_BUYER_GROUPS)[number]

export const PLACE_BUYER_GROUP_HEADING: Record<PlaceBuyerGroup, string> = {
  homes: 'Homes',
  cabins: 'Cabins',
  attached: 'Townhomes and condos',
  multifamily: 'Multifamily',
  lots: 'Lots',
  // placeBuyerGroup files only MLS commercial sales (F) and business
  // opportunities (H) here, so the group says what it is (Matt 2026-09-23:
  // "we haven't been doing commercial"). Commercial leases never reach it:
  // the rows come from placeStockSectionsFromTiles, which drops them.
  other: 'Commercial property',
}

const CABIN_SUBTYPE = /\bcabin/i

export function placeBuyerGroup(
  propertyType?: string | null,
  propertySubType?: string | null,
): PlaceBuyerGroup {
  const sub = (propertySubType ?? '').trim()
  if (CABIN_SUBTYPE.test(sub)) return 'cabins'
  const key = placeTypeKey(propertyType, propertySubType)
  if (key === 'land' || key === 'farm') return 'lots'
  if (key === 'condo' || key === 'townhome') return 'attached'
  if (key === 'multifamily_2_4') return 'multifamily'
  if (key === 'commercial_sale' || key === 'business') return 'other'
  const type = (propertyType ?? '').trim().toUpperCase()
  if (type === 'D' || type === 'LAND') return 'lots'
  return 'homes'
}
