import { describe, expect, it } from 'vitest'
import { auditDeal, auditScore, kindOf, type AuditDoc, type AuditInput } from './records'

const doc = (id: string, forms: Array<[string | null, string, string]>, archived = false): AuditDoc => ({
  id,
  name: `${id}.pdf`,
  archived,
  ingestedAt: '2026-01-01T00:00:00Z',
  forms: forms.map(([profile, form, verdict]) => ({ profile, form, verdict, checkedAgainst: null })),
})
const base = (over: Partial<AuditInput> = {}): AuditInput => ({ side: 'seller', stage: 'closed', docs: [], offers: [], reviews: [], mailFiled: 3, yearBuilt: 2004, ...over })
const row = (rows: ReturnType<typeof auditDeal>, key: string) => rows.find((r) => r.key === key)

describe('records audit', () => {
  it('names each kind of record from the form the reader identified', () => {
    expect(kindOf({ profile: 'oref-015-listing-agreement', form: 'Listing Agreement' })).toBe('listing')
    expect(kindOf({ profile: null, form: 'LISTING AGREEMENT ADDENDUM' })).toBe('addendum')
    expect(kindOf({ profile: null, form: '1.1 OREGON RESIDENTIAL REAL ESTATE PURCHASE AND SALE AGREEMENT' })).toBe('saleAgreement')
    expect(kindOf({ profile: null, form: 'FINAL AGENCY ACKNOWLEDGEMENT' })).toBe('faa')
    expect(kindOf({ profile: null, form: 'Receipt for Incoming Wire/Direct Deposit Confirmation' })).toBe('earnestMoney')
  })

  it('a complete closed seller file', () => {
    const rows = auditDeal(
      base({
        docs: [
          doc('la', [['oref-015-listing-agreement', 'Listing Agreement', 'fully_executed']]),
          doc('pam', [['oref-042-pamphlet', 'Initial Agency Disclosure Pamphlet', 'reference']]),
          doc('spd', [['oref-020-spd', "Seller's Property Disclosure Statement", 'fully_executed']]),
          doc('rsa', [['oref-001-rsa', 'Residential Real Estate Sale Agreement', 'fully_executed']]),
          doc('em', [['earnest-money-receipt', 'Earnest Money Receipt', 'reference']]),
          doc('ss', [['settlement-statement', 'Final Settlement Statement', 'reference']]),
        ],
        offers: [{ id: 'o', buyerName: 'B', status: 'accepted', submittedAt: null, presentedAt: null, repliedAt: '2026-01-02', documentId: 'rsa' }],
        reviews: [{ documentIds: ['la', 'rsa'], reviewedAt: '2026-01-03', decision: 'approved' }],
      }),
    )
    expect(rows.filter((r) => r.status !== 'ok' && r.status !== 'na')).toEqual([])
    expect(auditScore(rows).missing).toBe(0)
  })

  it('an unanswered offer and an unreviewed agreement are named', () => {
    const rows = auditDeal(
      base({
        stage: 'active_listing',
        docs: [doc('la', [['oref-015-listing-agreement', 'Listing Agreement', 'fully_executed']])],
        offers: [{ id: 'o', buyerName: 'Jane Offer', status: 'received', submittedAt: '2026-01-02', presentedAt: null, repliedAt: null, documentId: null }],
      }),
    )
    expect(row(rows, 'offers')).toMatchObject({ status: 'review' })
    expect(row(rows, 'offers')!.detail).toMatch(/Jane Offer/)
    expect(row(rows, 'principal_review')).toMatchObject({ status: 'missing', detail: '0 of 1 reviewed in the Vault.' })
  })

  it('a partially signed listing agreement is not on file as executed; an archived copy never counts as the live one', () => {
    const rows = auditDeal(base({ stage: 'active_listing', docs: [doc('la', [['oref-015-listing-agreement', 'Listing Agreement', 'partially_executed']]), doc('old', [['oref-015-listing-agreement', 'Listing Agreement', 'fully_executed']], true)] }))
    expect(row(rows, 'listing')!.status).toBe('review')
  })

  it('lead-based paint applies to homes built before 1978; unknown year asks a person', () => {
    expect(row(auditDeal(base({ yearBuilt: 1967 })), 'lbp')!.status).toBe('missing')
    expect(row(auditDeal(base({ yearBuilt: 1995 })), 'lbp')).toBeUndefined()
    expect(row(auditDeal(base({ yearBuilt: null })), 'lbp')!.status).toBe('review')
  })

  it('buyer-side files need the buyer representation agreement, not a listing agreement', () => {
    const rows = auditDeal(base({ side: 'buyer' }))
    expect(row(rows, 'listing')!.status).toBe('na')
    expect(row(rows, 'buyer_rep')!.status).toBe('missing')
  })
})
