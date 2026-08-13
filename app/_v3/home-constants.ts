/**
 * Route-local constants for the homepage (app/page.tsx).
 *
 * Split out so the route file stays under the ci:file-size-budget floor.
 * Nothing here fetches, formats, or derives.
 */

/** D11 towns, in lead order. Snapshot query keys on geo_label. */
export const D11_TOWNS = [
  'Bend',
  'Redmond',
  'Sisters',
  'Sunriver',
  'La Pine',
  'Terrebonne',
] as const

export const D11_TOWN_SLUG: Record<(typeof D11_TOWNS)[number], string> = {
  Bend: 'bend',
  Redmond: 'redmond',
  Sisters: 'sisters',
  Sunriver: 'sunriver',
  'La Pine': 'la-pine',
  Terrebonne: 'terrebonne',
}

export const D11_TOWN_IMG: Record<(typeof D11_TOWNS)[number], string> = {
  Bend: '/images/kb/bend-drake-park-aerial.jpg',
  Redmond: '/images/kb/redmond-downtown-aerial.jpg',
  Sisters: '/images/kb/sisters-downtown-three-peaks.jpg',
  Sunriver: '/images/kb/sunriver-deschutes-river.jpg',
  'La Pine': '/images/kb/vandevert-ranch.jpg',
  Terrebonne: '/images/kb/smith-rock-terrebonne.jpg',
}

export const HOME_COMMUNITY_EDGES = [
  { label: 'Tetherow', href: '/communities/tetherow' },
  { label: 'Caldera Springs', href: '/communities/caldera-springs' },
  { label: 'Broken Top', href: '/communities/broken-top' },
  { label: 'NorthWest Crossing', href: '/communities/northwest-crossing' },
] as const

export const HOME_FIELD_LIMIT = 24
export const HOME_TILE_FETCH = 200

export const HOME_PULSE_TRACE =
  'live MLS through Oregon Data Share, single-family homes, Central Oregon region'

export const HOME_TOWN_TRACE =
  'live MLS through Oregon Data Share, active single-family listings, one row per city'

