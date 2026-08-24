import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(resolve('lib/data/market-truth/leftover-area-market.ts'), 'utf8')

describe('leftoverCityAreaMarket', () => {
  it('reads leftover HUD and omits on miss', () => {
    expect(SRC).toMatch(/leftoverHudKpis/)
    expect(SRC).toMatch(/leftoverHudPublishes/)
    expect(SRC).toMatch(/getDetachedOverlays/)
    expect(SRC).toMatch(/getPublicDetachedPace/)
    expect(SRC).not.toMatch(/getMarketPulse/)
  })
})
