import { describe, it, expect } from 'vitest'
import { inferListingState, type ListingStateSignals } from './listing-state'

const NOW = new Date('2026-07-31T12:00:00Z')

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 86_400_000)
}

function signals(overrides: Partial<ListingStateSignals>): ListingStateSignals {
  return { hasListingRow: true, standardStatus: 'Active', now: NOW, ...overrides }
}

describe('inferListingState', () => {
  it('no listings row + fresh shoot -> pre_market', () => {
    const r = inferListingState(signals({ hasListingRow: false, freshShootAvailable: true }))
    expect(r.state).toBe('pre_market')
    expect(r.suggestion).toMatch(/coming soon|just-listed/i)
  })

  it('no listings row + nothing to work from -> unknown, asks for the address', () => {
    const r = inferListingState(signals({ hasListingRow: false, freshShootAvailable: false }))
    expect(r.state).toBe('unknown')
    expect(r.suggestion).toMatch(/address/i)
  })

  it('StandardStatus = Coming Soon -> coming_soon', () => {
    const r = inferListingState(signals({ standardStatus: 'Coming Soon' }))
    expect(r.state).toBe('coming_soon')
  })

  it('StandardStatus is case/spacing insensitive for Coming Soon', () => {
    expect(inferListingState(signals({ standardStatus: 'ComingSoon' })).state).toBe('coming_soon')
    expect(inferListingState(signals({ standardStatus: 'coming   soon' })).state).toBe('coming_soon')
  })

  it('OnMarketDate <= 7 days -> just_listed', () => {
    const r = inferListingState(signals({ standardStatus: 'Active', onMarketDate: daysAgo(3) }))
    expect(r.state).toBe('just_listed')
  })

  it('OnMarketDate exactly 7 days ago is still just_listed (inclusive boundary)', () => {
    const r = inferListingState(signals({ standardStatus: 'Active', onMarketDate: daysAgo(7) }))
    expect(r.state).toBe('just_listed')
  })

  it('OnMarketDate 8 days ago is past the just_listed window', () => {
    const r = inferListingState(signals({ standardStatus: 'Active', onMarketDate: daysAgo(8) }))
    expect(r.state).not.toBe('just_listed')
  })

  it('recent price change (outside the just_listed window) -> price_improvement', () => {
    const r = inferListingState(
      signals({ standardStatus: 'Active', onMarketDate: daysAgo(30), recentPriceChange: true }),
    )
    expect(r.state).toBe('price_improvement')
  })

  it('just_listed wins over a simultaneous price change (table order)', () => {
    const r = inferListingState(
      signals({ standardStatus: 'Active', onMarketDate: daysAgo(2), recentPriceChange: true }),
    )
    expect(r.state).toBe('just_listed')
  })

  it('Pending -> under_contract', () => {
    expect(inferListingState(signals({ standardStatus: 'Pending' })).state).toBe('under_contract')
  })

  it('Active Under Contract -> under_contract', () => {
    expect(inferListingState(signals({ standardStatus: 'Active Under Contract' })).state).toBe('under_contract')
  })

  it('Closed -> just_sold', () => {
    expect(inferListingState(signals({ standardStatus: 'Closed' })).state).toBe('just_sold')
  })

  it.each(['Withdrawn', 'Expired', 'Canceled', 'Cancelled'])('%s -> dead', (status) => {
    expect(inferListingState(signals({ standardStatus: status })).state).toBe('dead')
  })

  it('NULL StandardStatus -> unknown, never assumed active', () => {
    const r = inferListingState(signals({ standardStatus: null, onMarketDate: daysAgo(1) }))
    expect(r.state).toBe('unknown')
  })

  it('undefined StandardStatus -> unknown', () => {
    const r = inferListingState(signals({ standardStatus: undefined }))
    expect(r.state).toBe('unknown')
  })

  it('empty-string StandardStatus -> unknown', () => {
    const r = inferListingState(signals({ standardStatus: '   ' }))
    expect(r.state).toBe('unknown')
  })

  it('Active with no special signal -> active (plain, no gate)', () => {
    const r = inferListingState(signals({ standardStatus: 'Active', onMarketDate: daysAgo(90) }))
    expect(r.state).toBe('active')
  })

  it('an unparseable OnMarketDate does not throw and falls through to active', () => {
    const r = inferListingState(signals({ standardStatus: 'Active', onMarketDate: 'not-a-date' }))
    expect(r.state).toBe('active')
  })

  it('every branch returns a non-empty broker-facing suggestion', () => {
    const cases: ListingStateSignals[] = [
      signals({ hasListingRow: false, freshShootAvailable: true }),
      signals({ hasListingRow: false, freshShootAvailable: false }),
      signals({ standardStatus: 'Coming Soon' }),
      signals({ standardStatus: 'Pending' }),
      signals({ standardStatus: 'Closed' }),
      signals({ standardStatus: 'Withdrawn' }),
      signals({ standardStatus: null }),
      signals({ standardStatus: 'Active', onMarketDate: daysAgo(1) }),
      signals({ standardStatus: 'Active', onMarketDate: daysAgo(30), recentPriceChange: true }),
      signals({ standardStatus: 'Active', onMarketDate: daysAgo(90) }),
    ]
    for (const s of cases) {
      const r = inferListingState(s)
      expect(r.suggestion.length).toBeGreaterThan(0)
    }
  })
})
