/**
 * Pure public-segment labels and browse hrefs.
 *
 * Kept free of getMetrics / Supabase so v3 barrel consumers can import these
 * without pulling next/headers into a client module graph under webpack.
 */

export const PUBLIC_PLACE_SEGMENTS = [
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

export type PublicPlaceSegment = (typeof PUBLIC_PLACE_SEGMENTS)[number]

type BrowseSpec = { propertySubTypes?: string; propertyType?: string }

const BROWSE: Record<PublicPlaceSegment, BrowseSpec> = {
  condo: { propertySubTypes: 'Condominium' },
  townhome: { propertySubTypes: 'Townhouse' },
  manufactured_land: { propertySubTypes: 'Manufactured On Land' },
  manufactured_park: { propertySubTypes: 'In Park' },
  multifamily_2_4: { propertyType: 'multi-family' },
  land: { propertyType: 'Land' },
  farm: { propertyType: 'farm' },
  commercial_sale: { propertyType: 'Commercial' },
  business: { propertyType: 'business' },
}

const NOUN: Record<PublicPlaceSegment, { one: string; many: string }> = {
  condo: { one: 'condo', many: 'condos' },
  townhome: { one: 'townhome', many: 'townhomes' },
  manufactured_land: { one: 'manufactured home on land', many: 'manufactured homes on land' },
  manufactured_park: { one: 'manufactured home in a park', many: 'manufactured homes in parks' },
  multifamily_2_4: { one: '2-4 unit building', many: '2-4 unit buildings' },
  land: { one: 'lot', many: 'lots' },
  farm: { one: 'farm', many: 'farms' },
  commercial_sale: { one: 'commercial property', many: 'commercial properties' },
  business: { one: 'business', many: 'businesses' },
}

const SEGMENT_PRESET_SLUG: Record<PublicPlaceSegment, string> = {
  condo: 'condos',
  townhome: 'townhomes',
  manufactured_land: 'manufactured-on-land',
  manufactured_park: 'manufactured-in-park',
  multifamily_2_4: 'multi-family',
  land: 'lots-and-land',
  farm: 'farms',
  commercial_sale: 'commercial',
  business: 'businesses',
}

function hyphenSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function publicSegmentNoun(segment: string, count: number): string {
  const n = NOUN[segment as PublicPlaceSegment]
  if (!n) return segment
  return count === 1 ? n.one : n.many
}

export function publicSegmentFilterParams(
  segment: string,
): { propertyType?: string; propertySubTypes?: string } | null {
  const spec = BROWSE[segment as PublicPlaceSegment]
  if (!spec) return null
  return {
    propertyType: spec.propertyType,
    propertySubTypes: spec.propertySubTypes,
  }
}

export function publicSegmentBrowseHref(
  citySlug: string | null,
  segment: string,
  opts?: { postalCode?: string | null },
): string {
  const spec = BROWSE[segment as PublicPlaceSegment]
  const path = citySlug?.trim() ? `/homes-for-sale/${hyphenSlug(citySlug)}` : '/homes-for-sale'
  const presetSlug = SEGMENT_PRESET_SLUG[segment as PublicPlaceSegment]
  const zip = opts?.postalCode?.replace(/\D/g, '').slice(0, 5)
  if (presetSlug && !(zip && zip.length === 5)) return `${path}/${presetSlug}`
  const params = new URLSearchParams()
  if (zip && zip.length === 5) params.set('postalCode', zip)
  if (spec?.propertySubTypes) params.set('propertySubTypes', spec.propertySubTypes)
  if (spec?.propertyType) params.set('propertyType', spec.propertyType)
  const q = params.toString()
  return q ? `${path}?${q}` : path
}

export function publicSegmentVerdictLabel(verdict: string | null): string | null {
  if (verdict === 'seller') return "seller's market"
  if (verdict === 'buyer') return "buyer's market"
  if (verdict === 'balanced') return 'balanced market'
  return null
}

/** Pure percent formatter for leftover pace shares. */
export function formatPaceShare(share: number): string {
  const pct = Math.round(share * 1000) / 10
  return `${pct.toFixed(1)}%`
}
