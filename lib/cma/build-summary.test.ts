/**
 * build_summary carries the build's own hold (SKILL.md rule 22, Matt
 * 2026-10-07) twice: top-level for the queue and under pricing beside the
 * other pricing fields, both read off pricing.hold.
 */
import { describe, expect, it } from 'vitest'
import { composeBuildSummary, type BuildSummaryInput } from '@/lib/cma/build-summary'
import { emptyExclusions } from '@/lib/cma/comp-trace'
import { applyAskInBandHold, recommendationGapHold } from '@/lib/cma/gap-hold'
import type { CmaPricing } from '@/lib/cma/types'
import { holdDecidedFromSummary, type CmaBuildSummary } from '@/lib/data/cma/unified-queue'

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

describe('build_summary says whether the build measured the ask against the band (review, 2026-10-07)', () => {
  // The send gates read holdDecidedFromSummary: a build that measured and found
  // no hold is not second-guessed; a build that never had an ask and a band to
  // measure goes through the live backstop (expired origin, ask inside the
  // stored band).
  const gate = (summary: Record<string, unknown>, ask: number) =>
    recommendationGapHold(915_000, ask, {
      low: 893_000,
      high: 951_000,
      holdKind: null,
      holdDecided: holdDecidedFromSummary(summary as CmaBuildSummary),
      origin: 'expired',
    })

  it('writes hold_measured true when a failed cycle had an ask and a band, and the gate trusts that no-hold verdict', () => {
    const pricing = { ...input({}).pricing, valueLow: 893_000, valueHigh: 951_000, failedAsk: 975_000 } as CmaPricing
    applyAskInBandHold(pricing, { lastCycleFailed: true, lastListPrice: 975_000, auditVerdict: 'pass' })
    expect(pricing.askInBandMeasured).toBe(true)
    expect(pricing.hold ?? null).toBeNull()
    const summary = composeBuildSummary(input(pricing))
    expect(summary.hold_measured).toBe(true)
    expect((summary.pricing as Record<string, unknown>).hold_measured).toBe(true)
    expect(summary.hold_kind).toBeNull()
    expect(holdDecidedFromSummary(summary as CmaBuildSummary)).toBe(true)
    // The row's ask later reads inside the stored band; the build decided, so no live hold.
    expect(gate(summary, 925_000).hold).toBe(false)
  })

  it('writes hold_measured false when the last cycle did not fail, and the row goes through the live backstop', () => {
    const pricing = { ...input({}).pricing, valueLow: 893_000, valueHigh: 951_000, failedAsk: null } as CmaPricing
    applyAskInBandHold(pricing, { lastCycleFailed: false, lastListPrice: 925_000, auditVerdict: 'pass' })
    expect(pricing.askInBandMeasured).toBe(false)
    const summary = composeBuildSummary(input(pricing))
    expect(summary.hold_measured).toBe(false)
    expect(summary.hold_kind).toBeNull()
    expect(holdDecidedFromSummary(summary as CmaBuildSummary)).toBe(false)
    const held = gate(summary, 925_000)
    expect(held.hold).toBe(true)
    if (held.hold) expect(held.reason).toMatch(/inside the sales range/)
  })

  it('writes hold_measured false when a failed cycle carried no ask, and the row goes through the live backstop', () => {
    const pricing = { ...input({}).pricing, valueLow: 893_000, valueHigh: 951_000, failedAsk: null } as CmaPricing
    applyAskInBandHold(pricing, { lastCycleFailed: true, lastListPrice: null, auditVerdict: 'pass' })
    expect(pricing.askInBandMeasured).toBe(false)
    const summary = composeBuildSummary(input(pricing))
    expect(summary.hold_measured).toBe(false)
    expect(holdDecidedFromSummary(summary as CmaBuildSummary)).toBe(false)
    expect(gate(summary, 925_000).hold).toBe(true)
  })

  it('a stored hold is a decision, measured or not', () => {
    const pricing = { ...input({}).pricing, valueLow: 893_000, valueHigh: 951_000, failedAsk: 925_000 } as CmaPricing
    applyAskInBandHold(pricing, { lastCycleFailed: true, lastListPrice: 925_000, auditVerdict: 'pass' })
    const summary = composeBuildSummary(input(pricing))
    expect(summary.hold_kind).toBe('ask-in-band')
    expect(summary.hold_measured).toBe(true)
    expect(holdDecidedFromSummary(summary as CmaBuildSummary)).toBe(true)
  })
})
