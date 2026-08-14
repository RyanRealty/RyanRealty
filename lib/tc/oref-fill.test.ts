import { describe, expect, it } from 'vitest'
import {
  coverRowsFromFacts,
  dealFactsFromRows,
  mapDealFactsToFillValues,
  mergePartyNamesIntoFacts,
  parseEarnestMoneyAmount,
  pickPreferredOrefForm,
  presentFactValues,
  resolveOrefFieldMap,
  type DealFacts,
  type OrefFormCandidate,
} from './oref-fill'

const FULL: DealFacts = {
  address: '218 SW 4th St',
  city: 'Redmond',
  state: 'OR',
  zip: '97756',
  buyers: ['Todd Chester'],
  sellers: ['PMA Investments LLC'],
  salePrice: 435000,
  listingPrice: 449000,
  mlsNumber: '220199880',
  escrowNumber: 'E-100',
  escrowCompany: 'Western Title',
  contractAcceptanceDate: '2025-04-22',
  escrowClosingDate: '2025-07-31',
  actualClosingDate: null,
  brokerName: 'Matt Ryan',
  earnestMoneyAmount: 10000,
}

describe('dealFactsFromRows', () => {
  it('maps known tc_* columns and drops empty names', () => {
    const facts = dealFactsFromRows(
      { address: '218 SW 4th St', city: 'Redmond', state: 'OR', zip: '97756', broker_name: 'Matt Ryan' },
      {
        buyers: ['Todd Chester', ''],
        sellers: ['PMA Investments LLC'],
        sale_price: '435000',
        listing_price: null,
        mls_number: '220199880',
        escrow_number: '  ',
        escrow_company: null,
        earnest_money: null,
        contract_acceptance_date: '2025-04-22T00:00:00Z',
        escrow_closing_date: '2025-07-31',
        actual_closing_date: null,
        broker_name: null,
      },
    )
    expect(facts.buyers).toEqual(['Todd Chester'])
    expect(facts.salePrice).toBe(435000)
    expect(facts.escrowNumber).toBeNull()
    expect(facts.contractAcceptanceDate).toBe('2025-04-22')
    expect(facts.brokerName).toBe('Matt Ryan')
    expect(facts.earnestMoneyAmount).toBeNull()
  })

  it('does not treat zero or junk prices as present', () => {
    const facts = dealFactsFromRows({ address: 'x' }, { sale_price: 0, listing_price: 'n/a' })
    expect(facts.salePrice).toBeNull()
    expect(facts.listingPrice).toBeNull()
  })

  it('reads buyer/seller names from cycle jsonb objects without inventing', () => {
    const facts = dealFactsFromRows(
      { address: '218 SW 4th St' },
      {
        buyers: [{ name: 'Todd Chester' }, { first: 'Ada', last: 'Lovelace' }, { name: '' }],
        sellers: [{ full_name: 'PMA Investments LLC' }],
      },
    )
    expect(facts.buyers).toEqual(['Todd Chester', 'Ada Lovelace'])
    expect(facts.sellers).toEqual(['PMA Investments LLC'])
  })
})

describe('mergePartyNamesIntoFacts', () => {
  it('prefers named CRM parties and keeps cycle names when none are linked', () => {
    const fromParties = mergePartyNamesIntoFacts(FULL, [
      { role: 'buyer', name: 'Pat Buyer' },
      { role: 'seller', name: 'Sam Seller' },
      { role: 'other', name: 'Ada Agent' },
    ])
    expect(fromParties.buyers).toEqual(['Pat Buyer'])
    expect(fromParties.sellers).toEqual(['Sam Seller'])
    expect(fromParties.salePrice).toBe(435000)

    const fallback = mergePartyNamesIntoFacts(FULL, [{ role: 'other', name: 'Ada Agent' }])
    expect(fallback.buyers).toEqual(['Todd Chester'])
    expect(fallback.sellers).toEqual(['PMA Investments LLC'])
  })
})

describe('parseEarnestMoneyAmount', () => {
  it('reads a positive number or { amount } and ignores zero', () => {
    expect(parseEarnestMoneyAmount(5000)).toBe(5000)
    expect(parseEarnestMoneyAmount({ amount: 2500 })).toBe(2500)
    expect(parseEarnestMoneyAmount(0)).toBeNull()
    expect(parseEarnestMoneyAmount({ amount: 0 })).toBeNull()
    expect(parseEarnestMoneyAmount(null)).toBeNull()
  })
})

describe('mapDealFactsToFillValues', () => {
  it('maps known deal fields onto matching bindings', () => {
    const { filled } = mapDealFactsToFillValues(FULL, [
      { dataRef: 'PropertyAddress', type: 'text', page: 1, x: 0.1, y: 0.2, w: 0.4, h: 0.03 },
      { dataRef: 'SalePrice', type: 'text', page: 1, x: 0.1, y: 0.3, w: 0.2, h: 0.03 },
      { key: 'Buyer1Name', type: 'text' },
    ])
    const byFact = Object.fromEntries(filled.map((f) => [f.factKey, f.value]))
    expect(byFact.address).toBe('218 SW 4th St')
    expect(byFact.salePrice).toBe('$435,000')
    expect(byFact.buyers).toBe('Todd Chester')
  })

  it('omits missing facts and unknown bindings instead of inventing values', () => {
    const sparse: DealFacts = {
      ...FULL,
      salePrice: null,
      earnestMoneyAmount: null,
      escrowNumber: null,
      actualClosingDate: null,
    }
    const { filled, omittedBindings, omittedFactKeys } = mapDealFactsToFillValues(sparse, [
      { dataRef: 'SalePrice' },
      { dataRef: 'EarnestMoney' },
      { dataRef: 'SomeUnknownBox' },
      { dataRef: 'PropertyCity' },
    ])
    expect(filled.map((f) => f.factKey)).toEqual(['city'])
    expect(filled.every((f) => f.value !== '' && f.value !== 'TBD' && f.value !== '$0')).toBe(true)
    expect(omittedBindings).toEqual(expect.arrayContaining(['SalePrice', 'EarnestMoney', 'SomeUnknownBox']))
    expect(omittedFactKeys).toEqual(expect.arrayContaining(['salePrice', 'earnestMoneyAmount', 'escrowNumber']))
    expect(presentFactValues(sparse).salePrice).toBeUndefined()
  })

  it('never fills sale price from listing price', () => {
    const facts: DealFacts = { ...FULL, salePrice: null, listingPrice: 449000 }
    const { filled } = mapDealFactsToFillValues(facts, [{ dataRef: 'SalePrice' }, { dataRef: 'ListPrice' }])
    expect(filled.find((f) => f.factKey === 'salePrice')).toBeUndefined()
    expect(filled.find((f) => f.factKey === 'listingPrice')?.value).toBe('$449,000')
  })
})

describe('resolveOrefFieldMap', () => {
  it('uses the checked-in 001 overlay when the live field_map is empty', () => {
    const resolved = resolveOrefFieldMap({ formNumber: '001', pageCount: 15, fieldMap: [] })
    expect(resolved.source).toBe('oref-001-overlay')
    const { filled } = mapDealFactsToFillValues(FULL, resolved.fields)
    const keys = filled.map((f) => f.factKey)
    expect(keys).toEqual(
      expect.arrayContaining(['address', 'city', 'salePrice', 'buyers', 'sellers']),
    )
    expect(filled.find((f) => f.factKey === 'salePrice')?.value).toBe('$435,000')
    expect(filled.find((f) => f.factKey === 'listingPrice')).toBeUndefined()
    expect(filled.every((f) => f.page != null && f.x != null && f.y != null)).toBe(true)
  })

  it('omits overlay blanks when the matching fact is missing', () => {
    const resolved = resolveOrefFieldMap({ formNumber: '001', pageCount: 15, fieldMap: [] })
    const { filled } = mapDealFactsToFillValues(
      { ...FULL, salePrice: null, earnestMoneyAmount: null, buyers: [] },
      resolved.fields,
    )
    const keys = filled.map((f) => f.factKey)
    expect(keys).not.toContain('salePrice')
    expect(keys).not.toContain('buyers')
    expect(keys).toContain('address')
    expect(filled.every((f) => f.value !== '$0' && f.value !== 'TBD')).toBe(true)
  })

  it('prefers a non-empty database field_map over the overlay', () => {
    const resolved = resolveOrefFieldMap({
      formNumber: '001',
      pageCount: 15,
      fieldMap: [{ dataRef: 'PropertyAddress', page: 1, x: 0.1, y: 0.1, w: 0.4, h: 0.03 }],
    })
    expect(resolved.source).toBe('db')
    expect(resolved.fields).toHaveLength(1)
  })
})

describe('coverRowsFromFacts', () => {
  it('lists only present facts', () => {
    const rows = coverRowsFromFacts({
      ...FULL,
      escrowNumber: null,
      earnestMoneyAmount: null,
      actualClosingDate: null,
    })
    expect(rows.map((r) => r.factKey)).not.toContain('escrowNumber')
    expect(rows.map((r) => r.factKey)).not.toContain('earnestMoneyAmount')
    expect(rows.find((r) => r.factKey === 'salePrice')?.value).toBe('$435,000')
  })
})

describe('pickPreferredOrefForm', () => {
  const v = (partial: Partial<OrefFormCandidate> & Pick<OrefFormCandidate, 'id' | 'name'>): OrefFormCandidate => ({
    libraryCode: 'OREF',
    formNumber: null,
    fieldCount: 0,
    blankPath: 'x.pdf',
    ...partial,
  })

  it('prefers OREF 001 sale agreement over form 110 notice', () => {
    const picked = pickPreferredOrefForm([
      v({ id: '110', formNumber: '110', name: 'Notice From Seller To Buyer', fieldCount: 12 }),
      v({ id: '001', formNumber: '001', name: 'Residential Real Estate Sale Agreement', fieldCount: 0 }),
    ])
    expect(picked?.id).toBe('001')
  })

  it('falls back to the best-supported named sale agreement', () => {
    const picked = pickPreferredOrefForm([
      v({ id: 'add', formNumber: '002', name: 'Addendum to Sale Agreement', fieldCount: 40 }),
      v({ id: 'sa', formNumber: '099', name: 'Residential Sale Agreement', fieldCount: 3 }),
    ])
    expect(picked?.id).toBe('sa')
  })
})
