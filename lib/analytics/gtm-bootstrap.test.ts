import { describe, expect, it } from 'vitest'
import { gtmBootstrapScript } from './gtm-bootstrap'

const VISITOR_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'

/** Runs the shipped bootstrap on a stub page; returns whether gtm.js was requested. */
function loadsGtm(page: { pathname: string; hostname: string; search?: string; cookie?: string; userAgent?: string; webdriver?: boolean }): boolean {
  const script = gtmBootstrapScript('other', 'GTM-TEST123')
  const inserted: unknown[] = []
  const fakeScript = { parentNode: { insertBefore: (el: unknown) => inserted.push(el) } }
  const document = { cookie: page.cookie ?? '', getElementsByTagName: () => [fakeScript], createElement: () => ({}), head: { appendChild: (el: unknown) => inserted.push(el) } }
  const window: { dataLayer?: unknown[] } = { dataLayer: [] }
  new Function('window', 'document', 'location', 'navigator', 'dataLayer', script)(
    window,
    document,
    { search: page.search ?? '', pathname: page.pathname, hostname: page.hostname },
    { userAgent: page.userAgent ?? VISITOR_UA, webdriver: page.webdriver ?? false },
    window.dataLayer,
  )
  return inserted.length > 0
}

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
    const location = { search: '', pathname: '/', hostname: 'ryan-realty.com' }
    const navigator = { userAgent: VISITOR_UA, webdriver: false }
    const run = new Function('window', 'document', 'location', 'navigator', 'dataLayer', `${script}`)
    // The script references the global dataLayer through gtag(); hand it the same array.
    window.dataLayer = []
    run(window, document, location, navigator, window.dataLayer)
    expect(inserted).toHaveLength(1)
    expect(inserted[0]?.src).toBe('https://www.googletagmanager.com/gtm.js?id=GTM-TEST123')
    expect(
      (window.dataLayer ?? []).some((e) => typeof e === 'object' && e !== null && (e as { event?: string }).event === 'gtm.js'),
    ).toBe(true)
  })

  it('never loads gtm.js on a page whose address carries a secret (a signing link)', () => {
    const script = gtmBootstrapScript('other', 'GTM-TEST123')
    for (const [pathname, loads] of [['/sign/Yi4wyKxKtxZNhijQFu1lKJu9WWofkfJNdzW0bFkwtpc', false], ['/cma-drafts/42', false], ['/listings/123', true]] as const) {
      const inserted: unknown[] = []
      const fakeScript = { parentNode: { insertBefore: (el: unknown) => inserted.push(el) } }
      const document = { cookie: '', getElementsByTagName: () => [fakeScript], createElement: () => ({}), head: { appendChild: (el: unknown) => inserted.push(el) } }
      const window: { dataLayer?: unknown[] } = { dataLayer: [] }
      new Function('window', 'document', 'location', 'navigator', 'dataLayer', script)(
        window,
        document,
        { search: '', pathname, hostname: 'ryan-realty.com' },
        { userAgent: VISITOR_UA, webdriver: false },
        window.dataLayer,
      )
      expect(inserted.length > 0).toBe(loads)
    }
  })

  it('loads gtm.js for an outside visitor and for nobody GA4 must not count (Matt 2026-10-05)', () => {
    expect(loadsGtm({ pathname: '/homes-for-sale', hostname: 'ryan-realty.com' })).toBe(true)
    expect(loadsGtm({ pathname: '/sell', hostname: 'seller.ryan-realty.com' })).toBe(true)
    expect(loadsGtm({ pathname: '/admin', hostname: 'ryan-realty.com' })).toBe(false)
    expect(loadsGtm({ pathname: '/admin/crm/12', hostname: 'ryan-realty.com' })).toBe(false)
    expect(loadsGtm({ pathname: '/', hostname: '127.0.0.1' })).toBe(false)
    expect(loadsGtm({ pathname: '/', hostname: 'localhost' })).toBe(false)
    expect(loadsGtm({ pathname: '/', hostname: 'ryanrealty-git-x.vercel.app' })).toBe(false)
    expect(loadsGtm({ pathname: '/', hostname: 'ryan-realty.com', webdriver: true })).toBe(false)
    expect(loadsGtm({ pathname: '/', hostname: 'ryan-realty.com', cookie: 'a=b; rr_automation=1' })).toBe(false)
    expect(loadsGtm({ pathname: '/', hostname: 'ryan-realty.com', search: '?rr_automation=1' })).toBe(false)
    expect(loadsGtm({ pathname: '/', hostname: 'ryan-realty.com', userAgent: 'Mozilla/5.0 HeadlessChrome/146.0.0.0' })).toBe(false)
    expect(loadsGtm({ pathname: '/', hostname: 'ryan-realty.com', cookie: 'rr_internal=1; rr_vid=x' })).toBe(false)
  })
})
