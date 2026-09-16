import { describe, expect, it } from 'vitest'
import type { ResortAmenity } from '@/lib/resort-community-content'
import {
  amenityItemListItems,
  buildCommunityAmenityBoard,
  integerShares,
  joinEnglish,
} from './community-amenities'

const amenities: ResortAmenity[] = [
  { category: 'Dining', name: 'Coorie', access: 'Open to public', description: 'Course-facing dining.' },
  { category: 'Dining', name: 'The Row', access: 'Walk-in' },
  { category: 'Wellness', name: 'Tetherow Spa', blog_slug: 'tetherow-spa-guide' },
]

describe('integerShares', () => {
  it('sums to 100 and prefers the largest remainder', () => {
    expect(integerShares([3, 1])).toEqual([75, 25])
    expect(integerShares([1, 1, 1])).toEqual([34, 33, 33])
    expect(integerShares([0, 0])).toEqual([0, 0])
  })
})

describe('joinEnglish', () => {
  it('joins two and three names without an invented serial comma on a pair', () => {
    expect(joinEnglish(['Coorie'])).toBe('Coorie')
    expect(joinEnglish(['Coorie', 'The Row'])).toBe('Coorie and The Row')
    expect(joinEnglish(['Coorie', 'The Row', 'Tetherow Spa'])).toBe('Coorie, The Row, and Tetherow Spa')
  })
})

describe('buildCommunityAmenityBoard', () => {
  it('returns null when no named amenity is on file', () => {
    expect(
      buildCommunityAmenityBoard({
        placeName: 'Tetherow',
        amenities: [{ category: 'Dining', name: '   ' }],
        browseHref: '/homes-for-sale/bend/tetherow',
      }),
    ).toBeNull()
  })

  it('builds a mix page plus one page per category from the authored list', () => {
    const board = buildCommunityAmenityBoard({
      placeName: 'Tetherow',
      amenities,
      amenityPosts: { 'tetherow-spa-guide': { slug: 'tetherow-spa-guide', title: 'The spa at Tetherow' } },
      browseHref: '/homes-for-sale/bend/tetherow',
    })
    expect(board).not.toBeNull()
    expect(board?.total).toBe(3)
    expect(board?.claim).toContain('3 amenities')
    expect(board?.claim).toContain('Coorie')
    expect(board?.mix).toHaveLength(2)
    expect(board?.mix.map((s) => s.label)).toEqual(['Dining', 'Wellness'])
    expect(board?.mix.reduce((sum, s) => sum + s.pct, 0)).toBe(100)
    expect(board?.categories).toHaveLength(2)
    expect(board?.categories[0]?.pillHref).toBe('/homes-for-sale/bend/tetherow')
    expect(board?.categories[1]?.pillHref).toBe('/blog/tetherow-spa-guide')
    expect(board?.source).toMatch(/authored Tetherow amenity list/i)
  })
})

describe('amenityItemListItems', () => {
  it('uses a recorded URL, then a published blog, then the section anchor', () => {
    const board = buildCommunityAmenityBoard({
      placeName: 'Tetherow',
      amenities: [
        { category: 'Trails', name: 'Shevlin Park', url: 'https://www.bendparksandrec.org/park/shevlin-park/' },
        ...amenities,
      ],
      amenityPosts: { 'tetherow-spa-guide': { slug: 'tetherow-spa-guide', title: 'The spa at Tetherow' } },
      browseHref: '/homes-for-sale/bend/tetherow',
    })
    const items = amenityItemListItems(
      board!,
      '/communities/tetherow',
      [
        { category: 'Trails', name: 'Shevlin Park', url: 'https://www.bendparksandrec.org/park/shevlin-park/' },
        ...amenities,
      ],
      { 'tetherow-spa-guide': { slug: 'tetherow-spa-guide', title: 'The spa at Tetherow' } },
    )
    expect(items[0]?.url).toBe('https://www.bendparksandrec.org/park/shevlin-park/')
    expect(items.find((item) => item.name === 'Tetherow Spa')?.url).toBe('/blog/tetherow-spa-guide')
    expect(items.find((item) => item.name === 'Coorie')?.url).toBe('/communities/tetherow#amenities')
  })
})
