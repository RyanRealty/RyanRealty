import { describe, expect, it } from 'vitest'
import { MAX_TIMING_MS, isNonPagePath, parseWebVitalSample } from './web-vitals-sample'

const sample = (over: Record<string, unknown> = {}) => ({
  name: 'LCP',
  value: 2400,
  rating: 'good',
  navigationType: 'navigate',
  path: '/cities/bend',
  device: 'mobile',
  ...over,
})

describe('parseWebVitalSample', () => {
  it('stores a normal page sample with every column', () => {
    expect(parseWebVitalSample(sample())).toEqual({
      ok: true,
      row: {
        metric: 'LCP',
        value: 2400,
        rating: 'good',
        path: '/cities/bend',
        navigation_type: 'navigate',
        device: 'mobile',
      },
    })
  })

  it('accepts the five current vitals, case-insensitively', () => {
    for (const name of ['lcp', 'INP', 'cls', 'FCP', 'ttfb']) {
      expect(parseWebVitalSample(sample({ name, value: name === 'cls' ? 0.08 : 300 })).ok).toBe(true)
    }
  })

  // TRACK-3: Next 16 still calls onFID, so FID reports keep arriving.
  it('drops FID', () => {
    expect(parseWebVitalSample(sample({ name: 'FID', value: 12 }))).toEqual({ ok: false, reason: 'metric' })
  })

  it('drops non-numeric and non-finite values', () => {
    expect(parseWebVitalSample(sample({ value: 'abc' }))).toEqual({ ok: false, reason: 'value' })
    expect(parseWebVitalSample(sample({ value: Infinity }))).toEqual({ ok: false, reason: 'value' })
  })

  it('drops negative values and timings past two minutes instead of capping them', () => {
    expect(parseWebVitalSample(sample({ value: -1 }))).toEqual({ ok: false, reason: 'range' })
    expect(parseWebVitalSample(sample({ value: MAX_TIMING_MS + 1 }))).toEqual({ ok: false, reason: 'range' })
    expect(parseWebVitalSample(sample({ name: 'TTFB', value: 3_600_000 }))).toEqual({ ok: false, reason: 'range' })
    expect(parseWebVitalSample(sample({ value: MAX_TIMING_MS })).ok).toBe(true)
  })

  it('does not apply the millisecond ceiling to unitless CLS', () => {
    expect(parseWebVitalSample(sample({ name: 'CLS', value: 3.2 })).ok).toBe(true)
    expect(parseWebVitalSample(sample({ name: 'CLS', value: -0.1 }))).toEqual({ ok: false, reason: 'range' })
  })

  it('drops framework and API paths (the /_next/image 404 renders)', () => {
    expect(parseWebVitalSample(sample({ path: '/_next/image' }))).toEqual({ ok: false, reason: 'path' })
    expect(parseWebVitalSample(sample({ path: '/api/web-vitals' }))).toEqual({ ok: false, reason: 'path' })
  })

  it('truncates a very long path and nulls missing optional fields', () => {
    const verdict = parseWebVitalSample({ name: 'INP', value: 180, path: `/${'a'.repeat(600)}` })
    expect(verdict.ok).toBe(true)
    if (verdict.ok) {
      expect(verdict.row.path?.length).toBe(512)
      expect(verdict.row.rating).toBeNull()
      expect(verdict.row.device).toBeNull()
    }
  })
})

describe('isNonPagePath', () => {
  it('claims framework and API paths only', () => {
    expect(isNonPagePath('/_next/image')).toBe(true)
    expect(isNonPagePath('/_next/static/chunks/a.js')).toBe(true)
    expect(isNonPagePath('/api')).toBe(true)
    expect(isNonPagePath('/api/visitors/track')).toBe(true)
    expect(isNonPagePath('/')).toBe(false)
    expect(isNonPagePath('/apis-of-bend')).toBe(false)
    expect(isNonPagePath('/homes-for-sale/bend')).toBe(false)
  })
})
