import { describe, expect, it } from 'vitest'
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
    const allowed = new Set(getAllResortCommunities().map((entry) => `/communities/${entry.slug}`))
    for (const href of hrefs) {
      expect(allowed.has(href)).toBe(true)
    }
  })
})

describe('place follows from a master-plan', () => {
  it('Tetherow Homes and Market keep the Tetherow filter', () => {
    const links = getPlaceLinks({ type: 'community', slug: 'tetherow', citySlug: 'bend' })
    expect(links.browseUrl).toBe('/homes-for-sale/bend/tetherow')
    expect(links.marketUrl).toBe('/housing-market/bend/tetherow')
  })

  it('Caldera Springs Homes and Market keep the Caldera filter', () => {
    const links = getPlaceLinks({ type: 'community', slug: 'caldera-springs', citySlug: 'sunriver' })
    expect(links.browseUrl).toBe('/homes-for-sale/sunriver/caldera-springs')
    expect(links.marketUrl).toBe('/housing-market/sunriver/caldera-springs')
  })
})
