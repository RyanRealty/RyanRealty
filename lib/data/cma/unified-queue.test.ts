/**
 * The queue row's hold kind is read off build_summary.hold_kind, the field
 * lib/cma/build-summary.ts writes for rule 22 (ask inside the band, Matt
 * 2026-10-07). Only the one kind the build writes maps through.
 */
import { describe, expect, it } from 'vitest'
import { holdDecidedFromSummary, holdKindFromSummary } from '@/lib/data/cma/unified-queue'

describe('holdKindFromSummary', () => {
  it('maps the stored ask-in-band kind onto the row', () => {
    expect(holdKindFromSummary({ hold_kind: 'ask-in-band' })).toBe('ask-in-band')
  })

  it('maps any other value, a missing field, and a missing summary to null', () => {
    expect(holdKindFromSummary({ hold_kind: null })).toBeNull()
    expect(holdKindFromSummary({ hold_kind: 'something-else' })).toBeNull()
    expect(holdKindFromSummary({})).toBeNull()
    expect(holdKindFromSummary(null)).toBeNull()
    expect(holdKindFromSummary(undefined)).toBeNull()
  })
})

describe('holdDecidedFromSummary', () => {
  it('is true when the build stored the hold or measured the ask against the band', () => {
    expect(holdDecidedFromSummary({ hold_kind: 'ask-in-band' })).toBe(true)
    expect(holdDecidedFromSummary({ hold_kind: 'ask-in-band', hold_measured: true })).toBe(true)
    expect(holdDecidedFromSummary({ hold_kind: null, hold_measured: true })).toBe(true)
  })

  it('is false when the build did not measure, including a null hold_kind with no measurement (review, 2026-10-07)', () => {
    // Every build since 2026-10-07 wrote hold_kind null, measured or not. The
    // key alone is not a decision: those rows go through the live backstop.
    expect(holdDecidedFromSummary({ hold_kind: null })).toBe(false)
    expect(holdDecidedFromSummary({ hold_kind: null, hold_measured: false })).toBe(false)
    expect(holdDecidedFromSummary({})).toBe(false)
    expect(holdDecidedFromSummary({ needs_review: true })).toBe(false)
    expect(holdDecidedFromSummary(null)).toBe(false)
  })
})
