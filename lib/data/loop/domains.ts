/**
 * Company-wide THE LOOP domains (v1.2.0).
 *
 * Growth/SEO is one row. A class that cannot name a domain here is not
 * company work — it is an ad-hoc task. Canon: docs/plans/COMPANY_IMPROVEMENT.md
 */

export const COMPANY_IMPROVEMENT_DOMAINS = [
  'public-ux',
  'seo-aeo',
  'leads',
  'nurture',
  'social-presence',
  'sales-insights',
  'transactions',
  'broker-tools',
  'recruit-retain',
  'data-sync',
  'factory',
  'license-voice',
] as const

export type CompanyImprovementDomain = (typeof COMPANY_IMPROVEMENT_DOMAINS)[number]

export type LedgerVerdict = 'win' | 'loss' | 'flat' | 'inconclusive'

export function isCompanyImprovementDomain(value: string): value is CompanyImprovementDomain {
  return (COMPANY_IMPROVEMENT_DOMAINS as readonly string[]).includes(value)
}

export function assertCompanyDomain(value: string): asserts value is CompanyImprovementDomain {
  if (!isCompanyImprovementDomain(value)) {
    throw new Error(`Unknown company domain: ${value}`)
  }
}

/** Learned confidence: win-rate over win+loss. New / inconclusive-only classes start at 0.5. */
export function confidenceFromVerdicts(verdicts: readonly LedgerVerdict[]): number {
  const counted = verdicts.filter((v) => v === 'win' || v === 'loss')
  if (counted.length === 0) return 0.5
  return counted.filter((v) => v === 'win').length / counted.length
}

export function scoreCandidate(input: {
  reach: number
  gapToBenchmark: number
  confidence: number
  effort: number
}): number {
  if (!(input.effort > 0)) return 0
  return (input.reach * input.gapToBenchmark * input.confidence) / input.effort
}
