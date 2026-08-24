import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(resolve('app/page.tsx'), 'utf8')

describe('homepage HUD leftover sale-to-list', () => {
  it('reads region leftover saleToOriginal for saleToList', () => {
    expect(SRC).toMatch(/getPublicDetachedPace\(\{\s*geoType:\s*'region',\s*geoSlug:\s*'central-oregon'\s*\}\)/)
    expect(SRC).toMatch(/leftoverHudKpis/)
    expect(SRC).toMatch(/saleToList:\s*hud\.saleToList/)
  })

  it('does not assign saleToList from cache avg_sale_to_list_ratio', () => {
    expect(SRC).not.toMatch(/sltRaw\s*=\s*mktStats\?\.avg_sale_to_list_ratio/)
    expect(SRC).not.toMatch(/saleToList:[\s\S]{0,80}avg_sale_to_list_ratio/)
    expect(SRC).not.toMatch(/getMarketStatsCacheRowForGeo/)
  })

  it('HUD KPI row is leftover only: miss omits, pulse does not fill', () => {
    expect(SRC).toMatch(/closed30:\s*hud\.closed30/)
    expect(SRC).toMatch(/daysToPending:\s*hud\.daysToPending/)
    expect(SRC).toMatch(/new30:\s*hud\.new30/)
    expect(SRC).not.toMatch(/closedCount30d\s*\?\?\s*pulse/)
    expect(SRC).not.toMatch(/daysToPending90d\s*\?\?\s*pulse/)
    expect(SRC).not.toMatch(/new30:\s*pulse/)
    expect(SRC).not.toMatch(/closed30:\s*publicPace\.closedCount\s*\?\?/)
    expect(SRC).not.toMatch(/daysToPending:\s*publicPace\.daysToContract/)
  })
})
