/**
 * One published status label for search chrome and listing cards.
 *
 * SEO preset routes (`/homes-for-sale/{city}/{place}/pending`) already filter
 * the set. The chip and the cards must name that status. Hardcoding "For Sale"
 * and omitting Pending on the card is the same class of lie.
 *
 * Fleet finding 2026-08-17: Awbrey Butte pending heading + 29 pending sales,
 * chip still For Sale, no card showed Pending
 * (fleet 009a30599d628b93f6f094b1cbe63595).
 */
import { classifyListingStatus } from '@/lib/format/listing-status'

export const SEARCH_STATUS_FILTER_CHIPS = [
  { value: 'active', label: 'For Sale' },
  { value: 'active_and_pending', label: 'Active + under contract' },
  { value: 'pending', label: 'Under contract only' },
  { value: 'closed', label: 'Sold' },
  { value: 'all', label: 'All statuses' },
] as const

export type SearchStatusFilter = (typeof SEARCH_STATUS_FILTER_CHIPS)[number]['value']

export type PublishedListingStatusBadge = {
  kind: 'pending' | 'sold'
  label: string
}

export function publishSearchStatusChip(statusFilter?: string | null): string {
  const key = (statusFilter ?? 'active').trim().toLowerCase()
  return SEARCH_STATUS_FILTER_CHIPS.find((option) => option.value === key)?.label ?? 'For Sale'
}

export function publishListingStatusBadge(
  standardStatus?: string | null,
): PublishedListingStatusBadge | null {
  const kind = classifyListingStatus(standardStatus)
  if (kind === 'pending') return { kind: 'pending', label: 'Pending' }
  if (kind === 'contract') return { kind: 'pending', label: 'Under contract' }
  if (kind === 'closed') return { kind: 'sold', label: 'Sold' }
  return null
}
