/**
 * Public place-page extra segments (Step 9). Detached stays the HUD.
 * The mixed all-types bucket is omitted (it double-counts). Lease inventory
 * stays out. Neighborhood extra types are inventory; MOS only when publishable. Miss omits the row.
 */
import { createServiceClient } from '@/lib/data/client'
import { DEFINITION_ID } from '@/lib/data/market-truth/registry'
import { staleReason } from '@/lib/data/market-truth/getMetric'
import { formatPriceExact } from '@/lib/format/money'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import {
  BOARD_STATS,
  collapseCitySegmentRows,
  type CitySegmentRow,
  type RawSegmentCell,
} from '@/lib/data/market-truth/city-segment-collapse'

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

export type PublicSegmentRow = CitySegmentRow & { segment: PublicPlaceSegment }

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

export function publicSegmentBrowseHref(
  citySlug: string | null,
  segment: string,
  opts?: { postalCode?: string | null },
): string {
  const spec = BROWSE[segment as PublicPlaceSegment]
  const path = citySlug?.trim() ? `/homes-for-sale/${hyphenSlug(citySlug)}` : '/homes-for-sale'
  const params = new URLSearchParams()
  const zip = opts?.postalCode?.replace(/\D/g, '').slice(0, 5)
  if (zip && zip.length === 5) params.set('postalCode', zip)
  if (spec?.propertySubTypes) params.set('propertySubTypes', spec.propertySubTypes)
  if (spec?.propertyType) params.set('propertyType', spec.propertyType)
  const q = params.toString()
  return q ? `${path}?${q}` : path
}

export function publicSegmentVerdictLabel(verdict: string | null): string | null {
  if (verdict === 'seller') return "seller's"
  if (verdict === 'buyer') return "buyer's"
  if (verdict === 'balanced') return 'balanced'
  return null
}

export function publicSegmentDisplayBits(row: {
  medianList: number | null
  monthsOfSupply: number | null
  verdict: string | null
}): string[] {
  return [
    row.medianList != null ? formatPriceExact(row.medianList) : null,
    row.monthsOfSupply != null ? `${formatMonthsOfSupply(row.monthsOfSupply)} months` : null,
    publicSegmentVerdictLabel(row.verdict),
  ].filter((bit): bit is string => Boolean(bit))
}

export type PublicSegmentItem = {
  key: PublicPlaceSegment
  value: string
  label: string
  noun: string
  href: string
}

/** Miss omitted. Detached is never here. */
export function publicSegmentItems(
  rows: readonly PublicSegmentRow[],
  citySlug: string | null,
  opts?: { postalCode?: string | null },
): PublicSegmentItem[] {
  const items: PublicSegmentItem[] = []
  for (const row of rows) {
    if (row.activeCount == null || row.activeCount <= 0) continue
    if (!(PUBLIC_PLACE_SEGMENTS as readonly string[]).includes(row.segment)) continue
    const noun = publicSegmentNoun(row.segment, row.activeCount)
    const bits = publicSegmentDisplayBits(row)
    items.push({
      key: row.segment,
      value: row.activeCount.toLocaleString('en-US'),
      label: [`${noun} for sale`, ...bits].join(' · '),
      noun,
      href: publicSegmentBrowseHref(citySlug, row.segment, opts),
    })
  }
  return items
}

export async function getPublicPlaceSegments(opts: {
  geoType: 'city' | 'region' | 'zip' | 'neighborhood'
  geoSlug: string
}): Promise<PublicSegmentRow[]> {
  const geoSlug = hyphenSlug(opts.geoSlug)
  if (!geoSlug) return []

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('market_metric')
    .select(
      'segment, stat_id, value, value_text, sample_n, window_months, period_end, computed_at, complete_through, is_publishable',
    )
    .eq('definition_id', DEFINITION_ID)
    .eq('geo_type', opts.geoType)
    .eq('geo_slug', geoSlug)
    .in('segment', [...PUBLIC_PLACE_SEGMENTS])
    .in('stat_id', [...BOARD_STATS])
    .eq('is_publishable', true)
    .not('value', 'is', null)

  if (error) throw new Error(`getPublicPlaceSegments: ${error.message}`)
  return collapseCitySegmentRows((data ?? []) as RawSegmentCell[], {
    segments: PUBLIC_PLACE_SEGMENTS,
    stale: (row) =>
      Boolean(
        staleReason({
          completeThrough: String(row.complete_through ?? ''),
          periodEnd: String(row.period_end ?? ''),
          windowMonths: Number(row.window_months),
        }),
      ),
  }).filter((row): row is PublicSegmentRow => {
    if (row.activeCount == null || row.activeCount <= 0) return false
    return (PUBLIC_PLACE_SEGMENTS as readonly string[]).includes(row.segment)
  })
}
