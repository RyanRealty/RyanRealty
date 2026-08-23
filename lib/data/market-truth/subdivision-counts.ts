/**
 * Subdivision grain publishes counts only (REGISTRY §4). Prices, MOS, and
 * verdict stay off this grain. getMetric is the read path. Miss omits.
 * Extra product types overlay active / pending / closed counts.
 */
import { getMetric } from '@/lib/data/market-truth/getMetric'
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
      label: 'pending · now',
    })
  }
  if (row.closedCount != null && row.closedCount >= 1) {
    items.push({
      key: 'closed',
      value: row.closedCount.toLocaleString('en-US'),
      label: 'closed sales · 12 months',
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
      label: `${publicSegmentNoun(row.segment, row.pendingCount)} pending · now · recorded plat`,
    }
  }
  if (row.closedCount != null && row.closedCount >= 1) {
    return {
      n: row.closedCount,
      kind: 'closed',
      label: `${publicSegmentNoun(row.segment, row.closedCount)} closed · 12 months · recorded plat`,
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
        bits.push(`${row.pendingCount.toLocaleString('en-US')} pending · now`)
      }
      if (row.closedCount != null && row.closedCount >= 1) {
        bits.push(`${row.closedCount.toLocaleString('en-US')} closed · 12 months`)
      }
    } else if (lead.kind === 'pending') {
      if (row.closedCount != null && row.closedCount >= 1) {
        bits.push(`${row.closedCount.toLocaleString('en-US')} closed · 12 months`)
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

export async function getSubdivisionCounts(geoSlug: string): Promise<SubdivisionCounts> {
  const slug = geoSlug.trim().toLowerCase()
  if (!slug) return EMPTY_SUBDIVISION_COUNTS

  const [active, pending, closed, ...extraRows] = await Promise.all([
    getMetric({
      stat: 'active_count',
      geoType: 'subdivision',
      geoSlug: slug,
      segment: 'detached',
    }),
    getMetric({
      stat: 'pending_count',
      geoType: 'subdivision',
      geoSlug: slug,
      segment: 'detached',
    }),
    getMetric({
      stat: 'closed_count',
      geoType: 'subdivision',
      geoSlug: slug,
      segment: 'detached',
      windowMonths: 12,
    }),
    ...PUBLIC_PLACE_SEGMENTS.flatMap((segment) => [
      getMetric({
        stat: 'active_count',
        geoType: 'subdivision',
        geoSlug: slug,
        segment,
      }),
      getMetric({
        stat: 'pending_count',
        geoType: 'subdivision',
        geoSlug: slug,
        segment,
      }),
      getMetric({
        stat: 'closed_count',
        geoType: 'subdivision',
        geoSlug: slug,
        segment,
        windowMonths: 12,
      }),
    ]),
  ])

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
