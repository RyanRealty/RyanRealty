/**
 * The proof block's placing and wording, through the public interface.
 *
 * The fixture is the live 2026-09-08 pull (7 Ryan Realty closings, Bend
 * detached medians of 29 days and 0.9698), so a change to the geometry or the
 * sentences shows up here as a diff rather than on a screenshot.
 */
import { describe, expect, it } from 'vitest'
import {
  askDistanceLabel,
  packLanes,
  proofBlockView,
  ratioLabel,
  trackPctOf,
} from './V3ProofBlock.view'
import type { ProofBlock } from '@/lib/data/proof/getProofBlock'

const ATTRIBUTION = { surface: 'sell', place: 'bend', source: 'proof_block' }

function liveBlock(over: Partial<ProofBlock> = {}): ProofBlock {
  const rows = [
    { id: '220225317', city: 'Redmond', propertySubType: 'Single Family Residence', closeDate: '2026-09-01', saleToOriginal: 1.0152671755725191, daysToContract: 2 },
    { id: '220215040', city: 'Bend', propertySubType: 'Single Family Residence', closeDate: '2026-07-08', saleToOriginal: 0.9628942486085343, daysToContract: 28 },
    { id: '220221770', city: 'Bend', propertySubType: 'Single Family Residence', closeDate: '2026-05-15', saleToOriginal: 1, daysToContract: null },
    { id: '220205364', city: 'Bend', propertySubType: 'Single Family Residence', closeDate: '2025-10-29', saleToOriginal: 0.899880810488677, daysToContract: 76 },
    { id: '220200647', city: 'Bend', propertySubType: 'Single Family Residence', closeDate: '2025-10-10', saleToOriginal: 0.9074074074074074, daysToContract: 118 },
    { id: '220198987', city: 'Bend', propertySubType: 'Single Family Residence', closeDate: '2025-09-29', saleToOriginal: 0.7973462002412545, daysToContract: 160 },
    { id: '220205567', city: 'Bend', propertySubType: 'Single Family Residence', closeDate: '2025-09-25', saleToOriginal: 0.9372156505914468, daysToContract: 12 },
  ]
  return {
    window: { months: 12, start: '2025-09-08', end: '2026-09-08' },
    reviews: {
      count: 25,
      averageRating: 5,
      source: 'google',
      quotes: [
        { id: '2026-07-10-0', text: 'As a California resident, selling my house in Bend was more difficult than I had anticipated.', author: 'MJB', date: '2026-07-10', rating: 5 },
        { id: '2026-05-18-1', text: "I'd highly recommend Matt Ryan.", author: 'E Oster', date: '2026-05-18', rating: 5 },
      ],
    },
    record: { homesSold: 17, totalVolume: 13_384_034, avgSalePrice: 787_296 },
    outcomes: {
      rows,
      closings: 7,
      saleToOriginalN: 7,
      daysToContractN: 6,
      daysExcludedN: 1,
      medianSaleToOriginal: 0.9372156505914468,
      medianDaysToContract: 52,
      cities: ['Bend', 'Redmond'],
      publishable: true,
      quietReason: null,
    },
    context: {
      geoType: 'city',
      geoSlug: 'bend',
      label: 'Bend',
      medianDaysToContract: 29,
      medianDaysToContractN: 1994,
      medianSaleToOriginal: 0.969756097560976,
      medianSaleToOriginalN: 2081,
      closedCount: 2081,
      definitionId: 'mt-v1',
      computedAt: '2026-09-08T00:21:24.953Z',
    },
    trace: [
      { figure: '5.0 average from 25 Google reviews', source: 'GBP', table: 'public.reviews', filter: "source='google'", window: 'all', rows: 25, fetchedAt: '2026-09-08T03:45:07.237Z', query: 'getReviews()' },
    ],
    ...over,
  }
}

describe('packLanes', () => {
  it('leaves well-separated marks on one lane', () => {
    expect(packLanes([0, 20, 40, 60, 80])).toEqual([0, 0, 0, 0, 0])
  })

  it('steps a colliding mark up rather than hiding it', () => {
    expect(packLanes([10, 11, 12])).toEqual([0, 1, 2])
  })

  it('assigns lanes by position, not by input order', () => {
    // The 90 is far from the cluster and stays on lane 0 wherever it appears.
    expect(packLanes([90, 10, 11])).toEqual([0, 0, 1])
  })

  it('gives a null position a lane without consuming one', () => {
    expect(packLanes([10, null, 11])).toEqual([0, 0, 1])
  })

  it('caps at four lanes rather than climbing out of the track', () => {
    const lanes = packLanes([0, 0.1, 0.2, 0.3, 0.4, 0.5])
    expect(Math.max(...lanes)).toBeLessThanOrEqual(3)
  })
})

describe('trackPctOf', () => {
  it('recovers the plot line from two placed points', () => {
    const placed = [
      { value: 0, pct: 0 },
      { value: 100, pct: 100 },
    ]
    expect(trackPctOf(placed, 50)).toBe(50)
  })

  it('returns null when the target falls outside the track', () => {
    const placed = [
      { value: 0, pct: 0 },
      { value: 100, pct: 100 },
    ]
    expect(trackPctOf(placed, 200)).toBeNull()
  })

  it('returns null when every placed point shares one value', () => {
    expect(trackPctOf([{ value: 5, pct: 10 }, { value: 5, pct: 10 }], 0)).toBeNull()
  })
})

describe('labels', () => {
  it('states the ratio the market cells publish', () => {
    expect(ratioLabel(0.9372156505914468)).toBe('93.7% of the first ask')
    expect(ratioLabel(0.969756097560976)).toBe('97.0% of the first ask')
  })

  it('says the same figure the way a person says it', () => {
    expect(askDistanceLabel(0.9)).toBe('10.0% under the first ask')
    expect(askDistanceLabel(1.0152671755725191)).toBe('1.5% over the first ask')
    expect(askDistanceLabel(1)).toBe('at the first ask')
  })
})

describe('proofBlockView', () => {
  it('places every closing that carries a figure, and only those', () => {
    const view = proofBlockView({ block: liveBlock(), attribution: ATTRIBUTION, showOutcomes: true })!
    expect(view.marks).toHaveLength(7)
    // Every closing has a ratio; the retroactive entry has no day count, so it
    // is absent from the days track and present on the ratio track.
    expect(view.marks.filter((m) => m.ratioPct != null)).toHaveLength(7)
    expect(view.marks.filter((m) => m.daysPct != null)).toHaveLength(6)
    const retro = view.marks.find((m) => m.id === '220221770')!
    expect(retro.daysPct).toBeNull()
    expect(retro.daysLabel).toBeNull()
    expect(retro.ratioLabel).toBe('100.0% of the first ask')
  })

  it('puts both medians on their own tracks, in the same window', () => {
    const view = proofBlockView({ block: liveBlock(), attribution: ATTRIBUTION, showOutcomes: true })!
    const days = view.strips.find((s) => s.key === 'days')!
    const ratio = view.strips.find((s) => s.key === 'ratio')!
    expect(days.context).toEqual({ pct: expect.any(Number), label: '29 days', name: 'Bend median' })
    expect(ratio.context?.label).toBe('97.0%')
    for (const strip of [days, ratio]) {
      expect(strip.context!.pct).toBeGreaterThan(0)
      expect(strip.context!.pct).toBeLessThan(100)
    }
  })

  it('anchors the ratio track on the first asking price rather than on zero dollars', () => {
    const view = proofBlockView({ block: liveBlock(), attribution: ATTRIBUTION, showOutcomes: true })!
    const ratio = view.strips.find((s) => s.key === 'ratio')!
    expect(ratio.anchor).not.toBeNull()
    expect(ratio.anchor!.label).toBe('sold at the first ask')
    // A mark that sold OVER the first ask must sit to the right of the anchor,
    // and one that sold under must sit to its left.
    const over = view.marks.find((m) => m.id === '220225317')!
    const under = view.marks.find((m) => m.id === '220198987')!
    expect(over.ratioPct!).toBeGreaterThan(ratio.anchor!.pct)
    expect(under.ratioPct!).toBeLessThan(ratio.anchor!.pct)
  })

  it('claims the medians in plain sentences and never leads with a percentage', () => {
    const view = proofBlockView({ block: liveBlock(), attribution: ATTRIBUTION, showOutcomes: true })!
    expect(view.heading).not.toMatch(/%/)
    expect(view.claim).not.toMatch(/%/)
    const days = view.strips.find((s) => s.key === 'days')!
    expect(days.claim).toContain('52 days')
    expect(days.claim).toContain('29 days')
    const ratio = view.strips.find((s) => s.key === 'ratio')!
    expect(ratio.claim).toContain('93.7% of the first ask')
    expect(ratio.claim).toContain('97.0% of the first ask')
  })

  it('states the count and the window, and explains what is missing', () => {
    const view = proofBlockView({ block: liveBlock(), attribution: ATTRIBUTION, showOutcomes: true })!
    expect(view.countLine).toContain('7 closings')
    expect(view.countLine).toContain('Bend and Redmond')
    const days = view.strips.find((s) => s.key === 'days')!
    expect(days.note).toContain('6 of 7')
    expect(days.note).toContain('after the contract was already signed')
  })

  it('carries the record, the words, and the full trace', () => {
    const view = proofBlockView({ block: liveBlock(), attribution: ATTRIBUTION, showOutcomes: true })!
    expect(view.record).toEqual({
      value: '17',
      label: 'homes closed, listed by Ryan Realty',
      aside: expect.stringContaining('13'),
    })
    expect(view.reviews?.line).toBe('5.0 from 25 verified Google reviews')
    expect(view.reviews?.quotes).toHaveLength(2)
    // Quotes are never trimmed.
    expect(view.reviews?.quotes[0]?.text).toContain('more difficult than I had anticipated')
    expect(view.trace).toContain('public.reviews')
  })

  it('goes quiet, keeping the rest, when the window is too thin to chart', () => {
    const thin = liveBlock()
    const view = proofBlockView({
      block: {
        ...thin,
        outcomes: {
          ...thin.outcomes,
          rows: thin.outcomes.rows.slice(0, 3),
          closings: 3,
          publishable: false,
          quietReason: 'Too few recent closings here to chart.',
        },
      },
      attribution: ATTRIBUTION,
    })!
    expect(view.quiet).toBe('Too few recent closings here to chart.')
    expect(view.marks).toHaveLength(0)
    expect(view.strips).toHaveLength(0)
    // The record and the reviews survive: only the drawing withheld.
    expect(view.record).not.toBeNull()
    expect(view.reviews).not.toBeNull()
  })

  it('drops the context sentence rather than comparing to nothing', () => {
    const view = proofBlockView({
      block: { ...liveBlock(), context: null },
      attribution: ATTRIBUTION,
      showOutcomes: true,
    })!
    const days = view.strips.find((s) => s.key === 'days')!
    expect(days.context).toBeNull()
    expect(days.claim).toBe('Half of them went under contract inside 52 days.')
  })

  // Matt 2026-09-08, "hold those, we only want positive": the comparison strips
  // do not reach a seller-facing page, and a caller who forgets the prop must
  // not get them by accident. Recorded in docs/plans/PUBLIC_PRODUCT/decisions.md.
  it('withholds the outcome strips unless the caller asks for them', () => {
    const view = proofBlockView({ block: liveBlock(), attribution: ATTRIBUTION })!
    expect(view.strips).toHaveLength(0)
    expect(view.marks).toHaveLength(0)
    // The positive proof still ships, and the section says only what it shows.
    expect(view.record).not.toBeNull()
    expect(view.reviews).not.toBeNull()
    expect(view.heading).not.toMatch(/against|versus|compared/i)
  })

  it('renders nothing at all when the block carries nothing', () => {
    const view = proofBlockView({
      block: {
        ...liveBlock(),
        reviews: null,
        record: null,
        outcomes: { ...liveBlock().outcomes, rows: [], closings: 0, publishable: false },
      },
      attribution: ATTRIBUTION,
    })
    expect(view).toBeNull()
  })
})
