import { describe, expect, it } from 'vitest'
import {
  V3_PRICE_STOPS,
  clamp,
  formatPriceRange,
  formatPriceStop,
  rangeToUrl,
  snapToStops,
  urlToRange,
  valueFromVisualPercent,
  visualPercent,
} from './V3Range.logic'

describe('V3Range.logic', () => {
  it('snaps to the nearest tick, not a linear dollar grid', () => {
    expect(snapToStops(325_000, V3_PRICE_STOPS)).toBe(300_000)
    expect(snapToStops(900_000, V3_PRICE_STOPS)).toBe(1_000_000)
    expect(snapToStops(Number.NaN, V3_PRICE_STOPS)).toBe(0)
  })

  it('spaces ticks evenly so $500K is not a sliver of a $5M axis', () => {
    const i500 = V3_PRICE_STOPS.indexOf(500_000)
    expect(visualPercent(500_000, V3_PRICE_STOPS)).toBeCloseTo(
      (i500 / (V3_PRICE_STOPS.length - 1)) * 100,
      6,
    )
    expect(visualPercent(0, V3_PRICE_STOPS)).toBe(0)
    expect(visualPercent(5_000_000, V3_PRICE_STOPS)).toBe(100)
    // Typed $325K sits between $300K and $400K, not on a linear 6.5%.
    const p = visualPercent(325_000, V3_PRICE_STOPS)
    const a = visualPercent(300_000, V3_PRICE_STOPS)
    const b = visualPercent(400_000, V3_PRICE_STOPS)
    expect(p).toBeGreaterThan(a)
    expect(p).toBeLessThan(b)
  })

  it('pointer percents land on a stop', () => {
    expect(valueFromVisualPercent(0, V3_PRICE_STOPS)).toBe(0)
    expect(valueFromVisualPercent(100, V3_PRICE_STOPS)).toBe(5_000_000)
    expect(valueFromVisualPercent(50, V3_PRICE_STOPS)).toBe(
      V3_PRICE_STOPS[Math.round((V3_PRICE_STOPS.length - 1) / 2)],
    )
  })

  it('omits open ends on the URL so Any/no-max stay honest', () => {
    expect(rangeToUrl(0, 5_000_000, V3_PRICE_STOPS)).toEqual({ min: undefined, max: undefined })
    expect(rangeToUrl(500_000, 5_000_000, V3_PRICE_STOPS)).toEqual({
      min: '500000',
      max: undefined,
    })
    expect(rangeToUrl(0, 750_000, V3_PRICE_STOPS)).toEqual({
      min: undefined,
      max: '750000',
    })
    expect(rangeToUrl(500_000, 1_000_000, V3_PRICE_STOPS)).toEqual({
      min: '500000',
      max: '1000000',
    })
  })

  it('reads a missing bound as the open end, not zero inventory', () => {
    expect(urlToRange(undefined, undefined, V3_PRICE_STOPS)).toEqual({
      low: 0,
      high: 5_000_000,
    })
    expect(urlToRange('500000', undefined, V3_PRICE_STOPS)).toEqual({
      low: 500_000,
      high: 5_000_000,
    })
    expect(urlToRange(undefined, '750000', V3_PRICE_STOPS)).toEqual({
      low: 0,
      high: 750_000,
    })
  })

  it('keeps a typed off-tick figure until the slider commits', () => {
    expect(urlToRange('325000', '1100000', V3_PRICE_STOPS)).toEqual({
      low: 325_000,
      high: 1_100_000,
    })
  })

  it('formats the open ends as Any / plus, not $0–$5,000,000', () => {
    expect(formatPriceStop(0)).toBe('Any')
    expect(formatPriceStop(500_000)).toBe('$500K')
    expect(formatPriceStop(1_500_000)).toBe('$1.5M')
    expect(formatPriceStop(5_000_000)).toBe('$5M+')
    expect(formatPriceRange(0, 5_000_000)).toBe('Any price')
    expect(formatPriceRange(0, 750_000)).toBe('Up to $750K')
    expect(formatPriceRange(500_000, 5_000_000)).toBe('$500K+')
    expect(formatPriceRange(500_000, 1_000_000)).toBe('$500K to $1M')
  })

  it('clamp is a closed interval', () => {
    expect(clamp(3, 0, 10)).toBe(3)
    expect(clamp(-1, 0, 10)).toBe(0)
    expect(clamp(99, 0, 10)).toBe(10)
  })
})
