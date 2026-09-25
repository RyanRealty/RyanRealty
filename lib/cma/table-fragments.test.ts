import { describe, expect, it } from 'vitest'
import {
  keepMatrixWhole,
  matrixChunkSizes,
  packRowHtml,
  tableFragmentSizes,
} from '@/lib/cma/table-fragments'

describe('tableFragmentSizes', () => {
  it('keeps five rows in one pack', () => {
    expect(tableFragmentSizes(5)).toEqual([5])
  })

  it('never leaves a 1-row or 2-row pack on a 19-row matrix', () => {
    expect(tableFragmentSizes(19)).toEqual([3, 3, 3, 3, 3, 4])
    for (const size of tableFragmentSizes(19)) {
      expect(size).toBeGreaterThanOrEqual(3)
    }
  })

  it('turns a 13-row remainder into 3+3+3+4, not 3+3+3+3+1', () => {
    expect(tableFragmentSizes(13)).toEqual([3, 3, 3, 4])
  })
})

describe('keepMatrixWhole', () => {
  it('does not force a 19-row two-column matrix whole', () => {
    expect(keepMatrixWhole(2, 19)).toBe(false)
  })

  it('keeps a 12-row table whole at any width', () => {
    expect(keepMatrixWhole(6, 12)).toBe(true)
  })

  it('lets a six-column 19-row closed matrix split', () => {
    expect(keepMatrixWhole(6, 19)).toBe(false)
  })
})

describe('matrixChunkSizes', () => {
  it('keeps 12 or fewer rows as one table', () => {
    expect(matrixChunkSizes(12)).toEqual([12])
    expect(matrixChunkSizes(5)).toEqual([5])
  })

  it('splits 19 rows into 12+7, never a 1-row or 2-row piece', () => {
    expect(matrixChunkSizes(19)).toEqual([12, 7])
    expect(matrixChunkSizes(13)).toEqual([10, 3])
  })
})

describe('packRowHtml', () => {
  it('wraps each pack in tbody.row-pack', () => {
    const html = packRowHtml(['<tr>a</tr>', '<tr>b</tr>', '<tr>c</tr>', '<tr>d</tr>', '<tr>e</tr>'])
    expect(html).toBe('<tbody class="row-pack"><tr>a</tr><tr>b</tr><tr>c</tr><tr>d</tr><tr>e</tr></tbody>')
  })
})
