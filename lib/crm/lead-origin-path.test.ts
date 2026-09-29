import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { valuationHref } from '@/lib/site/valuation-href'
import { leadOriginPath } from './lead-origin-path'

/**
 * A seller lead's source_url names the page that produced it. Every valuation
 * link on a content page carries ?from=<its path>; the spine form posts through
 * submitSellerLPForm, which ignored it until 2026-09-29, so every seller lead
 * recorded /sell as its origin.
 */

const HOSTS = ['ryan-realty.com']

describe('leadOriginPath', () => {
  it('reads the origin a valuation link carries, the way valuationHref writes it', () => {
    const href = valuationHref('/cities/bend') // /sell?from=%2Fcities%2Fbend#get-value
    expect(leadOriginPath(`https://ryan-realty.com${href}`, HOSTS, '/sell')).toBe('/cities/bend')
    expect(leadOriginPath('https://ryan-realty.com/sell/valuation?from=%2Fhousing-market%2Fannual-review', HOSTS, '/sell/valuation')).toBe(
      '/housing-market/annual-review',
    )
  })

  it('keeps the form page when the link carried no origin', () => {
    expect(leadOriginPath('https://ryan-realty.com/sell', HOSTS, '/sell')).toBe('/sell')
    expect(leadOriginPath('', HOSTS, '/sell')).toBe('/sell')
    expect(leadOriginPath(null, HOSTS, '/sell')).toBe('/sell')
  })

  it('refuses a cross-site referer, a protocol-relative or odd-shaped value, and a malformed referer', () => {
    expect(leadOriginPath('https://evil.example/sell?from=%2Fcities%2Fbend', HOSTS, '/sell')).toBe('/sell')
    expect(leadOriginPath('https://ryan-realty.com/sell?from=%2F%2Fevil.example', HOSTS, '/sell')).toBe('/sell')
    expect(leadOriginPath('https://ryan-realty.com/sell?from=https%3A%2F%2Fevil.example', HOSTS, '/sell')).toBe('/sell')
    expect(leadOriginPath('https://ryan-realty.com/sell?from=%2Fcities%2Fbend%3Cscript%3E', HOSTS, '/sell')).toBe('/sell')
    expect(leadOriginPath('not a url', HOSTS, '/sell')).toBe('/sell')
  })

  it('drops a query or fragment inside the carried path', () => {
    expect(leadOriginPath('https://ryan-realty.com/sell?from=%2Fzip%2F97702%3Fx%3D1', HOSTS, '/sell')).toBe('/zip/97702')
  })

  it('accepts the request host as well as the site host (preview deployments)', () => {
    const preview = 'ryanrealty-abc123.vercel.app'
    expect(leadOriginPath(`https://${preview}/sell?from=%2Fcities%2Fbend`, ['ryan-realty.com', preview], '/sell')).toBe('/cities/bend')
    expect(leadOriginPath(`https://${preview}/sell?from=%2Fcities%2Fbend`, ['ryan-realty.com', null], '/sell')).toBe('/sell')
  })
})

describe('submitSellerLPForm uses it for source_url only', () => {
  const src = readFileSync(resolve('app/lp/seller-home-value/actions.ts'), 'utf8')

  it('builds source_url from the origin path, UTMs kept', () => {
    expect(src).toContain("leadOriginPathname = leadOriginPath(referer, [new URL(siteUrl).host, requestHeaders.get('host')], leadPagePath)")
    expect(src).toContain('leadSourceUrl = `${siteUrl}${leadOriginPathname}?${qs}`')
  })

  it("keeps the broker's origin note on the page the form was on", () => {
    expect(src).toMatch(/landingPage: leadPagePath,/)
  })
})
