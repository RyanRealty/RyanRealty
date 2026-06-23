import { describe, it, expect } from 'vitest'
import {
  isSustainedHotAnonymous,
  evaluateSustainedHotAnonymous,
  isAlreadyIdentified,
  SUSTAINED_HOT_ANONYMOUS_DEFAULTS,
  type SustainedHotAnonymousSignals,
} from './isSustainedHotAnonymous'

// CONTACT360 Phase 0.3: convert a sustained hot ANONYMOUS visitor into a durable
// tracked record. These tests lock the PURE rule that gates that conversion:
// it must fire AT the threshold (>= 5 listing views across >= 2 sessions in 14
// days), NOT below it, and it must IGNORE any visitor who is already identified
// (known email / fub person / auth user / existing crm_person) so we never mint
// a duplicate lead. No Supabase here. The .from() reads live in the DAL module.

// A fixed "now" so the 14-day recency window is deterministic across machines.
const NOW = new Date('2026-06-20T12:00:00.000Z')

/** Build N listing_view events spread across the given session ids, all recent. */
function recentEvents(sessionIds: string[], perSession: number): SustainedHotAnonymousSignals['listingViewEvents'] {
  const out: SustainedHotAnonymousSignals['listingViewEvents'] = []
  for (const sid of sessionIds) {
    for (let i = 0; i < perSession; i++) {
      // 1 day before NOW, comfortably inside the window.
      out.push({ sessionId: sid, eventAt: '2026-06-19T10:00:00.000Z' })
    }
  }
  return out
}

const NO_IDENTITY: SustainedHotAnonymousSignals['identity'] = {
  identifiedAt: null,
  fubPersonId: null,
  email: null,
  authUserId: null,
  existingCrmPersonId: null,
}

describe('isSustainedHotAnonymous (Phase 0.3 conversion gate)', () => {
  describe('fires AT the threshold', () => {
    it('qualifies on exactly 5 listing views across exactly 2 sessions in window', () => {
      const signals: SustainedHotAnonymousSignals = {
        // 3 + 2 = 5 views across sessions a + b.
        listingViewEvents: [...recentEvents(['sess-a'], 3), ...recentEvents(['sess-b'], 2)],
        identity: NO_IDENTITY,
      }
      const evalResult = evaluateSustainedHotAnonymous(signals, {}, NOW)
      expect(evalResult.listingViewsInWindow).toBe(5)
      expect(evalResult.distinctSessionsInWindow).toBe(2)
      expect(evalResult.alreadyIdentified).toBe(false)
      expect(evalResult.qualifies).toBe(true)
      expect(isSustainedHotAnonymous(signals, {}, NOW)).toBe(true)
    })

    it('qualifies comfortably above threshold (8 views across 3 sessions)', () => {
      const signals: SustainedHotAnonymousSignals = {
        listingViewEvents: [
          ...recentEvents(['s1'], 3),
          ...recentEvents(['s2'], 3),
          ...recentEvents(['s3'], 2),
        ],
        identity: NO_IDENTITY,
      }
      expect(isSustainedHotAnonymous(signals, {}, NOW)).toBe(true)
    })
  })

  describe('does NOT fire below the threshold', () => {
    it('rejects when listing views are enough but only ONE session (a binge, not sustained)', () => {
      const signals: SustainedHotAnonymousSignals = {
        listingViewEvents: recentEvents(['only-session'], 6), // 6 views, 1 session
        identity: NO_IDENTITY,
      }
      const e = evaluateSustainedHotAnonymous(signals, {}, NOW)
      expect(e.listingViewsInWindow).toBe(6)
      expect(e.distinctSessionsInWindow).toBe(1)
      expect(e.qualifies).toBe(false)
      expect(isSustainedHotAnonymous(signals, {}, NOW)).toBe(false)
    })

    it('rejects when sessions are enough but listing views fall one short (4 < 5)', () => {
      const signals: SustainedHotAnonymousSignals = {
        listingViewEvents: [...recentEvents(['s1'], 2), ...recentEvents(['s2'], 2)], // 4 views, 2 sessions
        identity: NO_IDENTITY,
      }
      const e = evaluateSustainedHotAnonymous(signals, {}, NOW)
      expect(e.listingViewsInWindow).toBe(4)
      expect(e.distinctSessionsInWindow).toBe(2)
      expect(e.qualifies).toBe(false)
    })

    it('rejects when listing views are stale (outside the 14-day window)', () => {
      const signals: SustainedHotAnonymousSignals = {
        listingViewEvents: [
          // 20 days before NOW — outside the 14-day window, so they do not count.
          { sessionId: 's1', eventAt: '2026-05-31T10:00:00.000Z' },
          { sessionId: 's1', eventAt: '2026-05-31T10:05:00.000Z' },
          { sessionId: 's2', eventAt: '2026-05-31T11:00:00.000Z' },
          { sessionId: 's2', eventAt: '2026-05-31T11:05:00.000Z' },
          { sessionId: 's3', eventAt: '2026-05-31T12:00:00.000Z' },
        ],
        identity: NO_IDENTITY,
      }
      const e = evaluateSustainedHotAnonymous(signals, {}, NOW)
      expect(e.listingViewsInWindow).toBe(0)
      expect(e.distinctSessionsInWindow).toBe(0)
      expect(e.qualifies).toBe(false)
    })

    it('counts only the IN-window subset when stale + fresh events are mixed', () => {
      const signals: SustainedHotAnonymousSignals = {
        listingViewEvents: [
          ...recentEvents(['fresh-1'], 2), // 2 fresh
          ...recentEvents(['fresh-2'], 2), // 2 fresh  -> 4 fresh across 2 sessions
          { sessionId: 'stale', eventAt: '2026-05-01T10:00:00.000Z' }, // dropped
        ],
        identity: NO_IDENTITY,
      }
      const e = evaluateSustainedHotAnonymous(signals, {}, NOW)
      expect(e.listingViewsInWindow).toBe(4) // stale one excluded
      expect(e.distinctSessionsInWindow).toBe(2)
      expect(e.qualifies).toBe(false) // 4 < 5
    })

    it('rejects an empty signal set', () => {
      const signals: SustainedHotAnonymousSignals = { listingViewEvents: [], identity: NO_IDENTITY }
      expect(isSustainedHotAnonymous(signals, {}, NOW)).toBe(false)
    })
  })

  describe('IGNORES an already-identified visitor (no duplicate lead)', () => {
    const QUALIFYING_EVENTS = [...recentEvents(['s1'], 3), ...recentEvents(['s2'], 3)] // 6 views / 2 sessions

    it('rejects when the session is already identified (identifiedAt set)', () => {
      const signals: SustainedHotAnonymousSignals = {
        listingViewEvents: QUALIFYING_EVENTS,
        identity: { ...NO_IDENTITY, identifiedAt: '2026-06-18T00:00:00.000Z' },
      }
      const e = evaluateSustainedHotAnonymous(signals, {}, NOW)
      expect(e.alreadyIdentified).toBe(true)
      expect(e.qualifies).toBe(false)
    })

    it('rejects when a FUB person is already stitched', () => {
      const signals: SustainedHotAnonymousSignals = {
        listingViewEvents: QUALIFYING_EVENTS,
        identity: { ...NO_IDENTITY, fubPersonId: 12345 },
      }
      expect(isSustainedHotAnonymous(signals, {}, NOW)).toBe(false)
    })

    it('rejects when an email is already captured', () => {
      const signals: SustainedHotAnonymousSignals = {
        listingViewEvents: QUALIFYING_EVENTS,
        identity: { ...NO_IDENTITY, email: 'known@example.com' },
      }
      expect(isSustainedHotAnonymous(signals, {}, NOW)).toBe(false)
    })

    it('rejects when a signed-in auth user is stitched', () => {
      const signals: SustainedHotAnonymousSignals = {
        listingViewEvents: QUALIFYING_EVENTS,
        identity: { ...NO_IDENTITY, authUserId: '8f1d2c34-0000-4000-8000-000000000000' },
      }
      expect(isSustainedHotAnonymous(signals, {}, NOW)).toBe(false)
    })

    it('rejects when an existing crm_person is already mapped (Phase 1.1 bridge)', () => {
      const signals: SustainedHotAnonymousSignals = {
        listingViewEvents: QUALIFYING_EVENTS,
        identity: { ...NO_IDENTITY, existingCrmPersonId: 777 },
      }
      expect(isSustainedHotAnonymous(signals, {}, NOW)).toBe(false)
    })

    it('treats blank/zero identity flags as NOT identified', () => {
      const signals: SustainedHotAnonymousSignals = {
        listingViewEvents: QUALIFYING_EVENTS,
        identity: { identifiedAt: '', fubPersonId: 0, email: '   ', authUserId: '', existingCrmPersonId: 0 },
      }
      const e = evaluateSustainedHotAnonymous(signals, {}, NOW)
      expect(e.alreadyIdentified).toBe(false)
      expect(e.qualifies).toBe(true)
    })
  })

  describe('isAlreadyIdentified helper', () => {
    it('is false for an all-null identity', () => {
      expect(isAlreadyIdentified(NO_IDENTITY)).toBe(false)
    })
    it('is true the moment any one signal is present', () => {
      expect(isAlreadyIdentified({ ...NO_IDENTITY, email: 'a@b.com' })).toBe(true)
      expect(isAlreadyIdentified({ ...NO_IDENTITY, fubPersonId: 1 })).toBe(true)
      expect(isAlreadyIdentified({ ...NO_IDENTITY, identifiedAt: '2026-01-01T00:00:00Z' })).toBe(true)
    })
  })

  describe('threshold overrides (tuning without a deploy)', () => {
    it('a stricter minSessions raises the bar', () => {
      const signals: SustainedHotAnonymousSignals = {
        listingViewEvents: [...recentEvents(['s1'], 3), ...recentEvents(['s2'], 2)], // 5 / 2
        identity: NO_IDENTITY,
      }
      // Default would pass; require 3 sessions and it fails.
      expect(isSustainedHotAnonymous(signals, {}, NOW)).toBe(true)
      expect(isSustainedHotAnonymous(signals, { minSessions: 3 }, NOW)).toBe(false)
    })

    it('a tighter window can exclude otherwise-fresh events', () => {
      const signals: SustainedHotAnonymousSignals = {
        listingViewEvents: [
          { sessionId: 's1', eventAt: '2026-06-15T10:00:00.000Z' }, // 5 days ago
          { sessionId: 's1', eventAt: '2026-06-15T10:05:00.000Z' },
          { sessionId: 's1', eventAt: '2026-06-15T10:10:00.000Z' },
          { sessionId: 's2', eventAt: '2026-06-15T11:00:00.000Z' },
          { sessionId: 's2', eventAt: '2026-06-15T11:05:00.000Z' },
        ],
        identity: NO_IDENTITY,
      }
      // 14-day default: all 5 count, qualifies.
      expect(isSustainedHotAnonymous(signals, {}, NOW)).toBe(true)
      // 3-day window: all are older than 3 days, none count.
      expect(isSustainedHotAnonymous(signals, { windowDays: 3 }, NOW)).toBe(false)
    })

    it('exposes the applied thresholds in the evaluation', () => {
      const signals: SustainedHotAnonymousSignals = { listingViewEvents: [], identity: NO_IDENTITY }
      const e = evaluateSustainedHotAnonymous(signals, { minListingViews: 9 }, NOW)
      expect(e.thresholds.minListingViews).toBe(9)
      expect(e.thresholds.minSessions).toBe(SUSTAINED_HOT_ANONYMOUS_DEFAULTS.minSessions)
      expect(e.thresholds.windowDays).toBe(SUSTAINED_HOT_ANONYMOUS_DEFAULTS.windowDays)
    })
  })
})
