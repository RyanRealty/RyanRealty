import { describe, expect, it } from 'vitest'
import { matchGeoLinksForPost } from './blog-geo-links'

describe('matchGeoLinksForPost', () => {
  it('matches a community named in the slug', () => {
    const links = matchGeoLinksForPost({ slug: 'tetherow-resort-living-real-estate' })
    expect(links.map((l) => l.slug)).toEqual(['tetherow'])
    expect(links[0].href).toBe('/communities/tetherow')
    expect(links[0].anchor).toBe('Tetherow homes for sale')
  })

  it('matches a multi-word label across hyphens (Broken Top, Black Butte Ranch)', () => {
    expect(matchGeoLinksForPost({ slug: 'broken-top-bend-golf-community' })[0]?.slug).toBe('broken-top')
    expect(matchGeoLinksForPost({ slug: 'black-butte-ranch-guide' })[0]?.slug).toBe('black-butte-ranch')
  })

  it('matches via title and tags when the slug is generic', () => {
    const links = matchGeoLinksForPost({
      slug: 'retirement-central-oregon',
      title: 'Retiring in Central Oregon',
      tags: ['Brasada Ranch', 'retirement'],
    })
    expect(links.map((l) => l.slug)).toContain('brasada-ranch')
  })

  it('returns [] when no community is named', () => {
    expect(matchGeoLinksForPost({ slug: 'best-neighborhoods-bend-retirees' })).toEqual([])
  })

  it('caps at 2, most specific label first', () => {
    const links = matchGeoLinksForPost({
      slug: 'x',
      title: 'Tetherow vs Broken Top vs Black Butte Ranch',
    })
    expect(links).toHaveLength(2)
    expect(links[0].label.length).toBeGreaterThanOrEqual(links[1].label.length)
  })

  it('does not match on partial words', () => {
    // "tether" alone must not match Tetherow.
    expect(matchGeoLinksForPost({ slug: 'tether-your-budget' })).toEqual([])
  })

  it('matches NW Crossing short names to NorthWest Crossing', () => {
    expect(matchGeoLinksForPost({ slug: 'living-in-nw-crossing-bend' })[0]?.slug).toBe(
      'northwest-crossing',
    )
    expect(
      matchGeoLinksForPost({
        slug: 'west-side-walkable',
        tags: ['nw crossing', 'bend'],
      })[0]?.slug,
    ).toBe('northwest-crossing')
    expect(matchGeoLinksForPost({ slug: 'nwx-farmers-market-guide' })[0]?.slug).toBe(
      'northwest-crossing',
    )
  })
})
