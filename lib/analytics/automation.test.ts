import { describe, expect, it } from 'vitest'
import { PROVISIONAL_AUTOMATION_REASONS, classifyArrivalShape, classifyAutomation } from './automation'

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
