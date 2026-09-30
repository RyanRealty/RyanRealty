import { describe, expect, it } from 'vitest'
import {
  REDECIDE_ARCHIVE_PREFIX,
  createdByMessage,
  messageKeyFromDedupe,
  messageKeyFromSourceDocId,
  planDocumentsOffDeal,
  planDocumentsOnDeal,
  planMisfileCorrections,
  redecideArchiveReason,
  type MessageDocument,
} from './mail-reconcile'

const doc = (over: Partial<MessageDocument> & { id: string }): MessageDocument => ({
  cycleId: 'cyc-a',
  sourceDocId: 'gmail:rfc:m1:ATT1',
  sha256: `sha-${over.id}`,
  archived: false,
  archivedReason: null,
  personSignals: [],
  otherFilings: [],
  ...over,
})

describe('planDocumentsOffDeal (a message leaving a deal)', () => {
  it('archives only what this message created, nobody else uses, and no person relies on', () => {
    const plan = planDocumentsOffDeal({
      messageKey: 'rfc:m1',
      documents: [
        doc({ id: 'own' }),
        doc({ id: 'reused', sourceDocId: 'gmail:rfc:other:ATT9' }),
        doc({ id: 'skyslope', sourceDocId: '98765' }),
        doc({ id: 'person', personSignals: ['document_uploaded by paul@ryan-realty.com'] }),
        doc({ id: 'checklist', personSignals: ['on the checklist (not placed by the document reader)'] }),
        doc({ id: 'shared', otherFilings: ['email rfc:m2'] }),
        doc({ id: 'gone', archived: true }),
        doc({ id: 'own' }),
      ],
    })
    expect(plan.archive).toEqual(['own'])
    expect(plan.alreadyArchived).toEqual(['gone'])
    const kept = Object.fromEntries(plan.keep.map((k) => [k.id, k.reason]))
    expect(Object.keys(kept).sort()).toEqual(['checklist', 'person', 'reused', 'shared', 'skyslope'])
    expect(kept.person).toMatch(/^a person relies on it: document_uploaded by paul@/)
    expect(kept.shared).toMatch(/^still filed by email rfc:m2/)
    expect(kept.reused).toMatch(/^not this email/)
  })

  it('knows which documents a message created from the source id', () => {
    expect(createdByMessage({ sourceDocId: 'gmail:rfc:m1:ATT1' }, 'rfc:m1')).toBe(true)
    expect(createdByMessage({ sourceDocId: 'gmail:rfc:m10:ATT1' }, 'rfc:m1')).toBe(false)
    expect(createdByMessage({ sourceDocId: null }, 'rfc:m1')).toBe(false)
  })
})

describe('planDocumentsOnDeal (a message filed on a deal)', () => {
  it('restores what a re-decision archived here, moves its documents off another cycle, and leaves other archives alone', () => {
    const ours = `${REDECIDE_ARCHIVE_PREFIX} the email that filed this on X is not mail for any file`
    const plan = planDocumentsOnDeal({
      messageKey: 'rfc:m1',
      targetCycleId: 'cyc-b',
      targetCycleHashes: new Map([['sha-twin', 'live-on-b']]),
      documents: [
        doc({ id: 'restore', cycleId: 'cyc-b', archived: true, archivedReason: ours }),
        doc({ id: 'reader-archived', cycleId: 'cyc-b', archived: true, archivedReason: 'Superseded by the executed copy' }),
        doc({ id: 'here', cycleId: 'cyc-b' }),
        doc({ id: 'move', cycleId: 'cyc-a' }),
        doc({ id: 'move-restore', cycleId: 'cyc-a', archived: true, archivedReason: ours }),
        doc({ id: 'twin', cycleId: 'cyc-a', sha256: 'sha-twin' }),
        doc({ id: 'held', cycleId: 'cyc-a', personSignals: ['principal review'] }),
        doc({ id: 'someone-else', cycleId: 'cyc-a', sourceDocId: 'gmail:rfc:m2:A' }),
      ],
    })
    expect(plan.restore).toEqual(['restore'])
    expect(plan.move).toEqual([
      { id: 'move', toCycleId: 'cyc-b', restore: false },
      { id: 'move-restore', toCycleId: 'cyc-b', restore: true },
    ])
    expect(plan.archiveDuplicate).toEqual([{ id: 'twin', duplicateOf: 'live-on-b' }])
    expect(plan.keep.map((k) => k.id)).toEqual(['held'])
  })

  it('writes an archive reason a later run can recognise', () => {
    const r = redecideArchiveReason({ fromAddress: '56111 School House Rd', toAddress: null, newStatus: 'not_deal', rulesVersion: 'mail-rules-v4' })
    expect(r.startsWith(REDECIDE_ARCHIVE_PREFIX)).toBe(true)
    expect(r).toContain('is not mail for any file')
    expect(redecideArchiveReason({ fromAddress: 'A', toAddress: 'B St', newStatus: 'filed', rulesVersion: 'v' })).toContain('belongs to B St')
    expect(redecideArchiveReason({ fromAddress: 'A', toAddress: null, newStatus: 'ambiguous', rulesVersion: 'v' })).toContain('mail queue')
  })
})

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
