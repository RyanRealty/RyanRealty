import { describe, expect, it } from 'vitest'
import { pickEnvelopeReminders, ENVELOPE_REMINDER_INTERVAL_MS } from './envelope-reminders'
import type { EnvelopeReminderCandidate } from './envelope-reminders'

const NOW = Date.parse('2026-08-23T18:00:00Z')

function cand(over: Partial<EnvelopeReminderCandidate> = {}): EnvelopeReminderCandidate {
  return {
    recipientId: 'r1',
    envelopeId: 'e1',
    envelopeName: 'SA',
    envelopeStatus: 'sent',
    remindersEnabled: true,
    cycleId: 'c1',
    createdBy: 'matt@ryan-realty.com',
    propertyAddress: '20702 Beaumont Drive',
    email: 'pat@example.com',
    name: 'Pat',
    role: 'Buyer',
    actionRequired: 'NeedsToSign',
    completedAt: null,
    declinedAt: null,
    sentAt: new Date(NOW - ENVELOPE_REMINDER_INTERVAL_MS - 1000).toISOString(),
    lastRemindedAt: null,
    authTokenHash: 'abc',
    viewedAt: null,
    ...over,
  }
}

describe('pickEnvelopeReminders', () => {
  it('reminds a signer 48h after send', () => {
    expect(pickEnvelopeReminders([cand()], NOW).map((c) => c.recipientId)).toEqual(['r1'])
  })

  it('waits a full 48h once the signer has opened the documents', () => {
    const tooSoon = cand({
      viewedAt: new Date(NOW - ENVELOPE_REMINDER_INTERVAL_MS + 60_000).toISOString(),
      sentAt: new Date(NOW - ENVELOPE_REMINDER_INTERVAL_MS + 60_000).toISOString(),
    })
    expect(pickEnvelopeReminders([tooSoon], NOW)).toEqual([])
  })

  it('uses lastRemindedAt when a reminder already went out', () => {
    const recent = cand({
      viewedAt: new Date(NOW - 7_200_000).toISOString(),
      sentAt: new Date(NOW - ENVELOPE_REMINDER_INTERVAL_MS * 3).toISOString(),
      lastRemindedAt: new Date(NOW - 3_600_000).toISOString(),
    })
    expect(pickEnvelopeReminders([recent], NOW)).toEqual([])
    const dueAgain = cand({
      sentAt: new Date(NOW - ENVELOPE_REMINDER_INTERVAL_MS * 3).toISOString(),
      lastRemindedAt: new Date(NOW - ENVELOPE_REMINDER_INTERVAL_MS - 1000).toISOString(),
    })
    expect(pickEnvelopeReminders([dueAgain], NOW)).toHaveLength(1)
  })

  it('skips copy-only, NoAction, completed, drafts, and unchecked reminders', () => {
    expect(
      pickEnvelopeReminders(
        [
          cand({ recipientId: 'copy', actionRequired: 'ReceivesACopy' }),
          cand({ recipientId: 'none', actionRequired: 'NoAction' }),
          cand({ recipientId: 'done', completedAt: new Date(NOW).toISOString() }),
          cand({ recipientId: 'draft', envelopeStatus: 'draft' }),
          cand({ recipientId: 'off', remindersEnabled: false }),
          cand({ recipientId: 'later', authTokenHash: null, viewedAt: null }),
        ],
        NOW,
      ),
    ).toEqual([])
  })

  it('skips a later signing-order recipient who has not been notified yet', () => {
    expect(pickEnvelopeReminders([cand({ authTokenHash: null, viewedAt: null })], NOW)).toEqual([])
    expect(pickEnvelopeReminders([cand({ authTokenHash: null, viewedAt: new Date(NOW).toISOString() })], NOW)).toHaveLength(
      1,
    )
  })
})

describe('an invite that was never opened is retried in half an hour', () => {
  const base = {
    recipientId: 'r1',
    envelopeId: 'e1',
    envelopeName: 'Residential — Standard',
    envelopeStatus: 'sent',
    remindersEnabled: true,
    cycleId: 'c1',
    createdBy: 'matt@ryan-realty.com',
    propertyAddress: '2840 NE Sedalia Loop, Bend, OR 97701',
    email: 'admin@ryan-realty.com',
    name: 'Vault Test Buyer',
    role: 'Buyer',
    actionRequired: 'NeedsToSign',
    completedAt: null,
    declinedAt: null,
    sentAt: null,
    authTokenHash: 'hash',
  }
  const now = Date.parse('2026-08-25T23:30:00Z')
  const minutesAgo = (n: number) => new Date(now - n * 60_000).toISOString()

  it('sends another link 30 minutes after an invite nobody opened', () => {
    const due = pickEnvelopeReminders(
      [{ ...base, viewedAt: null, lastRemindedAt: minutesAgo(31), linkEmailsSent: 1 }],
      now,
    )
    expect(due.map((d) => d.recipientId)).toEqual(['r1'])
  })

  it('waits out the half hour before trying again', () => {
    expect(
      pickEnvelopeReminders([{ ...base, viewedAt: null, lastRemindedAt: minutesAgo(20), linkEmailsSent: 1 }], now),
    ).toEqual([])
  })

  it('leaves a signer who opened the documents on the 48-hour cadence', () => {
    // They have it. They are deciding. Do not mail them every half hour.
    expect(
      pickEnvelopeReminders(
        [{ ...base, viewedAt: minutesAgo(90), lastRemindedAt: minutesAgo(90), linkEmailsSent: 1 }],
        now,
      ),
    ).toEqual([])
  })

  it('stops after the fourth link rather than mailing a wrong address forever', () => {
    expect(
      pickEnvelopeReminders(
        [{ ...base, viewedAt: null, lastRemindedAt: minutesAgo(600), linkEmailsSent: 4 }],
        now,
      ),
    ).toEqual([])
  })

  it('still says nothing to a recipient whose turn has not come', () => {
    expect(
      pickEnvelopeReminders(
        [{ ...base, authTokenHash: null, viewedAt: null, lastRemindedAt: minutesAgo(600), linkEmailsSent: 0 }],
        now,
      ),
    ).toEqual([])
  })
})

describe('the unopened retry backs off instead of drumming hourly', () => {
  const base = {
    recipientId: 'r1',
    envelopeId: 'e1',
    envelopeName: '022B',
    envelopeStatus: 'sent',
    remindersEnabled: true,
    cycleId: 'c1',
    createdBy: 'matt@ryan-realty.com',
    propertyAddress: '2840 NE Sedalia Loop, Bend, OR 97701',
    email: 'marketing@ryan-realty.com',
    name: 'Marketing Test Lead',
    role: 'Seller',
    actionRequired: 'NeedsToSign',
    completedAt: null,
    declinedAt: null,
    sentAt: null,
    authTokenHash: 'hash',
    viewedAt: null,
  }
  const now = Date.parse('2026-08-26T18:00:00Z')
  const minsAgo = (n: number) => new Date(now - n * 60_000).toISOString()
  const due = (linkEmailsSent: number, mins: number) =>
    pickEnvelopeReminders([{ ...base, linkEmailsSent, lastRemindedAt: minsAgo(mins) }], now).length === 1

  it('retries 30 minutes after the first invite', () => {
    expect(due(1, 31)).toBe(true)
    expect(due(1, 20)).toBe(false)
  })

  it('waits two hours before the second retry, not another hour', () => {
    // 022B went out at 05:46 and was re-sent at 07:00, 08:01 and 09:01 before
    // the cap stopped it. Three emails in three hours is not a reminder.
    expect(due(2, 61)).toBe(false)
    expect(due(2, 121)).toBe(true)
  })

  it('waits eight hours before the last one', () => {
    expect(due(3, 200)).toBe(false)
    expect(due(3, 481)).toBe(true)
  })

  it('stops entirely at the cap', () => {
    expect(due(4, 10_000)).toBe(false)
  })
})
