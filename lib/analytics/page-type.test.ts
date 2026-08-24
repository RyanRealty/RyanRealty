import { describe, expect, it } from 'vitest'
import { listingMlsFromPath, pageTypeFromPath, visitorPageCategoryFromPath } from './page-type'

describe('pageTypeFromPath', () => {
  it('maps the live public surfaces', () => {
    expect(pageTypeFromPath('/')).toBe('home')
    expect(pageTypeFromPath('/homes-for-sale/bend/awbrey-butte')).toBe('search')
    expect(pageTypeFromPath('/homes-for-sale/bend/some-street-220215519')).toBe('listing')
    expect(pageTypeFromPath('/cities/bend')).toBe('city')
    expect(pageTypeFromPath('/cities/bend/awbrey-butte')).toBe('neighborhood')
    expect(pageTypeFromPath('/communities/tetherow')).toBe('community')
    expect(pageTypeFromPath('/search/bend')).toBe('search')
    expect(pageTypeFromPath('/lp/seller-home-value')).toBe('sell')
    expect(pageTypeFromPath('/housing-market/bend')).toBe('market')
    expect(pageTypeFromPath('/how-we-get-our-numbers')).toBe('market')
    expect(pageTypeFromPath('/months-of-supply')).toBe('market')
    expect(pageTypeFromPath('/contact')).toBe('contact')
    expect(pageTypeFromPath('/central-oregon/trails')).toBe('guides')
    expect(pageTypeFromPath('/luxury-homes-bend')).toBe('search')
    expect(pageTypeFromPath('/oregon/portland')).toBe('city')
    expect(pageTypeFromPath('/faq')).toBe('blog')
    expect(pageTypeFromPath('/our-homes')).toBe('listing')
    expect(pageTypeFromPath('/motivated-sellers')).toBe('sell')
    expect(pageTypeFromPath('/newsletter')).toBe('utility')
    expect(pageTypeFromPath('/data-deletion')).toBe('legal')
  })
})

describe('visitorPageCategoryFromPath', () => {
  it('keeps the scoring-trigger vocabulary', () => {
    expect(visitorPageCategoryFromPath('/homes-for-sale/bend/x-220215519')).toBe('listing_detail')
    expect(visitorPageCategoryFromPath('/lp/seller-home-value')).toBe('seller_intent')
    expect(visitorPageCategoryFromPath('/tools/mortgage-calculator')).toBe('financial_tools')
    expect(visitorPageCategoryFromPath('/cities/bend')).toBe('area_guide')
    expect(visitorPageCategoryFromPath('/')).toBe('home')
  })
})

describe('listingMlsFromPath', () => {
  it('reads the MLS off a pretty listing URL', () => {
    expect(listingMlsFromPath('/homes-for-sale/bend/foo-220215519')).toBe('220215519')
    expect(listingMlsFromPath('/homes-for-sale/bend')).toBeNull()
  })
})
