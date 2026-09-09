/**
 * The comparative mark's arithmetic (SITE-44). The band describes the homes in
 * view; these are the rules that keep it from describing anything else.
 */
import { describe, expect, it } from 'vitest'
import { bandLabel, bandPosition, buildPpsfBand, quantile } from '@/components/search/ppsf-band'

describe('quantile', () => {
  it('interpolates between the two straddling values', () => {
    expect(quantile([100, 200, 300, 400], 0.25)).toBe(175)
    expect(quantile([100, 200, 300, 400], 0.75)).toBe(325)
    expect(quantile([100, 200, 300], 0.5)).toBe(200)
  })

  it('has an answer for a one-value set and none for an empty one', () => {
    expect(quantile([260], 0.25)).toBe(260)
    expect(Number.isNaN(quantile([], 0.5))).toBe(true)
  })
})

describe('buildPpsfBand', () => {
  it('drops nulls, zeroes and non-numbers before it measures anything', () => {
    const band = buildPpsfBand([300, null, 0, undefined, 200, Number.NaN, 400, 100])
    expect(band).toEqual({ min: 100, max: 400, q1: 175, q3: 325, n: 4 })
  })

  it('refuses a set too small to describe', () => {
    expect(buildPpsfBand([200, 300, 400])).toBeNull()
    expect(buildPpsfBand([])).toBeNull()
  })

  it('refuses a set with no width — a band of zero span is decoration', () => {
    expect(buildPpsfBand([250, 250, 250, 250, 250])).toBeNull()
  })
})

describe('bandPosition', () => {
  const band = { min: 100, max: 500, q1: 200, q3: 400, n: 12 }

  it('places the ends at the ends and the middle in the middle', () => {
    expect(bandPosition(band, 100)).toBe(0)
    expect(bandPosition(band, 500)).toBe(100)
    expect(bandPosition(band, 300)).toBe(50)
  })

  it('never escapes the track', () => {
    expect(bandPosition(band, 10)).toBe(0)
    expect(bandPosition(band, 9000)).toBe(100)
  })
})

describe('bandLabel', () => {
  const band = { min: 100, max: 500, q1: 200, q3: 400, n: 12 }

  it('says which side of the middle half the home sits on', () => {
    expect(bandLabel(band, 150)).toContain('below the middle half')
    expect(bandLabel(band, 300)).toContain('inside the middle half')
    expect(bandLabel(band, 450)).toContain('above the middle half')
    expect(bandLabel(band, 450)).toContain('$450 per sq ft')
  })

  it('names the population it is comparing against, not the whole market', () => {
    expect(bandLabel(band, 300)).toContain('the 12 homes in view')
  })

  it('says plainly when a home cannot be placed at all', () => {
    expect(bandLabel(band, null)).toContain('does not report a living area')
  })
})
