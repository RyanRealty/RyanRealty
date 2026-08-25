import { describe, expect, it } from 'vitest'
import { fallbackSigningStack, withFallbackSignatures,
  withNoUnsignableRequirement,
} from './fallback-signing-stack'

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
  it('uses the printed Buyer/Seller lines instead of dumping a second stack', () => {
    const map = withFallbackSignatures(
      [
        {
          type: 'text',
          page: 15,
          x: 0.126,
          y: 0.309,
          w: 0.509,
          h: 0.022,
          dataRef: 'Buyer_4',
          signerRole: null,
          optional: false,
          label: 'Buyer_4',
        },
        {
          type: 'text',
          page: 15,
          x: 0.126,
          y: 0.737,
          w: 0.509,
          h: 0.022,
          dataRef: 'Seller_5',
          signerRole: null,
          optional: false,
          label: 'Seller_5',
        },
      ],
      { pageCount: 15, formNumber: '001' },
    )
    const buyer = map.find((f) => f.label === 'Buyer_4')
    const seller = map.find((f) => f.label === 'Seller_5')
    expect(buyer).toMatchObject({ type: 'signature', y: 0.309, w: 0.509 })
    expect(seller).toMatchObject({ type: 'signature', y: 0.737, w: 0.509 })
    expect(map.filter((f) => f.type === 'signature' && f.label === 'Buyer signature')).toHaveLength(0)
  })

  it('appends last-page signatures when the AcroForm map is only text widgets', () => {
    const map = withFallbackSignatures(
      [
        {
          type: 'text',
          page: 2,
          x: 0.1,
          y: 0.2,
          w: 0.4,
          h: 0.016,
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

  it('keeps 059 signatures on the printed Delivering/Receiving lines', () => {
    const map = withFallbackSignatures(
      [
        {
          type: 'text',
          page: 1,
          x: 0.184,
          y: 0.537,
          w: 0.451,
          h: 0.022,
          dataRef: 'Delivering Party',
          signerRole: null,
          optional: false,
          label: 'Delivering Party',
        },
        {
          type: 'text',
          page: 1,
          x: 0.183,
          y: 0.708,
          w: 0.451,
          h: 0.022,
          dataRef: 'Receiving Party',
          signerRole: null,
          optional: false,
          label: 'Receiving Party',
        },
        {
          type: 'signature',
          page: 1,
          x: 0.865,
          y: 0.463,
          w: 0.073,
          h: 0.016,
          dataRef:
            'DELIVERY AND RECEIPT By signing below the delivering Party represents that the abovelisted items are being delivered',
          signerRole: null,
          optional: false,
          label: 'DELIVERY AND RECEIPT By signing below the delivering Party represents that the abovelisted items are being delivered',
        },
      ],
      { pageCount: 1, formNumber: '059', documentName: 'Delivery Addendum 1 - 059 OREF' },
    )
    const dumped = map.filter((f) => f.type === 'signature' && f.y >= 0.77)
    expect(dumped).toHaveLength(0)
    expect(map.find((f) => f.label === 'Delivering Party')).toMatchObject({ type: 'signature', y: 0.537 })
    expect(map.find((f) => f.label === 'Receiving Party')).toMatchObject({ type: 'signature', y: 0.708 })
    expect(map.find((f) => f.x === 0.865)?.type).toBe('text')
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

describe('withNoUnsignableRequirement', () => {
  it('stops a field nobody on the form can sign from blocking the send', () => {
    const map = [
      { type: 'signature' as const, page: 1, x: 0.1, y: 0.8, w: 0.3, h: 0.04, signerRole: 'buyer' as const, optional: false, dataRef: 'BuyerSignature', label: 'Buyer signature' },
      { type: 'initials' as const, page: 1, x: 0.1, y: 0.9, w: 0.05, h: 0.02, signerRole: 'seller' as const, optional: false, dataRef: 'SellerInitials', label: 'Seller initials' },
      { type: 'text' as const, page: 1, x: 0.1, y: 0.5, w: 0.3, h: 0.02, signerRole: null, optional: false, dataRef: 'Notes', label: 'Notes' },
    ]
    const out = withNoUnsignableRequirement(map, new Set(['seller']))
    expect(out[0]).toMatchObject({ type: 'signature', signerRole: 'buyer', optional: true })
    expect(out[1]).toMatchObject({ type: 'initials', signerRole: 'seller', optional: false })
    // Text is not a signing obligation — leave it exactly as it was.
    expect(out[2]).toMatchObject({ type: 'text', optional: false })
  })
})
