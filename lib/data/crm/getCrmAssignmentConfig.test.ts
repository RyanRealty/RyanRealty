import { describe, it, expect } from 'vitest'
import { mapAssignmentConfig, normalizeStrategy, ASSIGNMENT_CONFIG_FALLBACK } from './getCrmAssignmentConfig'

describe('normalizeStrategy', () => {
  it('passes known strategies through', () => {
    expect(normalizeStrategy('all_to_one')).toBe('all_to_one')
    expect(normalizeStrategy('round_robin')).toBe('round_robin')
    expect(normalizeStrategy('by_source')).toBe('by_source')
  })

  it('defaults an unknown/empty/null value to all_to_one (the dormant default)', () => {
    expect(normalizeStrategy('garbage')).toBe('all_to_one')
    expect(normalizeStrategy('')).toBe('all_to_one')
    expect(normalizeStrategy(null)).toBe('all_to_one')
    expect(normalizeStrategy(undefined)).toBe('all_to_one')
  })
})

describe('mapAssignmentConfig', () => {
  it('a null config row → the all-to-Matt fallback', () => {
    expect(mapAssignmentConfig(null, [])).toEqual(ASSIGNMENT_CONFIG_FALLBACK)
  })

  it('maps strategy + default broker', () => {
    const c = mapAssignmentConfig({ strategy: 'round_robin', default_broker: 'matt' }, [])
    expect(c.strategy).toBe('round_robin')
    expect(c.defaultBroker).toBe('matt')
    expect(c.rules).toEqual([])
  })

  it('an empty default broker falls back to matt', () => {
    const c = mapAssignmentConfig({ strategy: 'all_to_one', default_broker: '' }, [])
    expect(c.defaultBroker).toBe('matt')
  })

  it('sorts rules by position then id and drops incomplete rows', () => {
    const c = mapAssignmentConfig({ strategy: 'by_source', default_broker: 'matt' }, [
      { id: 3, source: 'seller', broker: 'rebecca', position: 2 },
      { id: 1, source: 'buyer', broker: 'paul', position: 1 },
      { id: 4, source: '', broker: 'paul', position: 0 }, // dropped (no source)
      { id: 5, source: 'fsbo', broker: '', position: 0 }, // dropped (no broker)
    ])
    expect(c.rules).toEqual([
      { id: 1, source: 'buyer', broker: 'paul', position: 1 },
      { id: 3, source: 'seller', broker: 'rebecca', position: 2 },
    ])
  })
})
