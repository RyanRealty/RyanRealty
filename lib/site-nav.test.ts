import { describe, it, expect } from 'vitest'
import {
  KB_ABOUT_DROPDOWN,
  KB_FOOTER_COLUMNS,
  KB_MENU_GROUPS,
  KB_TOP_LINKS,
  KB_TOP_NAV,
  MAP_SEARCH,
  PRIMARY_NAV,
  VALUATION_FORM,
} from './site-nav'
import { getPlaceLinks, canonicalCommunitySlug } from './place-links'

describe('KB nav SSOT (Buy · Areas · Market · Sell · About)', () => {
  it('top bar is the five intent labels in order', () => {
    expect(KB_TOP_LINKS.map((l) => l.label)).toEqual(['Buy', 'Areas', 'Market', 'Sell', 'About'])
    expect(KB_TOP_LINKS.map((l) => l.href)).toEqual([
      '/homes-for-sale?view=list',
      '/cities',
      '/housing-market',
      '/sell',
      '/about',
    ])
  })

  it('PRIMARY_NAV is the same tree as KB_TOP_NAV', () => {
    expect(PRIMARY_NAV).toBe(KB_TOP_NAV)
  })

  it('puts brokerage pages in the About top-bar group', () => {
    const about = KB_TOP_NAV.find((g) => g.href === '/about')
    const hrefs = about?.children.map((l) => l.href) ?? []
    for (const h of ['/about', '/team', '/reviews', '/contact', '/refer-a-client']) {
      expect(hrefs).toContain(h)
    }
    expect(KB_ABOUT_DROPDOWN.map((l) => l.href).sort()).toEqual(['/contact', '/reviews', '/team'])
  })

  it('puts lifestyle under Areas (not a junk Guides drawer)', () => {
    const areas = KB_TOP_NAV.find((g) => g.label === 'Areas')
    const hrefs = areas?.children.map((l) => l.href) ?? []
    for (const h of [
      '/schools',
      '/parks',
      '/central-oregon/trails',
      '/central-oregon/events',
      '/central-oregon/venues',
      '/lp/central-oregon-golf',
    ]) {
      expect(hrefs).toContain(h)
    }
  })

  it('puts tools under Market including rental calculator', () => {
    const market = KB_TOP_NAV.find((g) => g.label === 'Market')
    const hrefs = market?.children.map((l) => l.href) ?? []
    expect(hrefs).toContain('/tools/mortgage-calculator')
    expect(hrefs).toContain('/tools/rental-property-calculator')
    expect(hrefs).toContain('/months-of-supply')
    expect(hrefs).toContain('/how-we-get-our-numbers')
  })

  it('Menu+ mirrors intent groups; About includes Join', () => {
    expect(KB_MENU_GROUPS.map((g) => g.title).slice(0, 5)).toEqual([
      'Buy',
      'Areas',
      'Market',
      'Sell',
      'About',
    ])
    const about = KB_MENU_GROUPS.find((g) => g.title === 'About')
    expect(about?.links.some((l) => l.href === '/join')).toBe(true)
  })

  it('uses the regional list door for Homes / All homes, not the Bend inject', () => {
    const buy = KB_TOP_NAV.find((g) => g.label === 'Buy')
    expect(buy?.href).toBe('/homes-for-sale?view=list')
    expect(buy?.children[0]?.href).toBe('/homes-for-sale?view=list')
    expect(KB_MENU_GROUPS.find((g) => g.title === 'Buy')?.links[0]?.href).toBe(
      '/homes-for-sale?view=list',
    )
  })

  it('uses canonical map + valuation destinations', () => {
    expect(MAP_SEARCH.href).toBe('/homes-for-sale?view=map')
    // One valuation spine (Matt-granted): every global CTA anchors the on-page /sell form.
    expect(VALUATION_FORM.href).toBe('/sell#get-value')
    expect(VALUATION_FORM.label).toBe('Value my home')
    const buy = KB_MENU_GROUPS.find((g) => g.title === 'Buy')
    expect(buy?.links.some((l) => l.href === MAP_SEARCH.href)).toBe(true)
  })

  it('footer About column carries team trust links', () => {
    const about = KB_FOOTER_COLUMNS.find((c) => c.heading === 'About')
    const hrefs = about?.links.map((l) => l.href) ?? []
    for (const h of ['/about', '/team', '/reviews', '/contact', '/refer-a-client']) {
      expect(hrefs).toContain(h)
    }
  })

  it('footer Market column opens the monthly briefing door', () => {
    const market = KB_FOOTER_COLUMNS.find((c) => c.heading === 'Market')
    const hrefs = market?.links.map((l) => l.href) ?? []
    expect(hrefs).toContain('/newsletter')
  })

  it('no group lists the same href twice', () => {
    for (const g of KB_TOP_NAV) {
      const hrefs = g.children.map((c) => c.href)
      expect(new Set(hrefs).size, g.label).toBe(hrefs.length)
    }
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
