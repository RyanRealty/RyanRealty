/**
 * Subdivision grain publishes counts only (REGISTRY §4). Prices, MOS, and
 * verdict stay off this grain. getMetric is the read path. Miss omits.
 * Extra product types overlay active / pending / closed counts.
 */
import { getMetrics, type GetMetricInput, type MetricResult } from '@/lib/data/market-truth/getMetric'
import {
  PUBLIC_PLACE_SEGMENTS,
  publicSegmentNoun,
  type PublicPlaceSegment,
} from '@/lib/data/market-truth/public-segments'

export type SubdivisionExtraCount = {
  segment: PublicPlaceSegment
  activeCount: number | null
  pendingCount: number | null
  closedCount: number | null
}

export type SubdivisionCounts = {
  activeCount: number | null
  pendingCount: number | null
  closedCount: number | null
  extras: readonly SubdivisionExtraCount[]
}

export const EMPTY_SUBDIVISION_COUNTS: SubdivisionCounts = {
  activeCount: null,
  pendingCount: null,
  closedCount: null,
  extras: [],
}

function publishedCount(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 1) return null
  return Math.round(value)
}

export type SubdivisionCountItem = { key: string; value: string; label: string }

export function subdivisionCountItems(row: SubdivisionCounts): SubdivisionCountItem[] {
  const items: SubdivisionCountItem[] = []
  if (row.activeCount != null && row.activeCount >= 1) {
    items.push({
      key: 'active',
      value: row.activeCount.toLocaleString('en-US'),
      label: 'active detached · recorded plat',
    })
  }
  if (row.pendingCount != null && row.pendingCount >= 1) {
    items.push({
      key: 'pending',
      value: row.pendingCount.toLocaleString('en-US'),
      label: 'under contract now',
    })
  }
  if (row.closedCount != null && row.closedCount >= 1) {
    items.push({
      key: 'closed',
      value: row.closedCount.toLocaleString('en-US'),
      label: 'homes sold, last 12 months',
    })
  }
  return items
}

export type SubdivisionExtraItem = {
  key: PublicPlaceSegment
  value: string
  label: string
  bits: string | null
}

function extraLead(
  row: SubdivisionExtraCount,
): { n: number; kind: 'active' | 'pending' | 'closed'; label: string } | null {
  if (row.activeCount != null && row.activeCount >= 1) {
    return {
      n: row.activeCount,
      kind: 'active',
      label: `${publicSegmentNoun(row.segment, row.activeCount)} for sale · recorded plat`,
    }
  }
  if (row.pendingCount != null && row.pendingCount >= 1) {
    return {
      n: row.pendingCount,
      kind: 'pending',
      label: `${publicSegmentNoun(row.segment, row.pendingCount)} under contract now · recorded plat`,
    }
  }
  if (row.closedCount != null && row.closedCount >= 1) {
    return {
      n: row.closedCount,
      kind: 'closed',
      label: `${publicSegmentNoun(row.segment, row.closedCount)} sold in the last 12 months · recorded plat`,
    }
  }
  return null
}

export function subdivisionExtraItems(
  extras: readonly SubdivisionExtraCount[],
): SubdivisionExtraItem[] {
  const items: SubdivisionExtraItem[] = []
  for (const row of extras) {
    const lead = extraLead(row)
    if (!lead) continue
    const bits: string[] = []
    if (lead.kind === 'active') {
      if (row.pendingCount != null && row.pendingCount >= 1) {
        bits.push(`${row.pendingCount.toLocaleString('en-US')} under contract now`)
      }
      if (row.closedCount != null && row.closedCount >= 1) {
        bits.push(`${row.closedCount.toLocaleString('en-US')} sold in the last 12 months`)
      }
    } else if (lead.kind === 'pending') {
      if (row.closedCount != null && row.closedCount >= 1) {
        bits.push(`${row.closedCount.toLocaleString('en-US')} sold in the last 12 months`)
      }
    }
    items.push({
      key: row.segment,
      value: lead.n.toLocaleString('en-US'),
      label: lead.label,
      bits: bits.length ? bits.join(' · ') : null,
    })
  }
  return items
}

export function subdivisionCountsHasRow(row: SubdivisionCounts): boolean {
  return subdivisionCountItems(row).length > 0 || subdivisionExtraItems(row.extras ?? []).length > 0
}

/** The metric inputs for one plat, in a fixed order parseCounts understands. */
function subdivisionCountInputs(slug: string): GetMetricInput[] {
  return [
    { stat: 'active_count', geoType: 'subdivision', geoSlug: slug, segment: 'detached' },
    { stat: 'pending_count', geoType: 'subdivision', geoSlug: slug, segment: 'detached' },
    { stat: 'closed_count', geoType: 'subdivision', geoSlug: slug, segment: 'detached', windowMonths: 12 },
    ...PUBLIC_PLACE_SEGMENTS.flatMap((segment): GetMetricInput[] => [
      { stat: 'active_count', geoType: 'subdivision', geoSlug: slug, segment },
      { stat: 'pending_count', geoType: 'subdivision', geoSlug: slug, segment },
      { stat: 'closed_count', geoType: 'subdivision', geoSlug: slug, segment, windowMonths: 12 },
    ]),
  ]
}

function parseSubdivisionCounts(results: readonly (MetricResult | null)[]): SubdivisionCounts {
  const [active, pending, closed, ...extraRows] = results

  const extras: SubdivisionExtraCount[] = []
  PUBLIC_PLACE_SEGMENTS.forEach((segment, i) => {
    const base = i * 3
    const activeN = publishedCount(extraRows[base]?.isPublishable ? extraRows[base]?.value : null)
    const pendingN = publishedCount(
      extraRows[base + 1]?.isPublishable ? extraRows[base + 1]?.value : null,
    )
    const closedN = publishedCount(
      extraRows[base + 2]?.isPublishable ? extraRows[base + 2]?.value : null,
    )
    if (activeN == null && pendingN == null && closedN == null) return
    extras.push({
      segment,
      activeCount: activeN,
      pendingCount: pendingN,
      closedCount: closedN,
    })
  })

  return {
    activeCount: publishedCount(active?.isPublishable ? active.value : null),
    pendingCount: publishedCount(pending?.isPublishable ? pending.value : null),
    closedCount: publishedCount(closed?.isPublishable ? closed.value : null),
    extras,
  }
}

export async function getSubdivisionCounts(geoSlug: string): Promise<SubdivisionCounts> {
  const slug = geoSlug.trim().toLowerCase()
  if (!slug) return EMPTY_SUBDIVISION_COUNTS
  // ONE getMetrics round trip (it batches by IN-clause) — this used to fire
  // 21 individual getMetric queries per plat, and a parent ledger calling it
  // per child multiplied that into a 250-query storm that held the page
  // stream open for minutes (Larkspur, 2026-09-01).
  const results = await getMetrics(subdivisionCountInputs(slug))
  return parseSubdivisionCounts(results)
}

/**
 * Counts for MANY plats in ONE metric read — the parent-ledger path
 * ("Subdivision 1 has 5 townhomes" needs every child's counts). Returns a map
 * keyed by the normalized slug; a slug with no rows maps to empty counts.
 */
export async function getSubdivisionCountsForSlugs(
  geoSlugs: readonly string[],
): Promise<Map<string, SubdivisionCounts>> {
  const slugs = [...new Set(geoSlugs.map((s) => s.trim().toLowerCase()).filter(Boolean))]
  const out = new Map<string, SubdivisionCounts>()
  if (slugs.length === 0) return out
  const perSlug = subdivisionCountInputs(slugs[0]!).length
  const inputs = slugs.flatMap((slug) => subdivisionCountInputs(slug))
  const results = await getMetrics(inputs)
  slugs.forEach((slug, i) => {
    out.set(slug, parseSubdivisionCounts(results.slice(i * perSlug, (i + 1) * perSlug)))
  })
  return out
}
