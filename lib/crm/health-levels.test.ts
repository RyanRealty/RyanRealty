import { describe, it, expect } from 'vitest'
import {
  freshnessLevel,
  suppressionRateLevel,
  a2pLevel,
  levelTone,
  worstLevel,
  ageMinutesSince,
} from './health-levels'

// Phase 9.5: the /admin/crm/health board colors every tile through these PURE
// helpers. The thresholds are the contract — a webhook that goes silent must
// flip to red, a verified A2P campaign must read green, and the dot color must
// trace to one mapping (levelTone) so no tile drifts.
describe('freshnessLevel (inbound-signal age -> health)', () => {
  const t = { warnAfter: 60, staleAfter: 180 }

  it('is ok when age is within the warn threshold', () => {
    expect(freshnessLevel(0, t)).toBe('ok')
    expect(freshnessLevel(59, t)).toBe('ok')
    expect(freshnessLevel(60, t)).toBe('ok')
  })

  it('warns between the warn and stale thresholds', () => {
    expect(freshnessLevel(61, t)).toBe('warn')
    expect(freshnessLevel(120, t)).toBe('warn')
    expect(freshnessLevel(180, t)).toBe('warn')
  })

  it('is stale past the stale threshold', () => {
    expect(freshnessLevel(181, t)).toBe('stale')
    expect(freshnessLevel(10000, t)).toBe('stale')
  })

  it('treats a never-seen signal (null age) as stale', () => {
    expect(freshnessLevel(null, t)).toBe('stale')
  })

  it('treats a non-finite age as stale', () => {
    expect(freshnessLevel(Number.NaN, t)).toBe('stale')
    expect(freshnessLevel(Number.POSITIVE_INFINITY, t)).toBe('stale')
  })

  it('treats a clock-skewed future timestamp (negative age) as ok', () => {
    expect(freshnessLevel(-5, t)).toBe('ok')
  })
})

describe('suppressionRateLevel (opt-out share -> health)', () => {
  it('is ok at or below the warn share (default 25 percent)', () => {
    expect(suppressionRateLevel(0)).toBe('ok')
    expect(suppressionRateLevel(0.1)).toBe('ok')
    expect(suppressionRateLevel(0.25)).toBe('ok')
  })

  it('warns between the warn and red shares', () => {
    expect(suppressionRateLevel(0.26)).toBe('warn')
    expect(suppressionRateLevel(0.4)).toBe('warn')
  })

  it('is the red band above the red share (default 40 percent)', () => {
    expect(suppressionRateLevel(0.41)).toBe('stale')
    expect(suppressionRateLevel(1)).toBe('stale')
  })

  it('honors custom thresholds', () => {
    const th = { warnAbove: 0.05, staleAbove: 0.1 }
    expect(suppressionRateLevel(0.05, th)).toBe('ok')
    expect(suppressionRateLevel(0.08, th)).toBe('warn')
    expect(suppressionRateLevel(0.2, th)).toBe('stale')
  })

  it('reads ok for a non-finite rate (empty list / divide-by-zero)', () => {
    expect(suppressionRateLevel(Number.NaN)).toBe('ok')
  })
})

describe('a2pLevel (SMS campaign status -> health)', () => {
  it('is ok only when VERIFIED', () => {
    expect(a2pLevel('VERIFIED')).toBe('ok')
  })

  it('warns while a campaign is still clearing', () => {
    expect(a2pLevel('IN_PROGRESS')).toBe('warn')
    expect(a2pLevel('PENDING')).toBe('warn')
  })

  it('is red when SMS cannot send', () => {
    expect(a2pLevel('FAILED')).toBe('stale')
    expect(a2pLevel('NONE')).toBe('stale')
    expect(a2pLevel(null)).toBe('stale')
    expect(a2pLevel(undefined)).toBe('stale')
  })
})

describe('levelTone (the single dot-color mapping)', () => {
  it('maps each level to its console tone', () => {
    expect(levelTone('ok')).toBe('success')
    expect(levelTone('warn')).toBe('warning')
    expect(levelTone('stale')).toBe('danger')
  })
})

describe('worstLevel (roll-up across tiles)', () => {
  it('returns the most severe level present', () => {
    expect(worstLevel(['ok', 'ok'])).toBe('ok')
    expect(worstLevel(['ok', 'warn', 'ok'])).toBe('warn')
    expect(worstLevel(['ok', 'warn', 'stale'])).toBe('stale')
  })

  it('is ok for an empty set', () => {
    expect(worstLevel([])).toBe('ok')
  })
})

describe('ageMinutesSince (deterministic whole-minute age)', () => {
  const now = Date.parse('2026-06-20T12:00:00.000Z')

  it('computes whole minutes since a past timestamp', () => {
    expect(ageMinutesSince('2026-06-20T11:30:00.000Z', now)).toBe(30)
    expect(ageMinutesSince('2026-06-20T09:00:00.000Z', now)).toBe(180)
  })

  it('returns null for a missing or invalid timestamp', () => {
    expect(ageMinutesSince(null, now)).toBeNull()
    expect(ageMinutesSince(undefined, now)).toBeNull()
    expect(ageMinutesSince('not-a-date', now)).toBeNull()
  })

  it('returns a negative age for a future timestamp (clock skew)', () => {
    expect(ageMinutesSince('2026-06-20T12:05:00.000Z', now)).toBe(-5)
  })
})
