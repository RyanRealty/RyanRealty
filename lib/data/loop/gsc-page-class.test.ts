import { describe, expect, it } from 'vitest'

import {
  classifyGscPage,
  isCentralOregonMoneyClass,
  isTrackableQuery,
  normalizeGscPath,
  normalizeGscQuery,
} from './gsc-page-class'

describe('normalizeGscPath: one spelling per page', () => {
  it('folds origin, www, trailing slash, query string, hash and case', () => {
    expect(normalizeGscPath('https://www.ryan-realty.com/Blog/Sunriver-Guide/?utm_source=gbp#top')).toBe('/blog/sunriver-guide')
    expect(normalizeGscPath('https://ryan-realty.com/blog/sunriver-guide')).toBe('/blog/sunriver-guide')
    expect(normalizeGscPath('/blog/sunriver-guide/')).toBe('/blog/sunriver-guide')
    expect(normalizeGscPath('blog/sunriver-guide')).toBe('/blog/sunriver-guide')
  })

  it('keeps the homepage as / and refuses other hosts', () => {
    expect(normalizeGscPath('https://ryan-realty.com/')).toBe('/')
    expect(normalizeGscPath('https://ryan-realty.com/?utm_source=gbp')).toBe('/')
    expect(normalizeGscPath('https://example.com/blog/x')).toBe('')
    expect(normalizeGscPath('')).toBe('')
  })
})

describe('classifyGscPage: the route classes the loop trends', () => {
  const c = (p: string) => classifyGscPage(p)

  it('money classes, in and out of the service area', () => {
    expect(c('https://ryan-realty.com/')).toEqual({ pageClass: 'home', market: 'central-oregon' })
    expect(c('/communities/brasada-ranch')).toEqual({ pageClass: 'community', market: 'central-oregon' })
    expect(c('/communities/tetherow/types/condos')).toEqual({ pageClass: 'community-type', market: 'central-oregon' })
    expect(c('/cities/bend')).toEqual({ pageClass: 'city', market: 'central-oregon' })
    expect(c('/cities/medford')).toEqual({ pageClass: 'city', market: 'out-of-market' })
    expect(c('/cities/bend/awbrey-butte')).toEqual({ pageClass: 'neighborhood', market: 'central-oregon' })
    expect(c('/cities/bend/types/condos')).toEqual({ pageClass: 'city-type', market: 'central-oregon' })
    expect(c('/subdivisions/golf-homes-at-tetherow')).toEqual({ pageClass: 'subdivision', market: 'unknown' })
    expect(c('/oregon/grants-pass')).toEqual({ pageClass: 'oregon-city', market: 'out-of-market' })
  })

  it('homes-for-sale: hub, city, preset, place, listing', () => {
    expect(c('/homes-for-sale')).toEqual({ pageClass: 'homes-for-sale-hub', market: 'central-oregon' })
    expect(c('/homes-for-sale/bend')).toEqual({ pageClass: 'homes-for-sale-city', market: 'central-oregon' })
    expect(c('/homes-for-sale/grants-pass')).toEqual({ pageClass: 'homes-for-sale-city', market: 'out-of-market' })
    expect(c('/homes-for-sale/luxury')).toEqual({ pageClass: 'homes-for-sale-type', market: 'central-oregon' })
    expect(c('/homes-for-sale/bend/luxury')).toEqual({ pageClass: 'homes-for-sale-type', market: 'central-oregon' })
    expect(c('/homes-for-sale/bend/northwest-crossing')).toEqual({ pageClass: 'homes-for-sale-place', market: 'central-oregon' })
    expect(c('/homes-for-sale/bend/northwest-crossing/condos')).toEqual({ pageClass: 'homes-for-sale-type', market: 'central-oregon' })
    expect(c('/homes-for-sale/bend/mountain-view/providence/1522-locksley-220226356')).toEqual({
      pageClass: 'listing',
      market: 'central-oregon',
    })
    expect(c('/homes-for-sale/medford/123-main-st-220111111')).toEqual({ pageClass: 'listing', market: 'out-of-market' })
    expect(c('/homes-for-sale/outside-boundaries/brasada-ranch/brasada-ranch-220220863')).toEqual({
      pageClass: 'listing',
      market: 'unknown',
    })
    expect(c('/homes-for-sale/listing/220226356')).toEqual({ pageClass: 'listing', market: 'unknown' })
    // /search 301s to /homes-for-sale; old URLs still in GSC land in the same classes.
    expect(c('/search/bend')).toEqual({ pageClass: 'homes-for-sale-city', market: 'central-oregon' })
  })

  it('content and brand classes', () => {
    expect(c('/blog/hoa-guide-central-oregon').pageClass).toBe('blog')
    expect(c('/housing-market/bend').pageClass).toBe('housing-market')
    expect(c('/team/matt-ryan').pageClass).toBe('brand')
    expect(c('/communities').pageClass).toBe('place-index')
    expect(c('/something-new').pageClass).toBe('other')
  })
})

describe('isCentralOregonMoneyClass', () => {
  it('keeps money classes unless the URL routes out of market', () => {
    expect(isCentralOregonMoneyClass('community', 'central-oregon')).toBe(true)
    expect(isCentralOregonMoneyClass('subdivision', 'unknown')).toBe(true)
    expect(isCentralOregonMoneyClass('city', 'out-of-market')).toBe(false)
    expect(isCentralOregonMoneyClass('listing', 'central-oregon')).toBe(false)
    expect(isCentralOregonMoneyClass('blog', 'central-oregon')).toBe(false)
  })
})

describe('isTrackableQuery: a person, not a rank tracker', () => {
  it('drops quoted, bracketed and operator queries', () => {
    expect(isTrackableQuery('"tetherow homes for sale"')).toBe(false)
    expect(isTrackableQuery('[brasada ranch real estate]')).toBe(false)
    expect(isTrackableQuery('site:ryan-realty.com bend')).toBe(false)
    expect(isTrackableQuery('bend homes intitle:sale')).toBe(false)
    expect(isTrackableQuery('')).toBe(false)
  })

  it('keeps ordinary queries, including ones with a colon in a time', () => {
    expect(isTrackableQuery('tetherow homes for sale')).toBe(true)
    expect(isTrackableQuery('open house 1:00 bend')).toBe(true)
  })

  it('normalizes query spacing and case', () => {
    expect(normalizeGscQuery('  Tetherow   Homes ')).toBe('tetherow homes')
  })
})
