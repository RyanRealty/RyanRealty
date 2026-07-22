import { describe, it, expect } from 'vitest'
import { resolveViewedHomePersonId } from './viewed-home-bpo'

describe('resolveViewedHomePersonId', () => {
  it('prefers a valid explicit prop over the route param', () => {
    expect(resolveViewedHomePersonId(42, '99')).toBe(42)
  })

  it('falls back to the route param when no explicit prop', () => {
    expect(resolveViewedHomePersonId(undefined, '123')).toBe(123)
    expect(resolveViewedHomePersonId(null, '123')).toBe(123)
  })

  it('falls back to the route param when the explicit prop is invalid', () => {
    expect(resolveViewedHomePersonId(0, '7')).toBe(7)
    expect(resolveViewedHomePersonId(-5, '7')).toBe(7)
    expect(resolveViewedHomePersonId(1.5, '7')).toBe(7)
    expect(resolveViewedHomePersonId(NaN, '7')).toBe(7)
  })

  it('takes the first entry of an array route param', () => {
    expect(resolveViewedHomePersonId(undefined, ['55', '66'])).toBe(55)
  })

  it('trims whitespace in the route param', () => {
    expect(resolveViewedHomePersonId(undefined, ' 8 ')).toBe(8)
  })

  it('returns null for non-numeric, negative, zero, or missing params', () => {
    expect(resolveViewedHomePersonId(undefined, undefined)).toBeNull()
    expect(resolveViewedHomePersonId(undefined, '')).toBeNull()
    expect(resolveViewedHomePersonId(undefined, 'abc')).toBeNull()
    expect(resolveViewedHomePersonId(undefined, '12abc')).toBeNull()
    expect(resolveViewedHomePersonId(undefined, '-3')).toBeNull()
    expect(resolveViewedHomePersonId(undefined, '0')).toBeNull()
    expect(resolveViewedHomePersonId(undefined, '1.5')).toBeNull()
    expect(resolveViewedHomePersonId(undefined, [])).toBeNull()
  })

  it('rejects unsafe-integer route params', () => {
    expect(resolveViewedHomePersonId(undefined, '9007199254740993')).toBeNull()
  })
})
