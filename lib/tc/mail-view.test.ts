import { describe, expect, it } from 'vitest'
import { groupMailQueue, offerFollowUpLabel, type MailQueueRow } from './mail-view'

function row(p: Partial<MailQueueRow> & { id: string }): MailQueueRow {
  return {
    sentAt: '2026-09-15T12:00:00Z',
    direction: 'inbound',
    fromEmail: 'x@example.com',
    fromName: null,
    to: [],
    cc: [],
    subject: null,
    snippet: null,
    category: 'escrow_title',
    categoryLabel: 'Escrow / title',
    status: 'unfiled_transaction',
    method: null,
    reasons: [],
    attachments: [],
    offerId: null,
    mailboxes: [],
    decidedBy: 'system',
    propertyHint: null,
    candidates: [],
    ...p,
  }
}

describe('groupMailQueue', () => {
  it('groups unfiled mail by the property it names, and ambiguous mail by its candidate files', () => {
    const groups = groupMailQueue([
      row({ id: '1', propertyHint: '909 nw delaware', sentAt: '2026-09-10T00:00:00Z' }),
      row({ id: '2', propertyHint: '909 nw delaware', sentAt: '2026-09-12T00:00:00Z' }),
      row({
        id: '3',
        status: 'ambiguous',
        candidates: [
          { dealId: 'b', address: '20702 Beaumont Drive, Bend', propertyKey: 'k1', stage: 'pending', evidence: ['contact'] },
          { dealId: 'a', address: '19496 Tumalo Reservoir Rd, Bend', propertyKey: 'k2', stage: 'active_listing', evidence: ['contact'] },
        ],
        sentAt: '2026-09-14T00:00:00Z',
      }),
    ])
    expect(groups.map((g) => [g.kind, g.label, g.rows.length])).toEqual([
      ['ambiguous', '20702 Beaumont Drive · 19496 Tumalo Reservoir Rd', 1],
      ['property', '909 NW Delaware', 2],
    ])
  })
})

describe('offerFollowUpLabel', () => {
  it('says whether an emailed offer was answered and put in front of the seller', () => {
    expect(offerFollowUpLabel({ status: 'received', source: 'mail' })).toBe('No reply sent · Not yet sent to seller')
    expect(offerFollowUpLabel({ status: 'received', source: 'mail', repliedAt: 'x', presentedToSellerAt: 'y' })).toBe('Replied · Sent to seller')
    expect(offerFollowUpLabel({ status: 'received', source: 'manual' })).toBeNull()
  })
})
