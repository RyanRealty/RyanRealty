import { describe, expect, it } from 'vitest'
import { blogPostSlugFromPath, isInvalidBlogIndexPath } from './index-path-guard'

describe('isInvalidBlogIndexPath', () => {
  it('passes real categories and pages of two or more, in either spelling of a space', () => {
    expect(isInvalidBlogIndexPath('/blog/category/Market%20Reports')).toBe(false)
    expect(isInvalidBlogIndexPath('/blog/category/Market Reports')).toBe(false)
    expect(isInvalidBlogIndexPath('/blog/category/Investment%20%26%20Finance/page/3')).toBe(false)
    expect(isInvalidBlogIndexPath('/blog/page/2')).toBe(false)
    expect(isInvalidBlogIndexPath('/blog/page/17/')).toBe(false)
  })
  it('calls unknown categories, All, and malformed pages a 404', () => {
    expect(isInvalidBlogIndexPath('/blog/category/Nope')).toBe(true)
    expect(isInvalidBlogIndexPath('/blog/category/All')).toBe(true)
    expect(isInvalidBlogIndexPath('/blog/category/%E0%A4%A')).toBe(true)
    expect(isInvalidBlogIndexPath('/blog/page/1')).toBe(true)
    expect(isInvalidBlogIndexPath('/blog/page/0')).toBe(true)
    expect(isInvalidBlogIndexPath('/blog/page/x')).toBe(true)
    expect(isInvalidBlogIndexPath('/blog/page/2.5')).toBe(true)
    expect(isInvalidBlogIndexPath('/blog/category/Market%20Reports/page/1')).toBe(true)
    expect(isInvalidBlogIndexPath('/blog/category/Market%20Reports/page/abc')).toBe(true)
  })
  it('leaves every other path alone, the post route and the bare index included', () => {
    expect(isInvalidBlogIndexPath('/blog')).toBe(false)
    expect(isInvalidBlogIndexPath('/blog/sunriver-year-round-living-vs-vacation')).toBe(false)
    expect(isInvalidBlogIndexPath('/blog/category')).toBe(false)
    expect(isInvalidBlogIndexPath('/communities/nope')).toBe(false)
  })
})

describe('blogPostSlugFromPath', () => {
  it('returns the decoded slug of a one-segment post path', () => {
    expect(blogPostSlugFromPath('/blog/understanding-home-appraisals')).toBe('understanding-home-appraisals')
    expect(blogPostSlugFromPath('/blog/understanding-home-appraisals/')).toBe('understanding-home-appraisals')
    expect(blogPostSlugFromPath('/blog/a%20b')).toBe('a b')
  })
  it('is null for the index, deeper paths, other routes and an undecodable segment', () => {
    expect(blogPostSlugFromPath('/blog')).toBeNull()
    expect(blogPostSlugFromPath('/blog/')).toBeNull()
    expect(blogPostSlugFromPath('/blog/category/Market%20Reports')).toBeNull()
    expect(blogPostSlugFromPath('/blog/page/2')).toBeNull()
    expect(blogPostSlugFromPath('/communities/x')).toBeNull()
    expect(blogPostSlugFromPath('/blog/%E0%A4%A')).toBeNull()
  })
})
