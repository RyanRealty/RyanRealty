import { describe, it, expect } from 'vitest'
import { resolveStrategy, nextRoundRobin } from './lead-routing'
import type { CrmAssignmentConfig } from '@/lib/data/crm/getCrmAssignmentConfig'

function cfg(over: Partial<CrmAssignmentConfig>): CrmAssignmentConfig {
  return { strategy: 'all_to_one', defaultBroker: 'matt', rules: [], ...over }
}

describe('resolveStrategy', () => {
  it('all_to_one → default broker (the dormant live behavior)', () => {
    const r = resolveStrategy(cfg({ strategy: 'all_to_one', defaultBroker: 'matt' }), 'seller')
    expect(r).toEqual({ kind: 'resolved', broker: 'matt' })
  })

  it('all_to_one with a non-matt default routes there', () => {
    const r = resolveStrategy(cfg({ strategy: 'all_to_one', defaultBroker: 'rebecca' }), null)
    expect(r).toEqual({ kind: 'resolved', broker: 'rebecca' })
  })

  it('by_source → first matching rule wins', () => {
    const config = cfg({
      strategy: 'by_source',
      defaultBroker: 'matt',
      rules: [
        { id: 1, source: 'buyer', broker: 'paul', position: 0 },
        { id: 2, source: 'seller', broker: 'rebecca', position: 1 },
      ],
    })
    expect(resolveStrategy(config, 'seller')).toEqual({ kind: 'resolved', broker: 'rebecca' })
    expect(resolveStrategy(config, 'buyer')).toEqual({ kind: 'resolved', broker: 'paul' })
  })

  it('by_source → no matching rule falls back to default', () => {
    const config = cfg({
      strategy: 'by_source',
      defaultBroker: 'matt',
      rules: [{ id: 1, source: 'buyer', broker: 'paul', position: 0 }],
    })
    expect(resolveStrategy(config, 'seller')).toEqual({ kind: 'resolved', broker: 'matt' })
    expect(resolveStrategy(config, null)).toEqual({ kind: 'resolved', broker: 'matt' })
    expect(resolveStrategy(config, '')).toEqual({ kind: 'resolved', broker: 'matt' })
  })

  it('by_source → an empty-broker rule falls back to default', () => {
    const config = cfg({
      strategy: 'by_source',
      defaultBroker: 'matt',
      rules: [{ id: 1, source: 'seller', broker: '', position: 0 }],
    })
    expect(resolveStrategy(config, 'seller')).toEqual({ kind: 'resolved', broker: 'matt' })
  })

  it('round_robin → signals the caller to advance the atomic pointer', () => {
    expect(resolveStrategy(cfg({ strategy: 'round_robin' }), 'seller')).toEqual({ kind: 'round_robin' })
  })

  it('fail-safe: a missing default broker resolves to matt', () => {
    const r = resolveStrategy(cfg({ strategy: 'all_to_one', defaultBroker: '' }), null)
    expect(r).toEqual({ kind: 'resolved', broker: 'matt' })
  })
})

describe('nextRoundRobin (mirrors the SQL pointer math)', () => {
  const eligible = ['matt', 'paul', 'rebecca'] // ordered by slug, as the SQL fn orders

  it('first advance from the initial pointer (-1) picks index 0', () => {
    expect(nextRoundRobin(eligible, -1)).toEqual({ broker: 'matt', index: 0 })
  })

  it('rotates through every eligible broker in order', () => {
    expect(nextRoundRobin(eligible, 0)).toEqual({ broker: 'paul', index: 1 })
    expect(nextRoundRobin(eligible, 1)).toEqual({ broker: 'rebecca', index: 2 })
  })

  it('wraps back to the first broker after the last', () => {
    expect(nextRoundRobin(eligible, 2)).toEqual({ broker: 'matt', index: 0 })
  })

  it('only rotates among the eligible set (eligible-only)', () => {
    const two = ['matt', 'rebecca'] // paul not routing_eligible
    expect(nextRoundRobin(two, -1)).toEqual({ broker: 'matt', index: 0 })
    expect(nextRoundRobin(two, 0)).toEqual({ broker: 'rebecca', index: 1 })
    expect(nextRoundRobin(two, 1)).toEqual({ broker: 'matt', index: 0 }) // wrap
  })

  it('no eligible brokers → null (caller fails safe to default)', () => {
    expect(nextRoundRobin([], -1)).toBeNull()
  })

  it('a corrupt/negative prior index is normalized (never throws, never out of range)', () => {
    // ((-5 + 1) % 3 + 3) % 3 = 2 → 'rebecca'. The guard keeps it in range, never throws.
    expect(nextRoundRobin(eligible, -5)).toEqual({ broker: 'rebecca', index: 2 })
    // NaN is not an integer → normalized to -1 → index 0 → 'matt'.
    expect(nextRoundRobin(eligible, Number.NaN)).toEqual({ broker: 'matt', index: 0 })
  })
})
