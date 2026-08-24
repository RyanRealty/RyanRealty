import { describe, expect, it } from 'vitest'
import { fallbackSigningStack } from './fallback-signing-stack'

describe('fallbackSigningStack', () => {
  it('puts buyer and seller signature rows on the last page of 001', () => {
    const map = fallbackSigningStack({ pageCount: 15, formNumber: '001' })
    expect(map.some((f) => f.type === 'signature' && f.signerRole === 'buyer')).toBe(true)
    expect(map.some((f) => f.type === 'signature' && f.signerRole === 'seller')).toBe(true)
    expect(map.every((f) => f.page === 15)).toBe(true)
  })

  it('listing 015 is seller and listing broker, not buyer', () => {
    const map = fallbackSigningStack({ pageCount: 6, formNumber: '015' })
    expect(map.some((f) => f.signerRole === 'seller')).toBe(true)
    expect(map.some((f) => f.signerRole === 'listing_agent')).toBe(true)
    expect(map.some((f) => f.signerRole === 'buyer')).toBe(false)
  })
})
