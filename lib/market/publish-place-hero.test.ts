import { describe, expect, it } from 'vitest'
import { isStockPlaceHeroUrl, publishNeighborhoodHero, publishPlaceHeroUrl } from './publish-place-hero'

describe('publishPlaceHeroUrl', () => {
  it('drops Unsplash stock (Century West founding)', () => {
    const stock = 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1920'
    const city = 'https://cdn.example.com/bend-old-mill.jpg'
    expect(isStockPlaceHeroUrl(stock)).toBe(true)
    expect(publishPlaceHeroUrl([stock, city])).toBe(city)
  })

  it('keeps a first-party curated photo', () => {
    expect(publishPlaceHeroUrl(['/images/communities/broken-top.jpg', 'https://images.unsplash.com/photo-1'])).toBe(
      '/images/communities/broken-top.jpg',
    )
  })

  it('marks a stock DB hero as unverified and uses the city fallback', () => {
    const published = publishNeighborhoodHero({
      curated: null,
      dbUrl: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1920',
      cityFallbackSrc: '/images/cities/bend.jpg',
    })
    expect(published).toEqual({ src: '/images/cities/bend.jpg', verified: false })
  })
})
