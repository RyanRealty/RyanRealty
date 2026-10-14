import { describe, expect, it } from 'vitest'
import { gtmBootstrapScript } from './gtm-bootstrap'
import { RESTRICTED_CONSENT_REGIONS } from './consent-regions'
import { consentModeDefaultJs } from './consent-defaults'
import { consentRegionRestrictedFromCookieHeader } from './consent-regions'
import { CONSENT_COOKIE, parseConsentCookie } from '@/lib/identity/consent'

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

  function consentDefaultsFromRun(page: {
    cookie?: string
    globalPrivacyControl?: boolean
  }): Array<Record<string, unknown>> {
    const script = gtmBootstrapScript('home', 'GTM-TEST123')
    const inserted: unknown[] = []
    const fakeScript = { parentNode: { insertBefore: (el: unknown) => inserted.push(el) } }
    const document = {
      cookie: page.cookie ?? '',
      getElementsByTagName: () => [fakeScript],
      createElement: () => ({}),
      head: { appendChild: (el: unknown) => inserted.push(el) },
    }
    const window: { dataLayer?: unknown[] } = { dataLayer: [] }
    new Function('window', 'document', 'location', 'navigator', 'dataLayer', script)(
      window,
      document,
      { search: '', pathname: '/', hostname: 'ryan-realty.com' },
      { userAgent: VISITOR_UA, webdriver: false, globalPrivacyControl: page.globalPrivacyControl === true },
      window.dataLayer,
    )
    const calls: Array<Record<string, unknown>> = []
    for (const entry of window.dataLayer ?? []) {
      if (!entry || typeof entry !== 'object') continue
      const row = entry as { 0?: unknown; 1?: unknown; 2?: unknown }
      if (row[0] === 'consent' && row[1] === 'default' && row[2] && typeof row[2] === 'object') {
        calls.push(row[2] as Record<string, unknown>)
      }
    }
    return calls
  }

  it('region-scoped denied default uses the shared restricted list; global default grants analytics; ad_* denied in both', () => {
    const defaults = consentDefaultsFromRun({})
    expect(defaults).toHaveLength(2)
    const regional = defaults.find((d) => Array.isArray(d.region))
    const global = defaults.find((d) => !Array.isArray(d.region))
    expect(regional).toBeTruthy()
    expect(global).toBeTruthy()
    expect(regional?.region).toEqual([...RESTRICTED_CONSENT_REGIONS])
    expect(consentModeDefaultJs()).toContain(JSON.stringify([...RESTRICTED_CONSENT_REGIONS]))
    for (const d of defaults) {
      expect(d.ad_storage).toBe('denied')
      expect(d.ad_user_data).toBe('denied')
      expect(d.ad_personalization).toBe('denied')
      expect(d.functionality_storage).toBe('granted')
      expect(d.security_storage).toBe('granted')
      expect(d.wait_for_update).toBe(500)
    }
    expect(regional?.analytics_storage).toBe('denied')
    expect(global?.analytics_storage).toBe('granted')
  })

  it('GPC sets a single all-denied default, including in the US', () => {
    const defaults = consentDefaultsFromRun({ globalPrivacyControl: true })
    expect(defaults).toHaveLength(1)
    expect(defaults[0]?.analytics_storage).toBe('denied')
    expect(defaults[0]?.ad_storage).toBe('denied')
    expect(defaults[0]?.region).toBeUndefined()
  })

  it('GPC beats a stored marketing accept and the US analytics default', () => {
    const raw = encodeURIComponent(JSON.stringify({ analytics: true, marketing: true }))
    const defaults = consentDefaultsFromRun({
      cookie: `ryan_realty_cookie_consent=${raw}`,
      globalPrivacyControl: true,
    })
    expect(defaults).toHaveLength(1)
    expect(defaults[0]?.analytics_storage).toBe('denied')
    expect(defaults[0]?.ad_storage).toBe('denied')
    expect(defaults[0]?.ad_user_data).toBe('denied')
    expect(defaults[0]?.ad_personalization).toBe('denied')
  })

  it('a stored decline sets a single all-denied default even without GPC', () => {
    const raw = encodeURIComponent(JSON.stringify({ analytics: false, marketing: false }))
    const defaults = consentDefaultsFromRun({ cookie: `ryan_realty_cookie_consent=${raw}` })
    expect(defaults).toHaveLength(1)
    expect(defaults[0]?.analytics_storage).toBe('denied')
    expect(defaults[0]?.ad_storage).toBe('denied')
  })

  it('a stored accept grants analytics in the default (ad_* only if marketing)', () => {
    const raw = encodeURIComponent(JSON.stringify({ analytics: true, marketing: false }))
    const defaults = consentDefaultsFromRun({ cookie: `ryan_realty_cookie_consent=${raw}` })
    expect(defaults).toHaveLength(1)
    expect(defaults[0]?.analytics_storage).toBe('granted')
    expect(defaults[0]?.ad_storage).toBe('denied')
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
    expect(loadsGtm({ pathname: '/', hostname: 'app.localhost' })).toBe(false)
    expect(loadsGtm({ pathname: '/', hostname: '::1' })).toBe(false)
    expect(loadsGtm({ pathname: '/', hostname: 'ryanrealty-git-x.vercel.app' })).toBe(false)
    expect(loadsGtm({ pathname: '/', hostname: 'ryan-realty.com', webdriver: true })).toBe(false)
    expect(loadsGtm({ pathname: '/', hostname: 'ryan-realty.com', cookie: 'a=b; rr_automation=1' })).toBe(false)
    expect(loadsGtm({ pathname: '/', hostname: 'ryan-realty.com', search: '?rr_automation=1' })).toBe(false)
    expect(loadsGtm({ pathname: '/', hostname: 'ryan-realty.com', userAgent: 'Mozilla/5.0 HeadlessChrome/146.0.0.0' })).toBe(false)
    expect(loadsGtm({ pathname: '/', hostname: 'ryan-realty.com', cookie: 'rr_internal=1; rr_vid=x' })).toBe(false)
  })
})

/**
 * GTM version 9 (2026-10-14): the bootstrap pushes the first-paint page_view
 * itself, right after gtm.js, and GTM's "GA4 - page_view" tag is its only
 * sender (the Google tag has send_page_view false). page_location carries no
 * contact id: the Google tag used to send a tracked email link's `_pid`.
 */
describe('first-paint page_view', () => {
  function run(href: string, opts: { cookie?: string } = {}): unknown[] {
    const u = new URL(href)
    const script = gtmBootstrapScript('listing', 'GTM-TEST123')
    const fakeScript = { parentNode: { insertBefore: () => {} } }
    const document = { cookie: opts.cookie ?? '', getElementsByTagName: () => [fakeScript], createElement: () => ({}), head: { appendChild: () => {} } }
    const window: { dataLayer?: unknown[] } = { dataLayer: [] }
    new Function('window', 'document', 'location', 'navigator', 'dataLayer', script)(
      window,
      document,
      { href, search: u.search, pathname: u.pathname, hostname: u.hostname },
      { userAgent: VISITOR_UA, webdriver: false },
      window.dataLayer,
    )
    return window.dataLayer ?? []
  }
  const eventName = (row: unknown) => (row && typeof row === 'object' ? (row as { event?: unknown }).event : undefined)

  it('pushes one page_view right after gtm.js, with page_type and page_location', () => {
    const rows = run('https://ryan-realty.com/homes-for-sale/bend/x-220216404')
    const events = rows.map(eventName).filter(Boolean)
    expect(events).toEqual(['gtm.js', 'page_view'])
    expect(rows[rows.length - 1]).toEqual({
      event: 'page_view',
      page_type: 'listing',
      page_location: 'https://ryan-realty.com/homes-for-sale/bend/x-220216404',
    })
  })

  it('strips _pid, _fuid and rr_doc from page_location and keeps the campaign', () => {
    const rows = run('https://ryan-realty.com/sell?agent=matt&_pid=13490&_fuid=22288&rr_doc=cma-x&utm_source=email')
    const view = rows.find((r) => eventName(r) === 'page_view') as { page_location: string }
    expect(view.page_location).toBe('https://ryan-realty.com/sell?agent=matt&utm_source=email')
  })

  it('leaves an address with nothing to strip byte for byte', () => {
    const href = 'https://ryan-realty.com/search?q=NW%20Crossing&beds=3'
    const view = run(href).find((r) => eventName(r) === 'page_view') as { page_location: string }
    expect(view.page_location).toBe(href)
  })

  it('pushes no page_view when the page is suppressed (a signed-in broker browser)', () => {
    const rows = run('https://ryan-realty.com/cities/bend', { cookie: 'rr_internal=1' })
    expect(rows.map(eventName).filter(Boolean)).toEqual([])
  })
})

/**
 * No personal information reaches GA4 (Matt 2026-10-14). The homepage "value
 * your home" box lands on /sell?address=<what the person typed>; before this,
 * GA4 got that as dl= on the page_view AND on every later hit, because the
 * "GA4 - dataLayer events" tag and the Google tag's own events read the
 * browser's location. The bootstrap now sets the safe address for every hit
 * (`gtag('set')`, before gtm.js) and the page_view carries it too.
 */
describe('first paint sends GA4 no personal information', () => {
  function run(href: string, referrer = ''): unknown[] {
    const u = new URL(href)
    const script = gtmBootstrapScript('sell', 'GTM-TEST123')
    const fakeScript = { parentNode: { insertBefore: () => {} } }
    const document = { cookie: '', referrer, getElementsByTagName: () => [fakeScript], createElement: () => ({}), head: { appendChild: () => {} } }
    const window: { dataLayer?: unknown[] } = { dataLayer: [] }
    new Function('window', 'document', 'location', 'navigator', 'dataLayer', script)(
      window,
      document,
      { href, search: u.search, pathname: u.pathname, hostname: u.hostname },
      { userAgent: VISITOR_UA, webdriver: false },
      window.dataLayer,
    )
    return window.dataLayer ?? []
  }
  const isArgs = (row: unknown): row is ArrayLike<unknown> => Object.prototype.toString.call(row) === '[object Arguments]'
  const setCommand = (rows: unknown[]) => rows.find((r) => isArgs(r) && r[0] === 'set' && typeof r[1] === 'object' && r[1] !== null && 'page_location' in (r[1] as object))

  it('the page_view and every other hit get the address without the typed home address', () => {
    const rows = run('https://ryan-realty.com/sell?from=%2F&address=123%20Test%20Ln%2C%20Bend%20OR#get-value', 'https://ryan-realty.com/')
    const view = rows.find((r) => (r as { event?: string })?.event === 'page_view') as { page_location: string }
    expect(view.page_location).toBe('https://ryan-realty.com/sell?from=%2F')
    const set = setCommand(rows) as ArrayLike<unknown>
    expect(set).toBeTruthy()
    expect(set[1]).toEqual({ page_location: 'https://ryan-realty.com/sell?from=%2F', page_referrer: 'https://ryan-realty.com/' })
    expect(JSON.stringify(rows.map((r) => (isArgs(r) ? Array.from(r) : r)))).not.toMatch(/Test Ln|Test%20Ln/)
  })

  it('sets the safe address BEFORE gtm.js, so the first hit already carries it', () => {
    const rows = run('https://ryan-realty.com/contact?inquiry=We%20want%20to%20sell')
    const setAt = rows.findIndex((r) => r === setCommand(rows))
    const gtmAt = rows.findIndex((r) => (r as { event?: string })?.event === 'gtm.js')
    expect(setAt).toBeGreaterThanOrEqual(0)
    expect(setAt).toBeLessThan(gtmAt)
    expect((setCommand(rows) as ArrayLike<unknown>)[1]).toEqual({ page_location: 'https://ryan-realty.com/contact' })
  })

  it('a referrer out of a CMA reaches GA4 as /cma/[document]', () => {
    const rows = run('https://ryan-realty.com/homes-for-sale/bend?rr_doc=cma-828-florida', 'https://ryan-realty.com/cma/cma-828-florida?_pid=7.document.sig')
    expect((setCommand(rows) as ArrayLike<unknown>)[1]).toEqual({
      page_location: 'https://ryan-realty.com/homes-for-sale/bend',
      page_referrer: 'https://ryan-realty.com/cma/[document]',
    })
  })
})

/**
 * Visitor intent (Matt 2026-10-14, GTM version 10): the first-paint page_view
 * carries the label and market this browser stored on an earlier page, read
 * inline before hydration, only when analytics consent holds.
 */
describe('first-paint page_view carries the stored visitor intent', () => {
  const STORED = JSON.stringify({ intent: 'seller', primaryMarket: 'bend', markets: { bend: 2 } })

  function firstPageView(opts: {
    cookie?: string
    stored?: string | null
    gpc?: boolean
    storageThrows?: boolean
  }): Record<string, unknown> | undefined {
    const href = 'https://ryan-realty.com/cities/bend'
    const u = new URL(href)
    const script = gtmBootstrapScript('city', 'GTM-TEST123')
    const fakeScript = { parentNode: { insertBefore: () => {} } }
    const document = { cookie: opts.cookie ?? '', getElementsByTagName: () => [fakeScript], createElement: () => ({}), head: { appendChild: () => {} } }
    const localStorage = {
      getItem: (key: string) => {
        if (opts.storageThrows) throw new Error('SecurityError')
        return key === 'rr_visitor_intent_v1' ? (opts.stored ?? null) : null
      },
    }
    const window: { dataLayer?: unknown[]; localStorage: typeof localStorage } = { dataLayer: [], localStorage }
    new Function('window', 'document', 'location', 'navigator', 'dataLayer', script)(
      window,
      document,
      { href, search: u.search, pathname: u.pathname, hostname: u.hostname },
      { userAgent: VISITOR_UA, webdriver: false, globalPrivacyControl: opts.gpc === true },
      window.dataLayer,
    )
    return (window.dataLayer ?? []).find(
      (r): r is Record<string, unknown> => !!r && typeof r === 'object' && (r as { event?: unknown }).event === 'page_view',
    )
  }

  const ACCEPT = `ryan_realty_cookie_consent=${encodeURIComponent(JSON.stringify({ analytics: true, marketing: false }))}`
  const DECLINE = `ryan_realty_cookie_consent=${encodeURIComponent(JSON.stringify({ analytics: false, marketing: false }))}`

  it('adds visitor_intent and primary_market to the page_view object itself', () => {
    expect(firstPageView({ cookie: `rr_cr=0`, stored: STORED })).toEqual({
      event: 'page_view',
      page_type: 'city',
      page_location: 'https://ryan-realty.com/cities/bend',
      visitor_intent: 'seller',
      primary_market: 'bend',
    })
    expect(firstPageView({ cookie: `a=b; ${ACCEPT}; rr_cr=1`, stored: STORED })).toMatchObject({ visitor_intent: 'seller' })
  })

  it('an empty consent cookie is no answer (parseConsentCookie), so the region decides', () => {
    expect(firstPageView({ cookie: 'ryan_realty_cookie_consent=; rr_cr=0', stored: STORED })).toMatchObject({ visitor_intent: 'seller' })
    expect(firstPageView({ cookie: 'ryan_realty_cookie_consent=; rr_cr=1', stored: STORED })).not.toHaveProperty('visitor_intent')
  })

  it('reads nothing without analytics consent: GPC, a stored decline, or no answer in a restricted region', () => {
    for (const opts of [
      { cookie: `rr_cr=0`, stored: STORED, gpc: true },
      { cookie: `${DECLINE}; rr_cr=0`, stored: STORED },
      { cookie: `rr_cr=1`, stored: STORED },
      { cookie: '', stored: STORED },
    ]) {
      const view = firstPageView(opts)
      expect(view).toBeDefined()
      expect(view).not.toHaveProperty('visitor_intent')
      expect(view).not.toHaveProperty('primary_market')
    }
  })

  it('decides consent exactly as hasAnalyticsConsent does (GPC, stored answer, else the region cookie)', () => {
    const answers = ['', `${CONSENT_COOKIE}=`, ACCEPT, DECLINE, `${CONSENT_COOKIE}=all`, `${CONSENT_COOKIE}=garbage`]
    const regions = ['', 'rr_cr=0', 'rr_cr=1']
    for (const answer of answers)
      for (const region of regions)
        for (const gpc of [false, true]) {
          const cookie = [answer, region].filter(Boolean).join('; ')
          // hasAnalyticsConsent (components/CookieConsentBanner.tsx), from the same parts it is built from.
          const raw = cookie.split('; ').find((row) => row.startsWith(`${CONSENT_COOKIE}=`))?.split('=')[1]
          const stored = parseConsentCookie(raw)
          const expected = !gpc && (stored !== null ? stored.analytics : !consentRegionRestrictedFromCookieHeader(cookie))
          const view = firstPageView({ cookie, stored: STORED, gpc })
          expect(view?.visitor_intent === 'seller', `${cookie || '(no cookie)'} gpc=${gpc}`).toBe(expected)
        }
  })

  it('sends the plain page_view when storage is empty, blocked or holds garbage', () => {
    const plain = { event: 'page_view', page_type: 'city', page_location: 'https://ryan-realty.com/cities/bend' }
    expect(firstPageView({ cookie: 'rr_cr=0', stored: null })).toEqual(plain)
    expect(firstPageView({ cookie: 'rr_cr=0', storageThrows: true })).toEqual(plain)
    expect(firstPageView({ cookie: 'rr_cr=0', stored: '{nope' })).toEqual(plain)
    expect(firstPageView({ cookie: 'rr_cr=0', stored: JSON.stringify({ intent: 'landlord', primaryMarket: '<script>' }) })).toEqual(plain)
  })
})
