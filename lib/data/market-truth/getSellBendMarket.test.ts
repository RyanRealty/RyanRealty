import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cityDetachedSlug } from '@/lib/data/market-truth/getSellBendMarket'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { marketVerdict } from '@/lib/market/classify'

describe('getSellBendMarket', () => {
  it('assembles detached cells from market_metric, never pulse', () => {
    const src = readFileSync(resolve('lib/data/market-truth/getSellBendMarket.ts'), 'utf8')
    expect(src).toMatch(/segment', 'detached'/)
    expect(src).toMatch(/getCityDetachedMarket\('bend'\)/)
    expect(src).not.toMatch(/getMarketPulse/)
    expect(src).not.toMatch(/market_pulse_live/)
  })

  it('city and region pulse readers overlay Market Truth', () => {
    const pulse = readFileSync(resolve('lib/data/market/getMarketPulse.ts'), 'utf8')
    const region = readFileSync(resolve('lib/data/market/getRegionPulse.ts'), 'utf8')
    const snaps = readFileSync(resolve('lib/data/market/getMarketPulseSnapshot.ts'), 'utf8')
    expect(pulse).toMatch(/getDetachedMarket/)
    expect(region).toMatch(/getDetachedMarket/)
    expect(snaps).toMatch(/getDetachedMarkets/)
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

  it('/sell and the JSON feed both read Market Truth detached', () => {
    const page = readFileSync(resolve('app/sell/page.tsx'), 'utf8')
    const feed = readFileSync(resolve('lib/data/market/getMarketPulseJsonFeed.ts'), 'utf8')
    expect(page).toMatch(/getSellBendMarket/)
    expect(page).not.toMatch(/getMarketPulse/)
    expect(feed).toMatch(/getDetachedMarket/)
  })

  it('RECON Bend detached 4.454 months is 4.5 display and a balanced verdict', () => {
    const mos = 4.45402298850575
    expect(formatMonthsOfSupply(mos)).toBe('4.5')
    expect(marketVerdict(mos)).toEqual({ kind: 'balanced', label: 'balanced market' })
    expect(marketVerdict(3.54)).toEqual({ kind: 'sellers', label: "seller's market" })
  })
})
