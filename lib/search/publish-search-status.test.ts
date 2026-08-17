import { describe, expect, it } from 'vitest'
import {
  publishListingStatusBadge,
  publishSearchStatusChip,
  SEARCH_STATUS_FILTER_CHIPS,
} from './publish-search-status'

describe('publishSearchStatusChip', () => {
  it('names the pending preset Under contract only', () => {
    expect(publishSearchStatusChip('pending')).toBe('Under contract only')
    expect(SEARCH_STATUS_FILTER_CHIPS.find((o) => o.value === 'pending')?.label).toBe(
      'Under contract only',
    )
  })

  it('keeps For Sale as the active default', () => {
    expect(publishSearchStatusChip()).toBe('For Sale')
    expect(publishSearchStatusChip('active')).toBe('For Sale')
    expect(publishSearchStatusChip('unknown')).toBe('For Sale')
  })

  it('names sold and mixed scopes', () => {
    expect(publishSearchStatusChip('closed')).toBe('Sold')
    expect(publishSearchStatusChip('active_and_pending')).toBe('Active + under contract')
    expect(publishSearchStatusChip('all')).toBe('All statuses')
  })
})

describe('publishListingStatusBadge', () => {
  it('stamps Pending and Under contract', () => {
    expect(publishListingStatusBadge('Pending')).toEqual({ kind: 'pending', label: 'Pending' })
    expect(publishListingStatusBadge('Active Under Contract')).toEqual({
      kind: 'pending',
      label: 'Under contract',
    })
  })

  it('stamps Sold and withholds Active', () => {
    expect(publishListingStatusBadge('Closed')).toEqual({ kind: 'sold', label: 'Sold' })
    expect(publishListingStatusBadge('Active')).toBeNull()
    expect(publishListingStatusBadge(null)).toBeNull()
  })
})
