import { describe, expect, it } from 'vitest'
import {
  SOLD_ATTRIBUTION_TRUSTED_GRAINS,
  SOLD_ATTRIBUTION_UNTRUSTED_GRAINS,
  isSoldAttributionTrusted,
  publishSoldCount,
} from './geo-grain-trust'

describe('sold-attribution trust registry', () => {
  it('trusts only the grains whose writer attributes actives and closes together', () => {
    // refresh_market_pulse() reads public.listings once, under one predicate,
    // for both sides of the ratio. Those two are the whole trusted set.
    expect([...SOLD_ATTRIBUTION_TRUSTED_GRAINS].sort()).toEqual(['city', 'region'])
  })

  it('does not trust neighborhood, the grain refresh_community_market_pulse writes', () => {
    expect(isSoldAttributionTrusted('neighborhood')).toBe(false)
    expect(SOLD_ATTRIBUTION_UNTRUSTED_GRAINS).toContain('neighborhood')
  })

  it('is default-deny, so an unlisted or missing grain publishes nothing', () => {
    expect(isSoldAttributionTrusted(null)).toBe(false)
    expect(isSoldAttributionTrusted(undefined)).toBe(false)
    for (const grain of SOLD_ATTRIBUTION_UNTRUSTED_GRAINS) {
      expect(isSoldAttributionTrusted(grain)).toBe(false)
    }
  })

  it('the two sets do not overlap', () => {
    for (const grain of SOLD_ATTRIBUTION_TRUSTED_GRAINS) {
      expect(SOLD_ATTRIBUTION_UNTRUSTED_GRAINS).not.toContain(grain)
    }
  })
})

describe('publishSoldCount', () => {
  it('withholds the neighborhood 12-month count that published as 3 against 72 real sales', () => {
    expect(publishSoldCount({ value: 3, grain: 'neighborhood' })).toBeNull()
  })

  it('publishes the same figure at a trusted grain', () => {
    expect(publishSoldCount({ value: 3, grain: 'city' })).toBe(3)
    expect(publishSoldCount({ value: 272, grain: 'region' })).toBe(272)
  })

  it('withholds a missing, non-finite, or negative count at any grain', () => {
    expect(publishSoldCount({ value: null, grain: 'city' })).toBeNull()
    expect(publishSoldCount({ value: undefined, grain: 'city' })).toBeNull()
    expect(publishSoldCount({ value: Number.NaN, grain: 'city' })).toBeNull()
    expect(publishSoldCount({ value: -1, grain: 'city' })).toBeNull()
  })

  it('publishes a real zero at a trusted grain rather than treating it as missing', () => {
    expect(publishSoldCount({ value: 0, grain: 'city' })).toBe(0)
  })
})
