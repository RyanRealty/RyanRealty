import { describe, expect, it } from 'vitest'
import {
  BLOG_PAGE_SIZE,
  blogIndexHref,
  blogIndexTotalPages,
  blogIndexTrail,
  decodeBlogCategorySegment,
  parseBlogPageSegment,
} from './blog-index-paths'

describe('blogIndexHref', () => {
  it('bare index for All / page 1, paths for the rest', () => {
    expect(blogIndexHref({ category: 'All', page: 1 })).toBe('/blog')
    expect(blogIndexHref({ category: '', page: 1 })).toBe('/blog')
    expect(blogIndexHref({ category: 'All', page: 0 })).toBe('/blog')
    expect(blogIndexHref({ category: 'All', page: 2 })).toBe('/blog/page/2')
    expect(blogIndexHref({ category: 'Market Reports', page: 1 })).toBe('/blog/category/Market%20Reports')
    expect(blogIndexHref({ category: 'Investment & Finance', page: 3 })).toBe(
      '/blog/category/Investment%20%26%20Finance/page/3',
    )
  })
})

describe('decodeBlogCategorySegment', () => {
  it('round-trips what blogIndexHref encodes and rejects empties and bad escapes', () => {
    expect(decodeBlogCategorySegment('Market%20Reports')).toBe('Market Reports')
    expect(decodeBlogCategorySegment('Investment%20%26%20Finance')).toBe('Investment & Finance')
    expect(decodeBlogCategorySegment(undefined)).toBeNull()
    expect(decodeBlogCategorySegment('')).toBeNull()
    expect(decodeBlogCategorySegment('%20')).toBeNull()
    expect(decodeBlogCategorySegment('%E0%A4%A')).toBeNull()
  })
})

describe('parseBlogPageSegment', () => {
  it('accepts integers from 2 up and nothing else', () => {
    expect(parseBlogPageSegment('2')).toBe(2)
    expect(parseBlogPageSegment('17')).toBe(17)
    expect(parseBlogPageSegment('1')).toBeNull()
    expect(parseBlogPageSegment('0')).toBeNull()
    expect(parseBlogPageSegment('-2')).toBeNull()
    expect(parseBlogPageSegment('2.5')).toBeNull()
    expect(parseBlogPageSegment('abc')).toBeNull()
    expect(parseBlogPageSegment(undefined)).toBeNull()
  })
})

describe('blogIndexTotalPages', () => {
  it('is at least one page and rounds up by the page size', () => {
    expect(BLOG_PAGE_SIZE).toBe(12)
    expect(blogIndexTotalPages(0)).toBe(1)
    expect(blogIndexTotalPages(12)).toBe(1)
    expect(blogIndexTotalPages(13)).toBe(2)
    expect(blogIndexTotalPages(80)).toBe(7)
  })
})

describe('blogIndexTrail', () => {
  it('deepens with the path and never links the last crumb', () => {
    expect(blogIndexTrail({ category: 'All', page: 1 })).toEqual([{ label: 'Home', href: '/' }, { label: 'Blog' }])
    expect(blogIndexTrail({ category: 'Market Reports', page: 1 })).toEqual([
      { label: 'Home', href: '/' },
      { label: 'Blog', href: '/blog' },
      { label: 'Market Reports' },
    ])
    expect(blogIndexTrail({ category: 'All', page: 3 })).toEqual([
      { label: 'Home', href: '/' },
      { label: 'Blog', href: '/blog' },
      { label: 'Page 3' },
    ])
    expect(blogIndexTrail({ category: 'Market Reports', page: 2 })).toEqual([
      { label: 'Home', href: '/' },
      { label: 'Blog', href: '/blog' },
      { label: 'Market Reports', href: '/blog/category/Market%20Reports' },
      { label: 'Page 2' },
    ])
  })
})
