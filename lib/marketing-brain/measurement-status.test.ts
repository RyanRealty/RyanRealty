import { describe, expect, it } from 'vitest'
import { contentPerformanceHasMetrics } from './measurement-status'

describe('contentPerformanceHasMetrics', () => {
  it('rejects a publisher-sweep seed row with no window metrics', () => {
    expect(contentPerformanceHasMetrics({})).toBe(false)
    expect(contentPerformanceHasMetrics({ metrics_48h: null, metrics_7d: null, metrics_30d: null })).toBe(false)
  })

  it('accepts any populated window', () => {
    expect(contentPerformanceHasMetrics({ metrics_48h: { impressions: 12 } })).toBe(true)
    expect(contentPerformanceHasMetrics({ metrics_7d: { views: 3 } })).toBe(true)
    expect(contentPerformanceHasMetrics({ metrics_30d: { clicks: 1 } })).toBe(true)
  })
})
