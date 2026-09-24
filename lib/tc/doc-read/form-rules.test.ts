import { describe, expect, it } from 'vitest'
import { categoryOf, deriveProfile, formIdentity, lawRuleFor, noticeSender } from './form-rules'

describe('law decides who signs, whatever the release', () => {
  it('the initial agency disclosure pamphlet is delivered, not signed (OAR 863-015-0215)', () => {
    const d = deriveProfile({ title: 'Initial Agency Disclosure Pamphlet', tally: { buyer: 3 }, copies: 3 })
    expect(d.obligation).toEqual({ kind: 'reference' })
    expect(d.basis).toBe('law')
    expect(d.rule).toMatch(/OAR 863-015-0215/)
  })

  it('a standalone final agency acknowledgment needs buyer and seller (ORS 696.845)', () => {
    const d = deriveProfile({ title: 'FINAL AGENCY ACKNOWLEDGEMENT', tally: { buyer: 1 }, copies: 1 })
    expect(d.obligation).toEqual({ kind: 'all', parties: ['buyer', 'seller'] })
    expect(d.confidence).toBe('rule')
  })

  it("the seller's disclosure needs the buyer's acknowledgment; its addendum is not the statutory form", () => {
    expect(lawRuleFor("SELLER'S PROPERTY DISCLOSURE STATEMENT")?.key).toBe('seller-property-disclosure')
    expect(lawRuleFor("SELLER'S PROPERTY DISCLOSURE STATEMENT ADDENDUM")).toBeNull()
  })

  it('lead-based paint: seller, buyer and both agents (40 CFR 745.113)', () => {
    const d = deriveProfile({ title: '2.6 Lead-Based Hazard Addendum', tally: { buyer: 2, seller: 2 }, copies: 2 })
    expect(d.obligation).toEqual({ kind: 'all', parties: ['buyer', 'seller', 'buyer_agent', 'seller_agent'] })
  })

  it('FHA / VA amendatory clause: buyer and seller, agents only when the contract lacks them', () => {
    for (const title of ['FHA AMENDATORY CLAUSE AND REAL ESTATE CERTIFICATION', '2.19 FHA & VA Amendatory Clause', 'VA/FHA AMENDATORY CLAUSE AND REAL ESTATE CERTIFICATION']) {
      expect(deriveProfile({ title, tally: {}, copies: 1 }).obligation).toEqual({ kind: 'all', parties: ['buyer', 'seller'], optional: ['buyer_agent', 'seller_agent'] })
    }
  })

  it('the FIRPTA qualified-substitute statement is signed by escrow alone', () => {
    const d = deriveProfile({ title: 'STATEMENT OF ESCROW AGENT ACTING AS QUALIFIED SUBSTITUTE', tally: {}, copies: 7 })
    expect(d.obligation).toEqual({ kind: 'all', parties: ['escrow'] })
  })
})

describe('the kind of instrument', () => {
  it.each([
    ['1.1 OREGON RESIDENTIAL REAL ESTATE PURCHASE AND SALE AGREEMENT', 'sale_agreement'],
    ['RESIDENTIAL CONDOMINIUM REAL ESTATE SALE AGREEMENT', 'sale_agreement'],
    ['2.1 COUNTEROFFER TO REAL ESTATE PURCHASE AND SALE AGREEMENT', 'counteroffer'],
    ['2.2 GENERAL ADDENDUM TO REAL ESTATE PURCHASE AND SALE AGREEMENT', 'agreement'],
    ['SEPTIC/ONSITE SEWAGE SYSTEM ADDENDUM', 'agreement'],
    ['AGREEMENT TO OCCUPY AFTER CLOSING', 'agreement'],
    ['DELIVERY OF ASSOCIATION DOCUMENTS NO. 01', 'unknown'],
    ["NOTICE OF BUYER'S UNCONDITIONAL DISAPPROVAL", 'notice'],
    ['CONTINGENT RIGHT TO PURCHASE – NOTICE TO SELLER', 'notice'],
    ['ADVISORY REGARDING FAIR HOUSING', 'advisory'],
    ['NOTICE OF REAL ESTATE COMPENSATION', 'compensation_notice'],
    ["BUYER'S AGENT INSTRUCTIONS TO ESCROW NO. 1", 'escrow_instruction'],
    ['Receipt for Incoming Wire/Direct Deposit Confirmation', 'escrow_receipt'],
    ['Invoice', 'reference'],
    ["FINAL SELLER'S STATEMENT", 'reference'],
    ['STATUTORY WARRANTY DEED', 'reference'],
    ['Certificate of Completion', 'reference'],
    ['Letter from Guyasuta Investment Advisors', 'reference'],
    ['Privacy Notice', 'reference'],
    ['Accrual Balance Sheet', 'reference'],
    ['9.2 DISCLOSED LIMITED AGENCY AGREEMENT', 'agency_agreement'],
    ['MULTIPLE LISTING SERVICE OF CENTRAL OREGON LISTING CONTRACT', 'agency_agreement'],
    ['FORM 9.9 ADDENDUM FOR AGENT DOCUMENTS', 'agency_agreement'],
  ])('%s → %s', (title, want) => {
    expect(categoryOf(title)).toBe(want)
  })

  it('a notice is signed by the party giving it', () => {
    expect(noticeSender("NOTICE OF BUYER'S UNCONDITIONAL DISAPPROVAL")).toBe('buyer')
    expect(noticeSender('CONTINGENT RIGHT TO PURCHASE – NOTICE TO SELLER')).toBe('buyer')
    expect(noticeSender('NOTICE FROM SELLER TO BUYER')).toBe('seller')
    const d = deriveProfile({ title: "NOTICE OF BUYER'S UNCONDITIONAL DISAPPROVAL", tally: { buyer: 11, seller: 9 }, copies: 11 })
    expect(d.obligation).toEqual({ kind: 'all', parties: ['buyer'], optional: ['seller'] })
  })

  it('an advisory is one side', () => {
    expect(deriveProfile({ title: 'ADVISORY REGARDING FAIR HOUSING', tally: {}, copies: 16 }).obligation).toEqual({ kind: 'one_side', parties: ['buyer', 'seller'] })
    expect(deriveProfile({ title: 'ADVISORY TO BUYER REGARDING DUE DILIGENCE', tally: { buyer: 3 }, copies: 3 }).obligation).toEqual({ kind: 'one_side', parties: ['buyer'] })
  })

  it("the compensation notice is the paid firm's principal broker, either side", () => {
    expect(deriveProfile({ title: 'NOTICE OF REAL ESTATE COMPENSATION', tally: { seller_agent: 20, buyer_agent: 11 }, copies: 34 }).obligation).toEqual({
      kind: 'one_side',
      parties: ['buyer_agent', 'seller_agent'],
    })
  })

  it('a sale agreement or counteroffer carries its outcome and is an offer', () => {
    const sa = deriveProfile({ title: '1.1 OREGON RESIDENTIAL REAL ESTATE PURCHASE AND SALE AGREEMENT', tally: { buyer: 28, seller: 28, seller_agent: 20 }, copies: 28 })
    expect(sa).toMatchObject({ outcome: 'seller_response', offer: true, obligation: { kind: 'all', parties: ['buyer', 'seller'], optional: ['seller_agent'] } })
    expect(deriveProfile({ title: 'COUNTEROFFER NO. 2', tally: { buyer: 1, seller: 1 }, copies: 1 })).toMatchObject({ outcome: 'counter', offer: true, numbered: true })
  })
})

describe('the printed blocks, across copies', () => {
  it('a party printed on most copies is required; agents on a party instrument are optional', () => {
    const d = deriveProfile({ title: 'SEPTIC/ONSITE SEWAGE SYSTEM ADDENDUM', tally: { buyer: 16, seller: 16, buyer_agent: 6, seller_agent: 6 }, copies: 16 })
    expect(d.obligation).toEqual({ kind: 'all', parties: ['buyer', 'seller'] })
    expect(d.confidence).toBe('consensus')
  })

  it('one copy the reader saw only in part does not drop a party', () => {
    const d = deriveProfile({ title: 'OWNER ASSOCIATION ADDENDUM', tally: { buyer: 14, seller: 15 }, copies: 15 })
    expect(d.obligation).toEqual({ kind: 'all', parties: ['buyer', 'seller'] })
  })

  it('a form seen once or twice is new: decided, but not acted on alone', () => {
    expect(deriveProfile({ title: 'WOOD STOVE AND WOOD BURNING FIREPLACE INSERT ADDENDUM', tally: { buyer: 2, seller: 2 }, copies: 2 }).confidence).toBe('new')
  })

  it('no signature line on any copy: informational', () => {
    expect(deriveProfile({ title: 'Some Handout', tally: {}, copies: 4 }).obligation).toEqual({ kind: 'reference' })
  })

  it('an agency agreement binds the client and the broker', () => {
    expect(deriveProfile({ title: '9.2 DISCLOSED LIMITED AGENCY AGREEMENT', tally: { seller: 2, seller_agent: 2 }, copies: 2 }).obligation).toEqual({
      kind: 'all',
      parties: ['seller', 'seller_agent'],
    })
  })
})

describe('formIdentity', () => {
  it('one identity per form across numbering, instance numbers and punctuation', () => {
    expect(formIdentity('DELIVERY OF ASSOCIATION DOCUMENTS NO. 01')).toBe(formIdentity('Delivery of Association Documents No. 2'))
    expect(formIdentity('2.2 GENERAL ADDENDUM TO REAL ESTATE PURCHASE AND SALE AGREEMENT')).toBe('general addendum to real estate purchase and sale agreement')
    expect(formIdentity("SELLER'S PROPERTY DISCLOSURE STATEMENT ADDENDUM")).toBe(formIdentity('Seller’s Property Disclosure Statement Addendum'))
    expect(formIdentity('Addendum #3')).toBe('addendum')
    expect(formIdentity('')).toBeNull()
  })
})

describe('agency forms that print only "Client"', () => {
  it('are decided but not acted on alone', () => {
    expect(deriveProfile({ title: '9.2 DISCLOSED LIMITED AGENCY AGREEMENT', tally: { seller_agent: 4 }, copies: 4 }).confidence).toBe('new')
  })
})
