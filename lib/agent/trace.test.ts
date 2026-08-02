import { describe, it, expect } from 'vitest'
import { verifyReplyTrace } from './trace'

describe('verifyReplyTrace', () => {
  it('passes when every figure appears in the tool-result corpus', () => {
    const corpus = JSON.stringify({
      activeCount: 214,
      medianListPrice: 525000,
      monthsOfSupply: 3.2,
      medianDaysToPending: 38,
    })
    const reply =
      'Redmond SFR: 214 active, median list $525,000, 38 median days to pending, 3.2 months of supply.'
    const check = verifyReplyTrace(reply, corpus)
    expect(check.ok).toBe(true)
    expect(check.violations).toEqual([])
  })

  it('catches a figure that was never fetched this turn', () => {
    const corpus = JSON.stringify({ activeCount: 214 })
    const reply = 'Redmond has 214 active listings and a median price of $612,000.'
    const check = verifyReplyTrace(reply, corpus)
    expect(check.ok).toBe(false)
    expect(check.violations.some((v) => v.includes('612'))).toBe(true)
  })

  it('normalizes commas and dollar signs before comparing', () => {
    const corpus = JSON.stringify({ medianListPrice: 525000 })
    const reply = 'Median list is $525,000 right now.'
    const check = verifyReplyTrace(reply, corpus)
    expect(check.ok).toBe(true)
  })

  it('requires a trace for a $-amount even at a single digit', () => {
    const corpus = JSON.stringify({ note: 'nothing here' })
    const reply = 'That will run you about $5 more.'
    const check = verifyReplyTrace(reply, corpus)
    expect(check.ok).toBe(false)
    expect(check.violations).toContain('$5')
  })

  it('allows bare single-digit numbers (job handles, bed/bath counts) untraced', () => {
    const corpus = ''
    const reply = 'You have 2 jobs going: 1: CMA Awbrey Glen and 2: IG post Tumalo Reservoir. Which one?'
    const check = verifyReplyTrace(reply, corpus)
    expect(check.ok).toBe(true)
  })

  it('allows duration/ETA phrasing written by templates (20s, 4h, 15 min)', () => {
    const corpus = ''
    const reply =
      "Running the CMA now. Render takes about 15 min, I'll text you the draft link in 20s to 4h depending on the queue."
    const check = verifyReplyTrace(reply, corpus)
    expect(check.ok).toBe(true)
  })

  it('still requires a trace for a real stat that happens to share a duration-like unit (days)', () => {
    // "38 days" is a DOM stat, not a duration allowlist hit ("days" is
    // deliberately excluded from the duration unit list).
    const corpus = JSON.stringify({ note: 'nothing here' })
    const reply = 'Median days on market is 38 days.'
    const check = verifyReplyTrace(reply, corpus)
    expect(check.ok).toBe(false)
    expect(check.violations.some((v) => v.includes('38'))).toBe(true)
  })

  it('allows the known Ryan Realty brand phone number untraced', () => {
    const corpus = ''
    const reply = 'You can also reach the office at 541.213.6706.'
    const check = verifyReplyTrace(reply, corpus)
    expect(check.ok).toBe(true)
  })

  it('does NOT allowlist a phone-shaped number that is not a known brand number', () => {
    const corpus = ''
    const reply = 'Call the seller directly at 555.123.4567.'
    const check = verifyReplyTrace(reply, corpus)
    expect(check.ok).toBe(false)
  })

  it('traces an ORS citation that appears in the corpus', () => {
    const corpus = JSON.stringify({
      citation: 'ORS 105.464',
      heading: 'Lead-based paint disclosure',
    })
    const reply = 'This property needs a lead-based-paint disclosure per ORS 105.464.'
    const check = verifyReplyTrace(reply, corpus)
    expect(check.ok).toBe(true)
  })

  it('catches an ORS citation with no corpus support', () => {
    const corpus = JSON.stringify({ note: 'no legal corpus result this turn' })
    const reply = 'That disclosure is required under ORS 999.999.'
    const check = verifyReplyTrace(reply, corpus)
    expect(check.ok).toBe(false)
    expect(check.violations).toContain('ORS 999.999')
  })

  it('recognizes an OAR citation the same way', () => {
    const corpus = ''
    const reply = 'See OAR 863-015-0215 for the brokerage-name-in-advertising rule.'
    const check = verifyReplyTrace(reply, corpus)
    expect(check.ok).toBe(false)
    expect(check.violations).toContain('OAR 863-015-0215')
  })

  it('does NOT allowlist a bare year — a year is a number like any other', () => {
    const corpusMissing = JSON.stringify({ note: 'no year here' })
    const replyWithYear = 'This home was built in 2026.'
    const missing = verifyReplyTrace(replyWithYear, corpusMissing)
    expect(missing.ok).toBe(false)
    expect(missing.violations.some((v) => v.includes('2026'))).toBe(true)

    // A year DOES pass when the corpus actually contains it — same mechanism
    // as any other figure, no special casing either direction.
    const corpusWithYear = JSON.stringify({ yearBuilt: 2026 })
    const present = verifyReplyTrace(replyWithYear, corpusWithYear)
    expect(present.ok).toBe(true)
  })

  it('reports every violation in a reply with multiple untraced figures', () => {
    const corpus = JSON.stringify({ activeCount: 214 })
    const reply = '214 active, median $525,000, and 3.2 months of supply.'
    const check = verifyReplyTrace(reply, corpus)
    expect(check.ok).toBe(false)
    expect(check.violations.length).toBeGreaterThanOrEqual(2)
  })

  it('treats an empty reply as trivially ok', () => {
    expect(verifyReplyTrace('', '')).toEqual({ ok: true, violations: [] })
  })
})
