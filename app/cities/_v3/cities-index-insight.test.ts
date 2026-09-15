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
      regionActive: 100,
    })
    expect(board?.compare).toBeNull()
    expect(board?.allocation).toHaveLength(2)
    expect(board?.allocation.reduce((sum, s) => sum + s.pct, 0)).toBe(100)
  })
})
