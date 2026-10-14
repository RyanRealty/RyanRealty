import { describe, expect, it } from 'vitest'
import { failedAskBacktestHtml, type OpinionPageArgs } from '@/lib/cma/opinion-pages'
import { placePricingStoryHtml } from '@/lib/cma/place-pricing-story'
import type { PlacePricingStory } from '@/lib/cma/place-pricing-types'

const story: PlacePricingStory = {
  placeName: 'Old Farm',
  placeKind: 'neighborhood',
  windowMonths: 12,
  asOf: '2026-09-30',
  listedHomes: 48,
  didNotSell: 11,
  droppedPrice: 9,
  typicalCutShare: 0.035,
  gaveConcessions: 6,
  typicalConcessionShare: 0.02,
  heldAskCount: 20,
  heldAskMedianDays: 12,
  cutPriceCount: 14,
  cutPriceMedianDays: 28,
  sourceNote: 'Old Farm single-family homes on the market 2025-10-01 through 2026-09-30, 48 homes, Oregon Data Share MLS.',
}

function page(over: Partial<OpinionPageArgs> = {}): OpinionPageArgs {
  return {
    subject: { streetAddress: '1 Oak', city: 'Bend', lastListPrice: null },
    pricing: { valueLow: 400000, valueHigh: 500000 },
    comps: [],
    market: null,
    generatedAtIso: '2026-10-01T00:00:00.000Z',
    mapDataUri: null,
    ...over,
  } as unknown as OpinionPageArgs
}

describe('placePricingStoryHtml', () => {
  it('prints the place and the counts, and not the regional tiles', () => {
    const html = placePricingStoryHtml(story, 'letter')
    // With no home to place, the line names the place for what it is and says
    // nothing about where the home sits.
    expect(html).toContain('Here&#39;s what happened in the Old Farm neighborhood over the last 12 months.')
    // The words say what the count holds (reader review 2026-10-09, 1355
    // Jacksonville); this was "48 homes were listed." over the same count.
    expect(html).toContain(
      '48 homes were listed, sold or taken off the market. 11 of them came off the market without selling.',
    )
    expect(html).toContain('9 dropped the price. The typical cut was 3.5% of the first ask.')
    expect(html).toContain('6 gave the buyer a concession at closing. The typical concession was 2% of the list price.')
    expect(html).toContain(
      'Homes that held the first ask had an offer in 12 days. Homes that cut the price took 28 days.',
    )
    expect(html).toContain('A home that starts high and then cuts sits longer.')
    expect(html).toContain(story.sourceNote)
    const stored = placePricingStoryHtml(
      {
        ...story,
        sourceNote: 'River West single-family homes listed October 8, 2025 through October 8, 2026, 139 homes.',
      },
      'letter',
    )
    expect(stored).toContain(
      'River West single-family homes listed, sold or taken off the market between October 8, 2025 and October 8, 2026: 139 homes, each address counted once.',
    )
    expect(stored).not.toContain('listed October 8, 2025 through')
    expect(html).toContain('keep-note')
    expect(html).toContain('class="small"')
    expect(html).not.toContain('3,394')
    expect(html).not.toContain('94.2')
    expect(html).not.toContain('12.3')
    expect(html).not.toContain('stat-strip')
    expect(html).not.toMatch(/approximately/i)
    expect(html).not.toMatch(/[—–]/)
  })

  it('prints the same sentences on the immersive document', () => {
    const html = placePricingStoryHtml(story, 'immersive')
    expect(html).toContain('Old Farm')
    expect(html).toContain('48 homes were listed, sold or taken off the market')
    expect(html).not.toContain('3,394')
    expect(html).not.toContain('94.2')
  })

  it('renders nothing when the story is missing or the place had no listings', () => {
    expect(placePricingStoryHtml(null, 'letter')).toBe('')
    expect(placePricingStoryHtml(undefined, 'immersive')).toBe('')
    expect(placePricingStoryHtml({ ...story, listedHomes: 0 }, 'letter')).toBe('')
  })

  it('skips a cut, a concession, or a speed claim the row did not record', () => {
    const quiet = placePricingStoryHtml(
      {
        ...story,
        droppedPrice: 0,
        typicalCutShare: null,
        gaveConcessions: 0,
        typicalConcessionShare: null,
        heldAskMedianDays: null,
        cutPriceMedianDays: null,
      },
      'letter',
    )
    expect(quiet).toContain('48 homes were listed, sold or taken off the market')
    expect(quiet).not.toContain('dropped the price')
    expect(quiet).not.toContain('concession')
    expect(quiet).not.toContain('had an offer')
    expect(quiet).not.toContain('sits longer')
    expect(quiet).toContain('The homes that did not sell are the ones this report is measured against.')

    const cutOnly = placePricingStoryHtml(
      { ...story, droppedPrice: 7, typicalCutShare: null, gaveConcessions: 0, heldAskMedianDays: 18, cutPriceMedianDays: null },
      'letter',
    )
    expect(cutOnly).toContain('7 dropped the price.')
    expect(cutOnly).not.toContain('typical cut')
    expect(cutOnly).toContain('Homes that held the first ask had an offer in 18 days.')
    expect(cutOnly).not.toContain('Homes that cut the price')
    expect(cutOnly).not.toContain('sits longer')
  })

  it('does not say a cut sat longer when the cut group was not slower', () => {
    const faster = placePricingStoryHtml({ ...story, heldAskMedianDays: 30, cutPriceMedianDays: 10 }, 'letter')
    expect(faster).toContain('30 days')
    expect(faster).toContain('10 days')
    expect(faster).not.toContain('sits longer')
    expect(faster).toContain('this report is measured against')
  })

  it('keeps one decimal only when the percent needs it', () => {
    const html = placePricingStoryHtml({ ...story, typicalCutShare: 0.1, typicalConcessionShare: 0.125 }, 'letter')
    expect(html).toContain('The typical cut was 10% of the first ask.')
    expect(html).toContain('The typical concession was 12.5% of the list price.')
    expect(html).not.toContain('10.0%')
    expect(html).not.toContain('12.50%')
  })
})

describe('failedAskBacktestHtml', () => {
  it('prints the place story and not the regional tiles', () => {
    const html = failedAskBacktestHtml(page({ placePricing: story }), 'letter')
    expect(html).toContain('Old Farm')
    expect(html).toContain('48 homes were listed, sold or taken off the market')
    expect(html).not.toContain('3,394')
    expect(html).not.toContain('94.2')
    expect(html).not.toContain('12.3')
  })

  it('prints nothing when the place story is missing', () => {
    expect(failedAskBacktestHtml(page(), 'letter')).toBe('')
    expect(failedAskBacktestHtml(page({ placePricing: { ...story, listedHomes: 0 } }), 'immersive')).toBe('')
  })

  it('stays empty on a neutral story even when a place story is present', () => {
    const html = failedAskBacktestHtml(
      page({
        placePricing: story,
        subjectStatus: {
          standardStatus: 'Active',
          isActiveWithOtherBrokerage: true,
          isWithdrawnNotExpired: false,
          listingAgentIsUs: false,
          note: null,
        },
      }),
      'letter',
    )
    expect(html).toBe('')
  })
})
