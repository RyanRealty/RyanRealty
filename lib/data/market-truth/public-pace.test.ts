import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { formatPaceShare, publicPaceHasRow } from '@/lib/data/market-truth/public-pace'

const SRC = readFileSync(resolve('lib/data/market-truth/public-pace.ts'), 'utf8')

describe('getPublicDetachedPace', () => {
  it('reads publishable 12-month detached leftover cells, never pulse', () => {
    expect(SRC).toMatch(/from\('market_metric'\)/)
    expect(SRC).toMatch(/is_publishable/)
    expect(SRC).toMatch(/window_months/)
    expect(SRC).toMatch(/median_days_to_contract/)
    expect(SRC).toMatch(/new_listings/)
    expect(SRC).toMatch(/pct_with_price_cut/)
    expect(SRC).toMatch(/segment', 'detached'/)
    expect(SRC).not.toMatch(/market_pulse_live/)
    expect(SRC).not.toMatch(/'neighborhood'/)
    expect(SRC).not.toMatch(/commercial_lease/)
  })

  it('omits a miss instead of printing 0', () => {
    expect(SRC).toMatch(/closedCount == null \|\| closedCount <= 0/)
    expect(SRC).toMatch(/newListings == null \|\| newListings <= 0/)
    expect(publicPaceHasRow({
      daysToContract: null,
      daysToClose: null,
      closedCount: null,
      newListings: null,
      priceCutShare: null,
    })).toBe(false)
    expect(publicPaceHasRow({
      daysToContract: 28,
      daysToClose: null,
      closedCount: null,
      newListings: null,
      priceCutShare: null,
    })).toBe(true)
    expect(formatPaceShare(0.465871121718377)).toBe('46.6%')
  })
})

describe('public pace surfaces', () => {
  it('city and housing-market pages read getPublicDetachedPace', () => {
    const city = readFileSync(resolve('app/cities/[slug]/page.tsx'), 'utf8')
    const strip = readFileSync(resolve('app/cities/[slug]/PublicPaceStats.tsx'), 'utf8')
    const market = readFileSync(resolve('app/housing-market/[...slug]/page.tsx'), 'utf8')
    const hub = readFileSync(resolve('app/housing-market/page.tsx'), 'utf8')
    expect(city).toMatch(/getPublicDetachedPace/)
    expect(city).toMatch(/PublicPaceStats/)
    expect(strip).toMatch(/12 months/)
    expect(strip).toMatch(/days to contract/)
    expect(market).toMatch(/getPublicDetachedPace/)
    expect(hub).toMatch(/getPublicDetachedPace/)
    expect(city).not.toMatch(/geo_type['"]\s*,\s*['"]neighborhood/)
  })
})
