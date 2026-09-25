import { describe, expect, it } from 'vitest'
import { CLOSED_COMP_WEIGHT_SHARE_CAP, capClosedCompShares } from '@/lib/pricing/closed-comp-weight'
import { weightedAdjustedPrice } from '@/lib/pricing/reconciliation'
import { salesForBandEndpoints } from '@/lib/pricing/estimate'

describe('comp weight cap and $/sf band-endpoint trim', () => {
  it('Nugget shape: one $491/sf sale cannot keep 75.5% of the weight', () => {
    expect(CLOSED_COMP_WEIGHT_SHARE_CAP).toBe(0.4)
    const raw = [0.755, 0.12, 0.08, 0.045]
    const shares = capClosedCompShares(raw)
    expect(Math.max(...shares)).toBeLessThanOrEqual(CLOSED_COMP_WEIGHT_SHARE_CAP + 1e-9)
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 8)
    const point = weightedAdjustedPrice([
      { adjustedPrice: 980_000, weight: 0.755 },
      { adjustedPrice: 900_000, weight: 0.12 },
      { adjustedPrice: 870_000, weight: 0.08 },
      { adjustedPrice: 850_000, weight: 0.045 },
    ])
    const uncapped = Math.round(980_000 * 0.755 + 900_000 * 0.12 + 870_000 * 0.08 + 850_000 * 0.045)
    expect(point).not.toBe(uncapped)
    expect(point).toBeLessThan(uncapped)
  })

  it('Marshmallow shape: $618/sf $1.5M outlier is trimmed from band endpoints when 4 remain', () => {
    const rows = [
      { id: 'a', ppsfTimeAdjusted: 410, adjustedPrice: 980_000 },
      { id: 'b', ppsfTimeAdjusted: 430, adjustedPrice: 1_020_000 },
      { id: 'c', ppsfTimeAdjusted: 450, adjustedPrice: 1_050_000 },
      { id: 'd', ppsfTimeAdjusted: 618, adjustedPrice: 1_500_000 },
    ]
    const forBand = salesForBandEndpoints(rows)
    expect(forBand.map((r) => r.id)).toEqual(['a', 'b', 'c'])
    expect(forBand.some((r) => r.id === 'd')).toBe(false)
    expect(forBand.length).toBeGreaterThanOrEqual(3)
  })

  it('does not trim when fewer than four sales would remain', () => {
    const rows = [
      { id: 'a', ppsfTimeAdjusted: 400, adjustedPrice: 800_000 },
      { id: 'b', ppsfTimeAdjusted: 410, adjustedPrice: 820_000 },
      { id: 'c', ppsfTimeAdjusted: 600, adjustedPrice: 1_200_000 },
    ]
    expect(salesForBandEndpoints(rows).map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })
})
