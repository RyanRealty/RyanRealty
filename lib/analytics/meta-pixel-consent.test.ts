import { describe, expect, it } from 'vitest'
import { encodeConsent } from '@/test/consent-fixtures'
import {
  META_PIXEL_DEFAULT_FOLLOWS_ANALYTICS_STORAGE,
  metaPixelBootstrapScript,
  metaPixelMayLoad,
} from './meta-pixel-consent'

function runPixel(page: {
  cookie?: string
  search?: string
  globalPrivacyControl?: boolean
}): { loaded: boolean; inited: boolean; ldu: boolean } {
  const script = metaPixelBootstrapScript('1546878946032105')
  const inserted: { src?: string }[] = []
  const fakeScript = { parentNode: { insertBefore: (el: { src?: string }) => inserted.push(el) } }
  const window: { fbq?: ((...args: unknown[]) => void) & { queue?: unknown[][] }; _fbq?: unknown } = {}
  const document = {
    cookie: page.cookie ?? '',
    getElementsByTagName: () => [fakeScript],
    createElement: () => ({}) as { src?: string; async?: boolean },
    head: { appendChild: (el: { src?: string }) => inserted.push(el) },
  }
  new Function('window', 'document', 'location', 'navigator', script)(
    window,
    document,
    { search: page.search ?? '', pathname: '/', hostname: 'ryan-realty.com' },
    { globalPrivacyControl: page.globalPrivacyControl === true },
  )
  const queue = window.fbq?.queue ?? []
  const inited = queue.some((c) => Boolean(c) && (c as unknown[])[0] === 'init')
  const ldu = queue.some((c) => {
    const row = c as unknown[]
    return Boolean(row) && row[0] === 'dataProcessingOptions' && Array.isArray(row[1]) && row[1].includes('LDU')
  })
  return { loaded: inserted.length > 0, inited, ldu }
}

describe('metaPixelMayLoad', () => {
  it('denies restricted region, GPC, decline, and unknown region', () => {
    expect(metaPixelMayLoad({ stored: null, gpc: false, restrictedRegion: true })).toBe(false)
    expect(metaPixelMayLoad({ stored: null, gpc: true, restrictedRegion: false })).toBe(false)
    expect(
      metaPixelMayLoad({
        stored: { analytics: false, marketing: false },
        gpc: false,
        restrictedRegion: false,
      }),
    ).toBe(false)
  })

  it('grants US (unrestricted) with no answer when the analytics-follow flag is on', () => {
    expect(META_PIXEL_DEFAULT_FOLLOWS_ANALYTICS_STORAGE).toBe(true)
    expect(metaPixelMayLoad({ stored: null, gpc: false, restrictedRegion: false })).toBe(true)
  })

  it('does not load for a campaign-link arrival in a restricted or unknown region', () => {
    expect(
      metaPixelMayLoad({ stored: null, gpc: false, restrictedRegion: true, search: '?fbclid=1' }),
    ).toBe(false)
    expect(
      metaPixelMayLoad({ stored: null, gpc: false, restrictedRegion: true, search: '?utm_source=cma' }),
    ).toBe(false)
  })

  it('still loads for a US campaign-link arrival with no answer (the existing auto-grant)', () => {
    expect(
      metaPixelMayLoad({ stored: null, gpc: false, restrictedRegion: false, search: '?fbclid=1' }),
    ).toBe(true)
    expect(
      metaPixelMayLoad({ stored: null, gpc: false, restrictedRegion: false, search: '?utm_source=cma' }),
    ).toBe(true)
  })
})

describe('metaPixelBootstrapScript', () => {
  it('is valid JavaScript', () => {
    expect(() => new Function(metaPixelBootstrapScript('1546878946032105'))).not.toThrow()
  })

  it('does not load or init when restricted, GPC, declined, or unknown (no rr_cr)', () => {
    expect(runPixel({ cookie: 'rr_cr=1' })).toEqual({ loaded: false, inited: false, ldu: false })
    expect(runPixel({ globalPrivacyControl: true, cookie: 'rr_cr=0' })).toEqual({
      loaded: false,
      inited: false,
      ldu: false,
    })
    expect(
      runPixel({
        cookie: `rr_cr=0; ryan_realty_cookie_consent=${encodeConsent({ analytics: false, marketing: false })}`,
      }),
    ).toEqual({ loaded: false, inited: false, ldu: false })
    expect(runPixel({})).toEqual({ loaded: false, inited: false, ldu: false })
  })

  it('loads and inits for a granted US visitor, with LDU when marketing is not granted', () => {
    const us = runPixel({ cookie: 'rr_cr=0' })
    expect(us.loaded).toBe(true)
    expect(us.inited).toBe(true)
    expect(us.ldu).toBe(true)
  })

  it('does not load on a DE or unknown-region ad click with no answer', () => {
    expect(runPixel({ cookie: 'rr_cr=1', search: '?fbclid=abc' })).toEqual({
      loaded: false,
      inited: false,
      ldu: false,
    })
    expect(runPixel({ cookie: 'rr_cr=1', search: '?utm_source=cma' })).toEqual({
      loaded: false,
      inited: false,
      ldu: false,
    })
    expect(runPixel({ search: '?fbclid=abc' })).toEqual({ loaded: false, inited: false, ldu: false })
  })

  it('still loads on a US ad click with no answer', () => {
    const us = runPixel({ cookie: 'rr_cr=0', search: '?fbclid=abc' })
    expect(us.loaded).toBe(true)
    expect(us.inited).toBe(true)
  })

  it('does not run _fbp-setting init after a US decline', () => {
    const declined = runPixel({
      cookie: `rr_cr=0; ryan_realty_cookie_consent=${encodeConsent({ analytics: false, marketing: false })}`,
    })
    expect(declined.inited).toBe(false)
    expect(declined.loaded).toBe(false)
  })
})
