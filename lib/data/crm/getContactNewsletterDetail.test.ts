import { describe, it, expect } from 'vitest'
import { summarizeNewsletterEngagement } from './getContactNewsletterDetail'

describe('summarizeNewsletterEngagement', () => {
  it('counts every open event', () => {
    const result = summarizeNewsletterEngagement([
      { kind: 'open', at: '2026-06-01T10:00:00.000Z' },
      { kind: 'open', at: '2026-06-10T10:00:00.000Z' },
      { kind: 'open', at: '2026-06-05T10:00:00.000Z' },
    ])
    expect(result.recentOpens).toBe(3)
  })

  it('finds the latest open by ISO timestamp regardless of input order', () => {
    const result = summarizeNewsletterEngagement([
      { kind: 'open', at: '2026-06-01T10:00:00.000Z' },
      { kind: 'open', at: '2026-06-20T08:00:00.000Z' },
      { kind: 'open', at: '2026-06-05T10:00:00.000Z' },
    ])
    expect(result.lastOpenAt).toBe('2026-06-20T08:00:00.000Z')
  })

  it('returns zeros for an empty event list', () => {
    expect(summarizeNewsletterEngagement([])).toEqual({ lastOpenAt: null, recentOpens: 0 })
  })

  it('counts opens case-insensitively', () => {
    const result = summarizeNewsletterEngagement([
      { kind: 'OPEN', at: '2026-06-01T10:00:00.000Z' },
      { kind: 'Open', at: '2026-06-02T10:00:00.000Z' },
    ])
    expect(result.recentOpens).toBe(2)
    expect(result.lastOpenAt).toBe('2026-06-02T10:00:00.000Z')
  })

  it('ignores non-open event kinds (clicks, sends, bounces)', () => {
    const result = summarizeNewsletterEngagement([
      { kind: 'clicked', at: '2026-06-01T10:00:00.000Z' },
      { kind: 'sent', at: '2026-06-02T10:00:00.000Z' },
      { kind: 'bounced', at: '2026-06-03T10:00:00.000Z' },
      { kind: 'open', at: '2026-06-04T10:00:00.000Z' },
    ])
    expect(result.recentOpens).toBe(1)
    expect(result.lastOpenAt).toBe('2026-06-04T10:00:00.000Z')
  })

  it('returns zeros when there are events but none are opens', () => {
    expect(
      summarizeNewsletterEngagement([
        { kind: 'clicked', at: '2026-06-01T10:00:00.000Z' },
        { kind: 'sent', at: '2026-06-02T10:00:00.000Z' },
      ]),
    ).toEqual({ lastOpenAt: null, recentOpens: 0 })
  })

  it('skips open events with an empty timestamp (cannot be the latest, not counted)', () => {
    const result = summarizeNewsletterEngagement([
      { kind: 'open', at: '' },
      { kind: 'open', at: '2026-06-07T10:00:00.000Z' },
    ])
    expect(result.recentOpens).toBe(1)
    expect(result.lastOpenAt).toBe('2026-06-07T10:00:00.000Z')
  })
})
