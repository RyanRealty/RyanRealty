import { describe, expect, it } from 'vitest'
import { compactOrExactLabels, compactOrExactUsd, compactUsd } from '@/lib/cma/compact-usd'

describe('compactOrExactUsd', () => {
  it('prints the dollars when the short label would name a different price (2799 Aldrich, 2058 Hollow Tree)', () => {
    expect(compactOrExactUsd(524_900)).toBe('$524,900')
    expect(compactOrExactUsd(514_500)).toBe('$514,500')
    // A real $525,000 ask keeps the short label. It is that price.
    expect(compactOrExactUsd(525_000)).toBe('$525K')
    expect(compactOrExactUsd(520_000)).toBe('$520K')
    expect(compactOrExactUsd(503_000)).toBe('$503K')
    expect(compactOrExactUsd(1_050_000)).toBe('$1.05M')
    expect(compactOrExactUsd(1_785_000)).toBe('$1,785,000')
    // Chart axes stay short. $465,400 may still read $465K there.
    expect(compactUsd(524_900)).toBe('$525K')
    expect(compactUsd(514_500)).toBe('$515K')
    expect(compactUsd(465_400)).toBe('$465K')
  })

  it('gives two asks on one chip two labels, and does not rename a round ask', () => {
    const aldrich = compactOrExactLabels([524_900, 520_000])
    expect(aldrich(524_900)).toBe('$524,900')
    expect(aldrich(520_000)).toBe('$520K')
    const spring = compactOrExactLabels([525_000, 505_000])
    expect(spring(525_000)).toBe('$525K')
    expect(spring(505_000)).toBe('$505K')
    const hollow = compactOrExactLabels([514_500, 514_500])
    expect(hollow(514_500)).toBe('$514,500')
  })
})
