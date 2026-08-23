import { describe, expect, it } from 'vitest'
import {
  findStoreReads,
  findMlsSourceFilter,
  findDeadColumns,
} from '../check-market-truth.mjs'

describe('market-truth gates — failing fixtures', () => {
  it('gate 2: flags a direct pulse read', () => {
    expect(findStoreReads(`await sb.from('market_pulse_live').select('active_count')`)).toEqual([
      'market_pulse_live',
    ])
  })

  it('gate 2: ignores unrelated from()', () => {
    expect(findStoreReads(`await sb.from('listings').select('City')`)).toEqual([])
  })

  it('gate 6: flags consumer CDOM and DaysOnMarket quotes', () => {
    const dead = findDeadColumns(`const n = row.CumulativeDaysOnMarket; const x = listing["DaysOnMarket"]`)
    expect(dead.cdom).toBe(1)
    expect(dead.daysOnMarket).toBe(1)
  })

  it('gate 6: flags an mls_source constant filter', () => {
    expect(findMlsSourceFilter(`q.eq('mls_source', 'central_oregon')`)).toBeGreaterThan(0)
    expect(findMlsSourceFilter(`WHERE mls_source = 'central_oregon'`)).toBeGreaterThan(0)
    expect(findMlsSourceFilter(`select mls_source from listings`)).toBe(0)
  })
})
