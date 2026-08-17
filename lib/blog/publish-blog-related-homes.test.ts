import { describe, expect, it } from 'vitest'
import {
  matchBuyablePlaceForPost,
  publishBlogContextualCta,
  publishBlogRelatedHomes,
} from './publish-blog-related-homes'

describe('matchBuyablePlaceForPost', () => {
  it('matches a named resort community', () => {
    const brasada = matchBuyablePlaceForPost({ slug: 'brasada-ranch-central-oregon' })
    expect(brasada).toMatchObject({
      kind: 'community',
      slug: 'brasada-ranch',
      href: '/communities/brasada-ranch',
    })
    const caldera = matchBuyablePlaceForPost({ slug: 'caldera-springs-buyers-guide' })
    expect(caldera).toMatchObject({
      kind: 'community',
      slug: 'caldera-springs',
      href: '/communities/caldera-springs',
    })
  })

  it('matches a city only with buy-intent in slug or title', () => {
    const neighborhoods = matchBuyablePlaceForPost({ slug: 'best-neighborhoods-bend-retirees' })
    expect(neighborhoods).toMatchObject({
      kind: 'city',
      slug: 'bend',
      href: '/cities/bend',
    })
  })

  it('does not invent a place on lifestyle posts', () => {
    expect(matchBuyablePlaceForPost({ slug: 'arts-culture-central-oregon' })).toBeNull()
    expect(
      matchBuyablePlaceForPost({
        slug: 'retirement-central-oregon',
        title: 'Retiring in Central Oregon',
      }),
    ).toBeNull()
    expect(matchBuyablePlaceForPost({ slug: 'dining-craft-beer-bend' })).toBeNull()
  })

  it('prefers a community alias over a city fallback', () => {
    expect(matchBuyablePlaceForPost({ slug: 'living-in-nw-crossing-bend' })).toMatchObject({
      kind: 'community',
      slug: 'northwest-crossing',
      href: '/communities/northwest-crossing',
    })
  })
})

describe('publishBlogRelatedHomes', () => {
  it('withholds the rail without a buyable place or without tiles', () => {
    expect(publishBlogRelatedHomes({ place: null, listingKeys: ['abc'] })).toBeNull()
    const place = matchBuyablePlaceForPost({ slug: 'brasada-ranch-central-oregon' })
    expect(publishBlogRelatedHomes({ place, listingKeys: [] })).toBeNull()
  })

  it('publishes listing keys for a matched place', () => {
    const place = matchBuyablePlaceForPost({ slug: 'brasada-ranch-central-oregon' })
    expect(publishBlogRelatedHomes({ place, listingKeys: ['k1', 'k1', ''] })).toEqual({
      place,
      listingKeys: ['k1'],
    })
  })
})

describe('publishBlogContextualCta', () => {
  it('sends place posts to that inventory door', () => {
    const place = matchBuyablePlaceForPost({ slug: 'brasada-ranch-central-oregon' })
    expect(publishBlogContextualCta(place)).toEqual({
      label: 'See Brasada Ranch homes',
      href: '/communities/brasada-ranch',
    })
  })

  it('sends lifestyle posts to talk to a broker', () => {
    expect(publishBlogContextualCta(null)).toEqual({
      label: 'Talk to a broker',
      href: '/contact',
    })
  })
})
