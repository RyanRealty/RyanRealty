import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(resolve('components/site/listing-detail/NeighborhoodMarketContext.tsx'), 'utf8')
const PULSE = readFileSync(resolve('lib/data/market/getMarketPulse.ts'), 'utf8')
const HOUSING = readFileSync(resolve('app/housing-market/[...slug]/page.tsx'), 'utf8')
const AGENT = readFileSync(resolve('lib/agent/tools/market.ts'), 'utf8')

describe('listing and overlay MOS cannot print pulse 48', () => {
  it('listing KPI MOS goes through publishMonthsOfSupply, never cache fill', () => {
    expect(SRC).toMatch(/publishMonthsOfSupply/)
    expect(SRC).toMatch(/source: grain === 'neighborhood' \|\| grain === 'community' \? 'market-truth'/)
    expect(SRC).not.toMatch(/pulse\?\.monthsOfSupply \?\? stats\?\.monthsOfSupply/)
  })

  it('community pulse overlays neighborhood Market Truth cells', () => {
    expect(PULSE).toMatch(/geoType === 'community' \? 'neighborhood'/)
    expect(PULSE).toMatch(/market-pulse-v10-mt-community/)
  })

  it('housing-market neighborhood MOS is source market-truth after overlay', () => {
    expect(HOUSING).toMatch(/leftoverHudKpis/)
    expect(HOUSING).toMatch(/source: 'market-truth'/)
  })

  it('agent MOS is gated and subdivision/zip cannot print pulse MOS', () => {
    expect(AGENT).toMatch(/publishMonthsOfSupply/)
    expect(AGENT).toMatch(/monthsOfSupply: publishedMos/)
  })
})
