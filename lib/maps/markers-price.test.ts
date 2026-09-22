import { describe, expect, it } from 'vitest'
import { formatPriceLabel } from './markers'
import { formatAtlasPinPrice } from '@/lib/atlas/pin-price'

describe('formatPriceLabel', () => {
  it('matches Atlas pin language so fold and Atlas cannot drift', () => {
    expect(formatPriceLabel(735_000)).toBe('$735k')
    expect(formatPriceLabel(1_500_000)).toBe('$1.5M')
    expect(formatPriceLabel(1_000_000)).toBe('$1M')
    expect(formatPriceLabel(1.32)).toBe('')
    expect(formatPriceLabel(3_000)).toBe('')
    expect(formatPriceLabel(735_000)).toBe(formatAtlasPinPrice(735_000))
  })
})
