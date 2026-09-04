/**
 * Locks date-asc null sink: undated rows must not keep DB newest-first on top.
 */
import { describe, expect, it } from 'vitest'

// Mirror the date-null sink rule used in sortClassified (list.ts).
function sortByDateAsc(rows: Array<{ id: string; date: string | null }>) {
  const dateOf = (d: string | null) => d ?? ''
  return [...rows].sort((a, b) => {
    const ad = dateOf(a.date)
    const bd = dateOf(b.date)
    let cmp = 0
    if (!ad && !bd) cmp = 0
    else if (!ad) return 1
    else if (!bd) return -1
    else cmp = ad.localeCompare(bd)
    if (cmp !== 0) return cmp
    return dateOf(b.date).localeCompare(dateOf(a.date))
  })
}

describe('prospect date asc null sink', () => {
  it('puts oldest dated rows first and sinks null/empty dates', () => {
    const input = [
      { id: 'new', date: '2026-09-01' },
      { id: 'null', date: null },
      { id: 'old', date: '2026-07-01' },
      { id: 'empty', date: '' },
      { id: 'mid', date: '2026-08-01' },
    ]
    expect(sortByDateAsc(input).map((r) => r.id)).toEqual([
      'old',
      'mid',
      'new',
      'null',
      'empty',
    ])
  })
})
