import { describe, it, expect } from 'vitest'
import {
  toSavedSearchRow,
  dedupeByFiltersHash,
  type ClaimableGuestAlert,
} from './savedSearches'

function guest(overrides: Partial<ClaimableGuestAlert> = {}): ClaimableGuestAlert {
  return {
    id: 'g1',
    email: 'buyer@example.com',
    filters: { city: 'Bend', minPrice: 400000 },
    filters_hash: 's_abc123',
    name: 'Bend under $600k',
    notification_frequency: 'daily',
    fub_person_id: null,
    ...overrides,
  }
}

describe('toSavedSearchRow', () => {
  it('maps filters, name, hash and frequency onto a row owned by the user', () => {
    const row = toSavedSearchRow(guest(), 'user-uuid-1', 42)
    expect(row).toEqual({
      user_id: 'user-uuid-1',
      name: 'Bend under $600k',
      filters: { city: 'Bend', minPrice: 400000 },
      filters_hash: 's_abc123',
      notification_frequency: 'daily',
      crm_person_id: 42,
    })
  })

  it('passes through a null crm_person_id when none was resolved', () => {
    const row = toSavedSearchRow(guest(), 'user-uuid-1', null)
    expect(row.crm_person_id).toBeNull()
  })

  it('keeps an instant or weekly frequency verbatim', () => {
    expect(toSavedSearchRow(guest({ notification_frequency: 'instant' }), 'u', null).notification_frequency).toBe(
      'instant',
    )
    expect(toSavedSearchRow(guest({ notification_frequency: 'weekly' }), 'u', null).notification_frequency).toBe(
      'weekly',
    )
  })

  it('normalizes an unknown or missing frequency to daily', () => {
    expect(toSavedSearchRow(guest({ notification_frequency: 'hourly' }), 'u', null).notification_frequency).toBe(
      'daily',
    )
    expect(toSavedSearchRow(guest({ notification_frequency: null }), 'u', null).notification_frequency).toBe('daily')
    expect(toSavedSearchRow(guest({ notification_frequency: '  WEEKLY ' }), 'u', null).notification_frequency).toBe(
      'weekly',
    )
  })

  it('falls back to a default name when the guest row has none', () => {
    expect(toSavedSearchRow(guest({ name: null }), 'u', null).name).toBe('Saved search')
    expect(toSavedSearchRow(guest({ name: '   ' }), 'u', null).name).toBe('Saved search')
  })

  it('coerces a null filters object to an empty object (never null)', () => {
    const row = toSavedSearchRow(guest({ filters: null }), 'u', null)
    expect(row.filters).toEqual({})
  })

  it('preserves a null filters_hash so a hashless guest row stays hashless', () => {
    expect(toSavedSearchRow(guest({ filters_hash: null }), 'u', null).filters_hash).toBeNull()
  })
})

describe('dedupeByFiltersHash', () => {
  it('keeps only the first row for a repeated hash', () => {
    const rows = [
      { id: 'a', filters_hash: 's_1' },
      { id: 'b', filters_hash: 's_1' },
      { id: 'c', filters_hash: 's_2' },
    ]
    expect(dedupeByFiltersHash(rows).map((r) => r.id)).toEqual(['a', 'c'])
  })

  it('preserves input order', () => {
    const rows = [
      { id: 'c', filters_hash: 's_3' },
      { id: 'a', filters_hash: 's_1' },
      { id: 'b', filters_hash: 's_3' },
    ]
    expect(dedupeByFiltersHash(rows).map((r) => r.id)).toEqual(['c', 'a'])
  })

  it('always keeps rows with a null or blank hash (cannot be matched)', () => {
    const rows = [
      { id: 'a', filters_hash: null },
      { id: 'b', filters_hash: '' },
      { id: 'c', filters_hash: '   ' },
      { id: 'd', filters_hash: 's_1' },
      { id: 'e', filters_hash: 's_1' },
    ]
    expect(dedupeByFiltersHash(rows).map((r) => r.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('treats a hash with surrounding whitespace as the same hash', () => {
    const rows = [
      { id: 'a', filters_hash: 's_1' },
      { id: 'b', filters_hash: '  s_1  ' },
    ]
    expect(dedupeByFiltersHash(rows).map((r) => r.id)).toEqual(['a'])
  })

  it('returns an empty array for empty input', () => {
    expect(dedupeByFiltersHash([])).toEqual([])
  })
})
