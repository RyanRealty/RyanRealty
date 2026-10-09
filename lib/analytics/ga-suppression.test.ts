import { describe, expect, it } from 'vitest'
import {
  GA_SUPPRESS_JS,
  decideGaSuppression,
  decideGaSuppressionForPage,
  isAdminPath,
  isLocalhostHost,
  isProductionHost,
  type GaSuppressionInput,
} from './ga-suppression'

const VISITOR_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'

const base: GaSuppressionInput = {
  pathname: '/homes-for-sale/bend',
  host: 'ryan-realty.com',
  search: '',
  userAgent: VISITOR_UA,
  webdriver: false,
  cookieHeader: 'rr_vid=abc; _ga=GA1.1.1.2',
}

const CASES: Array<[string, Partial<GaSuppressionInput>, string | null]> = [
  ['an outside visitor on a public page', {}, null],
  ['an outside visitor on a phone', { userAgent: IPHONE_UA }, null],
  ['the homepage', { pathname: '/' }, null],
  ['the seller subdomain', { host: 'seller.ryan-realty.com' }, null],
  ['www', { host: 'www.ryan-realty.com' }, null],
  ['a page whose path merely starts with "admin"', { pathname: '/administrators-guide' }, null],
  ['a cookie whose name ends in rr_internal', { cookieHeader: 'xrr_internal=1' }, null],
  ['the internal cookie with another value', { cookieHeader: 'rr_internal=0' }, null],
  ['/admin', { pathname: '/admin' }, 'admin-path'],
  ['under /admin', { pathname: '/admin/crm/people/12' }, 'admin-path'],
  ['/admin/login', { pathname: '/admin/login' }, 'admin-path'],
  ['127.0.0.1', { host: '127.0.0.1' }, 'non-production-host'],
  ['127.0.0.1 with a port (stripped)', { host: '127.0.0.1:8777' }, 'non-production-host'],
  ['localhost', { host: 'localhost' }, 'non-production-host'],
  ['localhost:3000', { host: 'localhost:3000' }, 'non-production-host'],
  ['*.localhost', { host: 'app.localhost' }, 'non-production-host'],
  ['::1 without brackets', { host: '::1' }, 'non-production-host'],
  ['0.0.0.0', { host: '0.0.0.0' }, 'non-production-host'],
  ['IPv6 loopback', { host: '[::1]' }, 'non-production-host'],
  ['a LAN IPv4', { host: '192.168.1.20' }, 'non-production-host'],
  ['a 10.x LAN IPv4', { host: '10.0.0.8' }, 'non-production-host'],
  ['a vercel preview', { host: 'ryanrealty-git-main-ryan.vercel.app' }, 'non-production-host'],
  ['the vercel alias', { host: 'ryanrealty.vercel.app' }, 'non-production-host'],
  ['a lookalike host', { host: 'ryan-realty.com.evil.example' }, 'non-production-host'],
  ['a host that ends in the name without a dot', { host: 'notryan-realty.com' }, 'non-production-host'],
  ['navigator.webdriver', { webdriver: true }, 'automation'],
  ['a HeadlessChrome user agent', { userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/146.0.0.0 Safari/537.36' }, 'automation'],
  ['a declared crawler', { userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }, 'automation'],
  ['an empty user agent', { userAgent: '' }, 'automation'],
  ['the marker cookie', { cookieHeader: 'rr_vid=abc; rr_automation=1' }, 'automation'],
  ['the marker cookie first', { cookieHeader: 'rr_automation=1; rr_vid=abc' }, 'automation'],
  ['the marker query', { search: '?utm_source=x&rr_automation=1' }, 'automation'],
  ['the spoofed Mac Chrome/124 capture with the marker', { userAgent: VISITOR_UA.replace('141', '124'), cookieHeader: 'rr_automation=1' }, 'automation'],
  ['a signed-in broker browser', { cookieHeader: 'rr_vid=abc; rr_internal=1' }, 'internal-user'],
  ['a broker on /admin (admin wins)', { pathname: '/admin', cookieHeader: 'rr_internal=1' }, 'admin-path'],
]

/** Runs the shipped inline expression against a stub page. */
function runJs(input: GaSuppressionInput): boolean {
  const location = { pathname: input.pathname, hostname: input.host, search: input.search ?? '' }
  const navigator = { userAgent: input.userAgent, webdriver: input.webdriver }
  const document = { cookie: input.cookieHeader ?? '' }
  return new Function('location', 'navigator', 'document', `return ${GA_SUPPRESS_JS}`)(location, navigator, document) as boolean
}

describe('decideGaSuppression (Matt 2026-10-05: GA4 counts only real outside visitors)', () => {
  for (const [name, over, reason] of CASES) {
    it(`${reason ? 'suppresses' : 'sends'}: ${name}`, () => {
      const input = { ...base, ...over }
      const d = decideGaSuppression(input)
      expect(d.reason).toBe(reason)
      expect(d.suppress).toBe(reason !== null)
    })
  }

  it('the inline browser expression agrees with the function on every case', () => {
    for (const [name, over, reason] of CASES) {
      const input = { ...base, ...over }
      expect({ name, suppress: runJs(input) }).toEqual({ name, suppress: reason !== null })
    }
  })

  it('the inline expression is valid JavaScript and fails open on a thrown error', () => {
    expect(() => new Function(`return ${GA_SUPPRESS_JS}`)).not.toThrow()
    const throws = new Function('location', 'navigator', 'document', `return ${GA_SUPPRESS_JS}`)
    expect(throws(null, null, null)).toBe(false)
  })

  it('reads the page address the server mirror reports', () => {
    const page = (pageUrl: string, extra: Partial<Parameters<typeof decideGaSuppressionForPage>[0]> = {}) =>
      decideGaSuppressionForPage({ pageUrl, userAgent: VISITOR_UA, webdriver: false, cookieHeader: '', ...extra }).reason
    expect(page('https://ryan-realty.com/sell?utm_source=crm')).toBe(null)
    expect(page('https://ryan-realty.com/admin/visitors/live')).toBe('admin-path')
    expect(page('http://127.0.0.1:3000/')).toBe('non-production-host')
    expect(page('http://127.0.0.1:8777/')).toBe('non-production-host')
    expect(page('http://localhost:3199/cities/bend')).toBe('non-production-host')
    expect(page('http://app.localhost:3000/')).toBe('non-production-host')
    expect(page('http://192.168.1.20:3000/')).toBe('non-production-host')
    expect(page('http://[::1]:3000/')).toBe('non-production-host')
    expect(page('https://ryan-realty.com/?rr_automation=1')).toBe('automation')
    expect(page('https://ryan-realty.com/', { webdriver: true })).toBe('automation')
    expect(page('https://ryan-realty.com/', { cookieHeader: 'rr_automation=1' })).toBe('automation')
    expect(page('https://ryan-realty.com/', { cookieHeader: 'rr_internal=1' })).toBe('internal-user')
    expect(page('not a url')).toBe('non-production-host')
  })

  it('helpers', () => {
    expect(isAdminPath('/admin')).toBe(true)
    expect(isAdminPath('/admins')).toBe(false)
    expect(isAdminPath(null)).toBe(false)
    expect(isProductionHost('ryan-realty.com:443')).toBe(true)
    expect(isProductionHost('RYAN-REALTY.COM')).toBe(true)
    expect(isProductionHost('ryan-realty.com.')).toBe(true)
    expect(isProductionHost(undefined)).toBe(false)
    expect(isProductionHost('localhost')).toBe(false)
    expect(isProductionHost('app.localhost')).toBe(false)
    expect(isProductionHost('::1')).toBe(false)
    expect(isProductionHost('[::1]')).toBe(false)
    expect(isLocalhostHost('localhost')).toBe(true)
    expect(isLocalhostHost('127.0.0.1:3000')).toBe(true)
    expect(isLocalhostHost('dev.localhost')).toBe(true)
    expect(isLocalhostHost('::1')).toBe(true)
    expect(isLocalhostHost('[::1]:3000')).toBe(true)
    expect(isLocalhostHost('ryan-realty.com')).toBe(false)
  })
})
