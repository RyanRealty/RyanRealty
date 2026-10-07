/**
 * build_summary carries the build's own hold (SKILL.md rule 22, Matt
 * 2026-10-07) twice: top-level for the queue and under pricing beside the
 * other pricing fields, both read off pricing.hold.
 */
import { describe, expect, it } from 'vitest'
import { composeBuildSummary, type BuildSummaryInput } from '@/lib/cma/build-summary'
import { emptyExclusions } from '@/lib/cma/comp-trace'
import type { CmaPricing } from '@/lib/cma/types'

const site = {
  zone: 'RS',
  zoneOverlays: [],
  acreage: 0.2,
  water: {
    source: 'municipal',
    irrigationDistrict: null,
    rights: [],
    mappedIrrigationAcres: null,
    primaryIrrigationPriorityDate: null,
    hasPrivateAppurtenant: false,
    rightsQueryOk: true,
  },
  septic: { status: 'municipal-sewer' },
  permits: [],
  flood: { zone: 'X', inSFHA: false },
  wildfireHazard: null,
  entitlement: null,
  hunting: null,
  constraints: [],
  isMunicipal: true,
  resolved: true,
} as unknown as BuildSummaryInput['site']

function input(pricing: Partial<CmaPricing>): BuildSummaryInput {
  return {
    builder: 'test',
    docType: 'cma',
    pageCount: 1,
    comps: [],
    compSelection: {
      market_area: null,
      market_area_resolved: false,
      rural_acreage: false,
      pricing_source: 'facts',
      custom_or_new: false,
      subject: { sqft: 2000, lot_acres: 0.2, subdivision: null, subdivision_raw: null, product_sub_type: null },
      ladder: [],
      tiers_used: [],
      reached_target: true,
      starved: false,
      starved_at: null,
      starved_reason: null,
      target_comps: 5,
      min_comps: 5,
      candidates: 5,
      excluded_totals: emptyExclusions(),
      not_price_setting: 0,
      outliers_excluded: 0,
      final_count: 5,
      final_tier_counts: {},
      disclosures: [],
    },
    site,
    judgment: null,
    audit: null,
    firstRoundAudit: null,
    repairedKeys: [],
    contract: { pass: true, checks: [] } as unknown as BuildSummaryInput['contract'],
    pricing: {
      conservative: 893_000,
      recommended: 915_000,
      highEnd: 951_000,
      confidence: 'Moderate',
      convergenceSpreadPct: 1,
      compPpsfCv: 0.1,
      needsReview: false,
      reviewReason: null,
      method1Mid: 915_000,
      method2: 915_000,
      method3: 915_000,
      failedAsk: 925_000,
      ...pricing,
    } as unknown as CmaPricing,
    market: null,
    subject: { lastListPrice: 925_000, standardStatus: 'Expired', city: 'Bend', sqft: 2000 } as unknown as BuildSummaryInput['subject'],
    factsReady: true,
  }
}

describe('composeBuildSummary carries the hold', () => {
  it('writes hold_kind and hold_reason top-level and under pricing', () => {
    const reason = 'The last ask of $925,000 sits inside the sales range of $893,000 to $951,000 the recommendation reads from.'
    const summary = composeBuildSummary(
      input({
        needsReview: true,
        reviewReason: reason,
        hold: { kind: 'ask-in-band', ask: 925_000, bandLow: 893_000, bandHigh: 951_000, reason },
      }),
    )
    expect(summary.hold_kind).toBe('ask-in-band')
    expect(summary.hold_reason).toBe(reason)
    const pricing = summary.pricing as Record<string, unknown>
    expect(pricing.hold_kind).toBe('ask-in-band')
    expect(pricing.hold_reason).toBe(reason)
    expect(summary.needs_review).toBe(true)
  })

  it('writes null in both places on a build with no hold', () => {
    const summary = composeBuildSummary(input({}))
    expect(summary.hold_kind).toBeNull()
    expect(summary.hold_reason).toBeNull()
    const pricing = summary.pricing as Record<string, unknown>
    expect(pricing.hold_kind).toBeNull()
    expect(pricing.hold_reason).toBeNull()
  })
})
