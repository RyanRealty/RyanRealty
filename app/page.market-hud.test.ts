import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(resolve('app/page.tsx'), 'utf8')

describe('homepage HUD leftover sale-to-list', () => {
  it('reads region leftover saleToOriginal for saleToList', () => {
    expect(SRC).toMatch(/getPublicDetachedPace\(\{\s*geoType:\s*'region',\s*geoSlug:\s*'central-oregon'\s*\}\)/)
    expect(SRC).toMatch(/sltRaw\s*=\s*publicPace\.saleToOriginal\s*\?\?\s*null/)
    expect(SRC).toMatch(/saleToList:\s*sltRaw != null \? \(sltRaw < 2 \? sltRaw \* 100 : sltRaw\) : null/)
  })

  it('does not assign saleToList from cache avg_sale_to_list_ratio', () => {
    expect(SRC).not.toMatch(/sltRaw\s*=\s*mktStats\?\.avg_sale_to_list_ratio/)
    expect(SRC).not.toMatch(/saleToList:[\s\S]{0,80}avg_sale_to_list_ratio/)
    expect(SRC).not.toMatch(/getMarketStatsCacheRowForGeo/)
  })

  it('overlays leftover 30-day closed and 90-day days-to-contract, pulse fills on miss', () => {
    expect(SRC).toMatch(/closed30:\s*publicPace\.closedCount30d\s*\?\?\s*pulse\?\.soldCount30d\s*\?\?\s*null/)
    expect(SRC).toMatch(
      /daysToPending:\s*publicPace\.daysToPending90d\s*\?\?\s*pulse\?\.medianDaysToPending\s*\?\?\s*null/,
    )
    expect(SRC).not.toMatch(/closed30:\s*publicPace\.closedCount\s*\?\?/)
    expect(SRC).not.toMatch(/daysToPending:\s*publicPace\.daysToContract/)
  })
})
