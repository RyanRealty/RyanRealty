import { describe, expect, it } from 'vitest'
import { computeAuditVerdict, type AuditFinding } from '@/lib/cma/audit'

const f = (severity: AuditFinding['severity'], category: AuditFinding['category']): AuditFinding => ({
  severity,
  category,
  claim: 'x',
  evidence: 'y',
})

describe('computeAuditVerdict (deterministic verdict over categorized findings)', () => {
  it('passes with no findings', () => {
    expect(computeAuditVerdict([])).toBe('pass')
  })

  it('passes with only minor findings', () => {
    expect(computeAuditVerdict([f('minor', 'narrative'), f('minor', 'price-opinion')])).toBe('pass')
  })

  it('fails ONLY on critical data-integrity (an impossible/wrong fact)', () => {
    expect(computeAuditVerdict([f('critical', 'data-integrity')])).toBe('fail')
  })

  it('a price-level disagreement is broker judgment — review, never fail', () => {
    expect(computeAuditVerdict([f('critical', 'price-opinion')])).toBe('review')
    expect(computeAuditVerdict([f('major', 'price-opinion')])).toBe('review')
  })

  it('comp-selection and narrative defects force review', () => {
    expect(computeAuditVerdict([f('critical', 'comp-selection')])).toBe('review')
    expect(computeAuditVerdict([f('major', 'narrative')])).toBe('review')
    expect(computeAuditVerdict([f('major', 'market-verdict')])).toBe('review')
  })

  it('major data-integrity is review, not fail', () => {
    expect(computeAuditVerdict([f('major', 'data-integrity')])).toBe('review')
  })
})
