import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(resolve('data/golf/community-kpis.ts'), 'utf8')

describe('golf community KPIs', () => {
  it('reads leftover and detached inventory, not market_stats_cache', () => {
    expect(SRC).toMatch(/getPublicDetachedPace/)
    expect(SRC).toMatch(/getDetachedInventories/)
    expect(SRC).not.toMatch(/from\('market_stats_cache'\)/)
    expect(SRC).not.toMatch(/market_pulse_live/)
    expect(SRC).toMatch(/medianDom: null/)
  })
})
