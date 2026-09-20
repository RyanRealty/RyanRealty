import { describe, expect, it } from 'vitest'
import {
  communityPairAgrees,
  communityPublicPair,
  communityPublicPairForPlace,
  publicCommunitySlug,
  resolveDurableCommunitySlug,
  resolvePublicCommunitySlug,
  slugifyCommunityName,
} from './community-public-pair'
import { getAllResortCommunities } from '@/lib/data/communities/registry'

describe('community public pair — name and URL agree', () => {
  it('keeps matching label/slug communities on one live URL', () => {
    const tetherow = communityPublicPair({ slug: 'tetherow', label: 'Tetherow' })
    expect(tetherow).toEqual({
      displayName: 'Tetherow',
      publicSlug: 'tetherow',
      durableSlug: 'tetherow',
      href: '/communities/tetherow',
    })
    expect(communityPairAgrees(tetherow)).toBe(true)
  })

  it('publishes Juniper Preserve on /communities/juniper-preserve and keeps pronghorn durable', () => {
    const pair = communityPublicPairForPlace({ slug: 'pronghorn', name: 'Pronghorn' })
    expect(pair).toEqual({
      displayName: 'Juniper Preserve',
      publicSlug: 'juniper-preserve',
      durableSlug: 'pronghorn',
      href: '/communities/juniper-preserve',
    })
    expect(communityPairAgrees(pair!)).toBe(true)
    expect(resolvePublicCommunitySlug('pronghorn')).toBe('juniper-preserve')
    expect(resolvePublicCommunitySlug('juniper-preserve')).toBe('juniper-preserve')
    expect(resolveDurableCommunitySlug('juniper-preserve')).toBe('pronghorn')
    expect(resolveDurableCommunitySlug('Pronghorn')).toBe('pronghorn')
    expect(publicCommunitySlug({ slug: 'pronghorn', label: 'Juniper Preserve' })).toBe(
      'juniper-preserve',
    )
  })

  it('does not invent a pair for an ordinary plat', () => {
    expect(
      communityPublicPairForPlace({ slug: 'bend-parkside-place-phase-1', name: 'Parkside Place Phase 1' }),
    ).toBeNull()
  })

  it('every registry entry has an agreeing public pair', () => {
    const mismatches = getAllResortCommunities()
      .map((entry) => communityPublicPair(entry))
      .filter((pair) => !communityPairAgrees(pair))
      .map((pair) => `${pair.displayName} → ${pair.href} (durable ${pair.durableSlug})`)
    expect(mismatches).toEqual([])
  })

  it('slugifyCommunityName matches the Edge community slugify', () => {
    expect(slugifyCommunityName('Juniper Preserve')).toBe('juniper-preserve')
    expect(slugifyCommunityName('NorthWest Crossing')).toBe('northwest-crossing')
  })
})
