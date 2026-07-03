import { describe, it, expect } from 'vitest'
import { canonicalTagsToAdd, deriveOccupancyLocation } from './tag-canonical'

describe('tag-canonical: go-forward auto-tagger (additive only)', () => {
  it('a fresh buyer-LP lead (audience:buyer) gains segment:buyer', () => {
    expect(canonicalTagsToAdd({ tags: ['audience:buyer', 'source:buyer-lp'] })).toContain('segment:buyer')
  })
  it('a seller-LP lead (audience:seller) gains segment:seller even in Nurture', () => {
    expect(canonicalTagsToAdd({ tags: ['audience:seller'], stage: 'Nurture' })).toContain('segment:seller')
  })
  it('stage Seller Prospect implies segment:seller; Real Estate Agent implies realtor', () => {
    expect(canonicalTagsToAdd({ tags: [], stage: 'Seller Prospect' })).toContain('segment:seller')
    const r = canonicalTagsToAdd({ tags: [], stage: 'Real Estate Agent' })
    expect(r).toEqual(expect.arrayContaining(['industry:realtor', 'realtor:local']))
  })
  it('expired/fsbo signals + custom classification', () => {
    expect(canonicalTagsToAdd({ tags: ['intent:expired-listing'] })).toContain('segment:expired')
    expect(canonicalTagsToAdd({ tags: ['FSBO'] })).toContain('segment:fsbo')
    expect(canonicalTagsToAdd({ tags: [], custom: { customClassification: 'EXPIRED' } })).toContain('segment:expired')
  })
  it('a feeder city-realtor → realtor:migration', () => {
    expect(canonicalTagsToAdd({ tags: ['Seattle realtor'] })).toEqual(
      expect.arrayContaining(['industry:realtor', 'realtor:migration']),
    )
  })
  it('address derivation: out-of-state absentee → owner + location + segment:out-of-area', () => {
    const r = canonicalTagsToAdd({ tags: [], addresses: [
      { type: 'home', state: 'CA', city: 'LA', street: '1 A' },
      { type: 'Property', state: 'OR', city: 'Bend', street: '2 B' },
    ] })
    expect(r).toEqual(expect.arrayContaining(['owner:absentee', 'location:out-of-state', 'segment:out-of-area']))
  })
  it('NEVER returns a tag already present (additive only) + is idempotent', () => {
    const first = canonicalTagsToAdd({ tags: ['audience:buyer'] })
    const withAdds = ['audience:buyer', ...first]
    expect(canonicalTagsToAdd({ tags: withAdds })).toEqual([]) // nothing new the second time
  })
  it('never emits a compliance tag and ignores phone-typed addresses', () => {
    const r = deriveOccupancyLocation([
      { type: 'mobile', state: 'ZZ', city: 'x', street: '5551212' },
      { type: 'Property', state: 'OR', city: 'Bend', street: '2 B' },
    ])
    expect(r.location).toBeNull()
  })
})
