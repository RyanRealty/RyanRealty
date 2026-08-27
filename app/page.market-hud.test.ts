import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(resolve('app/page.tsx'), 'utf8')

/**
 * v3 spelling (2026-08-27 Broadside rebuild). The KB test pinned the
 * KbMarketData object literal (`closed30: hud.closed30`, ...); on the barrel
 * the KPI row is built by leftoverMarketFigures(hud, ...), whose own source
 * encodes the same rule — every figure off the ONE leftover pile, a missing
 * cell omitted, pulse never filling a tile. The data-source pins and every
 * negative pin survive unchanged.
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

  it('remainder uses leftover HUD region count', () => {
    expect(SRC).toMatch(/regionActive:\s*hud\.active/)
  })

  it('KPI row is leftover only: miss omits, pulse does not fill', () => {
    // The pace figures the HUD already prints are skipped, not re-labeled.
    expect(SRC).toMatch(/CITY_PACE_KEYS_ON_THE_HUD\.has\(item\.key\)/)
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
})
