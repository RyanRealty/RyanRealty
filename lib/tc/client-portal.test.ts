import { describe, expect, it } from 'vitest'
import { clientActivity, clientActivityLabel, clientMilestones, clientNextSteps, envelopeNameForClient } from './client-portal'

const calendar = [
  { kind: 'contract_accepted', date: '2026-09-01', title: 'x', cycleId: 'c' },
  { kind: 'earnest_money_due', date: '2026-09-04', title: 'x', cycleId: 'c' },
  { kind: 'principal_review_due', date: '2026-09-10', title: 'x', cycleId: 'c' },
  { kind: 'inspection_period_ends', date: '2026-09-11', title: 'x', cycleId: 'c' },
  { kind: 'financing_contingency_ends', date: '2026-09-25', title: 'x', cycleId: 'c' },
  { kind: 'escrow_closes', date: '2026-10-10', title: 'x', cycleId: 'c' },
]
const dates = { listingDate: '2026-08-01', acceptanceDate: '2026-09-01', closeDate: '2026-10-10', actualCloseDate: null }

describe('clientMilestones', () => {
  it('marks the step the buyer is on, mid-escrow', () => {
    const m = clientMilestones({ role: 'buyer', stage: 'pending', dates, calendar, today: '2026-09-15' })
    expect(m.map((s) => [s.key, s.state])).toEqual([
      ['searching', 'done'],
      ['accepted', 'done'],
      ['inspection', 'done'],
      ['financing', 'current'],
      ['closing', 'upcoming'],
    ])
    expect(m.find((s) => s.key === 'closing')?.date).toBe('2026-10-10')
  })

  it('a seller starts at Listed, and a closed deal is all done', () => {
    const listed = clientMilestones({ role: 'seller', stage: 'active_listing', dates: { ...dates, acceptanceDate: null }, calendar: [], today: '2026-08-15' })
    expect(listed.map((s) => [s.key, s.state])).toEqual([
      ['listed', 'done'],
      ['accepted', 'current'],
      ['closing', 'upcoming'],
    ])
    const closed = clientMilestones({ role: 'seller', stage: 'closed', dates: { ...dates, actualCloseDate: '2026-10-09' }, calendar, today: '2026-10-20' })
    expect(closed.every((s) => s.state === 'done')).toBe(true)
    expect(closed.at(-1)?.date).toBe('2026-10-09')
  })
})

describe('clientNextSteps', () => {
  it('puts signatures first, then only the dates that ask something of this client, and never the principal review', () => {
    const steps = clientNextSteps({
      role: 'buyer',
      stage: 'pending',
      calendar,
      pendingSignatures: [{ recipientId: 'r1', envelopeName: 'Repair Addendum', sentAt: null }],
      tasks: [],
      today: '2026-09-05',
    })
    expect(steps.map((s) => s.key)).toEqual([
      'sign:r1',
      'date:inspection_period_ends',
      'date:financing_contingency_ends',
      'date:escrow_closes',
    ])
    expect(steps.some((s) => s.key.includes('principal'))).toBe(false)
  })

  it('a seller is not asked to deposit earnest money', () => {
    const steps = clientNextSteps({ role: 'seller', stage: 'pending', calendar, pendingSignatures: [], tasks: [], today: '2026-09-02' })
    expect(steps.map((s) => s.key)).not.toContain('date:earnest_money_due')
    expect(steps.map((s) => s.key)).toContain('date:inspection_period_ends')
  })
})

describe('clientActivityLabel', () => {
  it('keeps the broker\'s working record off the client view', () => {
    for (const action of ['mail_filed', 'sms_filed', 'principal_broker_review', 'offer_received', 'cda_generated', 'contact_added', 'checklist_status_changed']) {
      expect(clientActivityLabel(action, {}, 'buyer')).toBeNull()
    }
  })

  it('speaks to the client about their own milestones', () => {
    expect(clientActivityLabel('listing_contract_accepted', {}, 'seller')).toBe('You accepted an offer')
    expect(clientActivityLabel('listing_contract_accepted', {}, 'buyer')).toBe('Your offer was accepted')
    expect(clientActivityLabel('envelope_completed', { envelope: 'Sale Agreement' }, 'buyer')).toBe('Signed by everyone: Sale Agreement')
  })
})

describe('closed files and the activity feed', () => {
  it('drops contingency dates computed past the close', () => {
    const m = clientMilestones({
      role: 'seller',
      stage: 'closed',
      dates: { listingDate: null, acceptanceDate: '2026-08-24', closeDate: null, actualCloseDate: '2026-08-24' },
      calendar: [
        { kind: 'inspection_period_ends', date: '2026-09-08', title: 'x', cycleId: 'c' },
        { kind: 'financing_contingency_ends', date: '2026-10-06', title: 'x', cycleId: 'c' },
      ],
      today: '2026-09-23',
    })
    expect(m.find((s) => s.key === 'inspection')?.date).toBeNull()
    expect(m.find((s) => s.key === 'financing')?.date).toBeNull()
    expect(m.find((s) => s.key === 'closing')?.date).toBe('2026-08-24')
  })

  it('shows a buyer only their own envelopes, once each, without the address prefix', () => {
    const address = '2840 NE Sedalia Loop, Bend, OR 97701'
    const feed = clientActivity({
      role: 'buyer',
      address,
      myEnvelopeNames: new Set([`${address} — Buyers Repair Addendum`]),
      events: [
        { action: 'envelope_completed', detail: { envelope: `${address} — Buyers Repair Addendum` }, at: '3' },
        { action: 'envelope_sent', detail: { envelope: `${address} — Buyers Repair Addendum` }, at: '2' },
        { action: 'envelope_sent', detail: { envelope: 'Listing — Standard' }, at: '1' },
        { action: 'mail_filed', detail: { title: 'Offer' }, at: '0' },
      ],
    })
    expect(feed).toEqual([{ at: '3', label: 'Signed by everyone: Buyers Repair Addendum' }])
  })

  it('strips the property from an envelope name only when it leads', () => {
    expect(envelopeNameForClient('60935 Apollo Place, Bend, OR 97702 — Delivery Addendum 1', '60935 Apollo Place, Bend, OR 97702')).toBe('Delivery Addendum 1')
    expect(envelopeNameForClient('Sale agreement', '60935 Apollo Place, Bend, OR 97702')).toBe('Sale agreement')
  })
})
