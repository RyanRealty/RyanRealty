import { describe, expect, it } from 'vitest'
import { brokerCompRefusal } from '@/lib/cma/comps'
import { emptyExclusions, type CompSelectionDiagnostics, type CompTierTrace } from '@/lib/cma/comp-trace'

function tier(over: Partial<CompTierTrace> = {}): CompTierTrace {
  return {
    tier: 'nearby-2mi-12mo',
    ran: true,
    skipped_reason: null,
    months_back: 12,
    sqft_min: 1500,
    sqft_max: 2100,
    lot_min: null,
    lot_max: null,
    geography: 'within 2 miles of the subject',
    rows_returned: 40,
    comps_added: 1,
    running_total: 1,
    excluded: emptyExclusions(),
    ...over,
  }
}

function diag(over: Partial<CompSelectionDiagnostics> = {}): CompSelectionDiagnostics {
  return {
    market_area: null,
    market_area_resolved: false,
    rural_acreage: false,
    pricing_source: 'listings',
    custom_or_new: false,
    subject: { sqft: 1800, lot_acres: 0.2, subdivision: null, subdivision_raw: 'N/A', product_sub_type: 'Single Family Residence' },
    ladder: [tier()],
    tiers_used: ['nearby-2mi-12mo'],
    reached_target: false,
    starved: true,
    starved_at: 'nearby-2mi-12mo',
    starved_reason: null,
    target_comps: 8,
    min_comps: 5,
    candidates: 1,
    excluded_totals: emptyExclusions(),
    outliers_excluded: 0,
    final_count: 1,
    final_tier_counts: {},
    disclosures: [],
    ...over,
  }
}

/**
 * A comp-starved build is a correct section 0 refusal, but until 2026-09-07 it
 * stored the diagnosis plus the entire tier-by-tier SQL trace — up to 2,000
 * characters — as the text the admin queue printed at a broker. The structured
 * detail still lives in build_summary.comp_selection; the row now carries one
 * sentence the broker can act on.
 */
describe('brokerCompRefusal', () => {
  it('names the bathroom count and the market when bath count is the binding cut', () => {
    const x = emptyExclusions()
    x.bath_count = 16
    x.resort_premium = 4
    const line = brokerCompRefusal({
      diagnostics: diag({ excluded_totals: x }),
      found: 1,
      minComps: 5,
      subjectBaths: 2,
      subjectCity: 'Sunriver',
    })
    expect(line).toContain('No sold 2-bath home')
    expect(line).toContain('within 2 miles of the subject, sold within 12 months')
    expect(line).toContain('16 were cut for a different bathroom count')
    expect(line).toContain('Found 1 of the 5 closed sales')
    expect(line.length).toBeLessThan(320)
  })

  it('names the largest cut in broker words when it is not bath count', () => {
    const x = emptyExclusions()
    x.resort_premium = 20
    x.bath_count = 3
    const line = brokerCompRefusal({
      diagnostics: diag({ excluded_totals: x }),
      found: 2,
      minComps: 5,
      subjectBaths: 3,
      subjectCity: 'Sunriver',
    })
    expect(line).toContain('20 were cut for a resort community this home is not in')
    expect(line).not.toContain('ILIKE')
  })

  it('says the market has nothing when no tier returned a single sale', () => {
    const line = brokerCompRefusal({
      diagnostics: diag({ ladder: [tier({ rows_returned: 0, comps_added: 0, running_total: 0 })] }),
      found: 0,
      minComps: 5,
      subjectBaths: 3,
      subjectCity: 'La Pine',
    })
    expect(line).toContain('No closed sale in within 2 miles of the subject, sold within 12 months')
    expect(line).toContain('Nothing on record prices it')
  })

  it('says so when no rung could run at all', () => {
    const line = brokerCompRefusal({
      diagnostics: diag({
        ladder: [tier({ ran: false, skipped_reason: 'the subject has no usable living area' })],
        tiers_used: [],
      }),
      found: 0,
      minComps: 5,
      subjectBaths: null,
      subjectCity: 'Bend',
    })
    expect(line).toContain('No comparable search could run for this home')
    expect(line).toContain('no usable living area')
  })

  it('never leaks SQL, tier names, or the full search trace', () => {
    const x = emptyExclusions()
    x.bath_count = 9
    const line = brokerCompRefusal({ diagnostics: diag({ excluded_totals: x }), found: 2, minComps: 5, subjectBaths: 2 })
    expect(line).not.toMatch(/ILIKE|StandardStatus|SubdivisionName|TotalLivingAreaSqFt|nearby-2mi/)
  })
})
