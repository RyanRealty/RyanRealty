import { describe, expect, it } from 'vitest'
import {
  liveDealCyclesFromBoard,
  closingMatchesQuery,
  incompleteInFlight,
  type ClosingDealRow,
} from './closings'

function deal(over: Partial<ClosingDealRow>): ClosingDealRow {
  return {
    id: 'd1',
    propertyKey: 'k',
    address: 'Addr',
    city: 'Bend',
    brokerName: 'Matt Ryan',
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
    mlsNumber: null,
    escrowNumber: null,
    itemsTotal: 0,
    itemsInReview: 0,
    itemsRequired: 0,
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

describe('closingMatchesQuery', () => {
  const impala = deal({
    address: '5663 Impala Avenue, Redmond',
    mlsNumber: '220221088',
    brokerName: 'Paul Stevenson',
    partyNames: ['Hunter Allen'],
  })
  it('matches MLS, street, agent, and party', () => {
    expect(closingMatchesQuery(impala, '220221088')).toBe(true)
    expect(closingMatchesQuery(impala, 'impala')).toBe(true)
    expect(closingMatchesQuery(impala, 'stevenson')).toBe(true)
    expect(closingMatchesQuery(impala, 'hunter')).toBe(true)
    expect(closingMatchesQuery(impala, 'beaumont')).toBe(false)
  })
  it('empty query matches all', () => {
    expect(closingMatchesQuery(impala, '  ')).toBe(true)
  })
})

describe('incompleteInFlight', () => {
  it('ranks in-flight deals with remaining required items', () => {
    const out = incompleteInFlight([
      deal({ address: 'Closed', stage: 'closed', itemsRequired: 20 }),
      deal({ id: '2', address: 'Two req', stage: 'pending', itemsRequired: 2 }),
      deal({ id: '3', address: 'Zero', stage: 'active_listing', itemsRequired: 0 }),
      deal({ id: '4', address: 'Ten req', stage: 'active_listing', itemsRequired: 10 }),
    ])
    expect(out.map((d) => d.address)).toEqual(['Ten req', 'Two req'])
  })
})
