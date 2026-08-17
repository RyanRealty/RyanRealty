import { describe, expect, it } from 'vitest'
import { matchBlogPlace } from './match-blog-place'
import { publishBlogRelatedHomes } from './publish-blog-related-homes'

const redmond = matchBlogPlace({ slug: 'moving-to-redmond-oregon-guide' })!

function tile(id: string, price: number) {
  return {
    listingKey: id,
    listNumber: id,
    listPrice: price,
    beds: 3,
    baths: 2,
    sqft: 1800,
    streetNumber: '100',
    streetName: 'Main',
    streetSuffix: 'St',
    city: 'Redmond',
    subdivisionName: null,
    photoUrl: `https://example.com/${id}.jpg`,
    lat: 44.27,
    lng: -121.17,
  }
}

describe('publishBlogRelatedHomes', () => {
  it('publishes photo tiles and withholds an empty fetch', () => {
    const published = publishBlogRelatedHomes(redmond, [tile('A', 425_000), tile('B', 510_000)])
    expect(published?.items).toHaveLength(2)
    expect(published?.items[0]?.priceLabel).toBe('$425,000')
    expect(published?.items[0]?.href).toContain('/homes-for-sale/')
    expect(published?.source).toContain('getCityListings')
    expect(publishBlogRelatedHomes(redmond, [])).toBeNull()
    expect(publishBlogRelatedHomes(redmond, [{ ...tile('C', 1), photoUrl: null }])).toBeNull()
  })

  it('dedupes keys and caps the teaser', () => {
    const tiles = Array.from({ length: 10 }, (_, i) => tile(`k${i}`, 400_000 + i))
    tiles.push(tile('k0', 999_000))
    const published = publishBlogRelatedHomes(redmond, tiles)
    expect(published?.items).toHaveLength(6)
    expect(new Set(published?.items.map((item) => item.id)).size).toBe(6)
  })
})
