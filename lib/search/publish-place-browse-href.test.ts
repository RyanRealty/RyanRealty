import { describe, expect, it } from 'vitest'
import {
  isPlaceFilteredSearchHref,
  publishPlaceBrowseHref,
  publishPlaceHeroCta,
} from './publish-place-browse-href'

describe('publishPlaceBrowseHref', () => {
  it('keeps a city / plat / neighborhood listings path', () => {
    expect(publishPlaceBrowseHref('/homes-for-sale/redmond/ridge-at-eagle-crest')).toBe(
      '/homes-for-sale/redmond/ridge-at-eagle-crest',
    )
    expect(publishPlaceBrowseHref('/homes-for-sale/bend')).toBe('/homes-for-sale/bend')
    expect(publishPlaceBrowseHref('/homes-for-sale/bend/awbrey-butte')).toBe(
      '/homes-for-sale/bend/awbrey-butte',
    )
  })

  it('withholds the regional inventory door', () => {
    expect(publishPlaceBrowseHref('/homes-for-sale')).toBeNull()
    expect(publishPlaceBrowseHref('/homes-for-sale?view=list')).toBeNull()
    expect(publishPlaceBrowseHref('/homes-for-sale/')).toBeNull()
    expect(isPlaceFilteredSearchHref('/homes-for-sale?view=list')).toBe(false)
  })

  it('withholds on-page jumps and empty hrefs', () => {
    expect(publishPlaceBrowseHref('#homes')).toBeNull()
    expect(publishPlaceBrowseHref('')).toBeNull()
    expect(publishPlaceBrowseHref(null)).toBeNull()
  })
})

describe('publishPlaceHeroCta', () => {
  it('keeps a plat listings path', () => {
    expect(
      publishPlaceHeroCta('/homes-for-sale/redmond/ridge-at-eagle-crest', 'See Ridge at Eagle Crest homes'),
    ).toEqual({
      href: '/homes-for-sale/redmond/ridge-at-eagle-crest',
      label: 'See Ridge at Eagle Crest homes',
    })
  })

  it('withholds the regional inventory door so KbHero cannot default to it', () => {
    expect(publishPlaceHeroCta('/homes-for-sale?view=list', 'See homes')).toBeNull()
    expect(publishPlaceHeroCta('/homes-for-sale', 'See homes')).toBeNull()
  })
})
