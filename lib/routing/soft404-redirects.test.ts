import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import legacyRedirects from '@/data/legacy-redirects.json'
import { BLOG_HOUSING_MARKET_GUIDE_REDIRECTS } from './blog-market-guide-redirects'

const LEGACY = legacyRedirects as Record<string, string>
const NEXT_CONFIG = readFileSync('next.config.ts', 'utf8')

describe('soft-404 and dead-link redirects', () => {
  it('301s May 2026 Bend report to the live June 2026 post', () => {
    expect(LEGACY['/blog/bend-oregon-market-report-may-2026']).toBe(
      '/blog/bend-oregon-market-report-june-2026',
    )
    expect(NEXT_CONFIG).toMatch(/source:\s*'\/blog\/bend-oregon-market-report-may-2026'/)
  })

  it('301s the sunriver round-living typo to the live year-round post', () => {
    expect(LEGACY['/blog/sunriver-round-living-vs-vacation']).toBe(
      '/blog/sunriver-year-round-living-vs-vacation',
    )
    expect(LEGACY['/sunriver-round-living-vs-vacation']).toBe(
      '/blog/sunriver-year-round-living-vs-vacation',
    )
  })

  it('repoints the four dead legacy destinations at live pages', () => {
    expect(LEGACY['/central-oregon-housing-market-update-october-2025-insights-and-trends-2']).toBe(
      '/housing-market',
    )
    expect(LEGACY['/overcoming-homebuyer-concerns-in-todays-economic-climate']).toBe(
      '/blog/first-time-home-buyer-guide-central-oregon',
    )
    expect(LEGACY['/rent-buy-home']).toBe('/blog/is-now-a-good-time-to-buy-in-bend')
    expect(LEGACY['/unlocking-the-benefits-of-title-insurance-for-secure-homeownership']).toBe(
      '/blog/closing-costs-buyers-bend-oregon',
    )
  })

  it('sends /housing-market/tumalo to the live city page and CRR to its community page', () => {
    expect(LEGACY['/housing-market/tumalo']).toBe('/cities/tumalo')
    expect(LEGACY['/housing-market/crooked-river-ranch']).toBe('/communities/crooked-river-ranch')
    expect(LEGACY['/housing-market/terrebonne/crooked-river-ranch']).toBe(
      '/communities/crooked-river-ranch',
    )
  })

  it('lists every housing-market-guide blog URL as a 301 source', () => {
    for (const { source, destination } of BLOG_HOUSING_MARKET_GUIDE_REDIRECTS) {
      expect(LEGACY[source], source).toBe(destination)
      expect(NEXT_CONFIG).toContain(`source: '${source}'`)
    }
  })
})
