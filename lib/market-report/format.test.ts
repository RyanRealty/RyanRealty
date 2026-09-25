import { describe, expect, it } from 'vitest'
import { marketVerdict } from '@/lib/data/market-truth/registry'
import { mosText } from './format'

describe('mosText', () => {
  it('prints one decimal when that reads the same verdict', () => {
    expect(mosText(3.26)).toBe('3.3')
    expect(mosText(4)).toBe('4.0')
    expect(mosText(3.96)).toBe('4.0')
    expect(mosText(6.04)).toBe('6.0')
  })

  it('never rounds across a threshold', () => {
    // 1,261 for sale against 1,880 sales in six months (Central Oregon, August 2026).
    const aug = 1261 / (1880 / 6)
    expect(marketVerdict(aug)).toBe('balanced')
    expect(mosText(aug)).toBe('4.1')
    expect(mosText(5.985)).toBe('5.9')
    expect(mosText(5.9996)).toBe('5.9')
  })

  it('always prints a number whose verdict is the value\'s own', () => {
    for (let x = 3.9; x <= 6.1; x += 0.0007) {
      expect(marketVerdict(Number(mosText(x)))).toBe(marketVerdict(x))
    }
  })

  it('prints a dash for no value', () => {
    expect(mosText(null)).toBe('–')
    expect(mosText(Number.NaN)).toBe('–')
  })
})
