/**
 * Subdivision grain publishes counts only (REGISTRY §4). Prices, MOS, and
 * verdict stay off this grain. getMetric is the read path. Miss omits.
 */
import { getMetric } from '@/lib/data/market-truth/getMetric'

export type SubdivisionCounts = {
  activeCount: number | null
  pendingCount: number | null
  closedCount: number | null
}

export const EMPTY_SUBDIVISION_COUNTS: SubdivisionCounts = {
  activeCount: null,
  pendingCount: null,
  closedCount: null,
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

export function subdivisionCountsHasRow(row: SubdivisionCounts): boolean {
  return subdivisionCountItems(row).length > 0
}

export async function getSubdivisionCounts(geoSlug: string): Promise<SubdivisionCounts> {
  const slug = geoSlug.trim().toLowerCase()
  if (!slug) return EMPTY_SUBDIVISION_COUNTS

  const [active, pending, closed] = await Promise.all([
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
  ])

  return {
    activeCount: publishedCount(active?.isPublishable ? active.value : null),
    pendingCount: publishedCount(pending?.isPublishable ? pending.value : null),
    closedCount: publishedCount(closed?.isPublishable ? closed.value : null),
  }
}
