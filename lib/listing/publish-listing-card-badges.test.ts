import { describe, expect, it } from 'vitest'
import {
  publishListingCardBadges,
  publishListingDropBadge,
  publishOpenHouseBadgeLabel,
} from './publish-listing-card-badges'

describe('publishOpenHouseBadgeLabel', () => {
  it('names the weekday and hour', () => {
    expect(publishOpenHouseBadgeLabel('2026-08-29', '10:00:00')).toBe('Open Sat 10am')
    expect(publishOpenHouseBadgeLabel('2026-08-29', '13:00:00')).toBe('Open Sat 1pm')
  })

  it('keeps the weekday when the hour is missing', () => {
    expect(publishOpenHouseBadgeLabel('2026-08-29')).toBe('Open Sat')
  })

  it('refuses a bare Open with no date', () => {
    expect(publishOpenHouseBadgeLabel(null, '10:00:00')).toBeNull()
    expect(publishOpenHouseBadgeLabel('', null)).toBeNull()
  })
})

describe('publishListingDropBadge', () => {
  it('prints the cut and the date', () => {
    expect(
      publishListingDropBadge({
        lastPriceChangeTimestamp: '2026-08-20',
        priceDropAmount: 25000,
        originalListPrice: 525000,
        listPrice: 500000,
      }),
    ).toBe('−$25K (−4.8%) · Aug 20')
  })

  it('refuses an undated cut', () => {
    expect(
      publishListingDropBadge({
        priceDropAmount: 25000,
        originalListPrice: 525000,
        listPrice: 500000,
      }),
    ).toBeNull()
  })

  it('refuses a date with no amount', () => {
    expect(publishListingDropBadge({ lastPriceChangeTimestamp: '2026-08-20' })).toBeNull()
  })
})

describe('publishListingCardBadges', () => {
  const nowMs = Date.parse('2026-08-29T18:00:00-07:00')

  it('puts Open ahead of New and caps at three', () => {
    const badges = publishListingCardBadges({
      nowMs,
      onMarketDate: '2026-08-28',
      lastPriceChangeTimestamp: '2026-08-20',
      priceDropAmount: 25000,
      originalListPrice: 525000,
      listPrice: 500000,
      hasVirtualTour: true,
      openHouseLabel: 'Open Sat 10am',
    })
    expect(badges.map((b) => b.kind)).toEqual(['open', 'new', 'drop'])
    expect(badges[0]?.label).toBe('Open Sat 10am')
    expect(badges.find((b) => b.kind === 'drop')?.label).toMatch(/−\$25K/)
    expect(badges.find((b) => b.kind === 'drop')?.label).toMatch(/Aug 20/)
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

  it('does not publish a drop from a stale count alone', () => {
    const badges = publishListingCardBadges({
      nowMs,
      priceDropCount: 1,
      priceDropAmount: 25000,
    })
    expect(badges.find((b) => b.kind === 'drop')).toBeUndefined()
  })

  it('rejects a leftover bare Open label', () => {
    const badges = publishListingCardBadges({
      nowMs,
      openHouseLabel: 'Open',
    })
    expect(badges.some((b) => b.kind === 'open')).toBe(false)
  })
})
