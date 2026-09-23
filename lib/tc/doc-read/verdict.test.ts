import { describe, expect, it } from 'vitest'
import { documentVerdict, nameScore, verdictFor } from './verdict'
import type { FormReading, SignatureLine } from './vision-reading'

const line = (over: Partial<SignatureLine> & Pick<SignatureLine, 'page' | 'party' | 'section'>): SignatureLine => ({
  label: over.party === 'buyer' ? 'Buyer' : 'Seller',
  signed: false,
  signedName: null,
  printedName: null,
  date: null,
  method: 'none',
  conditional: false,
  ...over,
})
const signed = (page: number, party: SignatureLine['party'], section: string, name: string | null): SignatureLine =>
  line({ page, party, section, signed: true, signedName: name, method: 'esign_stamp', date: '4/18/2025' })

const form = (over: Partial<FormReading>): FormReading => ({
  segment: 1,
  title: 'RESIDENTIAL REAL ESTATE SALE AGREEMENT',
  formNumber: 'OREF 001',
  instanceNumber: null,
  counterBy: null,
  saleAgreementNumber: 'RRP04212025',
  termsExcerpt: null,
  propertyAddress: '2680 NW Nordic Avenue, Bend, OR 97703',
  buyersNamed: ['Elsa Uchikawa', 'Hirosaku Uchikawa'],
  sellersNamed: ['Douglas Halpin', 'Masayo Halpin'],
  blankTemplate: false,
  watermark: null,
  response: 'not_on_form',
  signatureLines: [],
  ...over,
})

// The three sections of an OREF 001 (2025) as the reader reported them on
// real Nordic Ave copies, 2026-09-23.
const ACK = 'FINAL AGENCY ACKNOWLEDGMENT'
const OFFER = '50. OFFER TO PURCHASE'
const RESPONSE = "51. SELLER'S RESPONSE"
const buyersSigned = [
  signed(1, 'buyer', ACK, 'Elsa Uchikawa'),
  signed(1, 'buyer', ACK, 'Hirosaku Uchikawa'),
  signed(14, 'buyer', OFFER, 'Elsa Uchikawa'),
  signed(14, 'buyer', OFFER, 'Hirosaku Uchikawa'),
]
const sellersBlank = [
  line({ page: 1, party: 'seller', section: ACK, printedName: 'Douglas Halpin' }),
  line({ page: 1, party: 'seller', section: ACK, printedName: 'Masayo Halpin' }),
  line({ page: 15, party: 'seller', section: RESPONSE }),
  line({ page: 15, party: 'seller', section: RESPONSE }),
]
const sellersSigned = [
  signed(1, 'seller', ACK, 'Douglas Halpin'),
  signed(1, 'seller', ACK, 'Masayo Halpin'),
  signed(15, 'seller', RESPONSE, 'Douglas Halpin'),
  signed(15, 'seller', RESPONSE, 'Masayo Halpin'),
]

describe('sale agreement (OREF 001)', () => {
  it('buyer-signed offer with a blank seller response is partial and names who is missing', () => {
    const v = verdictFor(form({ response: 'none_marked', signatureLines: [...buyersSigned, ...sellersBlank] }))
    expect(v.profileKey).toBe('oref-001-rsa')
    expect(v.basis).toBe('library')
    expect(v.verdict).toBe('partially_executed')
    expect(v.signers.filter((s) => !s.signed).map((s) => s.name)).toEqual(['Douglas Halpin', 'Masayo Halpin'])
    expect(v.reasons.join(' ')).toMatch(/Waiting on Douglas Halpin \(seller\), Masayo Halpin \(seller\)/)
  })

  it('every party signed and the seller countered: signed, countered (not fully executed)', () => {
    const v = verdictFor(form({ response: 'countered', signatureLines: [...buyersSigned, ...sellersSigned] }))
    expect(v.verdict).toBe('countered')
    expect(v.outcome).toBe('countered')
  })

  it('accepted with every signature is fully executed', () => {
    const v = verdictFor(form({ response: 'accepted', signatureLines: [...buyersSigned, ...sellersSigned] }))
    expect(v.verdict).toBe('fully_executed')
  })

  it('a seller signing only the Final Agency Acknowledgment is not acceptance', () => {
    const v = verdictFor(
      form({
        response: 'none_marked',
        signatureLines: [...buyersSigned, signed(1, 'seller', ACK, 'Douglas Halpin'), signed(1, 'seller', ACK, 'Masayo Halpin'), ...sellersBlank.slice(2)],
      }),
    )
    expect(v.verdict).toBe('partially_executed')
  })

  it('a seller who signed the response without checking a box is sent to a person', () => {
    const v = verdictFor(form({ response: 'none_marked', signatureLines: [...buyersSigned, ...sellersSigned] }))
    expect(v.verdict).toBe('needs_review')
  })

  it('one of two named buyers signing is partial, even when a second line is printed', () => {
    const v = verdictFor(
      form({
        response: 'accepted',
        signatureLines: [
          signed(1, 'buyer', ACK, 'Elsa Uchikawa'),
          line({ page: 1, party: 'buyer', section: ACK }),
          signed(14, 'buyer', OFFER, 'Elsa Uchikawa'),
          line({ page: 14, party: 'buyer', section: OFFER }),
          ...sellersSigned,
        ],
      }),
    )
    expect(v.verdict).toBe('partially_executed')
    expect(v.signers.find((s) => s.name === 'Hirosaku Uchikawa')?.signed).toBe(false)
  })

  it('a trust and its trustee are one signer', () => {
    const v = verdictFor(
      form({
        response: 'accepted',
        buyersNamed: ['James L. Sullivan, Trustee of the Sullivan Family Trust'],
        sellersNamed: ['Todd Chester'],
        signatureLines: [
          signed(1, 'buyer', ACK, 'James L. Sullivan'),
          signed(14, 'buyer', OFFER, 'James L. Sullivan'),
          signed(1, 'seller', ACK, 'Todd Chester'),
          signed(15, 'seller', RESPONSE, 'Todd Chester'),
        ],
      }),
    )
    expect(v.verdict).toBe('fully_executed')
  })
})

describe('names', () => {
  it('scores the full-name match above a shared surname', () => {
    expect(nameScore('Douglas Halpin', 'Douglas Halpin')).toBe(2)
    expect(nameScore('Douglas Halpin', 'Masayo Halpin')).toBe(1)
    expect(nameScore('Al Li', 'Bo Li')).toBe(0)
  })

  it('credits each signature to its own spouse, whatever order the lines come in', () => {
    const v = verdictFor(
      form({
        response: 'accepted',
        signatureLines: [
          ...buyersSigned,
          signed(1, 'seller', ACK, 'Masayo Halpin'),
          signed(1, 'seller', ACK, 'Douglas Halpin'),
          signed(15, 'seller', RESPONSE, 'Masayo Halpin'),
          line({ page: 15, party: 'seller', section: RESPONSE }),
        ],
      }),
    )
    expect(v.verdict).toBe('partially_executed')
    expect(v.signers.find((s) => s.name === 'Douglas Halpin')?.missingSections).toEqual([RESPONSE])
    expect(v.signers.find((s) => s.name === 'Masayo Halpin')?.signed).toBe(true)
  })

  it('counts a signature the reader could not name toward the person still missing', () => {
    const v = verdictFor(
      form({
        response: 'accepted',
        signatureLines: [
          ...buyersSigned,
          ...sellersSigned.slice(0, 3),
          { ...signed(15, 'seller', RESPONSE, null), signedName: null },
        ],
      }),
    )
    expect(v.verdict).toBe('fully_executed')
  })
})

describe('counteroffers', () => {
  const counter = (lines: SignatureLine[], over: Partial<FormReading> = {}) =>
    verdictFor(
      form({
        title: "SELLER'S COUNTEROFFER NO. 1",
        formNumber: 'OREF 003',
        instanceNumber: '1',
        counterBy: 'seller',
        buyersNamed: ['Tyler Nicoll'],
        sellersNamed: ['Mary Bowman'],
        signatureLines: lines,
        ...over,
      }),
    )

  it('signed only by the seller who made it: partial, waiting on the buyer', () => {
    const v = counter([signed(1, 'seller', 'Acknowledgment', 'Mary Bowman'), line({ page: 2, party: 'buyer', section: "4. BUYER'S RESPONSE" })])
    expect(v.verdict).toBe('partially_executed')
    expect(v.reasons.join(' ')).toMatch(/buyer has not accepted/)
  })

  it('accepted when the buyer signed the response', () => {
    const v = counter([signed(1, 'seller', 'Acknowledgment', 'Mary Bowman'), signed(2, 'buyer', "4. BUYER'S RESPONSE", 'Tyler Nicoll')])
    expect(v.verdict).toBe('fully_executed')
    expect(v.outcome).toBe('accepted')
  })

  it('numbered counters are different instances', () => {
    const a = counter([], { instanceNumber: '1' })
    const b = counter([], { instanceNumber: '2' })
    expect(a.instanceKey).not.toBe(b.instanceKey)
  })
})

describe('other forms', () => {
  it('a rejected addendum signed by both sides is rejected, not executed', () => {
    const v = verdictFor(
      form({
        title: 'ADDENDUM TO SALE AGREEMENT',
        formNumber: 'OREF 002',
        response: 'rejected',
        termsExcerpt: 'If Buyer has not entered into a binding contract for the sale of their Drouillard property',
        signatureLines: [
          signed(16, 'buyer', 'Addendum', 'Elsa Uchikawa'),
          signed(16, 'buyer', 'Addendum', 'Hirosaku Uchikawa'),
          signed(16, 'seller', 'Addendum', 'Douglas Halpin'),
          signed(16, 'seller', 'Addendum', 'Masayo Halpin'),
        ],
      }),
    )
    expect(v.verdict).toBe('rejected')
    expect(v.weakKey).toBe(false)
  })

  it('an unnumbered addendum with no terms read has a weak key', () => {
    const v = verdictFor(form({ title: 'ADDENDUM TO SALE AGREEMENT', formNumber: 'OREF 002', signatureLines: [] }))
    expect(v.weakKey).toBe(true)
  })

  it('an advisory is executed by one side', () => {
    const v = verdictFor(
      form({
        title: 'ADVISORY REGARDING ELECTRONIC FUNDS',
        formNumber: 'OREF 043',
        buyersNamed: [],
        sellersNamed: ['Mary Bowman'],
        signatureLines: [signed(1, 'seller', 'Acknowledgment', 'Mary Bowman')],
      }),
    )
    expect(v.verdict).toBe('fully_executed')
  })

  it('a title report is a reference document', () => {
    const v = verdictFor(form({ title: 'Preliminary Title Report', formNumber: null, signatureLines: [] }))
    expect(v.verdict).toBe('reference')
  })

  it('a form outside the library takes its signers from the printed lines and says so', () => {
    const v = verdictFor(
      form({
        title: "NOTICE OF BUYER'S UNCONDITIONAL DISAPPROVAL",
        formNumber: null,
        signatureLines: [signed(2, 'buyer', 'Buyer', 'Elsa Uchikawa'), signed(2, 'buyer', 'Buyer', 'Hirosaku Uchikawa')],
      }),
    )
    expect(v.basis).toBe('lines')
    expect(v.verdict).toBe('fully_executed')
    expect(v.reasons.join(' ')).toMatch(/not in the form library/)
  })

  it('a blank form with signature lines is blank; one with nothing to sign is informational (OREF 000A guide)', () => {
    expect(verdictFor(form({ blankTemplate: true, signatureLines: [line({ page: 14, party: 'buyer', section: OFFER })] })).verdict).toBe('blank')
    expect(verdictFor(form({ title: 'THINGS TO KNOW BEFORE SIGNING', formNumber: 'OREF 000A', blankTemplate: true })).verdict).toBe('reference')
  })

  it('two earnest money receipts with nothing telling them apart are not copies of each other', () => {
    const receipt = verdictFor(form({ title: 'RECEIPT FOR DEPOSIT', formNumber: null, signatureLines: [] }))
    expect(receipt.weakKey).toBe(true)
  })

  it('the file is only as executed as its least executed form', () => {
    const rsa = verdictFor(form({ response: 'accepted', signatureLines: [...buyersSigned, ...sellersSigned] }))
    const add = verdictFor(form({ title: 'ADDENDUM TO SALE AGREEMENT', formNumber: 'OREF 002', signatureLines: [...buyersSigned.slice(2)] }))
    const d = documentVerdict([rsa, add])
    expect(d.verdict).toBe('partially_executed')
    expect(d.summary).toMatch(/Residential Real Estate Sale Agreement: fully executed; Addendum to Sale Agreement: partially signed/)
  })

  it('an advisory signed on its "Client" line is executed (Nordic OREF 047 / 080, 2026-09-23)', () => {
    for (const [title, num] of [['ADVISORY REGARDING REAL ESTATE COMPENSATION', 'OREF 047'], ['ADVISORY REGARDING SMOKE AND CARBON MONOXIDE ALARMS', 'OREF 080']]) {
      const v = verdictFor(
        form({
          title,
          formNumber: num,
          buyersNamed: [],
          sellersNamed: [],
          signatureLines: [
            { ...signed(1, 'other', '7. ACKNOWLEDGMENT', 'Elsa Uchikawa'), label: 'Client' },
            { ...line({ page: 1, party: 'other', section: '7. ACKNOWLEDGMENT' }), label: 'Client' },
          ],
        }),
      )
      expect(v.verdict, title).toBe('fully_executed')
    }
  })

  it('a title company\'s "By:" signature executes an earnest money receipt', () => {
    const v = verdictFor(
      form({
        title: 'RECEIPT FOR DEPOSIT',
        formNumber: null,
        signatureLines: [
          { ...signed(1, 'other', 'Receipt for Deposit', 'Emily Brooks'), label: 'BY:' },
          { ...line({ page: 1, party: 'escrow', section: 'Receipt for Deposit' }), label: 'ESCROW OFFICER:' },
        ],
      }),
    )
    expect(v.profileKey).toBe('earnest-money-receipt')
    expect(v.verdict).toBe('fully_executed')
  })

  it('an unsigned conditional line is not missing (SPD exclusion, Nordic 2026-09-23)', () => {
    const v = verdictFor(
      form({
        title: "SELLER'S PROPERTY DISCLOSURE STATEMENT",
        formNumber: 'OREF 020a',
        buyersNamed: [],
        signatureLines: [
          { ...line({ page: 1, party: 'seller', section: 'Section 1. Exclusion' }), conditional: true },
          { ...line({ page: 1, party: 'buyer', section: 'Section 1. Exclusion' }), conditional: true },
          signed(7, 'seller', 'Verification', 'Douglas Halpin'),
          signed(7, 'seller', 'Verification', 'Masayo Halpin'),
          signed(7, 'buyer', "II. Buyer's Acknowledgment", 'Elsa Uchikawa'),
        ],
      }),
    )
    expect(v.verdict).toBe('fully_executed')
  })

  it('a document outside the library with no signature lines is informational', () => {
    const v = verdictFor(form({ title: 'Ryan Realty / Transaction Audit', formNumber: null, signatureLines: [] }))
    expect(v.verdict).toBe('reference')
  })
})
