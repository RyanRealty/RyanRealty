import { describe, expect, it } from 'vitest'
import { indexBarWeight, liveForSaleLabel } from './cities-index-constants'

describe('indexBarWeight', () => {
  it('is the row share of the largest count', () => {
    expect(indexBarWeight(50, 100)).toBe(0.5)
    expect(indexBarWeight(100, 100)).toBe(1)
    expect(indexBarWeight(0, 100)).toBe(0)
  })

  it('withholds a bar when the count or the max is not a figure', () => {
    expect(indexBarWeight(null, 100)).toBeUndefined()
    expect(indexBarWeight(12, 0)).toBeUndefined()
    expect(indexBarWeight(Number.NaN, 10)).toBeUndefined()
  })
})

describe('liveForSaleLabel', () => {
  it('names the listed set, and zero as none listed', () => {
    expect(liveForSaleLabel(12)).toBe('12 for sale')
    expect(liveForSaleLabel(0)).toBe('None listed now')
  })
})
