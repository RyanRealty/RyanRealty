/**
 * Subdivision grain publishes counts only (REGISTRY §4). Prices, MOS, and
 * verdict stay off this grain. getMetric is the read path. Miss omits.
 * Extra product types are active counts beside the detached strip.
 */
import { getMetric } from '@/lib/data/market-truth/getMetric'
import {
  PUBLIC_PLACE_SEGMENTS,
  publicSegmentNoun,
  type PublicPlaceSegment,
} from '@/lib/data/market-truth/public-segments'

export type SubdivisionExtraCount = {
  segment: PublicPlaceSegment
  activeCount: number
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

export type SubdivisionExtraItem = { key: PublicPlaceSegment; value: string; label: string }

export function subdivisionExtraItems(
  extras: readonly SubdivisionExtraCount[],
): SubdivisionExtraItem[] {
  const items: SubdivisionExtraItem[] = []
  for (const row of extras) {
    if (row.activeCount < 1) continue
    const noun = publicSegmentNoun(row.segment, row.activeCount)
    items.push({
      key: row.segment,
      value: row.activeCount.toLocaleString('en-US'),
      label: `${noun} for sale · recorded plat`,
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
    ...PUBLIC_PLACE_SEGMENTS.map((segment) =>
      getMetric({
        stat: 'active_count',
        geoType: 'subdivision',
        geoSlug: slug,
        segment,
      }),
    ),
  ])

  const extras: SubdivisionExtraCount[] = []
  PUBLIC_PLACE_SEGMENTS.forEach((segment, i) => {
    const n = publishedCount(extraRows[i]?.isPublishable ? extraRows[i]?.value : null)
    if (n != null) extras.push({ segment, activeCount: n })
  })

  return {
    activeCount: publishedCount(active?.isPublishable ? active.value : null),
    pendingCount: publishedCount(pending?.isPublishable ? pending.value : null),
    closedCount: publishedCount(closed?.isPublishable ? closed.value : null),
    extras,
  }
}
