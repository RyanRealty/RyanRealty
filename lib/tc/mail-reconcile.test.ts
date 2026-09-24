import { describe, expect, it } from 'vitest'
import { messageKeyFromDedupe, messageKeyFromSourceDocId, planMisfileCorrections } from './mail-reconcile'

describe('message keys', () => {
  it('reads the message key off an event dedupe and a document source id', () => {
    expect(messageKeyFromDedupe('mail:rfc:abc123')).toBe('rfc:abc123')
    expect(messageKeyFromDedupe('sms:SM123')).toBeNull()
    expect(messageKeyFromSourceDocId('gmail:rfc:abc123:ANGjdJ9x')).toBe('rfc:abc123')
    expect(messageKeyFromSourceDocId('gmail:gmail:18f0a:ANG')).toBe('gmail:18f0a')
    expect(messageKeyFromSourceDocId('1234-skyslope')).toBeNull()
  })
})

describe('planMisfileCorrections', () => {
  const events = [
    // Newsletter misfiled onto School House (house-address contact).
    { id: 1, dealId: 'school-house', dedupe: 'mail:rfc:news', title: 'Build your brand', createdAt: '2026-09-01' },
    // Receipt with PDFs misfiled onto School House.
    { id: 2, dealId: 'school-house', dedupe: 'mail:rfc:receipt', title: 'Your receipt', createdAt: '2026-09-02' },
    // 3480 SW 45th mail misfiled onto Tumalo via the shared TC firm.
    { id: 3, dealId: 'tumalo', dedupe: 'mail:rfc:45th', title: 'Contingency Removal | 3480 SW 45th St', createdAt: '2026-09-03' },
    // Correct filing: Tumalo disclosures.
    { id: 4, dealId: 'tumalo', dedupe: 'mail:rfc:tumalo-spd', title: 'Property Disclosures | 19496 Tumalo', createdAt: '2026-09-04' },
    // Message the walk never saw.
    { id: 5, dealId: 'tumalo', dedupe: 'mail:rfc:gone', title: 'Deleted', createdAt: '2026-09-05' },
  ]
  const documents = [
    { id: 'd-receipt-1', dealId: 'school-house', sourceDocId: 'gmail:rfc:receipt:A1', name: 'Receipt.pdf', archived: false },
    { id: 'd-receipt-2', dealId: 'school-house', sourceDocId: 'gmail:rfc:receipt:A2', name: 'Invoice.pdf', archived: false },
    { id: 'd-spd', dealId: 'tumalo', sourceDocId: 'gmail:rfc:tumalo-spd:B1', name: 'Property Disclosures.pdf', archived: false },
    { id: 'd-45th', dealId: 'tumalo', sourceDocId: 'gmail:rfc:45th:C1', name: 'HW Addendum.pdf', archived: false },
    { id: 'd-skyslope', dealId: 'school-house', sourceDocId: '98765', name: 'Sale Agreement.pdf', archived: false },
  ]
  const decisions = new Map([
    ['rfc:news', { status: 'not_deal', dealId: null }],
    ['rfc:receipt', { status: 'not_deal', dealId: null }],
    ['rfc:45th', { status: 'filed', dealId: 'forty-fifth' }],
    ['rfc:tumalo-spd', { status: 'filed', dealId: 'tumalo' }],
  ])

  const plan = planMisfileCorrections({ events, documents, decisions })

  it('corrects only the filings the rules disagree with, and leaves unseen mail alone', () => {
    expect(plan.confirmed).toBe(1)
    expect(plan.unverified).toBe(1)
    const byDeal = Object.fromEntries(plan.corrections.map((c) => [c.dealId, c]))
    expect(byDeal['school-house'].eventIds).toEqual([1, 2])
    expect(byDeal['tumalo'].eventIds).toEqual([3])
    expect(byDeal['tumalo'].movedTo).toEqual({ 'rfc:45th': 'forty-fifth' })
    expect(byDeal['school-house'].movedTo).toEqual({ 'rfc:news': null, 'rfc:receipt': null })
  })

  it('archives the documents those messages left, never the migrated file', () => {
    const byDeal = Object.fromEntries(plan.corrections.map((c) => [c.dealId, c]))
    expect(byDeal['school-house'].documentIds.sort()).toEqual(['d-receipt-1', 'd-receipt-2'])
    expect(byDeal['tumalo'].documentIds).toEqual(['d-45th'])
  })
})
