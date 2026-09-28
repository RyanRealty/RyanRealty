/**
 * Contract checks and the net sheet follow the final recommendation,
 * not the list from before the active nudge.
 */
import { describe, expect, it } from 'vitest'
import { rebaseAuditToFinalRec, rebaseRecommendedQuotes, replaceGradedChecks } from '@/lib/cma/final-rec-grade'
import { buildNetSheet } from '@/lib/cma/expired-audit'
import { finishRecommendedAfterActives } from '@/lib/cma/finish-recommended'
import type { CmaPricing, CmaSellerNet } from '@/lib/cma/types'
import type { ContractCheck } from '@/lib/cma/contract'

describe('final recommendation is what the checks grade', () => {
  it('rewrites a recommended quote and leaves the band alone', () => {
    const text =
      'Audit verdict: pass. Recommended $564,000 sits in the cluster. The sales support $536,000 to $564,000. Also recommended $564k.'
    const out = rebaseRecommendedQuotes(text, 564_000, 555_000)
    expect(out).toContain('Recommended $555,000')
    expect(out).toContain('recommended $555,000')
    expect(out).not.toMatch(/[Rr]ecommended(?: list)? \$564/)
    expect(out).toContain('$536,000 to $564,000')
  })

  it('points the stored audit summary at the final list', () => {
    const audit = rebaseAuditToFinalRec(
      {
        verdict: 'pass',
        llmVerdict: 'pass',
        summary: 'The recommended $685,000 is inside the sales.',
        findings: [{ severity: 'minor', category: 'price-opinion', claim: 'Recommended list $685k is fine.', evidence: 'cluster', compListingKey: null }],
        costUsd: 0,
        model: 'test',
        usedLlm: true,
      },
      685_000,
      664_000,
    )
    expect(audit.summary).toContain('$664,000')
    expect(audit.summary).not.toContain('$685,000')
    expect(audit.findings[0]?.claim).toContain('$664,000')
  })

  it('replaces a check that cited the pre-nudge list', () => {
    const prior: ContractCheck[] = [
      {
        id: 'recommendation-in-range',
        severity: 'review',
        pass: true,
        detail: 'Recommended $543,000 sits inside the supported range $500,000 to $565,000.',
      },
    ]
    const graded: ContractCheck[] = [
      {
        id: 'recommendation-in-range',
        severity: 'review',
        pass: true,
        detail: 'Recommended $527,000 sits inside the supported range $500,000 to $565,000.',
      },
    ]
    const out = replaceGradedChecks({
      prior,
      graded,
      reviewReason: 'Recommended $543,000 sits inside the supported range $500,000 to $565,000.',
    })
    expect(out.checks[0]?.detail).toContain('$527,000')
    expect(out.checks[0]?.detail).not.toContain('$543,000')
    expect(out.reviewReason).toContain('$527,000')
    expect(out.reviewReason).not.toContain('$543,000')
  })

  it('Grand Targhee shape: net sheet list follows the nudged rec', () => {
    const sellerNet = {
      list: 543_000,
      net: 500_000,
      lines: [],
      unknowns: [],
      knownCount: 0,
      givenCount: 0,
      expectedConcessions: null,
      medianWhenGiven: null,
      rate: null,
      sentence: 'At $543,000 the estimate is a draft.',
    } as unknown as CmaSellerNet
    const pricing = {
      recommended: 543_000,
      conservative: 500_000,
      highEnd: 565_000,
      valueLow: 500_000,
      valueHigh: 565_000,
      notes: [],
      sellerNet,
      clamp: null,
    }
    const finished = finishRecommendedAfterActives(
      { ...pricing, recommended: 527_000 },
      { actives: [], pocketClosedSupport: null },
    )
    expect(finished.sellerNet?.list).toBe(527_000)
    const sheet = buildNetSheet(finished as unknown as CmaPricing, { expectedConcessions: null })
    expect(sheet.salePrice).toBe(527_000)
    expect(sheet.lines.map((l) => l.note ?? '').join(' ')).not.toContain('$543,000')
    expect(sheet.lines.map((l) => l.note ?? '').join(' ')).toContain('$527,000')
  })
})
