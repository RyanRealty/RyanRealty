import { describe, it, expect } from 'vitest'
import {
  NEW_SINCE_SCAN_SIZE,
  countNewSince,
  formatNewSinceLabel,
  newSinceBaseline,
} from '@/lib/data/leads/newSince'

const VISIT = '2026-07-20T00:00:00.000Z'
const SAVED = '2026-07-01T00:00:00.000Z'

describe('newSinceBaseline', () => {
  it('prefers the explicit last-viewed stamp', () => {
    expect(newSinceBaseline({ lastViewedAt: VISIT, createdAt: SAVED })).toBe(VISIT)
  })

  it('falls back to when the search was saved', () => {
    expect(newSinceBaseline({ lastViewedAt: null, createdAt: SAVED })).toBe(SAVED)
  })

  it('ignores an unparseable last-viewed stamp and falls back', () => {
    expect(newSinceBaseline({ lastViewedAt: 'not-a-date', createdAt: SAVED })).toBe(SAVED)
  })

  it('returns null when neither stamp is usable', () => {
    expect(newSinceBaseline({ lastViewedAt: null, createdAt: null })).toBeNull()
    expect(newSinceBaseline({})).toBeNull()
    expect(newSinceBaseline({ lastViewedAt: '', createdAt: 'garbage' })).toBeNull()
  })
})

describe('countNewSince', () => {
  it('counts only matches strictly after the baseline', () => {
    const result = countNewSince(
      [
        '2026-07-25T12:00:00.000Z', // after
        '2026-07-21T00:00:00.000Z', // after
        VISIT, // exactly the baseline, not new
        '2026-07-19T23:59:59.000Z', // before
      ],
      VISIT,
    )
    expect(result.count).toBe(2)
    expect(result.saturated).toBe(false)
    expect(result.baseline).toBe(VISIT)
  })

  it('never counts a missing or unparseable on-market date', () => {
    const result = countNewSince([null, undefined, '', 'nope', '2026-07-30T00:00:00.000Z'], VISIT)
    expect(result.count).toBe(1)
  })

  it('suppresses the count entirely when the baseline is unknowable', () => {
    const result = countNewSince(['2026-07-30T00:00:00.000Z'], null)
    expect(result).toEqual({ count: 0, saturated: false, baseline: null })
  })

  it('returns zero for an empty match set', () => {
    expect(countNewSince([], VISIT)).toEqual({ count: 0, saturated: false, baseline: VISIT })
  })

  it('marks a full window whose every row counted as saturated', () => {
    const dates = Array.from({ length: NEW_SINCE_SCAN_SIZE }, () => '2026-07-30T00:00:00.000Z')
    const result = countNewSince(dates, VISIT)
    expect(result.count).toBe(NEW_SINCE_SCAN_SIZE)
    expect(result.saturated).toBe(true)
  })

  it('does not mark a full window as saturated when one row is old', () => {
    const dates = Array.from({ length: NEW_SINCE_SCAN_SIZE }, (_, i) =>
      i === 0 ? '2026-07-01T00:00:00.000Z' : '2026-07-30T00:00:00.000Z',
    )
    const result = countNewSince(dates, VISIT)
    expect(result.count).toBe(NEW_SINCE_SCAN_SIZE - 1)
    expect(result.saturated).toBe(false)
  })

  it('does not mark a partial window as saturated even when everything counted', () => {
    const result = countNewSince(['2026-07-30T00:00:00.000Z', '2026-07-29T00:00:00.000Z'], VISIT)
    expect(result.count).toBe(2)
    expect(result.saturated).toBe(false)
  })

  it('honors a caller-supplied scan size', () => {
    const result = countNewSince(['2026-07-30T00:00:00.000Z', '2026-07-29T00:00:00.000Z'], VISIT, 2)
    expect(result.saturated).toBe(true)
  })

  it('counts nothing when every match predates the baseline', () => {
    const result = countNewSince([SAVED, '2026-06-01T00:00:00.000Z'], VISIT)
    expect(result.count).toBe(0)
    expect(result.saturated).toBe(false)
  })
})

describe('formatNewSinceLabel', () => {
  it('returns null when nothing is new', () => {
    expect(formatNewSinceLabel({ count: 0, saturated: false, baseline: VISIT })).toBeNull()
  })

  it('renders a plain count', () => {
    expect(formatNewSinceLabel({ count: 3, saturated: false, baseline: VISIT })).toBe('3 new')
  })

  it('renders a floor when the scan window saturated', () => {
    expect(formatNewSinceLabel({ count: 24, saturated: true, baseline: VISIT })).toBe('24+ new')
  })
})
