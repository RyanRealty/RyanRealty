import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { STAT_BY_ID } from '@/lib/data/market-truth/registry'

const SRC = readFileSync(resolve('lib/data/market-truth/leaderboards.ts'), 'utf8')

describe('getCityLeaderboard', () => {
  it('reads publishable market_metric city cells gated by STAT_BY_ID minN', () => {
    expect(SRC).toMatch(/from\('market_metric'\)/)
    expect(SRC).toMatch(/is_publishable/)
    expect(SRC).toMatch(/STAT_BY_ID/)
    expect(SRC).toMatch(/spec\.minN/)
    expect(SRC).toMatch(/\.gte\('sample_n', minN\)/)
    expect(SRC).toMatch(/opts\.segment \?\? 'detached'/)
    expect(SRC).not.toMatch(/market_pulse_live/)
    expect(STAT_BY_ID.get('yoy_median_price')?.minN).toBe(30)
    expect(STAT_BY_ID.get('median_list_active')?.minN).toBe(10)
    expect(STAT_BY_ID.get('median_days_to_contract')?.minN).toBe(10)
    expect(STAT_BY_ID.get('pct_with_price_cut')?.minN).toBe(30)
    expect(STAT_BY_ID.get('new_listings')?.minN).toBe(5)
  })

  it('accepts an ascending option (default false / value DESC)', () => {
    expect(SRC).toMatch(/ascending\?: boolean/)
    expect(SRC).toMatch(/collapseLeaderboardRows/)
  })
})

describe('collapseLeaderboardRows', () => {
  it('keeps one city: latest period_end, then 12mo over 24/36', async () => {
    const { collapseLeaderboardRows } = await import('@/lib/data/market-truth/leaderboard-collapse')
    const rows = collapseLeaderboardRows(
      [
        {
          geo_slug: 'bend',
          value: 0.0066,
          sample_n: 6048,
          window_months: 36,
          period_end: '2026-08-23',
          computed_at: '2026-08-23T01:00:00Z',
        },
        {
          geo_slug: 'bend',
          value: -0.01935,
          sample_n: 2057,
          window_months: 12,
          period_end: '2026-08-23',
          computed_at: '2026-08-23T01:00:00Z',
        },
        {
          geo_slug: 'prineville',
          value: 0.074,
          sample_n: 298,
          window_months: 12,
          period_end: '2026-08-23',
          computed_at: '2026-08-23T01:00:00Z',
        },
        {
          geo_slug: 'bend',
          value: 0.99,
          sample_n: 100,
          window_months: 12,
          period_end: '2026-08-22',
          computed_at: '2026-08-22T01:00:00Z',
        },
      ],
      { ascending: false, limit: 16 },
    )
    expect(rows.map((r) => r.geoSlug)).toEqual(['prineville', 'bend'])
    expect(rows[1]?.value).toBeCloseTo(-0.01935)
    expect(rows[1]?.windowMonths).toBe(12)
  })
})
