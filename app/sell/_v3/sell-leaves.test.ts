import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

const fsbo = read('app/sell/for-sale-by-owner/page.tsx')
const expired = read('app/sell/expired-listings/page.tsx')
const inherited = read('app/sell/inherited-home/page.tsx')
const intent = read('app/sell/[intent]/page.tsx')
const valuation = read('app/sell/valuation/page.tsx')
const sell = read('app/sell/page.tsx')
const leafView = read('app/sell/_v3/SellLeafView.tsx')
const form = read('app/sell/_v3/SellValueForm.tsx')

describe('sell leaves sit on the /sell spine', () => {
  it('does not import the shared lead-landing renderer under app/sell', () => {
    for (const src of [fsbo, expired, inherited, intent, valuation, sell]) {
      expect(src).not.toMatch(/from ['"]@\/components\/landing\/LeadLandingPage['"]/)
      expect(src).not.toMatch(/getSellLanding/)
    }
  })

  it('FSBO and expired use Stage + SellValueForm + the shop', () => {
    expect(leafView).toContain('SellValueForm')
    expect(leafView).toContain('placement="stage"')
    expect(leafView).toContain('sell-stage-poster')
    expect(leafView).toContain('<SellShop')
    expect(leafView).toContain('pagePath={path}')
    expect(fsbo).toContain('path={FSBO_ROUTE}')
    expect(expired).toContain('path={EXPIRED_ROUTE}')
    expect(form).toContain('submitSellerLPForm')
  })

  it('inherited-home folds into /sell', () => {
    expect(inherited).toContain('permanentRedirect(ROUTE_PATH)')
    expect(inherited).toContain('@data-free')
    expect(inherited).toContain('@no-breadcrumb')
    const nextConfig = read('next.config.ts')
    expect(nextConfig).toContain("source: '/sell/inherited-home'")
    expect(nextConfig).toContain("destination: '/sell'")
  })

  it('[intent] redirects leftover slugs instead of rendering a fourth product', () => {
    expect(intent).toContain('permanentRedirect')
    expect(intent).toContain("'inherited-home': ROUTE_PATH")
    expect(intent).toContain("'for-sale-by-owner': FSBO_ROUTE")
    expect(intent).toContain("'expired-listings': EXPIRED_ROUTE")
    expect(intent).toContain('notFound()')
  })

  it('valuation is the same form with more room, no Stage ghost', () => {
    expect(valuation).toContain('SellValueForm')
    expect(valuation).not.toMatch(/import ValuationForm/)
    expect(valuation).toContain('pagePath={VALUATION_ROUTE}')
    expect(valuation).toContain('placement="page"')
    expect(valuation).not.toMatch(/action=\{\{\s*label:\s*'Value my home'/)
    expect(valuation).toContain('height="compact"')
  })

  it('/sell keeps one filled ask on the photograph and prints our listings', () => {
    expect(sell).toContain('placement="stage"')
    expect(sell).toContain('sellListingRows')
  })
})
