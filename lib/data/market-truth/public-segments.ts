/**
 * Public place-page extra segments (Step 9 start). Condo and townhome only.
 * Detached stays the HUD. Neighborhood MOS is not here. Miss omits the row.
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

export const PUBLIC_PLACE_SEGMENTS = ['condo', 'townhome'] as const

export type PublicPlaceSegment = (typeof PUBLIC_PLACE_SEGMENTS)[number]

export type PublicSegmentRow = CitySegmentRow & { segment: PublicPlaceSegment }

const SUBTYPE_QUERY: Record<PublicPlaceSegment, string> = {
  condo: 'Condominium',
  townhome: 'Townhouse',
}

const NOUN: Record<PublicPlaceSegment, { one: string; many: string }> = {
  condo: { one: 'condo', many: 'condos' },
  townhome: { one: 'townhome', many: 'townhomes' },
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
  const sub = SUBTYPE_QUERY[segment as PublicPlaceSegment]
  const path = citySlug?.trim() ? `/homes-for-sale/${hyphenSlug(citySlug)}` : '/homes-for-sale'
  const params = new URLSearchParams()
  const zip = opts?.postalCode?.replace(/\D/g, '').slice(0, 5)
  if (zip && zip.length === 5) params.set('postalCode', zip)
  if (sub) params.set('propertySubTypes', sub)
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

export async function getPublicPlaceSegments(opts: {
  geoType: 'city' | 'region' | 'zip'
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
