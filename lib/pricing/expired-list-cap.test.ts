import { describe, expect, it } from 'vitest'
import {
  capListBandToFailedAsk,
  failedListAsk,
  isFailedListingStatus,
} from '@/lib/pricing/expired-list-cap'

describe('failed listing status', () => {
  it('treats Expired, Withdrawn, and Canceled as failed, and nothing else', () => {
    expect(isFailedListingStatus('Expired')).toBe(true)
    expect(isFailedListingStatus('withdrawn')).toBe(true)
    expect(isFailedListingStatus('Canceled')).toBe(true)
    expect(isFailedListingStatus('Cancelled')).toBe(true)
    expect(isFailedListingStatus('Active')).toBe(false)
    expect(isFailedListingStatus('Pending')).toBe(false)
    expect(isFailedListingStatus('Closed')).toBe(false)
    expect(isFailedListingStatus(null)).toBe(false)
  })
})

describe('failedListAsk', () => {
  it('returns the last list only when the listing failed to sell', () => {
    expect(failedListAsk({ lastListPrice: 749_900, standardStatus: 'Expired' })).toBe(749_900)
    expect(failedListAsk({ lastListPrice: 749_900, standardStatus: 'Active' })).toBeNull()
    expect(failedListAsk({ lastListPrice: 749_900, standardStatus: 'Closed' })).toBeNull()
    expect(failedListAsk({ lastListPrice: null, standardStatus: 'Expired' })).toBeNull()
  })
})

describe('capListBandToFailedAsk', () => {
  it('does not move a band that already sits at or below the failed ask', () => {
    const out = capListBandToFailedAsk(
      { conservative: 600_000, recommended: 625_000, highEnd: 650_000 },
      749_900,
    )
    expect(out.capped).toBe(false)
    expect(out.recommended).toBe(625_000)
    expect(out.highEnd).toBe(650_000)
  })

  it('never prints a list number above the failed ask', () => {
    const out = capListBandToFailedAsk(
      { conservative: 700_000, recommended: 800_000, highEnd: 875_000 },
      749_900,
    )
    expect(out.capped).toBe(true)
    expect(out.conservative).toBe(700_000)
    expect(out.recommended).toBe(749_900)
    expect(out.highEnd).toBe(749_900)
    expect(out.conservative).toBeLessThanOrEqual(out.recommended)
    expect(out.recommended).toBeLessThanOrEqual(out.highEnd)
  })

  it('collapses the whole band onto the failed ask when comps sit entirely above it', () => {
    const out = capListBandToFailedAsk(
      { conservative: 800_000, recommended: 850_000, highEnd: 900_000 },
      750_000,
    )
    expect(out).toMatchObject({
      conservative: 750_000,
      recommended: 750_000,
      highEnd: 750_000,
      capped: true,
    })
  })

  it('leaves a live or missing cap alone', () => {
    const band = { conservative: 800_000, recommended: 850_000, highEnd: 900_000 }
    expect(capListBandToFailedAsk(band, null).capped).toBe(false)
    expect(capListBandToFailedAsk(band, 0).capped).toBe(false)
    expect(capListBandToFailedAsk(band, null).recommended).toBe(850_000)
  })
})
