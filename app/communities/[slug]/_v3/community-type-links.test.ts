import { describe, expect, it } from 'vitest'
import {
  communityAllRealEstateLabel,
  communityTypeDownLinks,
  isCommunityAnswerSlug,
} from './community-type-links'

describe('communityTypeDownLinks', () => {
  it('Brasada links houses and lots with type anchors', () => {
    expect(
      communityTypeDownLinks({
        slug: 'brasada-ranch',
        name: 'Brasada Ranch',
        types: ['homes', 'lots'],
      }),
    ).toEqual([
      { href: '/communities/brasada-ranch/types/single-family', label: 'Brasada Ranch houses' },
      { href: '/communities/brasada-ranch/types/lots-and-land', label: 'Brasada Ranch lots' },
    ])
  })

  it('omits a type the listed set does not carry, and never names townhomes except Broken Top', () => {
    expect(
      communityTypeDownLinks({
        slug: 'tetherow',
        name: 'Tetherow',
        types: ['homes', 'attached', 'lots'],
      }),
    ).toEqual([
      { href: '/communities/tetherow/types/single-family', label: 'Tetherow houses' },
      { href: '/communities/tetherow/types/lots-and-land', label: 'Tetherow lots' },
    ])
    expect(
      communityTypeDownLinks({
        slug: 'broken-top',
        name: 'Broken Top',
        types: ['homes', 'attached', 'lots'],
      }),
    ).toEqual([
      { href: '/communities/broken-top/types/single-family', label: 'Broken Top houses' },
      { href: '/communities/broken-top/types/townhomes', label: 'Broken Top townhomes' },
      { href: '/communities/broken-top/types/lots-and-land', label: 'Broken Top lots' },
    ])
  })

  it('is empty for every other community', () => {
    expect(
      communityTypeDownLinks({ slug: 'sunriver', name: 'Sunriver', types: ['homes', 'lots'] }),
    ).toEqual([])
    expect(isCommunityAnswerSlug('sunriver')).toBe(false)
    expect(communityAllRealEstateLabel('Broken Top')).toBe('All Broken Top real estate')
  })
})
