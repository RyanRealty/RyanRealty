import { describe, expect, it } from 'vitest'
import { formatOfferMoney, offerCompareValue, type DealOffer } from './offers'

const offer = (over: Partial<DealOffer> = {}): DealOffer => ({
  id: '1',
  dealId: 'd',
  buyerName: 'Pat Buyer',
  buyerAgent: 'Ada Agent',
  price: 650000,
  earnestMoney: 10000,
  financingType: 'conventional',
  closeDate: '2026-09-30',
  contingencies: 'Inspection',
  status: 'received',
  submittedAt: '2026-08-20',
  ...over,
})

describe('offerCompareValue', () => {
  it('prints money and financing labels', () => {
    expect(offerCompareValue(offer(), 'price')).toBe('$650,000')
    expect(offerCompareValue(offer(), 'financingType')).toBe('Conventional')
    expect(formatOfferMoney(null)).toBe('—')
  })
})
