import { describe, expect, it } from 'vitest'
import {
  DEFINITION_ID,
  STATS,
  STAT_BY_ID,
  marketVerdict,
  pickWindow,
} from '@/lib/data/market-truth/registry'
import { UnknownStatError } from '@/lib/data/market-truth/getMetric'

describe('Market Truth registry', () => {
  it('registers every REGISTRY.md §3 stat_id once', () => {
    const ids = STATS.map((s) => s.statId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('median_days_to_contract')
    expect(ids).toContain('months_of_supply')
    expect(ids).toContain('market_verdict')
    expect(ids).toContain('active_count')
    expect(STAT_BY_ID.get('median_days_to_contract')?.earliestYear).toBe(2006)
    expect(STAT_BY_ID.get('median_close')?.minN).toBe(10)
    expect(DEFINITION_ID).toBe('mt-v1')
  })

  it('uses house 4/6 verdict bins', () => {
    expect(marketVerdict(3.54)).toBe('seller')
    expect(marketVerdict(4)).toBe('seller')
    expect(marketVerdict(4.42)).toBe('balanced')
    expect(marketVerdict(6)).toBe('buyer')
    expect(marketVerdict(8)).toBe('buyer')
  })

  it('ladders 12 → 24 → 36 then refuses', () => {
    expect(pickWindow(10, 0, 0, 10)).toBe(12)
    expect(pickWindow(4, 12, 40, 10)).toBe(24)
    expect(pickWindow(4, 8, 12, 10)).toBe(36)
    expect(pickWindow(3, 4, 9, 10)).toBeNull()
  })

  it('rejects unknown stat ids before a store read', () => {
    expect(() => {
      if (!STAT_BY_ID.get('median_dom')) throw new UnknownStatError('median_dom')
    }).toThrow(/not in the registry/)
  })
})
