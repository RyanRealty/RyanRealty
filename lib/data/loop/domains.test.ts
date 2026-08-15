import { describe, it, expect } from 'vitest'
import {
  COMPANY_IMPROVEMENT_DOMAINS,
  assertCompanyDomain,
  confidenceFromVerdicts,
  isCompanyImprovementDomain,
  scoreCandidate,
} from './domains'

describe('company improvement domains', () => {
  it('is a closed set of twelve domains — SEO is one row, not the whole loop', () => {
    expect(COMPANY_IMPROVEMENT_DOMAINS).toEqual([
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
    ])
  })

  it('rejects an unknown domain so a Growth-only class cannot hide as company work', () => {
    expect(isCompanyImprovementDomain('seo-aeo')).toBe(true)
    expect(isCompanyImprovementDomain('growth')).toBe(false)
    expect(() => assertCompanyDomain('growth')).toThrow(/unknown company domain/i)
  })
})

describe('confidenceFromVerdicts', () => {
  it('starts a new class at 0.5 so novelty is neither blocked nor over-trusted', () => {
    expect(confidenceFromVerdicts([])).toBe(0.5)
    expect(confidenceFromVerdicts(['inconclusive', 'flat'])).toBe(0.5)
  })

  it('is win-rate over win+loss only', () => {
    expect(confidenceFromVerdicts(['win', 'win', 'loss'])).toBeCloseTo(2 / 3, 10)
    expect(confidenceFromVerdicts(['loss', 'loss', 'flat'])).toBe(0)
  })
})

describe('scoreCandidate', () => {
  it('is reach × gap × confidence ÷ effort', () => {
    expect(scoreCandidate({ reach: 10, gapToBenchmark: 2, confidence: 0.5, effort: 4 })).toBe(2.5)
  })

  it('returns 0 when effort is not a positive number — never Infinity', () => {
    expect(scoreCandidate({ reach: 10, gapToBenchmark: 2, confidence: 1, effort: 0 })).toBe(0)
    expect(scoreCandidate({ reach: 10, gapToBenchmark: 2, confidence: 1, effort: -1 })).toBe(0)
  })
})
