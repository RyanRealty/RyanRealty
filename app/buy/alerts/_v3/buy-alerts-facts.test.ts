import { describe, expect, it } from 'vitest'
import { medianPositive } from '@/app/price-drops/_v3/drops-constants'
import { medianDropPctExcludingOutliers, PRICE_DROP_MEDIAN_MAX_PCT } from './buy-alerts-facts'

describe('medianDropPctExcludingOutliers', () => {
  it('drops typo-sized cuts over 50 percent before the median', () => {
    const values = [3.1, 3.3, 2.9, 90]
    expect(medianDropPctExcludingOutliers(values)).toBe(3.1)
    expect(medianPositive(values)).toBe(3.2)
  })

  it('keeps a cut of exactly 50 percent', () => {
    expect(medianDropPctExcludingOutliers([50, 3, 3])).toBe(3)
    expect(medianDropPctExcludingOutliers([50])).toBe(50)
  })

  it('accepts a tighter cap as a parameter so /price-drops stays unfiltered', () => {
    expect(medianDropPctExcludingOutliers([10, 20, 40], 15)).toBe(10)
    expect(PRICE_DROP_MEDIAN_MAX_PCT).toBe(50)
  })

  it('returns null when every cut is an outlier or missing', () => {
    expect(medianDropPctExcludingOutliers([90, 80])).toBeNull()
    expect(medianDropPctExcludingOutliers([null, undefined])).toBeNull()
    expect(medianDropPctExcludingOutliers([])).toBeNull()
  })
})
