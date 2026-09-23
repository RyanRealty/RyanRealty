import { describe, expect, it } from 'vitest'
import { gtmBootstrapScript } from './gtm-bootstrap'

/**
 * TRACK-2 (visibility audit 2026-09-22): a stray `}}` inside the inline GTM
 * bootstrap made the whole script a SyntaxError, so gtm.js never loaded and
 * browser GA4 read zero for five days while every string-matching gate passed.
 * These tests parse the exact string the page ships.
 */
describe('gtmBootstrapScript', () => {
  it('is valid JavaScript (new Function parses without running it)', () => {
    const script = gtmBootstrapScript('home', 'GTM-TEST123')
    expect(() => new Function(script)).not.toThrow()
  })

  it('still parses when the page type carries a quote or a backslash', () => {
    for (const pageType of ["o'neil", 'a\\b', "x'); alert(1); ('"]) {
      const script = gtmBootstrapScript(pageType, 'GTM-TEST123')
      expect(() => new Function(script)).not.toThrow()
    }
  })

  it('loads gtm.js for the container id', () => {
    const script = gtmBootstrapScript('home', 'GTM-TEST123')
    expect(script).toContain("'https://www.googletagmanager.com/gtm.js?id='+i+dl")
    expect(script).toContain("'dataLayer','GTM-TEST123');")
    expect(script).toContain("'gtm.start':\nnew Date().getTime(),event:'gtm.js'")
  })

  it('pushes consent defaults and page_type before the gtm.start event', () => {
    const script = gtmBootstrapScript('listing', 'GTM-TEST123')
    const consent = script.indexOf("gtag('consent','default'")
    const pageType = script.indexOf("page_type:'listing'")
    const start = script.indexOf("'gtm.start'")
    expect(consent).toBeGreaterThan(-1)
    expect(pageType).toBeGreaterThan(consent)
    expect(start).toBeGreaterThan(pageType)
  })

  it('runs and queues the gtm.js event on a stub window', () => {
    const script = gtmBootstrapScript('home', 'GTM-TEST123')
    const inserted: { src?: string }[] = []
    const fakeScript = { parentNode: { insertBefore: (el: { src?: string }) => inserted.push(el) } }
    const document = {
      cookie: '',
      getElementsByTagName: () => [fakeScript],
      createElement: () => ({}) as { src?: string; async?: boolean },
      head: { appendChild: (el: { src?: string }) => inserted.push(el) },
    }
    const window: { dataLayer?: unknown[] } = {}
    const location = { search: '' }
    const run = new Function('window', 'document', 'location', 'dataLayer', `${script}`)
    // The script references the global dataLayer through gtag(); hand it the same array.
    window.dataLayer = []
    run(window, document, location, window.dataLayer)
    expect(inserted).toHaveLength(1)
    expect(inserted[0]?.src).toBe('https://www.googletagmanager.com/gtm.js?id=GTM-TEST123')
    expect(
      (window.dataLayer ?? []).some((e) => typeof e === 'object' && e !== null && (e as { event?: string }).event === 'gtm.js'),
    ).toBe(true)
  })
})
