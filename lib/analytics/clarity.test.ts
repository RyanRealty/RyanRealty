/**
 * @vitest-environment jsdom
 *
 * Microsoft Clarity (Matt 2026-10-14): when it may record, what it is told, and
 * that nothing it is told can carry a name, an email or a phone.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  CLARITY_BLOCKING_PARAMS,
  CLARITY_CONSENT_DENIED,
  CLARITY_PROJECT_ID,
  clarityConsent,
  clarityState,
  clarityTags,
  clarityTagUrl,
  clarityUserId,
  decideClarity,
  haltClarity,
  rememberClarityUserId,
  resetClarityRuntime,
  startClarity,
  withdrawClarity,
  type ClarityDecisionInput,
  type ClarityWindow,
} from './clarity'

const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
const HASH = 'a'.repeat(64)
const CRM_ID = `crm-${HASH}`

const ALLOWED: ClarityDecisionInput = {
  projectId: 'abc123def4',
  nonProductionBuild: false,
  pathname: '/homes-for-sale/bend',
  host: 'ryan-realty.com',
  search: '',
  userAgent: CHROME_UA,
  webdriver: false,
  cookieHeader: '',
  gpc: false,
  analyticsConsent: true,
}

function decide(over: Partial<ClarityDecisionInput>) {
  return decideClarity({ ...ALLOWED, ...over })
}

describe('CLARITY_PROJECT_ID', () => {
  it('ships null, so nothing loads until Matt sends the id', () => {
    expect(CLARITY_PROJECT_ID).toBeNull()
    expect(decideClarity({ ...ALLOWED, projectId: CLARITY_PROJECT_ID })).toEqual({ load: false, reason: 'no-project-id' })
  })
})

describe('decideClarity', () => {
  it('records a public page for a consenting outside visitor', () => {
    expect(decide({})).toEqual({ load: true, reason: null })
    expect(decide({ pathname: '/', search: '?utm_source=facebook&agent=matt&bbox=1,2,3,4' }).load).toBe(true)
    expect(decide({ host: 'seller.ryan-realty.com' }).load).toBe(true)
  })

  it('needs a project id', () => {
    for (const projectId of [null, undefined, '', 'has space', 'x'.repeat(33), '../evil']) {
      expect(decide({ projectId }).reason).toBe('no-project-id')
    }
  })

  it('never loads on a dev or preview build', () => {
    expect(decide({ nonProductionBuild: true }).reason).toBe('non-production-build')
  })

  it('follows the GA4 suppression rule: admin and the CRM, other hosts, automation, broker browsers', () => {
    expect(decide({ pathname: '/admin' }).reason).toBe('admin-path')
    expect(decide({ pathname: '/admin/crm/people/12' }).reason).toBe('admin-path')
    expect(decide({ host: 'localhost' }).reason).toBe('non-production-host')
    expect(decide({ host: 'ryanrealty.vercel.app' }).reason).toBe('non-production-host')
    expect(decide({ userAgent: 'Mozilla/5.0 HeadlessChrome/129.0' }).reason).toBe('automation')
    expect(decide({ webdriver: true }).reason).toBe('automation')
    expect(decide({ cookieHeader: 'rr_automation=1' }).reason).toBe('automation')
    expect(decide({ cookieHeader: 'a=b; rr_internal=1' }).reason).toBe('internal-user')
  })

  it('skips every page PageViewTracker skips (an address that is a secret)', () => {
    for (const pathname of ['/sign/abcdefgh12345', '/cma-drafts/42', '/alerts/unsubscribe', '/newsletter/unsubscribe']) {
      expect(decide({ pathname }).reason).toBe('private-path')
    }
  })

  it('skips the signed-in personal areas', () => {
    for (const pathname of ['/account', '/account/profile', '/account/transactions', '/dashboard', '/Account/']) {
      expect(decide({ pathname }).reason).toBe('personal-area')
    }
    expect(decide({ pathname: '/accounting-help' }).load).toBe(true)
  })

  it('skips an address that names a person or carries a secret', () => {
    for (const key of CLARITY_BLOCKING_PARAMS) {
      expect(decide({ search: `?utm_source=crm&${key}=x` }).reason).toBe('identity-in-url')
    }
    expect(decide({ search: '?_pid=' }).reason).toBe('identity-in-url')
    expect(decide({ search: '?EMAIL=a%40b.co' }).reason).toBe('identity-in-url')
    // Free text the public forms put in the address.
    expect(decide({ pathname: '/sell', search: '?address=123%20NW%20Main%20St%2C%20Bend' }).reason).toBe('identity-in-url')
    expect(decide({ pathname: '/contact', search: '?inquiry=Hi%2C%20call%20me' }).reason).toBe('identity-in-url')
    expect(decide({ pathname: '/auth/confirm', search: '?token_hash=abc&type=email' }).reason).toBe('identity-in-url')
    expect(decide({ pathname: '/contact', search: '?listingKey=123&intent=tour' }).load).toBe(true)
  })

  it('blocks every secret param the error-report scrubber knows', async () => {
    const { SECRET_URL_PARAMS } = await import('./private-paths')
    for (const key of SECRET_URL_PARAMS) expect(CLARITY_BLOCKING_PARAMS).toContain(key)
  })

  it('needs analytics consent, and Global Privacy Control always wins', () => {
    expect(decide({ analyticsConsent: false })).toEqual({ load: false, reason: 'no-analytics-consent' })
    expect(decide({ gpc: true, analyticsConsent: true })).toEqual({ load: false, reason: 'gpc' })
  })
})

describe('values sent to Clarity', () => {
  it('tags the page type, the visitor intent and the primary market', () => {
    expect(clarityTags({ pathname: '/homes-for-sale/bend', visitorIntent: 'buyer', primaryMarket: 'bend' })).toEqual([
      ['page_type', 'search'],
      ['visitor_intent', 'buyer'],
      ['primary_market', 'bend'],
    ])
    expect(clarityTags({ pathname: '/' })).toEqual([['page_type', 'home']])
    expect(clarityTags({ pathname: '/communities/tetherow', visitorIntent: 'both', primaryMarket: 'tetherow' })).toEqual([
      ['page_type', 'community'],
      ['visitor_intent', 'both'],
      ['primary_market', 'tetherow'],
    ])
  })

  it('drops any value that is not its expected shape', () => {
    const bad = ['matt@ryan-realty.com', '5415550100', '(541) 555-0100', 'John Smith', 'x'.repeat(37), '', '-bend', 'Bend']
    for (const v of bad) {
      const tags = clarityTags({ pathname: '/', visitorIntent: v, primaryMarket: v })
      expect(tags, v).toEqual([['page_type', 'home']])
    }
    expect(clarityTags({ pathname: '/', visitorIntent: 'shopper' })).toEqual([['page_type', 'home']])
    expect(clarityTags({ pathname: '/', visitorIntent: 42, primaryMarket: { slug: 'bend' } })).toEqual([['page_type', 'home']])
  })

  it('identifies only with the hashed id GA4 gets as user_id', () => {
    expect(clarityUserId(CRM_ID)).toBe(CRM_ID)
    expect(clarityUserId(`em-${'0123456789abcdef'.repeat(4)}`)).toBe(`em-${'0123456789abcdef'.repeat(4)}`)
    for (const v of ['matt@ryan-realty.com', '64115', `crm-${'a'.repeat(63)}`, `crm-${'A'.repeat(64)}`, `x-${HASH}`, null, 64115]) {
      expect(clarityUserId(v)).toBeNull()
    }
  })

  it('maps the banner answer onto consentv2', () => {
    expect(clarityConsent({ analytics: true, marketing: false })).toEqual({ ad_Storage: 'denied', analytics_Storage: 'granted' })
    expect(clarityConsent({ analytics: true, marketing: true })).toEqual({ ad_Storage: 'granted', analytics_Storage: 'granted' })
    expect(clarityConsent({ analytics: false, marketing: true })).toEqual(CLARITY_CONSENT_DENIED)
  })

  it('loads the official tag address', () => {
    expect(clarityTagUrl('abc123def4')).toBe('https://www.clarity.ms/tag/abc123def4')
  })
})

// ── Runtime ────────────────────────────────────────────────────────────────

type Call = unknown[]

function queued(w: ClarityWindow): Call[] {
  return ((w.clarity?.q ?? []) as ArrayLike<unknown>[]).map((a) => Array.from(a))
}

/** Is the fake clarity.js recording (start / stop, as core.active()). */
const fake = { active: false }

/** Swap the snippet stub for a recorder, as clarity.js does once it loads. */
function loadClarityJs(w: ClarityWindow): Call[] {
  const calls: Call[] = queued(w)
  fake.active = true
  const fn = (...args: unknown[]) => {
    calls.push(args)
    if (args[0] === 'stop') fake.active = false
    if (args[0] === 'start') fake.active = true
  }
  ;(fn as unknown as { v: string }).v = 'test'
  w.clarity = fn
  return calls
}

/**
 * clarity-js's own history wrapper (src/core/history.ts): after the address
 * changes, an ACTIVE Clarity stops and restarts itself on the new page.
 */
function wrapLikeClarityJs(): { restarts: string[]; unwrap: () => void } {
  const restarts: string[] = []
  const inner = history.pushState
  history.pushState = function (this: History, ...args: Parameters<History['pushState']>) {
    inner.apply(this, args)
    if (fake.active) restarts.push(location.pathname)
  }
  return { restarts, unwrap: () => void (history.pushState = inner) }
}

const PAGE = () => ({ pathname: '/homes-for-sale/bend', visitorIntent: 'seller', primaryMarket: 'bend' })
const ALLOW = () => true
const US_CONSENT = clarityConsent({ analytics: true, marketing: false })

describe('runtime', () => {
  let w: ClarityWindow

  beforeEach(() => {
    resetClarityRuntime()
    document.head.innerHTML = '<script src="/app.js"></script>'
    delete (window as { clarity?: unknown }).clarity
    w = window as unknown as ClarityWindow
  })

  afterEach(() => {
    resetClarityRuntime()
    for (const name of ['_clck', '_clsk']) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
  })

  it('injects the tag once and queues the consent and the per-page tag callback', () => {
    startClarity(w, { projectId: 'abc123def4', consent: US_CONSENT, pageContext: PAGE, mayRecord: ALLOW })
    startClarity(w, { projectId: 'abc123def4', consent: US_CONSENT, pageContext: PAGE, mayRecord: ALLOW })
    const scripts = document.querySelectorAll('script#clarity-script')
    expect(scripts).toHaveLength(1)
    const tag = scripts[0] as HTMLScriptElement
    expect(tag.src).toBe('https://www.clarity.ms/tag/abc123def4')
    expect(tag.async).toBe(true)
    const q = queued(w)
    expect(q[0]).toEqual(['consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' }])
    expect(q[1][0]).toBe('metadata')
    expect(q[1].slice(2)).toEqual([false, true])
    expect(q).toHaveLength(2)
    expect(clarityState()).toBe('running')
  })

  it('applies identify and the tags from the metadata callback, on every Clarity page', () => {
    rememberClarityUserId(CRM_ID)
    startClarity(w, { projectId: 'abc123def4', consent: US_CONSENT, pageContext: PAGE, mayRecord: ALLOW })
    const calls = loadClarityJs(w)
    const callback = calls.find((c) => c[0] === 'metadata')?.[1] as () => void
    callback()
    callback()
    const applied = calls.filter((c) => c[0] === 'identify' || c[0] === 'set')
    expect(applied).toEqual([
      ['identify', CRM_ID],
      ['set', 'page_type', 'search'],
      ['set', 'visitor_intent', 'seller'],
      ['set', 'primary_market', 'bend'],
      ['identify', CRM_ID],
      ['set', 'page_type', 'search'],
      ['set', 'visitor_intent', 'seller'],
      ['set', 'primary_market', 'bend'],
    ])
  })

  it('sends a changed marketing answer as consentv2', () => {
    startClarity(w, { projectId: 'abc123def4', consent: US_CONSENT, pageContext: PAGE, mayRecord: ALLOW })
    const calls = loadClarityJs(w)
    startClarity(w, { projectId: 'abc123def4', consent: clarityConsent({ analytics: true, marketing: true }), pageContext: PAGE, mayRecord: ALLOW })
    expect(calls.at(-1)).toEqual(['consentv2', { ad_Storage: 'granted', analytics_Storage: 'granted' }])
  })

  it('halts on a page it may not see and starts again on the next one', () => {
    startClarity(w, { projectId: 'abc123def4', consent: US_CONSENT, pageContext: PAGE, mayRecord: ALLOW })
    const calls = loadClarityJs(w)
    haltClarity()
    haltClarity()
    expect(clarityState()).toBe('halted')
    expect(calls.filter((c) => c[0] === 'stop')).toHaveLength(1)
    rememberClarityUserId(CRM_ID)
    expect(calls.some((c) => c[0] === 'identify')).toBe(false)
    startClarity(w, { projectId: 'abc123def4', consent: US_CONSENT, pageContext: PAGE, mayRecord: ALLOW })
    expect(calls.slice(-2)).toEqual([['start'], ['consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' }]])
    expect(document.querySelectorAll('script#clarity-script')).toHaveLength(1)
  })

  it('on a withdrawal sends the documented denial, stops, deletes its cookies and never starts again on this page', () => {
    document.cookie = '_clck=abc|2|fq|0|1; path=/'
    document.cookie = '_clsk=xyz|1|1|1|k.clarity.ms/collect; path=/'
    startClarity(w, { projectId: 'abc123def4', consent: US_CONSENT, pageContext: PAGE, mayRecord: ALLOW })
    const calls = loadClarityJs(w)
    withdrawClarity(document, 'ryan-realty.com')
    expect(calls.slice(-2)).toEqual([['consentv2', { ad_Storage: 'denied', analytics_Storage: 'denied' }], ['stop']])
    expect(clarityState()).toBe('withdrawn')
    expect(document.cookie).not.toMatch(/_clck=|_clsk=/)
    const before = calls.length
    startClarity(w, { projectId: 'abc123def4', consent: US_CONSENT, pageContext: PAGE, mayRecord: ALLOW })
    rememberClarityUserId(CRM_ID)
    expect(calls.length).toBe(before)
  })

  it('a withdrawal before anything loaded calls nothing and leaves it free to load later', () => {
    withdrawClarity(document, 'ryan-realty.com')
    expect(w.clarity).toBeUndefined()
    expect(clarityState()).toBe('off')
    startClarity(w, { projectId: 'abc123def4', consent: US_CONSENT, pageContext: PAGE, mayRecord: ALLOW })
    expect(clarityState()).toBe('running')
  })

  it('refuses to inject a malformed project id', () => {
    startClarity(w, { projectId: 'x" onload="alert(1)', consent: US_CONSENT, pageContext: PAGE, mayRecord: ALLOW })
    expect(document.querySelectorAll('script#clarity-script')).toHaveLength(0)
    expect(w.clarity).toBeUndefined()
  })

  it('never hands Clarity a name, an email or a phone', () => {
    // Everything a hostile or broken caller could try, through every door.
    rememberClarityUserId('matt@ryan-realty.com')
    rememberClarityUserId('+1 541 555 0100')
    rememberClarityUserId('Matt Ryan')
    startClarity(w, {
      projectId: 'abc123def4',
      consent: US_CONSENT,
      pageContext: () => ({ pathname: '/homes-for-sale/bend', visitorIntent: 'matt@ryan-realty.com', primaryMarket: '5415550100' }),
      mayRecord: ALLOW,
    })
    const calls = loadClarityJs(w)
    ;(calls.find((c) => c[0] === 'metadata')?.[1] as () => void)()
    rememberClarityUserId(CRM_ID)
    startClarity(w, { projectId: 'abc123def4', consent: clarityConsent({ analytics: true, marketing: true }), pageContext: PAGE, mayRecord: ALLOW })
    ;(calls.find((c) => c[0] === 'metadata')?.[1] as () => void)()
    haltClarity()
    startClarity(w, { projectId: 'abc123def4', consent: US_CONSENT, pageContext: PAGE, mayRecord: ALLOW })
    withdrawClarity(document, 'ryan-realty.com')

    const methods = new Set(['consentv2', 'metadata', 'identify', 'set', 'stop', 'start'])
    const allowedString = (s: string) =>
      methods.has(s) ||
      ['page_type', 'visitor_intent', 'primary_market', 'granted', 'denied', 'buyer', 'seller', 'both', 'browsing'].includes(s) ||
      /^(crm|em)-[0-9a-f]{64}$/.test(s) ||
      /^[a-z]+(?:-[a-z0-9]+)*$/.test(s)
    const strings: string[] = []
    const walk = (v: unknown) => {
      if (typeof v === 'string') strings.push(v)
      else if (Array.isArray(v)) v.forEach(walk)
      else if (v && typeof v === 'object') Object.values(v).forEach(walk)
    }
    calls.forEach(walk)
    expect(strings.length).toBeGreaterThan(0)
    for (const s of strings) {
      expect(allowedString(s), s).toBe(true)
      expect(s).not.toMatch(/@|\d{7,}|\s/)
    }
    expect(calls.filter((c) => c[0] === 'identify').map((c) => c[1])).toEqual([CRM_ID, CRM_ID])
  })
})

describe('runtime: navigation guard', () => {
  let w: ClarityWindow
  const blocked = (url: URL) => !/^\/(account|dashboard|admin)(\/|$)/.test(url.pathname)

  beforeEach(() => {
    resetClarityRuntime()
    document.head.innerHTML = '<script src="/app.js"></script>'
    delete (window as { clarity?: unknown }).clarity
    w = window as unknown as ClarityWindow
    history.replaceState(null, '', '/homes-for-sale/bend')
  })

  afterEach(() => {
    resetClarityRuntime()
    history.replaceState(null, '', '/')
  })

  it('stops Clarity before a client navigation lands on a page it may not see, so clarity-js schedules no restart there', () => {
    startClarity(w, { projectId: 'abc123def4', consent: US_CONSENT, pageContext: PAGE, mayRecord: blocked })
    const calls = loadClarityJs(w)
    const clarityJs = wrapLikeClarityJs()
    try {
      history.pushState(null, '', '/homes-for-sale/redmond')
      expect(calls.some((c) => c[0] === 'stop')).toBe(false)
      expect(clarityJs.restarts).toEqual(['/homes-for-sale/redmond'])

      history.pushState(null, '', '/account/saved-homes')
      expect(calls.filter((c) => c[0] === 'stop')).toHaveLength(1)
      expect(clarityState()).toBe('halted')
      expect(clarityJs.restarts).toEqual(['/homes-for-sale/redmond'])

      history.pushState(null, '', '/admin/crm/people/12')
      expect(calls.filter((c) => c[0] === 'stop')).toHaveLength(1)
      expect(clarityJs.restarts).toEqual(['/homes-for-sale/redmond'])
    } finally {
      clarityJs.unwrap()
    }
  })

  it('judges replaceState the same way (an address that gains a person token)', () => {
    startClarity(w, {
      projectId: 'abc123def4',
      consent: US_CONSENT,
      pageContext: PAGE,
      mayRecord: (url) => !url.searchParams.has('_pid'),
    })
    const calls = loadClarityJs(w)
    history.replaceState(null, '', '/homes-for-sale/bend?_pid=12.email.abc')
    expect(calls.at(-1)).toEqual(['stop'])
  })

  it('stops on a back or forward navigation to a page it may not see', () => {
    let allowed = true
    startClarity(w, { projectId: 'abc123def4', consent: US_CONSENT, pageContext: PAGE, mayRecord: () => allowed })
    const calls = loadClarityJs(w)
    allowed = false
    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(calls.at(-1)).toEqual(['stop'])
    expect(clarityState()).toBe('halted')
  })

  it('does nothing before Clarity runs, and puts history back when reset', () => {
    const original = history.pushState
    startClarity(w, { projectId: 'abc123def4', consent: US_CONSENT, pageContext: PAGE, mayRecord: () => false })
    expect(history.pushState).not.toBe(original)
    resetClarityRuntime()
    expect(history.pushState).toBe(original)
  })
})

describe('runtime: identity and withdrawal from a halt', () => {
  let w: ClarityWindow

  beforeEach(() => {
    resetClarityRuntime()
    document.head.innerHTML = '<script src="/app.js"></script>'
    delete (window as { clarity?: unknown }).clarity
    w = window as unknown as ClarityWindow
  })

  afterEach(() => resetClarityRuntime())

  it('forgets the contact when the visitor is no longer known', () => {
    rememberClarityUserId(CRM_ID)
    startClarity(w, { projectId: 'abc123def4', consent: US_CONSENT, pageContext: PAGE, mayRecord: ALLOW })
    const calls = loadClarityJs(w)
    const callback = calls.find((c) => c[0] === 'metadata')?.[1] as () => void
    callback()
    expect(calls.filter((c) => c[0] === 'identify')).toHaveLength(1)
    rememberClarityUserId(null)
    callback()
    expect(calls.filter((c) => c[0] === 'identify')).toHaveLength(1)
  })

  it('a withdrawal while halted still sends the denial and a stop, for any restart to meet', () => {
    startClarity(w, { projectId: 'abc123def4', consent: US_CONSENT, pageContext: PAGE, mayRecord: ALLOW })
    const calls = loadClarityJs(w)
    haltClarity()
    withdrawClarity(document, 'ryan-realty.com')
    expect(calls.slice(-2)).toEqual([['consentv2', { ad_Storage: 'denied', analytics_Storage: 'denied' }], ['stop']])
    expect(clarityState()).toBe('withdrawn')
  })
})

describe('masking', () => {
  // Clarity masks every input box in all modes; these public lead forms carry
  // data-clarity-mask so typed answers echoed on the page are masked too.
  const MASKED = [
    'components/site/v3/V3Sheet.tsx',
    'components/site/v3/V3Ask.client.tsx',
    'components/site/v3/V3ListingClose.client.tsx',
    'components/site/v3/V3AlertsStrip.client.tsx',
    'components/site/LeadCaptureBlock.tsx',
    'components/landing/LeadLandingForm.tsx',
    'app/sell/_v3/SellValueForm.tsx',
    'app/book/BookingClient.tsx',
    'components/tools/RentalLeadForm.tsx',
    'components/search/SearchAlertCapture.tsx',
    'app/buy/alerts/_v3/BuyAlertsSignup.client.tsx',
    'components/site/NewsletterSignup.tsx',
    'components/site/listing-detail/ListingFoldActions.tsx',
    'components/site/listing-detail/ListingGuestSaveSheet.client.tsx',
    'components/site/listing-detail/PublishedCmaDownload.client.tsx',
    'components/SaveSearchButton.tsx',
    'components/auth/LoginForm.tsx',
    'components/auth/SignupForm.tsx',
    'components/auth/ForgotPasswordForm.tsx',
    'app/about/_v3/AboutInquiry.tsx',
  ]

  it.each(MASKED)('%s masks its form', (file) => {
    const src = readFileSync(join(process.cwd(), file), 'utf8')
    expect(src).toContain('data-clarity-mask="True"')
  })

  it('the sell stage masks the typed address it paints outside the form', () => {
    const src = readFileSync(join(process.cwd(), 'app/sell/_v3/SellValueForm.tsx'), 'utf8')
    expect(src).toContain("plate.setAttribute('data-clarity-mask', 'True')")
    expect(src).toContain("img.setAttribute('data-clarity-mask', 'True')")
    expect(src).not.toMatch(/setAttribute\('data-sell-street', address/)
  })

  it('every <form> in the shared lead primitives is masked', () => {
    for (const file of ['components/site/v3/V3Sheet.tsx', 'components/site/v3/V3Ask.client.tsx', 'components/site/v3/V3ListingClose.client.tsx', 'components/site/v3/V3AlertsStrip.client.tsx', 'app/sell/_v3/SellValueForm.tsx', 'components/SaveSearchButton.tsx']) {
      const src = readFileSync(join(process.cwd(), file), 'utf8')
      const forms = src.match(/<form\b[^>]*>/g) ?? []
      expect(forms.length, file).toBeGreaterThan(0)
      for (const tag of forms) expect(tag, file).toContain('data-clarity-mask="True"')
    }
  })
})
