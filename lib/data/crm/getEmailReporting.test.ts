import { describe, it, expect } from 'vitest'
import {
  safeRate,
  formatRate,
  sendKey,
  clampLimit,
  clampOffset,
  collapseSendLog,
  summarizeEngagement,
  summarizeCampaign,
  recoverSendTypes,
  filterBySendType,
  inheritEmailKeys,
  type RawEmailEventRow,
} from './getEmailReporting'

// ── safeRate — divide-by-zero -> null, never a fake 0 ─────────────────────────

describe('safeRate', () => {
  it('returns the honest ratio when the denominator is positive', () => {
    expect(safeRate(1, 4)).toBe(0.25)
    expect(safeRate(3, 3)).toBe(1)
    expect(safeRate(0, 5)).toBe(0) // a true 0 over real deliveries is honest
  })

  it('returns NULL (not 0) when the denominator is zero', () => {
    expect(safeRate(0, 0)).toBeNull()
    expect(safeRate(5, 0)).toBeNull()
  })

  it('guards a negative or non-finite denominator/numerator to null', () => {
    expect(safeRate(1, -2)).toBeNull()
    expect(safeRate(-1, 4)).toBeNull()
    expect(safeRate(1, Number.NaN)).toBeNull()
    expect(safeRate(Number.POSITIVE_INFINITY, 4)).toBeNull()
  })
})

describe('formatRate', () => {
  it('renders a fraction as a one-decimal percent', () => {
    expect(formatRate(0.25)).toBe('25.0%')
    expect(formatRate(0.333)).toBe('33.3%')
    expect(formatRate(1)).toBe('100.0%')
  })

  it('renders a dash for null (no fake 0%)', () => {
    expect(formatRate(null)).toBe('—')
  })
})

// ── sendKey — stable per-send identity ────────────────────────────────────────

describe('inheritEmailKeys', () => {
  it('copies email_key from the sent row onto later message_id matches', () => {
    const [sent, delivered] = inheritEmailKeys([
      {
        message_id: 're_1',
        recipient_email: 'a@b.com',
        person_id: 7,
        broker: 'matt',
        send_type: 'campaign',
        event: 'sent',
        email_key: 'bulk:email-cohort:26',
        subject: 'Hi',
        occurred_at: '2026-08-29T21:00:00.000Z',
      },
      {
        message_id: 're_1',
        recipient_email: 'a@b.com',
        person_id: 7,
        broker: null,
        send_type: 'other',
        event: 'delivered',
        email_key: null,
        subject: null,
        occurred_at: '2026-08-29T21:00:02.000Z',
      },
    ])
    expect(sent.email_key).toBe('bulk:email-cohort:26')
    expect(delivered.email_key).toBe('bulk:email-cohort:26')
    expect(delivered.send_type).toBe('campaign')
    expect(delivered.broker).toBe('matt')
    expect(delivered.subject).toBe('Hi')
  })
})

describe('sendKey', () => {
  it('prefers email_key+recipient, then message_id, then recipient+subject', () => {
    expect(sendKey({ email_key: 'k1', recipient_email: 'a@b.com' })).toBe('ek:k1|a@b.com')
    expect(sendKey({ message_id: 'm1', email_key: 'k1', recipient_email: 'a@b.com' })).toBe('ek:k1|a@b.com')
    expect(sendKey({ message_id: 'm1', recipient_email: 'a@b.com' })).toBe('mid:m1')
    expect(sendKey({ recipient_email: 'A@B.com', subject: 'Hi' })).toBe('rs:a@b.com|hi')
  })

  it('collapses recipient casing/whitespace', () => {
    expect(sendKey({ recipient_email: '  Foo@Bar.COM ', subject: ' Sub ' })).toBe('rs:foo@bar.com|sub')
  })
})

describe('clamps', () => {
  it('clampLimit defaults + caps', () => {
    expect(clampLimit(undefined)).toBe(50)
    expect(clampLimit(0)).toBe(50)
    expect(clampLimit(10)).toBe(10)
    expect(clampLimit(9999)).toBe(200)
  })
  it('clampOffset floors to non-negative', () => {
    expect(clampOffset(undefined)).toBe(0)
    expect(clampOffset(-5)).toBe(0)
    expect(clampOffset(20)).toBe(20)
  })
})

// ── collapseSendLog — one row per send, latest lifecycle event ─────────────────

function ev(over: Partial<RawEmailEventRow>): RawEmailEventRow {
  return {
    message_id: 'm1',
    recipient_email: 'a@b.com',
    person_id: 7,
    broker: 'matt',
    send_type: 'campaign',
    event: 'sent',
    email_key: null,
    subject: 'Hello',
    occurred_at: '2026-06-25T00:00:00.000Z',
    ...over,
  }
}

describe('collapseSendLog', () => {
  it('collapses a fan into one row keeping the highest-ranked event', () => {
    const rows = [
      ev({ event: 'click', occurred_at: '2026-06-25T03:00:00.000Z' }),
      ev({ event: 'open', occurred_at: '2026-06-25T02:00:00.000Z' }),
      ev({ event: 'delivered', occurred_at: '2026-06-25T01:00:00.000Z' }),
      ev({ event: 'sent', occurred_at: '2026-06-25T00:00:00.000Z' }),
    ]
    const out = collapseSendLog(rows)
    expect(out).toHaveLength(1)
    expect(out[0].latestEvent).toBe('click')
    expect(out[0].firstAtIso).toBe('2026-06-25T00:00:00.000Z')
    expect(out[0].latestAtIso).toBe('2026-06-25T03:00:00.000Z')
  })

  it('a bounce outranks an earlier open as the headline status', () => {
    const rows = [
      ev({ event: 'open', occurred_at: '2026-06-25T01:00:00.000Z' }),
      ev({ event: 'bounce', occurred_at: '2026-06-25T02:00:00.000Z' }),
    ]
    const out = collapseSendLog(rows)
    expect(out[0].latestEvent).toBe('bounce')
  })

  it('keeps distinct sends separate and sorts newest first', () => {
    const rows = [
      ev({ message_id: 'mA', event: 'sent', occurred_at: '2026-06-24T00:00:00.000Z' }),
      ev({ message_id: 'mB', event: 'open', occurred_at: '2026-06-25T00:00:00.000Z' }),
    ]
    const out = collapseSendLog(rows)
    expect(out).toHaveLength(2)
    expect(out[0].messageId).toBe('mB') // newer latestAt first
    expect(out[1].messageId).toBe('mA')
  })

  it('ignores unrecognized events', () => {
    const out = collapseSendLog([ev({ event: 'nonsense' })])
    expect(out).toHaveLength(0)
  })

  it('joins a Gmail sent row to a pixel open that only has email_key', () => {
    const rows = collapseSendLog([
      ev({
        message_id: 'gmail-1',
        email_key: 'manual:7:1',
        event: 'sent',
        occurred_at: '2026-08-30T10:00:00.000Z',
      }),
      ev({
        message_id: null,
        email_key: 'manual:7:1',
        event: 'open',
        occurred_at: '2026-08-30T10:05:00.000Z',
      }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].latestEvent).toBe('open')
    expect(rows[0].sentAtIso).toBe('2026-08-30T10:00:00.000Z')
    expect(rows[0].openedAtIso).toBe('2026-08-30T10:05:00.000Z')
  })
})

// ── summarizeEngagement — honest counts + rates ───────────────────────────────

describe('summarizeEngagement', () => {
  it('tallies stages and computes rates against the right denominators', () => {
    // One send: sent -> delivered -> open. open/delivered = 1/1 = 100%.
    const rows = [
      ev({ event: 'sent' }),
      ev({ event: 'delivered' }),
      ev({ event: 'open' }),
    ]
    const s = summarizeEngagement(rows)
    expect(s.sent).toBe(1)
    expect(s.delivered).toBe(1)
    expect(s.opened).toBe(1)
    expect(s.clicked).toBe(0)
    expect(s.openRate).toBe(1)
    expect(s.clickRate).toBe(0)
    expect(s.bounceRate).toBe(0) // 0 bounces / 1 sent is honest
  })

  it('returns NULL rates when there are no deliveries / sends (no fake 0%)', () => {
    const s = summarizeEngagement([])
    expect(s.sent).toBe(0)
    expect(s.openRate).toBeNull()
    expect(s.clickRate).toBeNull()
    expect(s.bounceRate).toBeNull()
  })

  it('open rate is null when there are sends but zero deliveries', () => {
    const s = summarizeEngagement([ev({ event: 'sent' }), ev({ event: 'bounce' })])
    expect(s.sent).toBe(1)
    expect(s.delivered).toBe(0)
    expect(s.openRate).toBeNull() // 0 deliveries -> cannot measure opens
    expect(s.bounceRate).toBe(1) // 1 bounce / 1 sent
  })

  it('de-dupes a doubled (send,event) row so the math stays correct', () => {
    const rows = [
      ev({ event: 'delivered', occurred_at: '2026-06-25T01:00:00.000Z' }),
      ev({ event: 'open', occurred_at: '2026-06-25T02:00:00.000Z' }),
      ev({ event: 'open', occurred_at: '2026-06-25T02:00:01.000Z' }), // dup open, same send
    ]
    const s = summarizeEngagement(rows)
    expect(s.opened).toBe(1)
    expect(s.openRate).toBe(1)
  })
})

// ── recoverSendTypes — join lifecycle 'other' rows back to the sent row ────────

describe('recoverSendTypes', () => {
  it('rewrites lifecycle (other) rows to the sent row send_type by message_id', () => {
    // The webhook writes open/click as 'other'; the sent row carries the truth.
    const rows = [
      ev({ message_id: 'm1', event: 'sent', send_type: 'market-report' }),
      ev({ message_id: 'm1', event: 'open', send_type: 'other' }),
      ev({ message_id: 'm1', event: 'click', send_type: 'other' }),
    ]
    const out = recoverSendTypes(rows)
    expect(out.map((r) => r.send_type)).toEqual(['market-report', 'market-report', 'market-report'])
  })

  it('the sent event wins over another concrete value for the same message', () => {
    const rows = [
      ev({ message_id: 'm1', event: 'open', send_type: 'campaign' }),
      ev({ message_id: 'm1', event: 'sent', send_type: 'market-report' }),
    ]
    const out = recoverSendTypes(rows)
    expect(out.every((r) => r.send_type === 'market-report')).toBe(true)
  })

  it('leaves rows with no message_id, or no recoverable type, unchanged', () => {
    const rows = [
      ev({ message_id: null, event: 'open', send_type: 'other' }),
      ev({ message_id: 'mX', event: 'open', send_type: 'other' }), // no sent row for mX
    ]
    const out = recoverSendTypes(rows)
    expect(out[0].send_type).toBe('other')
    expect(out[1].send_type).toBe('other')
  })

  it('returns the same rows when nothing is recoverable', () => {
    const rows = [ev({ message_id: 'm1', event: 'open', send_type: 'other' })]
    expect(recoverSendTypes(rows)).toBe(rows)
  })
})

// ── filterBySendType — in-memory type filter after recovery ────────────────────

describe('filterBySendType', () => {
  it('keeps only rows whose send_type matches', () => {
    const rows = [
      ev({ message_id: 'm1', event: 'sent', send_type: 'market-report' }),
      ev({ message_id: 'm2', event: 'sent', send_type: 'campaign' }),
    ]
    expect(filterBySendType(rows, 'market-report')).toHaveLength(1)
    expect(filterBySendType(rows, 'market-report')[0].message_id).toBe('m1')
  })

  it('is a no-op for a null/empty filter', () => {
    const rows = [ev({ event: 'sent' })]
    expect(filterBySendType(rows, null)).toBe(rows)
    expect(filterBySendType(rows, '')).toBe(rows)
  })

  it('recovery + filter together keep the lifecycle events of the selected type', () => {
    // A market-report send with an open; without recovery the open (other) would
    // be dropped by a market-report filter, hiding the engagement.
    const rows = [
      ev({ message_id: 'm1', event: 'sent', send_type: 'market-report' }),
      ev({ message_id: 'm1', event: 'open', send_type: 'other' }),
      ev({ message_id: 'm2', event: 'sent', send_type: 'campaign' }),
    ]
    const out = filterBySendType(recoverSendTypes(rows), 'market-report')
    expect(out).toHaveLength(2)
    const s = summarizeEngagement(out)
    expect(s.sent).toBe(1)
    expect(s.opened).toBe(1)
    // Implied-denominator rule (2026-09-01, the ">100% open rate" class): an
    // open proves the send was delivered even when its delivered row is
    // missing, so this is 1 open / 1 implied delivery — a real measurement,
    // no longer the old "no deliveries -> null".
    expect(s.openRate).toBe(1)
  })
})

// ── summarizeCampaign — tracked flag ──────────────────────────────────────────

describe('summarizeCampaign', () => {
  it('reports tracked:false with null rates when no events exist', () => {
    const c = summarizeCampaign([])
    expect(c.tracked).toBe(false)
    expect(c.openRate).toBeNull()
    expect(c.clickRate).toBeNull()
  })

  it('reports tracked:true with real numbers when events exist', () => {
    const c = summarizeCampaign([ev({ event: 'delivered' }), ev({ event: 'open' })])
    expect(c.tracked).toBe(true)
    expect(c.opened).toBe(1)
    expect(c.openRate).toBe(1)
  })
})

describe('sendKey — a batch campaign is many sends, not one', () => {
  it('separates two recipients of the same campaign', () => {
    const a = sendKey({ email_key: 'bulk:email-cohort:18', recipient_email: 'a@example.com' })
    const b = sendKey({ email_key: 'bulk:email-cohort:18', recipient_email: 'b@example.com' })
    expect(a).not.toBe(b)
  })

  it('counts one sent per recipient across a shared email_key', () => {
    const key = 'bulk:email-cohort:18'
    const rows = ['a@example.com', 'b@example.com', 'c@example.com'].flatMap((recipient_email) => [
      { message_id: null, recipient_email, person_id: null, broker: null, send_type: 'campaign', event: 'sent', email_key: key, subject: 'S', occurred_at: '2026-08-25T19:46:00Z' },
      { message_id: null, recipient_email, person_id: null, broker: null, send_type: 'campaign', event: 'delivered', email_key: key, subject: 'S', occurred_at: '2026-08-25T19:46:01Z' },
    ])
    const sum = summarizeEngagement(rows)
    expect(sum.sent).toBe(3)
    expect(sum.delivered).toBe(3)
  })

  it('still collapses a duplicate event for the same recipient', () => {
    const key = 'bulk:email-cohort:18'
    const row = { message_id: null, recipient_email: 'a@example.com', person_id: null, broker: null, send_type: 'campaign', event: 'open', email_key: key, subject: 'S', occurred_at: '2026-08-25T19:46:02Z' }
    expect(summarizeEngagement([row, { ...row, occurred_at: '2026-08-25T19:47:00Z' }]).opened).toBe(1)
  })
})
