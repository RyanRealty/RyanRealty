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

  it('Zillow 3D Home capture is off-site; Vimeo walkthrough is not', () => {
    expect(
      isOffsiteTourHost(
        'https://www.zillow.com/view-3d-home/865acc3a-e3d4-4402-ab96-f77e09bc5273/?utm_source=captureapp',
      ),
    ).toBe(true)
    expect(isOffsiteTourHost('https://vimeo.com/1208618330?fl=pl&fe=sh')).toBe(false)
    expect(isOffsiteTourHost('https://player.vimeo.com/video/1208618330')).toBe(false)
  })
})
