import { describe, expect, it } from 'vitest'
import { brokerCompRefusal } from '@/lib/cma/comps'
import {
  diagnoseStarvation,
  emptyExclusions,
  factsStopReason,
  shortageLead,
  type CompSelectionDiagnostics,
  type CompTierTrace,
} from '@/lib/cma/comp-trace'
import { cmaQueueWhy } from '@/lib/cma/queue-view'
import { withFactsPath } from '@/lib/pricing/select'
import type { PricingMatchResult, SelectedPricingComp } from '@/lib/pricing/match'
import type { CompSelection } from '@/lib/cma/comps'

/**
 * THE SHORTAGE MESSAGE NAMES THE BEST PATH (2026-10-08). The facts ladder
 * walks first; under five price-setting sales the build falls back to the
 * listings ladder and returned only that selection, so the stored error
 * ("Only 0 qualifying closed comps found ... listings path ...") described
 * the weaker search while the facts walk had held sales of its own. The
 * selection now carries the facts walk's count, its sales and why it stopped
 * (diagnostics.facts_path), and every shortage sentence leads with the path
 * that held the most, naming the sales.
 */

function rung(over: Partial<CompTierTrace> = {}): CompTierTrace {
  return {
    tier: 'neighborhood-24mo',
    ran: true,
    skipped_reason: null,
    months_back: 24,
    sqft_min: 700,
    sqft_max: 1180,
    lot_min: null,
    lot_max: null,
    geography: "City ILIKE 'Bend', market area = River West",
    rows_returned: 383,
    comps_added: 0,
    running_total: 0,
    excluded: emptyExclusions(),
    ...over,
  }
}

function diag(over: Partial<CompSelectionDiagnostics> = {}): CompSelectionDiagnostics {
  const x = emptyExclusions()
  x.market_area = 30
  x.bath_count = 18
  return {
    market_area: 'River West',
    market_area_resolved: true,
    rural_acreage: false,
    pricing_source: 'listings',
    custom_or_new: false,
    subject: { sqft: 876, lot_acres: 0.11, subdivision: 'Northwest Townsite', subdivision_raw: 'Northwest Townsite', product_sub_type: 'Single Family Residence' },
    ladder: [rung()],
    tiers_used: [],
    reached_target: false,
    starved: true,
    starved_at: 'neighborhood-24mo',
    starved_reason: null,
    target_comps: 5,
    min_comps: 5,
    candidates: 0,
    excluded_totals: x,
    not_price_setting: 0,
    outliers_excluded: 0,
    final_count: 0,
    final_tier_counts: {},
    disclosures: [],
    ...over,
  }
}

const FACTS = {
  held: 3,
  sales: ['1501 Newport', '1411 Newport', '1367 Milwaukee'],
  tiers_used: ['subdivision-24mo', 'adjacent-sub-12mo'],
  not_setting: 2,
  stop_reason: 'this home sits inside a neighborhood or community, so the search does not leave it for another community or a distance past that boundary',
}

describe('shortageLead', () => {
  it('names the count, the sales and the five', () => {
    expect(shortageLead({ marketArea: 'River West', held: 3, sales: FACTS.sales, minComps: 5 })).toBe(
      'The search in River West found 3 price-setting sales (1501 Newport, 1411 Newport, 1367 Milwaukee); 5 are needed.',
    )
    expect(shortageLead({ marketArea: null, held: 1, sales: ['1367 Milwaukee'], minComps: 5 })).toBe(
      'The search found 1 price-setting sale (1367 Milwaukee); 5 are needed.',
    )
    expect(shortageLead({ marketArea: 'River West', held: 0, sales: [], minComps: 5 })).toBe(
      'The search in River West found no price-setting sales; 5 are needed.',
    )
  })
})

describe('brokerCompRefusal leads with the best path', () => {
  it('leads with the facts walk when it held more than the listings fallback', () => {
    const line = brokerCompRefusal({ diagnostics: diag({ facts_path: FACTS }), found: 0, minComps: 5, subjectBaths: 2, subjectCity: 'Bend', sales: [] })
    expect(line.startsWith('The search in River West found 3 price-setting sales (1501 Newport, 1411 Newport, 1367 Milwaukee); 5 are needed.')).toBe(true)
    expect(line).toContain('It stopped because this home sits inside a neighborhood or community')
    expect(line).toContain('2 more sale(s) were found but do not set the price')
    // The weaker listings search is not the story.
    expect(line).not.toMatch(/were cut for|Found 0 of the 5/)
    expect(line).not.toMatch(/ILIKE|adjacent-sub|subdivision-24mo/)
    expect(cmaQueueWhy({ state: 'failed', buildError: line })).toBe('short-comps')
  })

  it('leads with the listings count, naming its sales, when the listings path held more', () => {
    const line = brokerCompRefusal({
      diagnostics: diag({ facts_path: { ...FACTS, held: 1, sales: ['1367 Milwaukee'] }, candidates: 2, final_count: 2 }),
      found: 2,
      minComps: 5,
      subjectBaths: 2,
      subjectCity: 'Bend',
      sales: ['1340 Cumberland', '233 Revere'],
    })
    expect(line.startsWith('The search in River West found 2 price-setting sales (1340 Cumberland, 233 Revere); 5 are needed.')).toBe(true)
    expect(line).toContain('were cut for a different neighborhood')
    expect(cmaQueueWhy({ state: 'failed', buildError: line })).toBe('short-comps')
  })

  it('reads a facts-sourced shortage from the facts walk too', () => {
    const line = brokerCompRefusal({
      diagnostics: diag({ pricing_source: 'facts', facts_path: { ...FACTS, held: 2, sales: ['1 A St', '2 B St'], not_setting: 0 } }),
      found: 2,
      minComps: 5,
      sales: ['1 A St', '2 B St'],
    })
    expect(line.startsWith('The search in River West found 2 price-setting sales (1 A St, 2 B St); 5 are needed.')).toBe(true)
    expect(line).toContain('It stopped because')
  })
})

describe('diagnoseStarvation leads with the best path', () => {
  it('puts the facts walk first when it held more', () => {
    const msg = diagnoseStarvation(diag({ facts_path: FACTS }))!
    expect(msg.startsWith('facts path: 3 price-setting sale(s) (1501 Newport, 1411 Newport, 1367 Milwaukee), short of 5')).toBe(true)
    expect(msg).toContain('listings path:')
    expect(msg.indexOf('facts path:')).toBeLessThan(msg.indexOf('listings path:'))
  })

  it('keeps the listings path first when it held at least as many', () => {
    const msg = diagnoseStarvation(diag({ facts_path: { ...FACTS, held: 0, sales: [] }, candidates: 1, final_count: 1 }))!
    expect(msg.startsWith('listings path:')).toBe(true)
    expect(msg).toContain('facts path: 0 price-setting sale(s)')
  })
})

describe('factsStopReason', () => {
  it('names the most common reason the rungs after the last one that ran were skipped', () => {
    const wall = 'this home sits inside a neighborhood or community, so the search does not leave it'
    expect(
      factsStopReason(
        [
          { ran: true, skippedReason: null },
          { ran: true, skippedReason: null },
          { ran: false, skippedReason: 'the subject is not inside a golf or resort community' },
          { ran: false, skippedReason: wall },
          { ran: false, skippedReason: wall },
        ],
        false,
      ),
    ).toBe(wall)
  })

  it('says every step ran when nothing after the last rung was skipped, and null when five were reached', () => {
    expect(factsStopReason([{ ran: true, skippedReason: null }], false)).toBe(
      'every step of the search ran and no other sale qualified',
    )
    expect(factsStopReason([{ ran: true, skippedReason: null }], true)).toBeNull()
  })
})

describe('withFactsPath keeps the facts walk on a listings fallback', () => {
  it('stores the facts count, sales, tiers, non-setters and stop reason, and rewrites the starved reason', () => {
    const listings: CompSelection = {
      comps: [],
      excludedOutliers: [],
      tiersUsed: [],
      trace: ['listings path: old reason'],
      diagnostics: diag({ starved_reason: 'listings path: old reason' }),
      pricingSource: 'listings',
    }
    const comps = FACTS.sales.map((address, i) => ({ listingKey: `F${i}`, address }) as unknown as SelectedPricingComp)
    const match = {
      comps,
      tiersUsed: FACTS.tiers_used,
      trace: [],
      reachedTarget: false,
      starved: true,
      rungs: [
        { tier: 'subdivision-24mo', ran: true, skippedReason: null, monthsBack: 24, scanned: 10, added: 1, runningTotal: 1, notSetting: 1 },
        { tier: 'adjacent-sub-12mo', ran: true, skippedReason: null, monthsBack: 12, scanned: 10, added: 2, runningTotal: 3, notSetting: 1 },
        { tier: 'beyond-2mi-12mo', ran: false, skippedReason: FACTS.stop_reason, monthsBack: 12, scanned: 0, added: 0, runningTotal: 3, notSetting: 0 },
      ],
      factsReady: true,
    } as PricingMatchResult & { factsReady: boolean }
    const out = withFactsPath(listings, match)
    expect(out.diagnostics.facts_path).toEqual(FACTS)
    expect(out.diagnostics.starved_reason!.startsWith('facts path: 3 price-setting sale(s)')).toBe(true)
    expect(out.trace).toContain(out.diagnostics.starved_reason)
    expect(out.trace).not.toContain('listings path: old reason')
  })

  it('leaves the selection alone when the facts table is not ready', () => {
    const listings: CompSelection = {
      comps: [],
      excludedOutliers: [],
      tiersUsed: [],
      trace: [],
      diagnostics: diag(),
      pricingSource: 'listings',
    }
    const out = withFactsPath(listings, {
      comps: [],
      tiersUsed: [],
      trace: [],
      reachedTarget: false,
      starved: true,
      rungs: [],
      factsReady: false,
    })
    expect(out.diagnostics.facts_path).toBeUndefined()
  })
})
