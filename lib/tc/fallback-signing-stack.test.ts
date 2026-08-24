import { describe, expect, it } from 'vitest'
import { fallbackSigningStack, withFallbackSignatures } from './fallback-signing-stack'

describe('fallbackSigningStack', () => {
  it('puts buyer, seller, and both licensee signature rows on the last page of 001', () => {
    const map = fallbackSigningStack({ pageCount: 15, formNumber: '001' })
    expect(map.some((f) => f.type === 'signature' && f.signerRole === 'buyer')).toBe(true)
    expect(map.some((f) => f.type === 'signature' && f.signerRole === 'seller')).toBe(true)
    expect(map.some((f) => f.type === 'signature' && f.signerRole === 'listing_agent')).toBe(true)
    expect(map.some((f) => f.type === 'signature' && f.signerRole === 'buyer_agent')).toBe(true)
    expect(map.every((f) => f.page === 15)).toBe(true)
  })

  it('listing 015 is seller and listing broker, not buyer', () => {
    const map = fallbackSigningStack({ pageCount: 6, formNumber: '015' })
    expect(map.some((f) => f.signerRole === 'seller')).toBe(true)
    expect(map.some((f) => f.signerRole === 'listing_agent')).toBe(true)
    expect(map.some((f) => f.signerRole === 'buyer')).toBe(false)
  })
})

describe('withFallbackSignatures', () => {
  it('appends last-page signatures when the AcroForm map is only text widgets', () => {
    const map = withFallbackSignatures(
      [
        {
          type: 'text',
          page: 2,
          x: 0.1,
          y: 0.2,
          w: 0.4,
          h: 0.02,
          dataRef: 'Buyer1Name',
          signerRole: 'buyer',
          optional: false,
          label: 'Buyers',
        },
      ],
      { pageCount: 15, formNumber: '001' },
    )
    expect(map.some((f) => f.type === 'text' && f.dataRef === 'Buyer1Name')).toBe(true)
    expect(map.some((f) => f.type === 'signature' && f.signerRole === 'buyer')).toBe(true)
    expect(map.some((f) => f.type === 'signature' && f.signerRole === 'seller')).toBe(true)
  })

  it('does not duplicate a role that already has a signature box', () => {
    const map = withFallbackSignatures(
      [
        {
          type: 'signature',
          page: 6,
          x: 0.1,
          y: 0.8,
          w: 0.3,
          h: 0.04,
          dataRef: 'SellerSignature',
          signerRole: 'seller',
          optional: false,
          label: 'Seller signature',
        },
      ],
      { pageCount: 6, formNumber: '015' },
    )
    expect(map.filter((f) => f.type === 'signature' && f.signerRole === 'seller')).toHaveLength(1)
    expect(map.some((f) => f.type === 'signature' && f.signerRole === 'listing_agent')).toBe(true)
  })
})
