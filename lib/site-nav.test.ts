import { describe, it, expect } from 'vitest'
import {
  KB_ABOUT_DROPDOWN,
  KB_FOOTER_COLUMNS,
  KB_MENU_GROUPS,
  KB_TOP_LINKS,
  MAP_SEARCH,
  VALUATION_FORM,
} from './site-nav'
import { getPlaceLinks, canonicalCommunitySlug } from './place-links'

describe('KB nav SSOT', () => {
  it('exposes About in the top bar and trust children in the dropdown', () => {
    expect(KB_TOP_LINKS.some((l) => l.href === '/about')).toBe(true)
    expect(KB_ABOUT_DROPDOWN.map((l) => l.href).sort()).toEqual(['/contact', '/reviews', '/team'])
  })

  it('puts Company near the top of Menu+ and includes Join', () => {
    expect(KB_MENU_GROUPS[1]?.title).toBe('Company')
    const company = KB_MENU_GROUPS.find((g) => g.title === 'Company')
    expect(company?.links.some((l) => l.href === '/join')).toBe(true)
    expect(company?.links.some((l) => l.href === '/about')).toBe(true)
  })

  it('uses canonical map + valuation destinations', () => {
    expect(MAP_SEARCH.href).toBe('/homes-for-sale?view=map')
    expect(VALUATION_FORM.href).toBe('/sell/valuation')
    const buy = KB_MENU_GROUPS.find((g) => g.title === 'Buy')
    expect(buy?.links.some((l) => l.href === MAP_SEARCH.href)).toBe(true)
  })

  it('footer Buyers column carries About, Team, Reviews, Contact', () => {
    const buyers = KB_FOOTER_COLUMNS.find((c) => c.heading === 'Buyers')
    const hrefs = buyers?.links.map((l) => l.href) ?? []
    for (const h of ['/about', '/team', '/reviews', '/contact']) {
      expect(hrefs).toContain(h)
    }
  })

  it('Learn group restores FAQ and Videos', () => {
    const learn = KB_MENU_GROUPS.find((g) => g.title === 'Learn')
    expect(learn?.links.some((l) => l.href === '/faq')).toBe(true)
    expect(learn?.links.some((l) => l.href === '/videos')).toBe(true)
  })
})

describe('getPlaceLinks', () => {
  it('normalizes bend-tetherow to bare tetherow place URL', () => {
    expect(canonicalCommunitySlug('bend-tetherow')).toBe('tetherow')
    const links = getPlaceLinks({ type: 'community', slug: 'bend-tetherow' })
    expect(links.placeUrl).toBe('/communities/tetherow')
    expect(links.browseUrl).toContain('/homes-for-sale/')
  })

  it('keeps Sunriver city and community distinct', () => {
    const city = getPlaceLinks({ type: 'city', slug: 'sunriver' })
    const community = getPlaceLinks({ type: 'community', slug: 'sunriver' })
    expect(city.placeUrl).toBe('/cities/sunriver')
    expect(community.placeUrl).toBe('/communities/sunriver')
  })
})
