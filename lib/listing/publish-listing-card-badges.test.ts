import { describe, expect, it } from 'vitest'
import {
  publishListingCardBadges,
  publishOpenHouseBadgeLabel,
} from './publish-listing-card-badges'

describe('publishOpenHouseBadgeLabel', () => {
  it('names the weekday and hour', () => {
    expect(publishOpenHouseBadgeLabel('2026-08-29', '10:00:00')).toBe('Open Sat 10am')
    expect(publishOpenHouseBadgeLabel('2026-08-29', '13:00:00')).toBe('Open Sat 1pm')
  })
})

describe('publishListingCardBadges', () => {
  const nowMs = Date.parse('2026-08-29T18:00:00-07:00')

  it('puts Open ahead of New and caps at three', () => {
    const badges = publishListingCardBadges({
      nowMs,
      onMarketDate: '2026-08-28',
      priceDropCount: 1,
      hasVirtualTour: true,
      openHouseLabel: 'Open Sat 10am',
    })
    expect(badges.map((b) => b.kind)).toEqual(['open', 'new', 'drop'])
    expect(badges[0]?.label).toBe('Open Sat 10am')
    expect(badges.find((b) => b.kind === 'drop')?.label).toBe('Price reduced')
  })

  it('status beats marketing badges', () => {
    const badges = publishListingCardBadges({
      nowMs,
      standardStatus: 'Pending',
      openHouseLabel: 'Open Sat',
    })
    expect(badges[0]).toEqual({ kind: 'pending', label: 'Pending' })
    expect(badges.some((b) => b.kind === 'open')).toBe(true)
  })

  it('prints Redfin Price reduced copy with the dollar drop when we have it', () => {
    const badges = publishListingCardBadges({
      nowMs,
      priceDropCount: 1,
      priceDropAmount: 25000,
    })
    expect(badges).toEqual([{ kind: 'drop', label: 'Price reduced $25K' }])
  })
})
