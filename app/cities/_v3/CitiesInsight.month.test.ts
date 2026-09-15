import { describe, expect, it } from 'vitest'
import { formatPublishedCloseMonth } from './CitiesInsight.client'

describe('formatPublishedCloseMonth', () => {
  it('labels each published month once — no duplicate May 2026', () => {
    const starts = [
      '2025-06-01',
      '2025-07-01',
      '2025-08-01',
      '2025-09-01',
      '2025-10-01',
      '2025-11-01',
      '2025-12-01',
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
      '2026-04-01',
      '2026-05-01',
    ]
    const labels = starts.map(formatPublishedCloseMonth)
    expect(labels.filter((label) => label === 'May 2026')).toHaveLength(1)
    expect(new Set(labels).size).toBe(starts.length)
    expect(labels.at(-1)).toBe('May 2026')
    expect(labels.at(-2)).toBe('Apr 2026')
  })
})
