import { describe, expect, it } from 'vitest'
import { applyFailedAskCap, FAILED_ASK_BACKTEST } from '@/lib/cma/expired-audit'
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

  it('Murphy shape: 39.2% max share is already under the cap; failed-ask rec stays $716k', () => {
    // Stored closed-comp weights on cma-20506-murphy (read-only dump 2026-09-25).
    const raw = [0.4234, 0.3563, 0.1285, 0.113, 0.0583]
    const total = raw.reduce((a, b) => a + b, 0)
    const uncapped = raw.map((w) => w / total)
    expect(Math.max(...uncapped)).toBeLessThanOrEqual(CLOSED_COMP_WEIGHT_SHARE_CAP)
    const shares = capClosedCompShares(raw)
    expect(Math.max(...shares)).toBeCloseTo(Math.max(...uncapped), 8)
    shares.forEach((s, i) => expect(s).toBeCloseTo(uncapped[i]!, 8))

    const point = weightedAdjustedPrice([
      { adjustedPrice: 696_334, weight: 0.4234 },
      { adjustedPrice: 693_608, weight: 0.3563 },
      { adjustedPrice: 735_000, weight: 0.1285 },
      { adjustedPrice: 735_000, weight: 0.113 },
      { adjustedPrice: 725_000, weight: 0.0583 },
    ])
    // Weighted mid of the stored comps is not the published rec. Murphy's
    // $716k is the failed-ask p75 of the $729k ask against band $693k–$735k.
    expect(point).toBeGreaterThan(700_000)
    expect(point).toBeLessThan(716_000)

    const x = {
      conservative: 693_000,
      recommended: 803_000,
      highEnd: 735_000,
      valueLow: 693_000,
      valueHigh: 735_000,
      needsReview: false,
      reviewReason: null as string | null,
      notes: [] as string[],
    }
    const off = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString()
    const r = applyFailedAskCap(x, { lastFailedListPrice: 729_000, offMarketDate: off })
    expect(r.applied).toBe(true)
    expect(x.recommended).toBe(716_000)
    expect(x.recommended).toBe(
      Math.round((729_000 * FAILED_ASK_BACKTEST.closeP75Ratio) / 1000) * 1000,
    )
    expect(x.valueLow).toBe(693_000)
    expect(x.valueHigh).toBe(735_000)
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
