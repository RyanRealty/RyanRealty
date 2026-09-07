import { describe, it, expect } from 'vitest'
import { marketNavChildren } from './market/report-doors'
import {
  FOOTER_NAV,
  KB_ABOUT_DROPDOWN,
  KB_FOOTER_COLUMNS,
  KB_MENU_GROUPS,
  KB_TOP_LINKS,
  KB_TOP_NAV,
  MAP_SEARCH,
  PRIMARY_NAV,
  VALUATION_FORM,
  footerColumnLinks,
} from './site-nav'
import { getPlaceLinks, canonicalCommunitySlug } from './place-links'

describe('KB nav SSOT (Buy · Areas · Market · Sell · About)', () => {
  it('SSOT still carries five intent groups (chrome primary drops Market)', () => {
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
    for (const h of ['/about', '/team', '/reviews', '/contact', '/join']) {
      expect(hrefs).toContain(h)
    }
    expect(hrefs).toContain('/join')
    expect(about?.children.find((l) => l.href === '/join')?.label).toBe('Work with us')
    expect(KB_ABOUT_DROPDOWN.map((l) => l.href).sort()).toEqual(['/contact', '/reviews', '/team'])
  })

  it('Areas top panel is places-first (market folded in; lifestyle in Menu+)', () => {
    const areas = KB_TOP_NAV.find((g) => g.label === 'Areas')
    const hrefs = areas?.children.map((l) => l.href) ?? []
    for (const h of [
      '/cities',
      '/communities',
      '/communities/tetherow',
      '/housing-market',
      '/neighborhoods',
      '/subdivisions',
    ]) {
      expect(hrefs).toContain(h)
    }
    expect(hrefs).not.toContain('/lp/central-oregon-golf')
    const menuAreas = KB_MENU_GROUPS.find((g) => g.title === 'Areas')
    const menuHrefs = menuAreas?.links.map((l) => l.href) ?? []
    for (const h of ['/schools', '/parks', '/central-oregon/golf']) {
      expect(menuHrefs).toContain(h)
    }
  })

  it('Market panel lists the report hierarchy (same doors as Menu+ and report-doors)', () => {
    const market = KB_TOP_NAV.find((g) => g.label === 'Market')
    const doors = marketNavChildren()
    expect(market?.children.map((l) => l.href)).toEqual(doors.map((d) => d.href))
    expect(market?.children.map((l) => l.label)).toEqual(doors.map((d) => d.label))
    expect(market?.children.find((l) => l.href === '/housing-market')?.label).toBe(
      'Live housing market',
    )
    expect(market?.children.find((l) => l.href === '/housing-market/reports')?.label).toBe(
      'Published reports',
    )
    const menuMarket = KB_MENU_GROUPS.find((g) => g.title === 'Market')
    const menuHrefs = menuMarket?.links.map((l) => l.href) ?? []
    for (const href of doors.map((d) => d.href)) {
      expect(menuHrefs).toContain(href)
    }
    expect(menuHrefs).not.toContain('/activity')
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

  it('footer Company and Contact columns carry team trust and ask links', () => {
    const company = KB_FOOTER_COLUMNS.find((c) => c.heading === 'Company')
    const contact = KB_FOOTER_COLUMNS.find((c) => c.heading === 'Contact')
    const actions = KB_FOOTER_COLUMNS.find((c) => c.heading === 'Buy · Sell · Join')
    const companyHrefs = company?.links.map((l) => l.href) ?? []
    const contactHrefs = contact?.links.map((l) => l.href) ?? []
    const actionHrefs = actions ? footerColumnLinks(actions).map((l) => l.href) : []
    for (const h of ['/about', '/team', '/reviews', '/invest', '/blog']) {
      expect(companyHrefs).toContain(h)
    }
    for (const h of ['/contact', '/book']) {
      expect(contactHrefs).toContain(h)
    }
    for (const h of ['/sell#get-value', '/sell', '/join', '/our-homes']) {
      expect(actionHrefs).toContain(h)
    }
  })

  it('footer columns group towns under Markets, then Buy · Sell · Join, Company, Contact', () => {
    expect(KB_FOOTER_COLUMNS.map((c) => c.heading)).toEqual([
      'Markets',
      'Buy · Sell · Join',
      'Company',
      'Contact',
    ])
    const markets = KB_FOOTER_COLUMNS[0]!
    expect(markets.groups?.map((g) => g.heading)).toEqual([
      'Bend',
      'Redmond',
      'Sisters',
      'Sunriver',
      'La Pine',
      'Terrebonne',
      'Prineville',
      'Madras',
    ])
    const bend = markets.groups?.find((g) => g.heading === 'Bend')?.links ?? []
    expect(bend.map((l) => l.href)).toEqual([
      '/homes-for-sale/bend',
      '/housing-market/bend',
      '/neighborhoods',
      '/communities/tetherow',
      '/communities/broken-top',
      '/communities/northwest-crossing',
      '/communities/awbrey-glen',
    ])
    expect(bend.map((l) => l.label)).toEqual([
      'Homes for sale in Bend',
      'Bend housing market',
      'Bend neighborhoods',
      'Tetherow',
      'Broken Top',
      'NorthWest Crossing',
      'Awbrey Glen',
    ])
    const allMarketLinks = footerColumnLinks(markets)
    const redmondHrefs = allMarketLinks.filter((l) => l.href.includes('redmond') || l.href.includes('eagle-crest') || l.href.includes('pronghorn')).map((l) => l.href)
    expect(redmondHrefs).toEqual([
      '/homes-for-sale/redmond',
      '/housing-market/redmond',
      '/communities/eagle-crest',
      '/communities/pronghorn',
    ])
    const actions = KB_FOOTER_COLUMNS.find((c) => c.heading === 'Buy · Sell · Join')
    expect(actions?.groups?.map((g) => g.heading)).toEqual(['Buy', 'Sell', 'Join'])
    expect(footerColumnLinks(actions!).map((l) => l.href)).toEqual([
      '/homes-for-sale?view=list',
      '/homes-for-sale?view=map',
      '/open-houses',
      '/price-drops',
      '/luxury-homes-bend',
      '/our-homes',
      '/sell',
      '/sell#get-value',
      '/join',
    ])
    const company = KB_FOOTER_COLUMNS.find((c) => c.heading === 'Company')
    expect(company?.links.map((l) => l.href)).toEqual([
      '/about',
      '/team',
      '/reviews',
      '/invest',
      '/housing-market',
      '/blog',
    ])
    const contact = KB_FOOTER_COLUMNS.find((c) => c.heading === 'Contact')
    expect(contact?.links.map((l) => l.href)).toEqual(['/contact', '/book'])
    expect(contact?.links.map((l) => l.label)).toEqual(['Contact us', 'Book a broker'])
    expect(FOOTER_NAV).toBe(KB_FOOTER_COLUMNS)
    const communityHrefs = KB_FOOTER_COLUMNS.flatMap((c) =>
      footerColumnLinks(c).map((l) => l.href).filter((h) => h.startsWith('/communities/')),
    )
    const allowed = new Set([
      '/communities/tetherow',
      '/communities/broken-top',
      '/communities/northwest-crossing',
      '/communities/awbrey-glen',
      '/communities/eagle-crest',
      '/communities/pronghorn',
      '/communities/black-butte-ranch',
      '/communities/caldera-springs',
      '/communities/crosswater',
    ])
    for (const href of communityHrefs) expect(allowed.has(href), href).toBe(true)
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
