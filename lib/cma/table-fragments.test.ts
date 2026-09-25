import { describe, expect, it } from 'vitest'
import {
  evenRowChunks,
  keepMatrixUnbreakable,
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
  it('keeps a 19-row two-column matrix whole: it fits one sheet', () => {
    expect(keepMatrixWhole(2, 19)).toBe(true)
  })

  it('keeps a 12-row table whole at any width', () => {
    expect(keepMatrixWhole(6, 12)).toBe(true)
  })

  it('keeps a six-column 19-row closed matrix whole when the estimate fits', () => {
    expect(keepMatrixWhole(6, 19)).toBe(true)
  })

  it('splits a 40-row two-column matrix: taller than a page', () => {
    expect(keepMatrixWhole(2, 40)).toBe(false)
  })
})

describe('keepMatrixUnbreakable', () => {
  it('does not lock a page-filling 19-row two-column matrix', () => {
    expect(keepMatrixUnbreakable(2, 19)).toBe(false)
  })

  it('locks a short piece that cannot leave 40% empty', () => {
    expect(keepMatrixUnbreakable(2, 6)).toBe(true)
  })
})

describe('evenRowChunks', () => {
  it('splits 19 into 10+9, not 12+7', () => {
    expect(evenRowChunks(19, 2)).toEqual([10, 9])
  })
})

describe('matrixChunkSizes', () => {
  it('keeps a page-fitting 19-row matrix as one table', () => {
    expect(matrixChunkSizes(19, 2)).toEqual([19])
    expect(matrixChunkSizes(19, 6)).toEqual([19])
    expect(matrixChunkSizes(12)).toEqual([12])
    expect(matrixChunkSizes(5)).toEqual([5])
  })

  it('splits a taller-than-a-page matrix into the fewest near-equal parts', () => {
    const sizes = matrixChunkSizes(40, 2)
    expect(sizes.length).toBeGreaterThanOrEqual(2)
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(40)
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1)
    for (const size of sizes) {
      expect(size).toBeGreaterThanOrEqual(3)
      expect(keepMatrixWhole(2, size)).toBe(true)
    }
  })
})

describe('packRowHtml', () => {
  it('wraps each pack in tbody.row-pack', () => {
    const html = packRowHtml(['<tr>a</tr>', '<tr>b</tr>', '<tr>c</tr>', '<tr>d</tr>', '<tr>e</tr>'])
    expect(html).toBe('<tbody class="row-pack"><tr>a</tr><tr>b</tr><tr>c</tr><tr>d</tr><tr>e</tr></tbody>')
  })
})
