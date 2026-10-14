import { describe, expect, it } from 'vitest'
import { communityHomesSrc, isCommunitySlug } from './place-homes-src'

describe('communityHomesSrc', () => {
  it('names the community query the API reads', () => {
    expect(communityHomesSrc('tetherow')).toBe('/api/place/homes?community=tetherow')
    expect(communityHomesSrc('eagle-crest')).toBe('/api/place/homes?community=eagle-crest')
  })

  it('refuses an empty slug so the map does not fetch a blank URL', () => {
    expect(communityHomesSrc('')).toBe('')
    expect(communityHomesSrc('   ')).toBe('')
  })
})

describe('isCommunitySlug', () => {
  it('accepts the registry slugs and rejects junk', () => {
    expect(isCommunitySlug('tetherow')).toBe(true)
    expect(isCommunitySlug('black-butte-ranch')).toBe(true)
    expect(isCommunitySlug('Tetherow')).toBe(false)
    expect(isCommunitySlug('tetherow/../x')).toBe(false)
    expect(isCommunitySlug('')).toBe(false)
  })
})
