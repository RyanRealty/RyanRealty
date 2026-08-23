import { describe, expect, it } from 'vitest'
import type { ClosingDealRow } from './closings'
import { productionByBroker } from './production'

function deal(over: Partial<ClosingDealRow>): ClosingDealRow {
  return {
    id: '1',
    propertyKey: 'k',
    address: 'A',
    city: null,
    brokerName: 'Matt Ryan',
    stage: 'pending',
    stageDetail: null,
    cycleId: 'c',
    cycleKind: 'sale',
    contractAcceptanceDate: null,
    escrowClosingDate: null,
    actualClosingDate: null,
    salePrice: null,
    listingPrice: null,
    expirationDate: null,
    mlsNumber: null,
    escrowNumber: null,
    itemsTotal: 1,
    itemsInReview: 1,
    itemsRequired: 2,
    partyNames: [],
    ...over,
  }
}

describe('productionByBroker', () => {
  it('rolls in-flight incomplete onto the deal broker', () => {
    const rows = productionByBroker([
      deal({ id: '1', brokerName: 'Matt Ryan', stage: 'pending', itemsRequired: 2, itemsInReview: 1 }),
      deal({ id: '2', brokerName: 'Paul Stevenson', stage: 'active_listing', itemsRequired: 4, itemsInReview: 0 }),
      deal({ id: '3', brokerName: 'Matt Ryan', stage: 'closed', itemsRequired: 9, itemsInReview: 9 }),
    ])
    const matt = rows.find((r) => r.broker === 'Matt Ryan')!
    expect(matt.pending).toBe(1)
    expect(matt.closed).toBe(1)
    expect(matt.incompleteRequired).toBe(2)
    expect(matt.inReview).toBe(1)
    expect(rows.find((r) => r.broker === 'Paul Stevenson')?.listings).toBe(1)
  })
})
