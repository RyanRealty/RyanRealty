import { describe, expect, it } from 'vitest'
import { isOffsiteTourHost } from './publish-listing-on-site-tour'

describe('isOffsiteTourHost', () => {
  it('Zillow 3D is a pointer, not an on-site model', () => {
    expect(
      isOffsiteTourHost(
        'https://www.zillow.com/view-imx/73652845-ebad-47bb-bf2a-877fb005ea35?setAttribution=mls&wl=true',
      ),
    ).toBe(true)
  })

  it('brochure microsites stay off the overlay iframe', () => {
    expect(isOffsiteTourHost('https://909nwdelawareave.com/')).toBe(true)
  })

  it('Matterport and Aryeo frame on-site', () => {
    expect(isOffsiteTourHost('https://my.matterport.com/show/?m=abc')).toBe(false)
    expect(isOffsiteTourHost('https://player.aryeo.com/videos/abc')).toBe(false)
  })
})
