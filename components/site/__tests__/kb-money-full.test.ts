import { describe, expect, it } from 'vitest'
import { kbMoneyFull } from '@/lib/kb/types'

describe('kbMoneyFull', () => {
  it('keeps Southern Crossing and NorthWest Crossing list medians exact', () => {
    expect(kbMoneyFull(919500)).toBe('$919,500')
    expect(kbMoneyFull(919500)).not.toBe('$920,000')
    expect(kbMoneyFull(1199900)).toBe('$1,199,900')
    expect(kbMoneyFull(1199900)).not.toBe('$1,200,000')
  })

  it('withholds a missing figure', () => {
    expect(kbMoneyFull(null)).toBeNull()
    expect(kbMoneyFull(Number.NaN)).toBeNull()
  })
})
