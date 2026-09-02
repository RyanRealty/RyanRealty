import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { auditCma, computeAuditVerdict, type AuditFinding } from '@/lib/cma/audit'
import type { CmaAdjustedComp, CmaPricing, CmaSubject } from '@/lib/cma/types'
import type { CompJudgment } from '@/lib/cma/judge'

const createMock = vi.fn()
// The audit runs on xAI through lib/grok (2026-09-01 migration). Mock the
// chokepoint, not the transport.
vi.mock('@/lib/grok', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/grok')>()
  return {
    ...actual,
    grokConfigured: () => Boolean(process.env.XAI_API_KEY),
    generateGrokStructured: (...a: unknown[]) => createMock(...a),
  }
})

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

/**
 * auditCma wiring: the LLM reports, CODE decides. These assert the two
 * behaviours the publish gate depends on — a fabricated citation becomes a
 * BLOCKING finding no matter how the model labelled it, and the audit still
 * fails OPEN when the API is unavailable.
 */
describe('auditCma — deterministic narrative check is wired into the findings', () => {
  const comps = [
    { listingKey: 'K1', address: '62719 Hawkview', subdivision: 'Oakview', city: 'Bend', sqft: 2013, closePrice: 610000, closeDate: '2026-07-02', adjustedPrice: 599242, weight: 0.89, yearBuilt: 2017, beds: 4, baths: 3, publicRemarks: null },
    { listingKey: 'K2', address: '21336 Evelyn', subdivision: 'Mirada', city: 'Bend', sqft: 2084, closePrice: 604500, closeDate: '2026-06-12', adjustedPrice: 583905, weight: 0.82, yearBuilt: 2014, beds: 3, baths: 3, publicRemarks: null },
    { listingKey: 'K3', address: '2713 Black Oak', subdivision: 'Oakview', city: 'Bend', sqft: 1940, closePrice: 570000, closeDate: '2026-06-08', adjustedPrice: 570294, weight: 0.87, yearBuilt: 2018, beds: 3, baths: 3, publicRemarks: null },
  ] as unknown as CmaAdjustedComp[]
  const subject = { streetAddress: '3415 Marys Grace', city: 'Bend', subdivision: 'Woodward Highlands', beds: 4, baths: 3, sqft: 1942, lotAcres: 0.12, yearBuilt: 2017, publicRemarks: null, lastListPrice: null, standardStatus: null } as unknown as CmaSubject
  const pricing = { method1Mid: 590000, method2: 585000, method3: 588000, convergenceSpreadPct: 1.2, recommended: 590000, conservative: 570000, highEnd: 610000, confidence: 'Moderate' } as unknown as CmaPricing

  const respond = (findings: unknown[], verdict = 'review') => ({
    value: { findings, verdict, summary: 'Reviewed.' },
    raw: JSON.stringify({ findings, verdict, summary: 'Reviewed.' }),
    costUsd: 0.01,
  })

  beforeEach(() => {
    createMock.mockReset()
    vi.stubEnv('XAI_API_KEY', 'test-key')
  })
  afterEach(() => vi.unstubAllEnvs())

  it('turns a model-labelled `major` fabrication into a blocking critical data-integrity fail', async () => {
    createMock.mockResolvedValue(
      respond([
        { severity: 'major', category: 'data-integrity', claim: "The narrative lists 'Brooklyn in Mirada' but no such comp appears in the priced set.", evidence: 'Comp set has no Brooklyn.' },
      ]),
    )
    const judgment = {
      narrative:
        'The strongest comps sold between $290 to $312/sqft: Hawkview at $303/sqft, Brooklyn in Mirada at $309/sqft, ' +
        'Black Oak in Oakview at $294/sqft, and Evelyn in Mirada at $290/sqft.',
      verdicts: [],
    } as unknown as CompJudgment

    const before = computeAuditVerdict([{ severity: 'major', category: 'data-integrity', claim: 'x', evidence: 'y' }])
    expect(before).toBe('review') // major alone does not block

    const audit = await auditCma({ subject, comps, excluded: [], pricing, judgment, market: null })
    expect(audit).not.toBeNull()
    const injected = audit!.findings.filter((f) => f.severity === 'critical' && f.category === 'data-integrity')
    expect(injected).toHaveLength(1)
    expect(injected[0].claim).toContain('Brooklyn')
    expect(audit!.verdict).toBe('fail')
    // The model's own label is preserved alongside, never rewritten.
    expect(audit!.findings.some((f) => f.severity === 'major')).toBe(true)
    // Injected findings carry no comp key, so buildCma's self-repair pass
    // cannot mistake one for "drop this comp and re-price".
    for (const f of injected) expect(f.compListingKey).toBeNull()
  })

  it('leaves a clean narrative alone', async () => {
    createMock.mockResolvedValue(respond([], 'pass'))
    const judgment = {
      narrative: 'Hawkview at $303/sqft, Black Oak at $294/sqft, and Evelyn at $290/sqft bracket the subject.',
      verdicts: [],
    } as unknown as CompJudgment
    const audit = await auditCma({ subject, comps, excluded: [], pricing, judgment, market: null })
    expect(audit!.findings).toEqual([])
    expect(audit!.verdict).toBe('pass')
  })

  it('fails OPEN: returns null and never throws when the API call errors', async () => {
    createMock.mockRejectedValue(new Error('400 You have reached your specified API usage limits.'))
    const judgment = { narrative: 'Brooklyn at $309/sqft.', verdicts: [] } as unknown as CompJudgment
    await expect(auditCma({ subject, comps, excluded: [], pricing, judgment, market: null })).resolves.toBeNull()
  })

  it('fails OPEN: returns null with no XAI_API_KEY, without calling the API', async () => {
    vi.stubEnv('XAI_API_KEY', '')
    await expect(
      auditCma({ subject, comps, excluded: [], pricing, judgment: null, market: null }),
    ).resolves.toBeNull()
    expect(createMock).not.toHaveBeenCalled()
  })
})
