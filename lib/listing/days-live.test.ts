import { describe, expect, it } from 'vitest'

import { daysLiveOnMarket } from './days-live'

/**
 * The case that produced this file. Live on 2026-09-08, the listing page
 * published "26 days on market" for a home whose OnMarketDate is
 * 2026-08-12 20:11:48+00 — while the citation printed beside it said
 * "OnMarketDate 2026-08-12", from which a reader counts 27.
 */
const AFTERNOON_LISTING = '2026-08-12T20:11:48+00:00'

describe('daysLiveOnMarket', () => {
  it('counts calendar days, not elapsed 24-hour periods', () => {
    // Morning of Sep 8 Pacific: only 26 x 24h have elapsed since 1:11pm on
    // Aug 12, but the home has been on the market since August 12.
    expect(daysLiveOnMarket(AFTERNOON_LISTING, new Date('2026-09-08T16:00:00Z'))).toBe(27)
    // Later the same Pacific day the answer must not change.
    expect(daysLiveOnMarket(AFTERNOON_LISTING, new Date('2026-09-09T02:00:00Z'))).toBe(27)
  })

  it('reads the same number a reader gets from the citation date', () => {
    const now = new Date('2026-09-08T16:00:00Z')
    const fromDateOnly = daysLiveOnMarket('2026-08-12', now)
    expect(daysLiveOnMarket(AFTERNOON_LISTING, now)).toBe(fromDateOnly)
  })

  it('counts the day a home reaches the market as day 0, and the next day as 1', () => {
    // 9am Pacific on the 12th, read at 8pm Pacific the same day.
    expect(daysLiveOnMarket('2026-08-12T16:00:00Z', new Date('2026-08-13T03:00:00Z'))).toBe(0)
    // Read the next Pacific morning.
    expect(daysLiveOnMarket('2026-08-12T16:00:00Z', new Date('2026-08-13T16:00:00Z'))).toBe(1)
  })

  it('uses the Oregon civil day, so a late-evening listing is not counted a day early', () => {
    // 2026-08-13T02:00Z is 7pm Pacific on August 12.
    const evening = '2026-08-13T02:00:00Z'
    expect(daysLiveOnMarket(evening, new Date('2026-08-14T16:00:00Z'))).toBe(2)
  })

  it('returns null rather than a fallback when there is no on-market date', () => {
    expect(daysLiveOnMarket(null)).toBeNull()
    expect(daysLiveOnMarket(undefined)).toBeNull()
    expect(daysLiveOnMarket('')).toBeNull()
    expect(daysLiveOnMarket('not a date')).toBeNull()
  })

  it('rejects a record dated after today and one eleven years old', () => {
    expect(daysLiveOnMarket('2026-09-10T00:00:00Z', new Date('2026-09-08T16:00:00Z'))).toBeNull()
    expect(daysLiveOnMarket('2010-01-01T00:00:00Z', new Date('2026-09-08T16:00:00Z'))).toBeNull()
  })
})
