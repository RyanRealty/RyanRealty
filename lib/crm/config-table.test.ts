import { describe, it, expect } from 'vitest'
import { reorderPositions, refuseProtectedDelete } from './config-table'

describe('reorderPositions', () => {
  it('normalizes a full reorder to a dense 0..n-1 sequence', () => {
    expect(reorderPositions([1, 2, 3], [3, 1, 2])).toEqual([
      { id: 3, position: 0 },
      { id: 1, position: 1 },
      { id: 2, position: 2 },
    ])
  })

  it('is a no-op (identity positions) when order is unchanged', () => {
    expect(reorderPositions([10, 20, 30], [10, 20, 30])).toEqual([
      { id: 10, position: 0 },
      { id: 20, position: 1 },
      { id: 30, position: 2 },
    ])
  })

  it('appends current ids the caller omitted, preserving their order', () => {
    // caller only reorders the first two; ids 3 and 4 must not be dropped
    expect(reorderPositions([1, 2, 3, 4], [2, 1])).toEqual([
      { id: 2, position: 0 },
      { id: 1, position: 1 },
      { id: 3, position: 2 },
      { id: 4, position: 3 },
    ])
  })

  it('ignores unknown ids in the desired order', () => {
    // 99 is not a current id — it must never appear in the output
    expect(reorderPositions([1, 2], [99, 2, 1])).toEqual([
      { id: 2, position: 0 },
      { id: 1, position: 1 },
    ])
  })

  it('dedupes a repeated id in the desired order', () => {
    expect(reorderPositions([1, 2, 3], [2, 2, 3, 1])).toEqual([
      { id: 2, position: 0 },
      { id: 3, position: 1 },
      { id: 1, position: 2 },
    ])
  })

  it('returns no updates for an empty table', () => {
    expect(reorderPositions([], [])).toEqual([])
  })
})

describe('refuseProtectedDelete', () => {
  it('refuses a protected row with a stable message', () => {
    const res = refuseProtectedDelete({ isProtected: true, label: 'Trash' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('Trash is a protected stage and cannot be deleted')
  })

  it('allows an unprotected row', () => {
    expect(refuseProtectedDelete({ isProtected: false, label: 'Lead' })).toEqual({ ok: true })
  })
})
