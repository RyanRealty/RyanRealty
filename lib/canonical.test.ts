import { describe, it, expect } from 'vitest'
import { getCanonicalUrl } from './canonical'

describe('getCanonicalUrl', () => {
  it('returns full URL for simple path', () => {
    const result = getCanonicalUrl('/about')
    expect(result).toMatch(/\/about$/)
    expect(result).toMatch(/^https?:\/\//)
  })

  it('strips UTM parameters', () => {
    const result = getCanonicalUrl('/page?utm_source=google&utm_medium=cpc&utm_campaign=test')
    expect(result).not.toContain('utm_source')
    expect(result).not.toContain('utm_medium')
    expect(result).not.toContain('utm_campaign')
  })

  it('strips utm_term and utm_content', () => {
    const result = getCanonicalUrl('/page?utm_term=keyword&utm_content=ad1')
    expect(result).not.toContain('utm_term')
    expect(result).not.toContain('utm_content')
  })

  it('strips fbclid and gclid', () => {
    const result = getCanonicalUrl('/page?fbclid=abc123&gclid=def456')
    expect(result).not.toContain('fbclid')
    expect(result).not.toContain('gclid')
  })

  it('strips page and sort params', () => {
    const result = getCanonicalUrl('/search?page=2&sort=price')
    expect(result).not.toContain('page=')
    expect(result).not.toContain('sort=')
  })

  it('strips view and ref params', () => {
    const result = getCanonicalUrl('/listings?view=map&ref=home')
    expect(result).not.toContain('view=')
    expect(result).not.toContain('ref=')
  })

  it('preserves non-stripped params', () => {
    const result = getCanonicalUrl('/search?city=Bend&minPrice=300000')
    expect(result).toContain('city=Bend')
    expect(result).toContain('minPrice=300000')
  })

  it('normalizes double slashes in path', () => {
    const result = getCanonicalUrl('//about//team/')
    expect(result).not.toMatch(/\/\/about/)
  })

  it('handles path with no query string', () => {
    const result = getCanonicalUrl('/homes-for-sale/bend')
    expect(result).toMatch(/\/homes-for-sale\/bend$/)
  })

  it('handles path with only stripped params', () => {
    const result = getCanonicalUrl('/page?utm_source=google')
    expect(result).not.toContain('?')
  })
})
