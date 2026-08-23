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

  it('waits a full 48h', () => {
    const tooSoon = cand({ sentAt: new Date(NOW - ENVELOPE_REMINDER_INTERVAL_MS + 60_000).toISOString() })
    expect(pickEnvelopeReminders([tooSoon], NOW)).toEqual([])
  })

  it('uses lastRemindedAt when a reminder already went out', () => {
    const recent = cand({
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
