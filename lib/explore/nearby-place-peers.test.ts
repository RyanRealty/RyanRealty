import { describe, expect, it } from 'vitest'
import {
  isTwoTokenSuffixTwin,
  nameOnlyChildEntries,
  nearbySubdivisionPeers,
  otherCommunitySubdivs,
} from './nearby-place-peers'

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

describe('otherCommunitySubdivs', () => {
  it('keeps sibling visitor names and drops self', () => {
    const rows = otherCommunitySubdivs({
      selfSlug: 'parkside-place-phase-1',
      plats: [
        { slug: 'parkside-place-phase-1', label: 'Parkside Place Phase 1' },
        { slug: 'parkside-place-phase-2', label: 'Parkside Place Phase 2' },
        { slug: 'awbrey-glen', label: 'Awbrey Glen' },
      ],
    })
    expect(rows.map((row) => row.name)).toEqual(['Awbrey Glen', 'Parkside Place Phase 2'])
    expect(rows.every((row) => !('count' in row))).toBe(true)
  })

  it('drops permit-glued slugs and withheld MLS tokens', () => {
    const rows = otherCommunitySubdivs({
      selfSlug: 'stevens-ranch',
      plats: [
        { slug: 'stevens-ranch-plld20211070', label: 'Stevens Ranch' },
        { slug: 'oww', label: 'Oww' },
        { slug: 'stevens-ranch-phase-rs-1', label: 'Stevens Ranch Phase RS-1' },
      ],
    })
    expect(rows.map((row) => row.href)).toEqual(['/subdivisions/stevens-ranch-phase-rs-1'])
  })

  it('is empty on a city dump — omit the rail', () => {
    expect(otherCommunitySubdivs({ selfSlug: 'lone-plat', plats: [] })).toEqual([])
  })
})
