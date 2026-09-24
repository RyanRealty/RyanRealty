import { describe, expect, it } from 'vitest'
import {
  communityPath,
  allowedCommunityUrlSlugs,
  communityPairAgrees,
  communityPublicPair,
  communityPublicPairForPlace,
  publicCommunitySlug,
  resolveDurableCommunitySlug,
  resolvePublicCommunitySlug,
  slugifyCommunityName,
} from './community-public-pair'
import { getAllResortCommunities } from '@/lib/data/communities/registry'
import { isCanonicalCommunitySlug, resolveCanonicalCommunitySlug } from './canonical-community-slug'

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

  it('edge allowlist keeps both the durable hop slug and the public door', () => {
    const slugs = allowedCommunityUrlSlugs()
    expect(slugs).toContain('pronghorn')
    expect(slugs).toContain('juniper-preserve')
    expect(slugs).toContain('tetherow')
  })
})

describe('communityPath — every registry key links the live door, never a redirect', () => {
  it('sends the durable rebrand key to the public door', () => {
    expect(communityPath('pronghorn')).toBe('/communities/juniper-preserve')
    expect(communityPath('Juniper Preserve')).toBe('/communities/juniper-preserve')
    expect(communityPath('tetherow')).toBe('/communities/tetherow')
  })

  it('no registry slug, label or alias resolves to a path the edge redirects', () => {
    for (const entry of getAllResortCommunities()) {
      const keys = [entry.slug, entry.label, ...(entry.subdivision_aliases ?? [])]
      for (const key of keys) {
        const path = communityPath(key)
        const seg = path.replace(/^\/communities\//, '')
        expect(resolveCanonicalCommunitySlug(seg), `${key} -> ${path}`).toBeNull()
        expect(isCanonicalCommunitySlug(seg), `${key} -> ${path}`).toBe(true)
      }
    }
  })
})
