import { describe, it, expect } from 'vitest'
import { summarizeEmailEngagement } from './getContactEmailEngagement'

describe('summarizeEmailEngagement', () => {
  it('returns the empty summary (hasAny false) for no rows', () => {
    const s = summarizeEmailEngagement([])
    expect(s).toEqual({
      sent: 0,
      opens: 0,
      clicks: 0,
      bounces: 0,
      complaints: 0,
      unsubscribes: 0,
      lastOpenAt: null,
      lastClickAt: null,
      hasAny: false,
    })
  })

  it('counts each event type', () => {
    const s = summarizeEmailEngagement([
      { event: 'sent', occurred_at: '2026-06-01T00:00:00Z' },
      { event: 'open', occurred_at: '2026-06-01T01:00:00Z' },
      { event: 'open', occurred_at: '2026-06-02T01:00:00Z' },
      { event: 'click', occurred_at: '2026-06-02T02:00:00Z' },
      { event: 'bounce', occurred_at: '2026-06-03T00:00:00Z' },
      { event: 'complaint', occurred_at: '2026-06-03T01:00:00Z' },
      { event: 'unsubscribe', occurred_at: '2026-06-03T02:00:00Z' },
    ])
    expect(s.sent).toBe(1)
    expect(s.opens).toBe(2)
    expect(s.clicks).toBe(1)
    expect(s.bounces).toBe(1)
    expect(s.complaints).toBe(1)
    expect(s.unsubscribes).toBe(1)
    expect(s.hasAny).toBe(true)
  })

  it('tracks the MOST RECENT open and click timestamps', () => {
    const s = summarizeEmailEngagement([
      { event: 'open', occurred_at: '2026-06-01T00:00:00Z' },
      { event: 'open', occurred_at: '2026-06-05T00:00:00Z' },
      { event: 'open', occurred_at: '2026-06-03T00:00:00Z' },
      { event: 'click', occurred_at: '2026-06-02T00:00:00Z' },
      { event: 'click', occurred_at: '2026-06-04T00:00:00Z' },
    ])
    expect(s.lastOpenAt).toBe('2026-06-05T00:00:00Z')
    expect(s.lastClickAt).toBe('2026-06-04T00:00:00Z')
  })

  it('ignores unknown event names and null timestamps without crashing', () => {
    const s = summarizeEmailEngagement([
      { event: 'delivered', occurred_at: null },
      { event: 'open', occurred_at: null },
      { event: 'totally-unknown', occurred_at: '2026-06-01T00:00:00Z' },
    ])
    expect(s.opens).toBe(1)
    expect(s.lastOpenAt).toBeNull()
    expect(s.hasAny).toBe(true)
  })
})
