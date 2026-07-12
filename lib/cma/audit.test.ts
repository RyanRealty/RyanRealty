import { describe, expect, it } from 'vitest'
import { computeAuditVerdict, type AuditFinding } from '@/lib/cma/audit'

const f = (
  severity: AuditFinding['severity'],
  category: AuditFinding['category'],
  compListingKey?: string,
): AuditFinding => ({ severity, category, claim: 'x', evidence: 'y', compListingKey: compListingKey ?? null })

describe('computeAuditVerdict (discriminating verdict, v2 2026-07-12)', () => {
  it('passes with no findings', () => {
    expect(computeAuditVerdict([])).toBe('pass')
  })

  it('passes with only minor findings', () => {
    expect(computeAuditVerdict([f('minor', 'narrative'), f('minor', 'price-opinion')])).toBe('pass')
  })

  // ── ADVISORY: does not raise the flag ─────────────────────────────────────
  it('a price-level disagreement is advisory — pass, even at critical', () => {
    expect(computeAuditVerdict([f('critical', 'price-opinion')])).toBe('pass')
    expect(computeAuditVerdict([f('major', 'price-opinion')])).toBe('pass')
  })

  it('a lone comp-selection nitpick with no comp key is advisory — pass', () => {
    expect(computeAuditVerdict([f('major', 'comp-selection')])).toBe('pass')
  })

  it('a market-verdict major is advisory — pass', () => {
    expect(computeAuditVerdict([f('major', 'market-verdict')])).toBe('pass')
  })

  // ── FAIL: hard factual error / non-comparable comp / false client claim ───
  it('fails on critical data-integrity, comp-selection, or narrative', () => {
    expect(computeAuditVerdict([f('critical', 'data-integrity')])).toBe('fail')
    expect(computeAuditVerdict([f('critical', 'comp-selection')])).toBe('fail')
    expect(computeAuditVerdict([f('critical', 'narrative')])).toBe('fail')
  })

  // ── REVIEW: specific, actionable defects ──────────────────────────────────
  it('a major data-integrity (a wrong fact) forces review', () => {
    expect(computeAuditVerdict([f('major', 'data-integrity')])).toBe('review')
  })

  it('critical market-verdict forces review', () => {
    expect(computeAuditVerdict([f('critical', 'market-verdict')])).toBe('review')
  })

  it('a LONE comp-selection major is the auditor reflex — advisory, pass', () => {
    expect(computeAuditVerdict([f('major', 'comp-selection', 'K123')])).toBe('pass')
    expect(computeAuditVerdict([f('major', 'comp-selection')])).toBe('pass')
  })

  it('a lone narrative major (rewording) is advisory — pass', () => {
    expect(computeAuditVerdict([f('major', 'narrative')])).toBe('pass')
  })

  it('TWO comp-selection majors are a comp-doubt cluster — review', () => {
    expect(computeAuditVerdict([f('major', 'comp-selection'), f('major', 'comp-selection')])).toBe('review')
  })

  it('the auditor reflex set (1 comp-major + 1 narrative-major + price gripes) stays advisory', () => {
    expect(
      computeAuditVerdict([
        f('major', 'comp-selection', 'K1'),
        f('major', 'narrative'),
        f('critical', 'price-opinion'),
        f('minor', 'market-verdict'),
      ]),
    ).toBe('pass')
  })
})
