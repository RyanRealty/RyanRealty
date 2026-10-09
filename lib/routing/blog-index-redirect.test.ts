import { describe, expect, it } from 'vitest'
import { resolveBlogIndexRedirect } from './blog-index-redirect'
import { BLOG_HOUSING_MARKET_GUIDE_REDIRECTS } from './blog-market-guide-redirects'

describe('resolveBlogIndexRedirect', () => {
  it('sends /blog/2017 and everything under it to /blog', () => {
    expect(resolveBlogIndexRedirect('/blog/2017')).toBe('/blog')
    expect(resolveBlogIndexRedirect('/blog/2017/7')).toBe('/blog')
    expect(resolveBlogIndexRedirect('/blog/2017/7/some-post')).toBe('/blog')
  })

  it('sends the bare category and page indexes to /blog', () => {
    expect(resolveBlogIndexRedirect('/blog/category')).toBe('/blog')
    expect(resolveBlogIndexRedirect('/blog/page')).toBe('/blog')
    expect(resolveBlogIndexRedirect('/blog/category/Buying%20Guides/page')).toBe('/blog')
    expect(resolveBlogIndexRedirect('/blog/category/Community%20Spotlights/page')).toBe('/blog')
  })

  it('sends an unknown category (and other invalid index shapes) to /blog', () => {
    expect(resolveBlogIndexRedirect('/blog/category/market-updates')).toBe('/blog')
    expect(resolveBlogIndexRedirect('/blog/category/Nope')).toBe('/blog')
    expect(resolveBlogIndexRedirect('/blog/page/1')).toBe('/blog')
  })

  it('leaves a real post, a valid category, and paging of two or more alone', () => {
    expect(resolveBlogIndexRedirect('/blog/sunriver-year-round-living-vs-vacation')).toBeNull()
    expect(resolveBlogIndexRedirect('/blog/category/Market%20Reports')).toBeNull()
    expect(resolveBlogIndexRedirect('/blog/page/2')).toBeNull()
    expect(resolveBlogIndexRedirect('/blog/category/Buying%20Guides/page/3')).toBeNull()
  })
})

describe('BLOG_HOUSING_MARKET_GUIDE_REDIRECTS', () => {
  it('points each 404 guide at a live market or place page, never another /blog/<town>-housing-market-guide', () => {
    expect(BLOG_HOUSING_MARKET_GUIDE_REDIRECTS.length).toBeGreaterThanOrEqual(12)
    for (const { source, destination } of BLOG_HOUSING_MARKET_GUIDE_REDIRECTS) {
      expect(source).toMatch(/^\/blog\/[a-z0-9-]+-housing-market-guide$/)
      expect(destination.startsWith('/housing-market/') || destination.startsWith('/cities/') || destination.startsWith('/communities/')).toBe(true)
      expect(destination).not.toContain('housing-market-guide')
    }
    expect(BLOG_HOUSING_MARKET_GUIDE_REDIRECTS.find((r) => r.source === '/blog/bend-housing-market-guide')?.destination).toBe(
      '/housing-market/bend',
    )
    expect(
      BLOG_HOUSING_MARKET_GUIDE_REDIRECTS.find((r) => r.source === '/blog/black-butte-ranch-housing-market-guide')
        ?.destination,
    ).toBe('/housing-market/sisters/black-butte-ranch')
  })
})
