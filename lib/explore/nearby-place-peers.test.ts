import { describe, expect, it } from 'vitest'
import { isTwoTokenSuffixTwin, nameOnlyChildEntries, nearbySubdivisionPeers } from './nearby-place-peers'

describe('nearbySubdivisionPeers', () => {
  it('ranks GIS ring neighbors ahead of resort siblings and never sorts by sales', () => {
    const peers = nearbySubdivisionPeers({
      selfSlug: 'deschutes-river-woods',
      ring: {
        ring: [
          { slug: 'woodside-ranch', label: 'Woodside Ranch', rank: 2 },
          { slug: 'lazy-river-south', label: 'Lazy River South', rank: 1 },
        ],
      },
      resortPeers: [{ name: 'River Meadows', href: '/subdivisions/river-meadows' }],
    })
    expect(peers.map((p) => p.name)).toEqual(['Lazy River South', 'Woodside Ranch', 'River Meadows'])
  })

  it('drops self and duplicate slugs', () => {
    const peers = nearbySubdivisionPeers({
      selfSlug: 'lazy-river-south',
      ring: {
        ring: [
          { slug: 'lazy-river-south', label: 'Lazy River South', rank: 1 },
          { slug: 'woodside-ranch', label: 'Woodside Ranch', rank: 2 },
        ],
      },
      resortPeers: [{ name: 'Woodside Ranch', href: '/subdivisions/woodside-ranch' }],
    })
    expect(peers).toEqual([{ name: 'Woodside Ranch', href: '/subdivisions/woodside-ranch' }])
  })

  it('is empty when nothing nearby is named — omit the section, do not invent a city dump', () => {
    expect(nearbySubdivisionPeers({ selfSlug: 'lone-plat' })).toEqual([])
  })
})

describe('nameOnlyChildEntries', () => {
  it('dedupes on href and never carries a count', () => {
    const rows = nameOnlyChildEntries([
      [{ name: 'Phase 1', href: '/subdivisions/phase-1' }],
      [
        { name: 'Phase 1', href: '/subdivisions/phase-1' },
        { name: 'Phase 2', href: '/subdivisions/phase-2' },
      ],
    ])
    expect(rows).toEqual([
      { name: 'Phase 1', href: '/subdivisions/phase-1' },
      { name: 'Phase 2', href: '/subdivisions/phase-2' },
    ])
  })

  it('collapses River Woods into Deschutes River Woods and keeps the longer name', () => {
    expect(isTwoTokenSuffixTwin('river-woods', 'deschutes-river-woods')).toBe(true)
    expect(isTwoTokenSuffixTwin('woods', 'deschutes-river-woods')).toBe(false)
    const rows = nameOnlyChildEntries([
      [
        { name: 'River Woods', href: '/subdivisions/river-woods' },
        { name: 'Deschutes River Woods', href: '/subdivisions/deschutes-river-woods' },
        { name: 'Woodside Ranch', href: '/subdivisions/woodside-ranch' },
      ],
    ])
    expect(rows).toEqual([
      { name: 'Deschutes River Woods', href: '/subdivisions/deschutes-river-woods' },
      { name: 'Woodside Ranch', href: '/subdivisions/woodside-ranch' },
    ])
  })

  it('keeps the longer slug when two cards share one name', () => {
    const rows = nameOnlyChildEntries([
      [
        { name: 'Awbrey Butte', href: '/subdivisions/awbrey' },
        { name: 'Awbrey Butte', href: '/cities/bend/awbrey-butte' },
      ],
    ])
    expect(rows).toEqual([{ name: 'Awbrey Butte', href: '/cities/bend/awbrey-butte' }])
  })
})
