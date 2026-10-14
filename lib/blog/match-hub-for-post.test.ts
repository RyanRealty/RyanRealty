import { describe, expect, it } from 'vitest'
import { matchHubForPost } from './match-hub-for-post'

describe('matchHubForPost', () => {
  it('prefers the community hub when a resort is named', () => {
    expect(matchHubForPost({ slug: 'tetherow-resort-living-real-estate' })).toEqual({
      kind: 'community',
      slug: 'tetherow',
      label: 'Tetherow',
      href: '/communities/tetherow',
      anchor: 'Tetherow homes for sale',
    })
  })

  it('sends a Bend post to the city inventory hub', () => {
    expect(matchHubForPost({ slug: 'best-neighborhoods-bend-retirees' })).toEqual({
      kind: 'city',
      slug: 'bend',
      label: 'Bend',
      href: '/homes-for-sale/bend',
      anchor: 'Bend homes for sale',
    })
  })

  it('matches La Pine and Sisters from title or tags', () => {
    expect(
      matchHubForPost({ slug: 'south-county-guide', title: 'What to know about La Pine' })?.href,
    ).toBe('/homes-for-sale/la-pine')
    expect(
      matchHubForPost({ slug: 'weekend-trips', tags: ['Sisters'] })?.anchor,
    ).toBe('Sisters homes for sale')
  })

  it('returns null when no city or community is named', () => {
    expect(matchHubForPost({ slug: 'arts-culture-central-oregon' })).toBeNull()
  })
})
