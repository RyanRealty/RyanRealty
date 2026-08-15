import { existsSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import {
  COMPANY_BLAST_RADIUS,
  COMPANY_IMPROVEMENT_DOMAINS,
  DOMAIN_REQUIRED_READS,
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

  it('names the seven blast-radius planes so a stat change cannot land on one surface only', () => {
    expect(COMPANY_BLAST_RADIUS).toEqual([
      'dal-stat',
      'public-site',
      'admin-crm',
      'reporting',
      'alerts-newsletters',
      'ads-audiences',
      'identity',
    ])
  })

  it('rejects an unknown domain so a Growth-only class cannot hide as company work', () => {
    expect(isCompanyImprovementDomain('seo-aeo')).toBe(true)
    expect(isCompanyImprovementDomain('growth')).toBe(false)
    expect(() => assertCompanyDomain('growth')).toThrow(/unknown company domain/i)
  })

  it('every domain routes to at least one expertise read — no animal is worked cold', () => {
    for (const domain of COMPANY_IMPROVEMENT_DOMAINS) {
      expect(DOMAIN_REQUIRED_READS[domain]?.length, `${domain} has no required reads`).toBeGreaterThan(0)
    }
  })

  it('expertise reads point at real files (section hints in parens allowed)', () => {
    for (const [domain, reads] of Object.entries(DOMAIN_REQUIRED_READS)) {
      for (const read of reads) {
        const path = read.replace(/\s*\(.*\)$/, '')
        expect(existsSync(path), `${domain}: ${path} does not exist`).toBe(true)
      }
    }
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
