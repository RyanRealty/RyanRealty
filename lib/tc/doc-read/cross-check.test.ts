import { describe, expect, it } from 'vitest'
import { crossCheckForm, normalizeFormNumber, pairCheck } from './cross-check'
import type { FormCheck } from '@/lib/tc/form-match/check'
import type { FormVerdict } from './verdict'
import type { FormReading, SignatureLine } from './vision-reading'

const line = (page: number, party: SignatureLine['party'], signed = true): SignatureLine => ({
  page, label: party, section: 'S', party, signed, signedName: null, printedName: null, date: null, method: signed ? 'esign_stamp' : 'none', conditional: false,
})
const reading = (over: Partial<FormReading> = {}): FormReading => ({
  segment: 0, title: "SELLER'S COUNTEROFFER", formNumber: 'OREF 003', instanceNumber: '1', counterBy: 'seller', saleAgreementNumber: null, termsExcerpt: null,
  propertyAddress: null, buyersNamed: ['A Buyer'], sellersNamed: ['A Seller'], blankTemplate: false, watermark: null, response: 'accepted',
  signatureLines: [line(1, 'seller'), line(1, 'buyer')], ...over,
})
const verdict = (v: FormVerdict['verdict']): FormVerdict => ({
  segment: 0, profileKey: 'oref-003', formName: "Seller's Counteroffer", basis: 'library', numberConflict: false, rule: null, confidence: 'library', offer: true,
  instanceNumber: '1', counterBy: 'seller', saleAgreementNumber: null, verdict: v, outcome: null, signers: [], reasons: ['read'], instanceKey: 'k', weakKey: false, numbered: true, checklistTerms: [],
})
const check = (over: Partial<FormCheck> = {}): FormCheck => ({
  templateId: 't', family: 'OREF', formNumber: '003', release: '01/2025', title: '', source: 'learned', pageCount: 1,
  pages: [{ templatePage: 1, docPage: 1, coverage: 1 }], missingPages: [],
  lines: [
    { page: 1, party: 'seller', label: 'Seller', section: '1', required: true, signed: true, dated: true, printed: true, ink: 300 },
    { page: 1, party: 'buyer', label: 'Buyer', section: '2', required: true, signed: true, dated: true, printed: true, ink: 300 },
  ],
  initials: [], ...over,
})

describe('cross-check', () => {
  it('normalizes printed form numbers', () => {
    expect(normalizeFormNumber('OREF 003')).toBe('003')
    expect(normalizeFormNumber('Form 2.1')).toBe('2.1')
    expect(normalizeFormNumber(null)).toBeNull()
  })

  it('pairs a form with the check on the same pages and number', () => {
    expect(pairCheck(reading(), [check()])).not.toBeNull()
    expect(pairCheck(reading(), [check({ formNumber: '004' })])).toBeNull()
    expect(pairCheck(reading({ signatureLines: [line(3, 'seller')] }), [check()])).toBeNull()
  })

  it('both reads agree: the verdict stands and records what it was checked against', () => {
    const out = crossCheckForm(verdict('fully_executed'), reading(), [check()])
    expect(out.verdict).toBe('fully_executed')
    expect(out.checkedAgainst).toBe('OREF 003 released 01/2025 (learned from our own copies)')
  })

  it('the reader says executed but the buyer line is empty: a person confirms', () => {
    const c = check()
    c.lines[1] = { ...c.lines[1], signed: false, ink: 0 }
    const out = crossCheckForm(verdict('fully_executed'), reading(), [c])
    expect(out.verdict).toBe('needs_review')
    expect(out.reasons[0]).toMatch(/buyer has not signed/)
  })

  it('a missing page stops a fully executed call too', () => {
    const out = crossCheckForm(verdict('fully_executed'), reading(), [check({ pageCount: 2, missingPages: [2], pages: [{ templatePage: 1, docPage: 1, coverage: 1 }, { templatePage: 2, docPage: null, coverage: null }] })])
    expect(out.verdict).toBe('needs_review')
    expect(out.reasons[0]).toMatch(/missing page 2 of 2/)
  })

  it('ink where the reader saw no signature never upgrades a verdict', () => {
    expect(crossCheckForm(verdict('partially_executed'), reading(), [check()]).verdict).toBe('partially_executed')
  })
})
