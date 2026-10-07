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
  it('is true when the build wrote the key, null or not, and false on a row built before the field', () => {
    expect(holdDecidedFromSummary({ hold_kind: 'ask-in-band' })).toBe(true)
    expect(holdDecidedFromSummary({ hold_kind: null })).toBe(true)
    expect(holdDecidedFromSummary({})).toBe(false)
    expect(holdDecidedFromSummary({ needs_review: true })).toBe(false)
    expect(holdDecidedFromSummary(null)).toBe(false)
  })
})
