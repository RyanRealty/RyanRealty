import { describe, expect, it } from 'vitest'
import { matchBlogCity, matchBlogPlace } from './match-blog-place'

describe('matchBlogPlace', () => {
  it('matches a resort community over the city in the same slug', () => {
    const place = matchBlogPlace({ slug: 'eagle-crest-affordable-resort-redmond' })
    expect(place?.kind).toBe('community')
    expect(place?.slug).toBe('eagle-crest')
    expect(place?.href).toBe('/communities/eagle-crest')
    expect(place?.queryNames).toContain('Eagle Crest')
  })

  it('matches a city guide', () => {
    const place = matchBlogPlace({ slug: 'moving-to-redmond-oregon-guide' })
    expect(place).toEqual({
      kind: 'city',
      slug: 'redmond',
      label: 'Redmond',
      href: '/cities/redmond',
      queryNames: ['Redmond'],
    })
  })

  it('matches Bend in a housing-rules slug', () => {
    const place = matchBlogPlace({ slug: 'oregons-hb-2001-middle-housing-bend' })
    expect(place?.kind).toBe('city')
    expect(place?.slug).toBe('bend')
  })

  it('returns null for a checklist with no place', () => {
    expect(matchBlogPlace({ slug: 'preparing-home-for-sale-checklist' })).toBeNull()
    expect(matchBlogCity({ slug: 'preparing-home-for-sale-checklist' })).toBeNull()
  })

  it('returns null for a region-only arts post', () => {
    expect(matchBlogPlace({ slug: 'arts-culture-central-oregon' })).toBeNull()
  })
})
