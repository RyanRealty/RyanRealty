import { describe, expect, it } from 'vitest'
import { communityPublicPair } from '@/lib/communities/community-public-pair'
import { getAllResortCommunities } from '@/lib/data/communities/registry'
import { getPlaceLinks } from '@/lib/place-links'
import { resortQuietItems } from './resort-doors'

describe('resortQuietItems', () => {
  it('lists every registry resort as a community door', () => {
    const items = resortQuietItems()
    const registry = getAllResortCommunities()
    const doors = items.filter((item) => 'href' in item)
    expect(doors.length).toBe(registry.length)
    expect(doors.some((item) => 'href' in item && item.href === '/communities/tetherow')).toBe(true)
    expect(doors.some((item) => 'href' in item && item.href === '/communities/sunriver')).toBe(true)
    expect(doors.some((item) => 'href' in item && item.href === '/communities/caldera-springs')).toBe(
      true,
    )
  })

  it('does not invent slugs outside the registry', () => {
    const hrefs = resortQuietItems().flatMap((item) => ('href' in item ? [item.href] : []))
    const allowed = new Set(getAllResortCommunities().map((entry) => communityPublicPair(entry).href))
    for (const href of hrefs) {
      expect(allowed.has(href)).toBe(true)
    }
  })
})

describe('place follows from a master-plan', () => {
  // SITE-183 / SITE-182: the area twin (/homes-for-sale/bend/tetherow) 301s
  // onto the community page, so the browse door is the registry city's
  // search; Market keeps the community filter.
  it('Tetherow browses its city and Market keeps the Tetherow filter', () => {
    const links = getPlaceLinks({ type: 'community', slug: 'tetherow', citySlug: 'bend' })
    expect(links.browseUrl).toBe('/homes-for-sale/bend')
    expect(links.marketUrl).toBe('/housing-market/bend/tetherow')
  })

  it('Caldera Springs browses its city and Market keeps the Caldera filter', () => {
    const links = getPlaceLinks({ type: 'community', slug: 'caldera-springs', citySlug: 'sunriver' })
    expect(links.browseUrl).toBe('/homes-for-sale/sunriver')
    expect(links.marketUrl).toBe('/housing-market/sunriver/caldera-springs')
  })
})
