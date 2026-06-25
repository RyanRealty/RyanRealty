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

describe('sendKey', () => {
  it('prefers message_id, then email_key, then recipient+subject', () => {
    expect(sendKey({ message_id: 'm1', recipient_email: 'a@b.com' })).toBe('mid:m1')
    expect(sendKey({ email_key: 'k1', recipient_email: 'a@b.com' })).toBe('ek:k1')
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
