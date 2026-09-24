import { describe, expect, it } from 'vitest'
import { decideRow, printedPartiesOf, registryFromRows } from './registry'
import { verdictFor } from './verdict'
import type { FormReading, SignatureLine } from './vision-reading'

const line = (party: SignatureLine['party'], signed: boolean, name: string | null = null): SignatureLine => ({
  page: 1,
  label: party,
  section: 'Signatures',
  party,
  signed,
  signedName: signed ? name : null,
  printedName: name,
  date: null,
  method: signed ? 'esign_stamp' : 'none',
  conditional: false,
})

const form = (over: Partial<FormReading>): FormReading => ({
  segment: 0,
  title: 'SEPTIC/ONSITE SEWAGE SYSTEM ADDENDUM',
  formNumber: 'OREF 081',
  instanceNumber: null,
  counterBy: null,
  saleAgreementNumber: null,
  termsExcerpt: null,
  propertyAddress: null,
  buyersNamed: ['Pat Buyer'],
  sellersNamed: ['Sam Seller'],
  blankTemplate: false,
  watermark: null,
  response: 'not_on_form',
  signatureLines: [line('buyer', true, 'Pat Buyer'), line('seller', true, 'Sam Seller')],
  ...over,
})

describe('decideRow', () => {
  it('a form the curated library lists keeps the library profile', () => {
    const d = decideRow({ title: 'RESIDENTIAL REAL ESTATE SALE AGREEMENT', copies: 40, tally: { buyer: 40, seller: 40 }, topNumber: 'OREF 001', existing: null })
    expect(d).toMatchObject({ basis: 'library', libraryKey: 'oref-001-rsa', confidence: 'library', offer: true, outcome: 'seller_response', libraryDisagrees: false })
  })

  it('the 2025 compensation notice number (091) is the library form, signed by either firm', () => {
    const d = decideRow({ title: 'NOTICE OF REAL ESTATE COMPENSATION', copies: 34, tally: { seller_agent: 20, buyer_agent: 11 }, topNumber: 'OREF 091', existing: null })
    expect(d.basis).toBe('library')
    expect(d.obligation).toEqual({ kind: 'one_side', parties: ['seller_agent', 'buyer_agent'] })
  })

  it("a form whose number contradicts the library's title match is learned from its own blocks (OREF 028 SPD addendum)", () => {
    const d = decideRow({ title: "SELLER'S PROPERTY DISCLOSURE STATEMENT ADDENDUM", copies: 35, tally: { seller: 35 }, topNumber: 'OREF 028', existing: null })
    expect(d).toMatchObject({ basis: 'blocks', confidence: 'consensus', libraryKey: null, obligation: { kind: 'all', parties: ['seller'] } })
  })

  it('a new release printing principal blocks the library does not expect is marked', () => {
    const d = decideRow({ title: 'RESIDENTIAL REAL ESTATE SALE AGREEMENT', copies: 5, tally: { buyer: 5 }, topNumber: 'OREF 001', existing: null })
    expect(d.libraryDisagrees).toBe(true)
    expect(d.obligation).toEqual({ kind: 'all', parties: ['buyer', 'seller'] })
  })

  it('a row a person set is never overwritten by the reader', () => {
    const d = decideRow({
      title: 'SEPTIC/ONSITE SEWAGE SYSTEM ADDENDUM',
      copies: 20,
      tally: { buyer: 20, seller: 20 },
      topNumber: 'OREF 081',
      existing: { basis: 'person', obligation: { kind: 'all', parties: ['seller'] }, rule: 'Matt: seller only.' },
    })
    expect(d).toMatchObject({ basis: 'person', obligation: { kind: 'all', parties: ['seller'] }, rule: 'Matt: seller only.' })
  })
})

const septicRow = {
  identity: 'septic onsite sewage system addendum',
  title: 'SEPTIC/ONSITE SEWAGE SYSTEM ADDENDUM',
  numbers: { 'OREF 081': 16 },
  obligation: { kind: 'all' as const, parties: ['buyer' as const, 'seller' as const] },
  outcome: null,
  numbered: true,
  offer: false,
  basis: 'blocks' as const,
  rule: 'The form prints signature lines for the buyer and seller on 16 copies; each named buyer and seller signs.',
  confidence: 'consensus' as const,
  copies: 16,
}

describe('verdicts through the registry', () => {
  const registry = registryFromRows([
    septicRow,
    { ...septicRow, identity: 'invoice', title: 'Invoice', numbers: {}, obligation: { kind: 'reference' }, basis: 'category', rule: 'A record.', confidence: 'rule', copies: 16, numbered: false },
    { ...septicRow, identity: 'wood stove and wood burning fireplace insert addendum', title: 'WOOD STOVE AND WOOD BURNING FIREPLACE INSERT ADDENDUM', confidence: 'new', copies: 2 },
  ])

  it('a registry form is decided by its learned profile and says why', () => {
    const v = verdictFor(form({}), registry)
    expect(v).toMatchObject({ basis: 'registry', verdict: 'fully_executed', confidence: 'consensus', numberConflict: false })
    expect(v.reasons.join(' ')).toMatch(/Who signs: The form prints signature lines for the buyer and seller/)
  })

  it('the seller signing alone leaves the buyer missing', () => {
    const v = verdictFor(form({ signatureLines: [line('buyer', false), line('seller', true, 'Sam Seller')] }), registry)
    expect(v.verdict).toBe('partially_executed')
    expect(v.signers.find((s) => s.party === 'buyer')?.signed).toBe(false)
  })

  it('a record with a signature line is a reference, not an unsigned form', () => {
    expect(verdictFor(form({ title: 'Invoice', formNumber: null, signatureLines: [line('other', false)] }), registry).verdict).toBe('reference')
  })

  it('without the registry the reader falls back to the printed lines, as before', () => {
    expect(verdictFor(form({})).basis).toBe('generic')
  })

  it('a form the library lists is never taken over by the registry', () => {
    const v = verdictFor(form({ title: 'RESIDENTIAL REAL ESTATE SALE AGREEMENT', formNumber: 'OREF 001' }), registry)
    expect(v.basis).toBe('library')
  })

  it('a registry form seen too few times carries confidence new', () => {
    expect(verdictFor(form({ title: 'WOOD STOVE AND WOOD BURNING FIREPLACE INSERT ADDENDUM', formNumber: 'OREF 046' }), registry).confidence).toBe('new')
  })
})

describe('printedPartiesOf', () => {
  it('counts every printed line, signed or not, once per party', () => {
    expect(printedPartiesOf(form({ signatureLines: [line('buyer', false), line('buyer', true), line('seller_agent', false), line('other', false)] })).sort()).toEqual(['buyer', 'seller_agent'])
  })
})

describe('registry edge cases', () => {
  const registry = registryFromRows([
    {
      identity: 'oref residential real estate sale agreement',
      title: 'OREF Residential Real Estate Sale Agreement',
      numbers: { '000A': 3 },
      obligation: { kind: 'all', parties: ['buyer', 'seller'] },
      outcome: 'seller_response',
      numbered: false,
      offer: true,
      basis: 'blocks',
      rule: 'Printed.',
      confidence: 'consensus',
      copies: 5,
    },
  ])

  it('a copy with no signature line stays informational under a registry profile (the 000A guide)', () => {
    const v = verdictFor(form({ title: 'OREF Residential Real Estate Sale Agreement', formNumber: 'OREF 000A', signatureLines: [] }), registry)
    expect(v.verdict).toBe('reference')
  })

  it("the library's optional signer is not a release change", () => {
    const d = decideRow({ title: 'CONTINGENCY REMOVAL ADDENDUM NO. 1', copies: 11, tally: { buyer: 11, seller: 11 }, topNumber: 'OREF 059', existing: null })
    expect(d.basis).toBe('library')
    expect(d.libraryDisagrees).toBe(false)
  })
})
