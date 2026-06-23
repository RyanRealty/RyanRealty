import { describe, it, expect } from 'vitest'
import {
  humanizeSearchCriteria,
  buildSearchUrl,
  mergeListingAlertRows,
} from './getContactListingAlerts'
import { buildSearchUrlFromFilters } from '@/lib/search-filters'

describe('humanizeSearchCriteria', () => {
  it('builds the canonical sentence: place, price range, beds, baths', () => {
    expect(
      humanizeSearchCriteria({ city: 'Bend', minPrice: 400000, maxPrice: 800000, beds: 3, baths: 2 }),
    ).toBe('Homes in Bend, $400k-$800k, 3+ beds, 2+ baths')
  })

  it('formats a price range with the city only', () => {
    expect(humanizeSearchCriteria({ city: 'Redmond', minPrice: 500000, maxPrice: 1000000 })).toBe(
      'Homes in Redmond, $500k-$1m',
    )
  })

  it('handles an open-ended min-only price', () => {
    expect(humanizeSearchCriteria({ minPrice: 600000 })).toBe('Homes, $600k+')
  })

  it('handles an open-ended max-only price', () => {
    expect(humanizeSearchCriteria({ maxPrice: 750000 })).toBe('Homes, under $750k')
  })

  it('formats millions with one decimal when not a whole number', () => {
    expect(humanizeSearchCriteria({ minPrice: 1250000, maxPrice: 2000000 })).toBe(
      'Homes, $1.3m-$2m',
    )
  })

  it('renders beds and baths without a place or price', () => {
    expect(humanizeSearchCriteria({ beds: 4, baths: 3 })).toBe('Homes, 4+ beds, 3+ baths')
  })

  it('puts a subdivision inside its city', () => {
    expect(humanizeSearchCriteria({ city: 'Bend', subdivision: 'Tetherow' })).toBe(
      'Homes in Tetherow, Bend',
    )
  })

  it('falls back to postal code when no city or subdivision', () => {
    expect(humanizeSearchCriteria({ postalCode: '97701', beds: 2 })).toBe(
      'Homes in 97701, 2+ beds',
    )
  })

  it('appends only the true feature flags', () => {
    expect(
      humanizeSearchCriteria({ city: 'Sunriver', hasView: true, hasPool: false, hasGolfCourse: true }),
    ).toBe('Homes in Sunriver, view, golf course')
  })

  it('reads string-encoded numbers and booleans (jsonb may store either)', () => {
    expect(
      humanizeSearchCriteria({ city: 'Bend', minPrice: '400000', beds: '3', hasWaterfront: 'true' }),
    ).toBe('Homes in Bend, $400k+, 3+ beds, waterfront')
  })

  it('ignores zero / non-positive beds and baths', () => {
    expect(humanizeSearchCriteria({ city: 'Bend', beds: 0, baths: 0 })).toBe('Homes in Bend')
  })

  it('returns a sensible default for an empty filter set', () => {
    expect(humanizeSearchCriteria({})).toBe('All homes')
  })
})

describe('buildSearchUrl', () => {
  it('matches the canonical buildSearchUrlFromFilters convention', () => {
    const filters = { city: 'Bend', minPrice: 400000, maxPrice: 800000, beds: 3 }
    expect(buildSearchUrl(filters)).toBe(buildSearchUrlFromFilters(filters))
  })

  it('produces a stable deep link for a city + price search', () => {
    const url = buildSearchUrl({ city: 'Bend', minPrice: 400000, maxPrice: 800000 })
    expect(url).toContain('minPrice=400000')
    expect(url).toContain('maxPrice=800000')
  })

  it('returns a non-empty browse path for an empty filter set', () => {
    expect(buildSearchUrl({}).startsWith('/')).toBe(true)
  })
})

describe('mergeListingAlertRows', () => {
  const savedRow = {
    id: 'saved-1',
    user_id: 'auth-uuid',
    name: 'Bend under 800k',
    filters: { city: 'Bend', minPrice: 400000, maxPrice: 800000, beds: 3 } as Record<string, unknown>,
    notification_frequency: 'daily',
    is_paused: false,
  }
  const guestRow = {
    id: 'guest-1',
    email: 'lead@example.com',
    filters: { city: 'Redmond', beds: 2 } as Record<string, unknown>,
    name: null,
    notification_frequency: 'weekly',
    is_active: true,
    last_notified_at: null,
    unsubscribe_token: 'tok-1',
    fub_person_id: 42,
  }

  it('unions saved searches and guest alerts into one list', () => {
    const out = mergeListingAlertRows([savedRow], [guestRow])
    expect(out).toHaveLength(2)
    expect(out[0].source).toBe('saved-search')
    expect(out[1].source).toBe('guest-alert')
  })

  it('humanizes + deep-links each row and carries cadence', () => {
    const [saved] = mergeListingAlertRows([savedRow], [])
    expect(saved.criteriaText).toBe('Homes in Bend, $400k-$800k, 3+ beds')
    expect(saved.label).toBe('Bend under 800k')
    expect(saved.url).toBe(buildSearchUrl(savedRow.filters))
    expect(saved.cadence).toBe('daily')
  })

  it('normalizes active: saved-search uses !is_paused', () => {
    const [active] = mergeListingAlertRows([{ ...savedRow, is_paused: false }], [])
    const [paused] = mergeListingAlertRows([{ ...savedRow, is_paused: true }], [])
    expect(active.active).toBe(true)
    expect(paused.active).toBe(false)
  })

  it('normalizes active: guest-alert uses is_active directly (not backwards)', () => {
    const [on] = mergeListingAlertRows([], [{ ...guestRow, is_active: true }])
    const [off] = mergeListingAlertRows([], [{ ...guestRow, is_active: false }])
    expect(on.active).toBe(true)
    expect(off.active).toBe(false)
  })

  it('falls back to humanized criteria when a guest alert has no name', () => {
    const [guest] = mergeListingAlertRows([], [guestRow])
    expect(guest.label).toBe('Homes in Redmond, 2+ beds')
  })

  it('dedupes a guest alert that duplicates a signed-in saved search (saved wins)', () => {
    const sameFilters = { city: 'Bend', minPrice: 400000, maxPrice: 800000, beds: 3 }
    const dupeGuest = { ...guestRow, id: 'guest-dupe', filters: sameFilters as Record<string, unknown> }
    const out = mergeListingAlertRows([savedRow], [dupeGuest])
    expect(out).toHaveLength(1)
    expect(out[0].source).toBe('saved-search')
    expect(out[0].id).toBe('saved-1')
  })

  it('returns an empty list when neither source has rows', () => {
    expect(mergeListingAlertRows([], [])).toEqual([])
  })
})
