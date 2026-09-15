import { describe, expect, it } from 'vitest'
import { citiesInsightBoard } from './cities-index-insight'

describe('citiesInsightBoard', () => {
  it('omits a withheld month instead of zero-filling', () => {
    const board = citiesInsightBoard({
      cities: [
        { slug: 'bend', name: 'Bend', activeCount: 80 },
        { slug: 'redmond', name: 'Redmond', activeCount: 20 },
      ],
      regionMonthly: Array.from({ length: 12 }, (_, i) => ({
        periodStart: `2025-${String(i + 1).padStart(2, '0')}-01`,
        periodEnd: `2025-${String(i + 1).padStart(2, '0')}-28`,
        medianClose: 500000,
        closedCount: i === 5 ? null : 10,
      })),
      bendMonthly: [],
    })
    expect(board?.compare).toBeNull()
    expect(board?.allocation).toHaveLength(2)
    expect(board?.allocation.reduce((sum, s) => sum + s.pct, 0)).toBe(100)
    expect(board?.allocation[0]?.cls).toMatch(/^insight-cards__alloc-seg--/)
    expect(board?.allocationProse).toContain('100 leftover homes on this directory')
    expect(board?.allocationProse).not.toMatch(/648/)
  })

  it('never cites a region leftover that is not the allocation total', () => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      periodStart: `2025-${String(i + 1).padStart(2, '0')}-01`,
      periodEnd: `2025-${String(i + 1).padStart(2, '0')}-28`,
      medianClose: 500000,
      closedCount: 10,
    }))
    const board = citiesInsightBoard({
      cities: [
        { slug: 'bend', name: 'Bend', activeCount: 29 },
        { slug: 'redmond', name: 'Redmond', activeCount: 11 },
      ],
      regionMonthly: months,
      bendMonthly: months,
    })
    expect(board?.allocationProse).toBe('Bend is 73% of the 40 leftover homes on this directory.')
    expect(board?.allocation.find((s) => s.name === 'Bend')?.amount).toBe('29 for sale')
    expect(board?.allocationProse).not.toMatch(/648/)
  })

  it('uses leftoverHud region leftover as the one pile, never snapshot 648 / 1550', () => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      periodStart: `2025-${String(i + 1).padStart(2, '0')}-01`,
      periodEnd: `2025-${String(i + 1).padStart(2, '0')}-28`,
      medianClose: 500000,
      closedCount: 10,
    }))
    const board = citiesInsightBoard({
      cities: [
        { slug: 'bend', name: 'Bend', activeCount: 619 },
        { slug: 'redmond', name: 'Redmond', activeCount: 200 },
      ],
      regionMonthly: months,
      bendMonthly: months,
      regionLeftover: 1499,
    })
    expect(board?.allocationProse).toBe('Bend is 41% of the 1,499 leftover homes.')
    expect(board?.allocation.find((s) => s.name === 'Bend')?.amount).toBe('619 for sale')
    expect(board?.allocationProse).not.toMatch(/648|1550/)
    expect(JSON.stringify(board)).not.toMatch(/648|1550/)
    expect(board?.compare?.[0]?.labels).toEqual([
      'Jan 2025',
      'Feb 2025',
      'Mar 2025',
      'Apr 2025',
      'May 2025',
      'Jun 2025',
      'Jul 2025',
      'Aug 2025',
      'Sep 2025',
      'Oct 2025',
      'Nov 2025',
      'Dec 2025',
    ])
    expect(new Set(board?.compare?.[0]?.labels).size).toBe(12)
  })
})
