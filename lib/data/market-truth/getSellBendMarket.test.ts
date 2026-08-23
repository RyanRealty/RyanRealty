import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cityDetachedSlug } from '@/lib/data/market-truth/getSellBendMarket'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { marketVerdict } from '@/lib/market/classify'

describe('getSellBendMarket', () => {
  it('reads getMetric for city detached — never pulse', () => {
    const src = readFileSync(resolve('lib/data/market-truth/getSellBendMarket.ts'), 'utf8')
    expect(src).toMatch(/stat: 'active_count'/)
    expect(src).toMatch(/stat: 'months_of_supply'/)
    expect(src).toMatch(/stat: 'market_verdict'/)
    expect(src).toMatch(/segment: 'detached'/)
    expect(src).toMatch(/getCityDetachedMarket\('bend'\)/)
    expect(src).not.toMatch(/getMarketPulse/)
    expect(src).not.toMatch(/market_pulse_live/)
    expect(src).toMatch(/storedVerdictKind\(verdict\.valueText\) !== classified\.kind/)
  })

  it('hyphenates cache city slugs the way market_metric keys them', () => {
    expect(cityDetachedSlug('la pine')).toBe('la-pine')
    expect(cityDetachedSlug('Bend')).toBe('bend')
  })

  it('CMA city grain reads the same city detached helper as /sell', () => {
    const cma = readFileSync(resolve('lib/cma/market.ts'), 'utf8')
    expect(cma).toMatch(/getCityDetachedMarket/)
    expect(cma).toMatch(/mt-v1 detached MLS-city/)
  })

  it('/sell and the Bend JSON feed both go through getSellBendMarket', () => {
    const page = readFileSync(resolve('app/sell/page.tsx'), 'utf8')
    const feed = readFileSync(resolve('lib/data/market/getMarketPulseJsonFeed.ts'), 'utf8')
    expect(page).toMatch(/getSellBendMarket/)
    expect(page).not.toMatch(/getMarketPulse/)
    expect(feed).toMatch(/getSellBendMarket/)
  })

  it('RECON Bend detached 4.454 months is 4.5 display and a balanced verdict', () => {
    const mos = 4.45402298850575
    expect(formatMonthsOfSupply(mos)).toBe('4.5')
    expect(marketVerdict(mos)).toEqual({ kind: 'balanced', label: 'balanced market' })
    expect(marketVerdict(3.54)).toEqual({ kind: 'sellers', label: "seller's market" })
  })
})
