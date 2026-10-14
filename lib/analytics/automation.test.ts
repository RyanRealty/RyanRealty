import { describe, expect, it } from 'vitest'
import {
  DATACENTER_LOCALITIES,
  IDENTIFIABLE_SESSION_FILTER,
  NON_BLOCKING_FLAG_REASONS,
  PROVISIONAL_AUTOMATION_REASONS,
  STALE_BROWSER_DAYS,
  classifyArrivalShape,
  classifyAutomation,
  desktopChromeMajor,
  isDatacenterLocality,
  isPersonEvidence,
  isProvisionalReason,
  isStaleDesktopChrome,
  sessionBlocksIdentification,
} from './automation'
import { CHROME_STABLE_DATES, chromeSupersededAt } from './chrome-releases'

const CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'

describe('classifyAutomation (TRACK-4 / P7)', () => {
  it('passes real browsers', () => {
    expect(classifyAutomation({ userAgent: CHROME })).toEqual({ automated: false, reason: null })
    expect(classifyAutomation({ userAgent: IPHONE })).toEqual({ automated: false, reason: null })
    // An Android phone brand whose model reads "...bot".
    expect(classifyAutomation({ userAgent: 'Mozilla/5.0 (Linux; Android 13; CUBOT KINGKONG 9) Chrome/139 Mobile Safari/537.36' }).automated).toBe(false)
  })

  it('flags JS-rendering crawlers that declare themselves', () => {
    for (const ua of [
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/140 Safari/537.36',
      'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)',
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    ]) {
      expect(classifyAutomation({ userAgent: ua })).toEqual({ automated: true, reason: 'declared-crawler' })
    }
  })

  it('flags headless and instrumented browsers', () => {
    expect(classifyAutomation({ userAgent: CHROME.replace('Chrome/', 'HeadlessChrome/') }).reason).toBe('headless')
    expect(classifyAutomation({ userAgent: `${CHROME} Chrome-Lighthouse` }).reason).toBe('headless')
  })

  it('flags HTTP tools, an empty UA, and navigator.webdriver', () => {
    expect(classifyAutomation({ userAgent: 'python-requests/2.32' }).reason).toBe('tool')
    expect(classifyAutomation({ userAgent: 'curl/8.4.0' }).reason).toBe('tool')
    expect(classifyAutomation({ userAgent: '' }).reason).toBe('empty-ua')
    expect(classifyAutomation({ userAgent: null }).reason).toBe('empty-ua')
    expect(classifyAutomation({ userAgent: CHROME, webdriver: true })).toEqual({ automated: true, reason: 'webdriver' })
    expect(classifyAutomation({ userAgent: CHROME, webdriver: 'true' }).automated).toBe(false)
  })
})

describe('classifyArrivalShape — the provisional contact-deep-link class (P7)', () => {
  const LANDING = 'https://ryan-realty.com/contact?intent=question&listingKey=220199976'

  it('flags a fresh session whose first page is the listing contact form, with no referrer', () => {
    expect(classifyArrivalShape({ landingPage: LANDING, referrer: undefined })).toEqual({
      automated: true,
      reason: 'contact-deep-link',
    })
    expect(PROVISIONAL_AUTOMATION_REASONS.has('contact-deep-link')).toBe(true)
    expect(PROVISIONAL_AUTOMATION_REASONS.has('headless')).toBe(false)
  })

  it('never flags a person arriving from a page, a link we sent, or a campaign', () => {
    expect(classifyArrivalShape({ landingPage: LANDING, referrer: 'https://ryan-realty.com/listing/220199976' }).automated).toBe(false)
    expect(classifyArrivalShape({ landingPage: `${LANDING}&_pid=64115.email.abcdefghijklmnopqrstuv`, referrer: null }).automated).toBe(false)
    expect(classifyArrivalShape({ landingPage: `${LANDING}&utm_source=crm&utm_medium=email`, referrer: null }).automated).toBe(false)
    expect(classifyArrivalShape({ landingPage: `${LANDING}&agent=matt`, referrer: null }).automated).toBe(false)
    expect(classifyArrivalShape({ landingPage: `${LANDING}&gclid=x`, referrer: null }).automated).toBe(false)
    expect(classifyArrivalShape({ landingPage: LANDING, referrer: null, hasToken: true }).automated).toBe(false)
  })

  it('leaves every other landing alone', () => {
    expect(classifyArrivalShape({ landingPage: 'https://ryan-realty.com/contact', referrer: null }).automated).toBe(false)
    expect(classifyArrivalShape({ landingPage: 'https://ryan-realty.com/contact?intent=&listingKey=', referrer: null }).automated).toBe(false)
    expect(classifyArrivalShape({ landingPage: 'https://ryan-realty.com/listing/220199976', referrer: null }).automated).toBe(false)
    expect(classifyArrivalShape({ landingPage: 'not a url', referrer: null }).automated).toBe(false)
    expect(classifyArrivalShape({ landingPage: null, referrer: null }).automated).toBe(false)
  })
})

describe('our own marker and a signed-in broker browser (Matt 2026-10-05, GA cleanup)', () => {
  it('the rr_automation marker classifies as automation even behind a desktop user agent', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    expect(classifyAutomation({ userAgent: ua, marker: true })).toEqual({ automated: true, reason: 'marker' })
    expect(classifyAutomation({ userAgent: ua, marker: false })).toEqual({ automated: false, reason: null })
  })

  it('a marker session is never identified; an internal (broker) session always may be', () => {
    expect(sessionBlocksIdentification({ is_automated: true, automation_reason: 'marker' })).toBe(true)
    expect(sessionBlocksIdentification({ is_automated: true, automation_reason: 'internal' })).toBe(false)
    expect(IDENTIFIABLE_SESSION_FILTER).toContain('internal')
  })
})

// ── Cold-arrival rules, 2026-10-14 (docs/TRACKING_POLICY.md "Automation") ──────
// The user agents below are the exact strings of the clusters measured on
// visitor_sessions 2026-09-30..2026-10-14 (scripts/audit-visitor-automation.ts).
const AT = Date.parse('2026-10-14T18:00:00Z')
const desktop = (platform: string, major: number) =>
  `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`
const LINUX = 'X11; Linux x86_64'
const WIN = 'Windows NT 10.0; Win64; x64'
const MAC = 'Macintosh; Intel Mac OS X 10_15_7'
const HOME = 'https://ryan-realty.com/homes-for-sale/bend/southwest-bend'
const cold = (extra: Partial<Parameters<typeof classifyArrivalShape>[0]> = {}) =>
  classifyArrivalShape({ landingPage: HOME, referrer: null, atMs: AT, ...extra })

describe('the Chrome release table', () => {
  it('is the published schedule, in order, and knows when each build was superseded', () => {
    const majors = Object.keys(CHROME_STABLE_DATES).map(Number)
    for (let i = 1; i < majors.length; i++) {
      expect(majors[i]).toBe(majors[i - 1] + 1)
      expect(CHROME_STABLE_DATES[majors[i]] > CHROME_STABLE_DATES[majors[i - 1]]).toBe(true)
    }
    expect(chromeSupersededAt(150)).toBe(Date.parse('2026-07-28T00:00:00Z'))
    // Older than the table: superseded no later than the table's first date.
    expect(chromeSupersededAt(100)).toBe(Date.parse('2025-06-24T00:00:00Z'))
    // The table does not know 160's successor: never judged.
    expect(chromeSupersededAt(160)).toBeNull()
    expect(chromeSupersededAt(200)).toBeNull()
    expect(chromeSupersededAt(0)).toBeNull()
  })
})

describe('desktopChromeMajor', () => {
  it('reads desktop Chrome on Windows, macOS and Linux', () => {
    expect(desktopChromeMajor(desktop(LINUX, 150))).toBe(150)
    expect(desktopChromeMajor(desktop(WIN, 148))).toBe(148)
    expect(desktopChromeMajor(desktop(MAC, 149))).toBe(149)
  })

  it('leaves phones, ChromeOS and the Chromium browsers on their own schedule alone', () => {
    expect(desktopChromeMajor(IPHONE)).toBeNull()
    expect(desktopChromeMajor('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36')).toBeNull()
    expect(desktopChromeMajor('Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/150.0.0.0 Mobile/15E148 Safari/604.1')).toBeNull()
    expect(desktopChromeMajor('Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')).toBeNull()
    expect(desktopChromeMajor(`${desktop(WIN, 140)} Edg/140.0.0.0`)).toBeNull()
    expect(desktopChromeMajor(`${desktop(WIN, 140)} OPR/125.0.0.0`)).toBeNull()
    expect(desktopChromeMajor('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0')).toBeNull()
    expect(desktopChromeMajor(null)).toBeNull()
  })
})

describe('isStaleDesktopChrome', () => {
  it(`flags a build superseded more than ${STALE_BROWSER_DAYS} days before the request`, () => {
    for (const major of [144, 148, 149, 150, 151]) expect(isStaleDesktopChrome(desktop(WIN, major), AT)).toBe(true)
    expect(isStaleDesktopChrome(desktop(MAC, 124), AT)).toBe(true)
  })

  it('never flags a current or recent build, or one newer than the table', () => {
    for (const major of [152, 153, 154, 155, 156, 160, 170]) expect(isStaleDesktopChrome(desktop(WIN, major), AT)).toBe(false)
  })

  it(`is strict at the boundary: exactly ${STALE_BROWSER_DAYS} days is not stale`, () => {
    const superseded = chromeSupersededAt(152)!
    expect(isStaleDesktopChrome(desktop(WIN, 152), superseded + STALE_BROWSER_DAYS * 86_400_000)).toBe(false)
    expect(isStaleDesktopChrome(desktop(WIN, 152), superseded + STALE_BROWSER_DAYS * 86_400_000 + 1)).toBe(true)
  })
})

describe('classifyArrivalShape — stale-browser (provisional)', () => {
  it('flags the measured clusters on a cold arrival', () => {
    for (const ua of [desktop(LINUX, 150), desktop(WIN, 148), desktop(WIN, 149), desktop(MAC, 150), desktop(WIN, 151), desktop(WIN, 144)]) {
      expect(cold({ userAgent: ua })).toEqual({ automated: true, reason: 'stale-browser' })
    }
  })

  it('never flags a person who arrived from somewhere we can name, whatever the build', () => {
    const old = desktop(MAC, 128) // a Mac stuck on macOS 10.15, as two identified contacts were
    expect(cold({ userAgent: old, referrer: 'https://www.google.com/' }).automated).toBe(false)
    expect(cold({ userAgent: old, landingPage: `${HOME}?utm_source=crm&utm_medium=email` }).automated).toBe(false)
    expect(cold({ userAgent: old, landingPage: `${HOME}?_pid=64115.email.abcdefghijklmnopqrstuv` }).automated).toBe(false)
    expect(cold({ userAgent: old, landingPage: `${HOME}?rr_doc=cma-2465-ne-7th` }).automated).toBe(false)
    expect(cold({ userAgent: old, landingPage: `${HOME}?msclkid=abc` }).automated).toBe(false)
    expect(cold({ userAgent: old, hasToken: true }).automated).toBe(false)
  })

  it('never flags a current browser or a phone on a cold arrival', () => {
    expect(cold({ userAgent: desktop(MAC, 154) }).automated).toBe(false)
    expect(cold({ userAgent: desktop(WIN, 155) }).automated).toBe(false)
    expect(cold({ userAgent: IPHONE }).automated).toBe(false)
    expect(cold({ userAgent: null }).automated).toBe(false)
  })

  it('is provisional: it never blocks identification', () => {
    expect(isProvisionalReason('stale-browser')).toBe(true)
    expect(sessionBlocksIdentification({ is_automated: true, automation_reason: 'stale-browser' })).toBe(false)
    expect(IDENTIFIABLE_SESSION_FILTER).toContain('stale-browser')
  })
})

describe('classifyArrivalShape — datacenter-geo (provisional)', () => {
  const geo = (city: string, region: string, country = 'US') => ({ city, region, country })

  it('flags a cold arrival from each datacenter town', () => {
    for (const l of DATACENTER_LOCALITIES) {
      expect(cold({ userAgent: desktop(WIN, 154), geo: geo(l.city, l.region) })).toEqual({ automated: true, reason: 'datacenter-geo' })
    }
    expect(isDatacenterLocality(geo('santa clara', 'ca'))).toBe(true)
  })

  it('never flags the towns this brokerage serves or a namesake elsewhere', () => {
    for (const [city, region] of [['Prineville', 'OR'], ['Bend', 'OR'], ['Redmond', 'OR'], ['Portland', 'OR'], ['Hillsboro', 'OR'], ['San Jose', 'CA']]) {
      expect(cold({ userAgent: desktop(WIN, 154), geo: geo(city, region) }).automated).toBe(false)
    }
    expect(isDatacenterLocality(geo('Santa Clara', 'UT'))).toBe(false)
    expect(isDatacenterLocality(geo('Santa Clara', 'VC', 'CU'))).toBe(false)
    expect(isDatacenterLocality({ city: 'Ashburn', region: null, country: 'US' })).toBe(false)
    expect(isDatacenterLocality(null)).toBe(false)
  })

  it('never flags a person who arrived from somewhere we can name', () => {
    const dc = geo('Santa Clara', 'CA')
    expect(cold({ userAgent: desktop(MAC, 154), geo: dc, referrer: 'https://www.google.com/' }).automated).toBe(false)
    expect(cold({ userAgent: desktop(MAC, 154), geo: dc, landingPage: `${HOME}?gclid=abc` }).automated).toBe(false)
    expect(cold({ userAgent: desktop(MAC, 154), geo: dc, hasToken: true }).automated).toBe(false)
  })

  it('a stale build wins the reason when both hold, and the contact form shape wins both', () => {
    expect(cold({ userAgent: desktop(WIN, 149), geo: geo('Santa Clara', 'CA') }).reason).toBe('stale-browser')
    expect(
      cold({ userAgent: desktop(WIN, 149), geo: geo('Santa Clara', 'CA'), landingPage: 'https://ryan-realty.com/contact?intent=tour&listingKey=220191864' }).reason,
    ).toBe('contact-deep-link')
  })

  it('is provisional: it never blocks identification', () => {
    expect(PROVISIONAL_AUTOMATION_REASONS.has('datacenter-geo')).toBe(true)
    expect(NON_BLOCKING_FLAG_REASONS.has('datacenter-geo')).toBe(true)
    expect(sessionBlocksIdentification({ is_automated: true, automation_reason: 'datacenter-geo' })).toBe(false)
  })
})

describe('isPersonEvidence — what clears a provisional flag', () => {
  const ev = (eventType: string, pageUrl = HOME) => isPersonEvidence({ eventType, pageUrl, landingPage: HOME })

  it('an interaction shows a person', () => {
    for (const t of ['search', 'cta_click', 'save_listing', 'scroll_depth', 'intent_declared', 'email_opt', 'sms_opt', 'join_convert', 'identify', 'signin']) {
      expect(ev(t)).toBe(true)
    }
  })

  it('moving on to another page shows a person', () => {
    expect(ev('page_view', 'https://ryan-realty.com/homes-for-sale/bend')).toBe(true)
    expect(ev('listing_view', 'https://ryan-realty.com/homes-for-sale/bend/southwest-bend/123-main-220199976')).toBe(true)
  })

  it('a section rendering in view, a repeat view or a re-query of the landing page does not', () => {
    expect(ev('section_view')).toBe(false)
    expect(ev('welcome_back')).toBe(false)
    expect(ev('page_view')).toBe(false)
    expect(ev('page_view', `${HOME}/`)).toBe(false)
    // The measured crawler re-renders the landing page with a normalized query a second later.
    expect(ev('page_view', `${HOME}?sort=newest&statusFilter=active&page=1`)).toBe(false)
    expect(isPersonEvidence({ eventType: 'page_view', pageUrl: HOME, landingPage: null })).toBe(false)
    expect(isPersonEvidence({ eventType: null, pageUrl: HOME, landingPage: HOME })).toBe(false)
  })
})

describe('classifyAutomation — the HeadlessChrome client hint and named agents (2026-10-14)', () => {
  it('flags a desktop user agent whose Sec-CH-UA brands it HeadlessChrome', () => {
    expect(
      classifyAutomation({
        userAgent: desktop(LINUX, 150),
        clientHints: '"Chromium";v="150", "Not.A/Brand";v="24", "HeadlessChrome";v="150"',
      }),
    ).toEqual({ automated: true, reason: 'headless' })
  })

  it('passes the brand list of a browser a person uses', () => {
    expect(
      classifyAutomation({ userAgent: desktop(MAC, 154), clientHints: '"Google Chrome";v="154", "Chromium";v="154", "Not=A?Brand";v="24"' }).automated,
    ).toBe(false)
    expect(classifyAutomation({ userAgent: desktop(MAC, 154), clientHints: null }).automated).toBe(false)
  })

  it('flags Google NotebookLM, a fetcher that names itself', () => {
    expect(classifyAutomation({ userAgent: 'Google-NotebookLM' })).toEqual({ automated: true, reason: 'declared-crawler' })
  })
})
