import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(resolve('app/page.tsx'), 'utf8')

/**
 * Homepage is not the market report. leftoverHudKpis still feeds the Field
 * count and the town remainder. The report lives on /housing-market.
 */
describe('homepage keeps leftover counts and does not host the report', () => {
  it('reads region leftover pace and leftoverHudKpis for the count', () => {
    expect(SRC).toMatch(/getPublicDetachedPace\(\{\s*geoType:\s*'region',\s*geoSlug:\s*'central-oregon'\s*\}\)/)
    expect(SRC).toMatch(/leftoverHudKpis/)
    expect(SRC).toMatch(/value:\s*hud\.active\.toLocaleString\('en-US'\)/)
  })

  it('does not assign saleToList from cache avg_sale_to_list_ratio', () => {
    expect(SRC).not.toMatch(/sltRaw\s*=\s*mktStats\?\.avg_sale_to_list_ratio/)
    expect(SRC).not.toMatch(/saleToList:[\s\S]{0,80}avg_sale_to_list_ratio/)
    expect(SRC).not.toMatch(/getMarketStatsCacheRowForGeo/)
  })

  it('remainder uses leftover HUD region count', () => {
    expect(SRC).toMatch(/regionActive:\s*hud\.active/)
  })

  it('does not mount the market instrument or leftover KPI row', () => {
    expect(SRC).not.toMatch(/leftoverMarketFigures\(hud/)
    expect(SRC).not.toMatch(/HOME_FIGURE_LABELS/)
    expect(SRC).not.toMatch(/<V3Instrument/)
    expect(SRC).not.toMatch(/placeMedianChart\(/)
    expect(SRC).not.toMatch(/<KbMarketHud/)
    expect(SRC).not.toMatch(/closedCount30d\s*\?\?\s*pulse/)
    expect(SRC).not.toMatch(/daysToPending90d\s*\?\?\s*pulse/)
  })

  it('keeps one Quiet door to the market report', () => {
    expect(SRC).toMatch(/id="market"/)
    expect(SRC).toMatch(/\/housing-market/)
  })
})
