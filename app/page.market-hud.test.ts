import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(resolve('app/page.tsx'), 'utf8')

/**
 * v3 spelling (2026-08-27 Broadside rebuild). The KPI row is built by
 * leftoverMarketFigures(hud, ...): every figure off the ONE leftover pile,
 * a missing cell omitted, pulse never filling a tile.
 */
describe('homepage market figures stay on the leftover pile', () => {
  it('reads region leftover pace and hands the hud to leftoverMarketFigures', () => {
    expect(SRC).toMatch(/getPublicDetachedPace\(\{\s*geoType:\s*'region',\s*geoSlug:\s*'central-oregon'\s*\}\)/)
    expect(SRC).toMatch(/leftoverHudKpis/)
    expect(SRC).toMatch(/leftoverMarketFigures\(hud/)
  })

  it('does not assign saleToList from cache avg_sale_to_list_ratio', () => {
    expect(SRC).not.toMatch(/sltRaw\s*=\s*mktStats\?\.avg_sale_to_list_ratio/)
    expect(SRC).not.toMatch(/saleToList:[\s\S]{0,80}avg_sale_to_list_ratio/)
    expect(SRC).not.toMatch(/getMarketStatsCacheRowForGeo/)
  })

  it('does not print a leftover regional remainder on the town Ledger', () => {
    expect(SRC).not.toMatch(/regionActive:\s*hud\.active/)
    expect(SRC).not.toMatch(/townRemainder/)
    expect(SRC).not.toMatch(/namePulseCityRemainder/)
  })

  it('KPI row is leftover only: miss omits, pulse does not fill', () => {
    expect(SRC).toMatch(/HOME_FIGURE_LABELS/)
    expect(SRC).toMatch(/leftoverMarketFigures\(hud/)
    expect(SRC).not.toMatch(/closedCount30d\s*\?\?\s*pulse/)
    expect(SRC).not.toMatch(/daysToPending90d\s*\?\?\s*pulse/)
    expect(SRC).not.toMatch(/new30:\s*pulse/)
    expect(SRC).not.toMatch(/closed30:\s*publicPace\.closedCount\s*\?\?/)
    expect(SRC).not.toMatch(/daysToPending:\s*publicPace\.daysToContract/)
  })

  it('the one verdict derivation classifies the raw leftover value', () => {
    expect(SRC).toMatch(/marketVerdict\(mosRaw\)/)
    expect(SRC).toMatch(/formatMonthsOfSupply\(mosRaw\)/)
  })

  it('does not print leftover labels or the banned market H2', () => {
    expect(SRC).toContain('Median close by month, single-family, Central Oregon')
    expect(SRC).toContain('How tight the market is')
    expect(SRC).toContain('chartFirst')
    expect(SRC).not.toContain('Market Truth leftover')
    expect(SRC).not.toContain('Market Truth metric layer')
    expect(SRC).not.toContain("Is Central Oregon a buyer's or seller's market?")
  })
})
