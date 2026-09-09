import { describe, expect, it } from 'vitest'
import { inboundEmailRepliesToAdvance, isAutomatedInboundEmail, replyPreview } from './inbound-email-advance'

const T0 = '2026-09-09T12:00:00.000Z'

describe('an inbound email advances the CRM the way a text does', () => {
  it('one entry per person, newest message, inside the window, with a one-line preview', () => {
    const rows = [
      { personId: 63297, messageKey: 'a', subject: 'Re: 2465 NE 7th', body: 'Thanks Matt.\nCan we talk Thursday?\n\n> On Sep 8 you wrote:', ts: '2026-09-09T13:00:00.000Z' },
      { personId: 63297, messageKey: 'b', subject: 'Re: 2465 NE 7th', body: 'Following up — Thursday at 2?', ts: '2026-09-09T14:00:00.000Z' },
      { personId: 63425, messageKey: 'c', subject: 'old', body: 'from last year', ts: '2025-01-01T00:00:00.000Z' },
    ]
    const out = inboundEmailRepliesToAdvance(rows, T0)
    expect(out).toEqual([{ personId: 63297, preview: 'Following up — Thursday at 2?', messageKey: 'b' }])
  })

  it('robots never advance anyone', () => {
    expect(isAutomatedInboundEmail({ subject: 'Automatic reply: Your report', body: 'x', fromEmails: ['dana@example.com'] })).toBe(true)
    expect(isAutomatedInboundEmail({ subject: 'Re: report', body: 'I am out of the office until Monday.', fromEmails: [] })).toBe(true)
    expect(isAutomatedInboundEmail({ subject: 'Delivery Status Notification (Failure)', body: null, fromEmails: ['mailer-daemon@googlemail.com'] })).toBe(true)
    expect(isAutomatedInboundEmail({ subject: 'Accepted: Walk-through', body: null, fromEmails: ['calendar-notification@google.com'] })).toBe(true)
    expect(isAutomatedInboundEmail({ subject: 'Re: 1617 NW 8th', body: 'Yes, still thinking about selling.', fromEmails: ['blake@example.com'] })).toBe(false)
    const out = inboundEmailRepliesToAdvance([{ personId: 1, messageKey: 'x', subject: 'Out of Office', body: 'back Monday', ts: '2026-09-09T13:00:00.000Z' }], T0)
    expect(out).toEqual([])
  })

  it('the preview skips quoted lines and caps the length', () => {
    expect(replyPreview('> you wrote\nOn Mon, Matt wrote:\n\nSure, call me.')).toBe('Sure, call me.')
    expect(replyPreview('x'.repeat(300))!.length).toBe(140)
    expect(replyPreview('')).toBeNull()
  })
})
