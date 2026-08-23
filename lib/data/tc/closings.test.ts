import { describe, expect, it } from 'vitest'
import { liveDealCyclesFromBoard, type ClosingDealRow } from './closings'

function deal(over: Partial<ClosingDealRow>): ClosingDealRow {
  return {
    id: 'd1',
    propertyKey: 'k',
    address: 'Addr',
    city: 'Bend',
    brokerName: 'Matt',
    stage: 'pending',
    stageDetail: null,
    cycleId: 'c1',
    cycleKind: 'sale',
    contractAcceptanceDate: null,
    escrowClosingDate: null,
    actualClosingDate: null,
    salePrice: null,
    listingPrice: null,
    expirationDate: null,
    itemsTotal: 0,
    itemsInReview: 0,
    partyNames: [],
    ...over,
  }
}

describe('liveDealCyclesFromBoard', () => {
  it('keeps in-flight deals with a cycle, drops closed and missing cycles', () => {
    const out = liveDealCyclesFromBoard([
      deal({ address: 'B St', stage: 'closed', cycleId: 'c-closed' }),
      deal({ id: '2', address: 'A Ave', propertyKey: 'impala', stage: 'active_listing', cycleId: 'c-list' }),
      deal({ id: '3', address: 'C Rd', stage: 'pending', cycleId: null }),
      deal({ id: '4', address: 'D Ln', stage: 'pre_contract', cycleId: 'c-pre' }),
    ])
    expect(out.map((d) => d.cycleId)).toEqual(['c-list', 'c-pre'])
    expect(out[0].address).toBe('A Ave')
  })
})
