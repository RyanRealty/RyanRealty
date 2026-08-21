import { describe, expect, it } from 'vitest'
import {
  FEATURED_COMMUNITY_SLUGS,
  featuredSlugOf,
  HELD_COMMUNITY_SLUGS,
  isFeaturedCommunitySlug,
} from './featured-slugs'

describe('featured community slugs', () => {
  it('covers the live restyle list and holds sunriver', () => {
    expect(FEATURED_COMMUNITY_SLUGS).toContain('tetherow')
    expect(FEATURED_COMMUNITY_SLUGS).toContain('pronghorn')
    expect(FEATURED_COMMUNITY_SLUGS).toContain('bend-westgate')
    expect(FEATURED_COMMUNITY_SLUGS).toContain('inn-of-the-7th-mountain')
    expect(FEATURED_COMMUNITY_SLUGS).not.toContain('sunriver')
    expect(FEATURED_COMMUNITY_SLUGS).not.toContain('juniper-preserve')
    expect(FEATURED_COMMUNITY_SLUGS).not.toContain('discovery-west')
    expect(FEATURED_COMMUNITY_SLUGS).not.toContain('caraway')
    expect(HELD_COMMUNITY_SLUGS).toContain('sunriver')
  })

  it('gates the restyle to live slugs only', () => {
    expect(isFeaturedCommunitySlug('tetherow')).toBe(true)
    expect(isFeaturedCommunitySlug('bend-petrosa')).toBe(true)
    expect(isFeaturedCommunitySlug('sunriver')).toBe(false)
    expect(isFeaturedCommunitySlug('juniper-preserve')).toBe(false)
    expect(isFeaturedCommunitySlug('bend-made-up-village')).toBe(false)
  })

  it('does not invent a Juniper Preserve route', () => {
    expect(featuredSlugOf('pronghorn')).toBe('pronghorn')
    expect(featuredSlugOf('juniper-preserve')).toBe('juniper-preserve')
    expect(isFeaturedCommunitySlug('juniper-preserve')).toBe(false)
  })
})
