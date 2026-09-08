import { describe, it, expect } from 'vitest'
import { daysLiveOnMarket } from './days-live'

const NOW = new Date('2026-09-08T12:00:00Z')

describe('daysLiveOnMarket · one definition for both surfaces', () => {
  it('counts whole days from the on-market date', () => {
    expect(daysLiveOnMarket('2026-05-21T00:00:00Z', NOW)).toBe(110)
  })

  it('is null with no date, so the caller prints nothing rather than the banned field', () => {
    expect(daysLiveOnMarket(null, NOW)).toBeNull()
    expect(daysLiveOnMarket(undefined, NOW)).toBeNull()
    expect(daysLiveOnMarket('not a date', NOW)).toBeNull()
  })

  it('refuses a record dated after today and one eleven years old', () => {
    expect(daysLiveOnMarket('2026-09-09T00:00:00Z', NOW)).toBeNull()
    expect(daysLiveOnMarket('2000-01-01T00:00:00Z', NOW)).toBeNull()
  })

  it('is zero on the day it listed, not one', () => {
    expect(daysLiveOnMarket('2026-09-08T00:00:00Z', NOW)).toBe(0)
  })
})
