/**
 * AEO-1 contract (visibility audit 2026-09-22): on /cities/<city>/<neighborhood>
 * the Dataset / Place JSON-LD and the FAQPage publish the SAME number under the
 * same label, because both come from one read.
 *
 * Live defect this locks out: Awbrey Butte published "Median List Price
 * 1350000" and "Active Listings 45" in its Dataset (market-truth overlay) and
 * "$1,312,500" / "54" in its FAQPage and on the page (boundary inventory).
 *
 * Two halves. The behavioural half runs the page's own builders end to end with
 * the two populations deliberately different. The source half pins the page's
 * wiring so the next edit cannot feed one builder from the overlay again.
 * Lives under _v3/ because that is the path vitest's unit project includes.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildMarketFaq } from '@/lib/site/market-faq'
import { answersFaqItems, buildPlaceAnswers } from '@/lib/site/place-answers'
import { datasetFaqConflicts } from '@/lib/site/dataset-faq-contract'
import type { DatasetInput, PlaceInput, SchemaInput } from '@/lib/site/json-ld'
import { buildNeighborhoodSchemas } from '../neighborhood-schemas'
import {
  neighborhoodCountNote,
  neighborhoodMarketFaqInput,
  neighborhoodPublishedFigures,
} from '../neighborhood-market'

// The two reads the page makes, with the live Awbrey Butte values (2026-09-23).
const OVERLAY = { active: 45, medianList: 1_350_000, daysToPending: 29, monthsSupply: 3.1 }
const BOUNDARY = { activeCount: 54, medianListPrice: 1_312_500 }
const PLACE = 'Awbrey Butte'

function datasetOf(schemas: SchemaInput[]): DatasetInput {
  const node = schemas.find((s): s is DatasetInput => s.type === 'dataset')
  if (!node) throw new Error('no Dataset node')
  return node
}

function placeOf(schemas: SchemaInput[]): PlaceInput {
  const node = schemas.find((s): s is PlaceInput => s.type === 'place')
  if (!node) throw new Error('no Place node')
  return node
}

function pageChain(published = neighborhoodPublishedFigures(BOUNDARY)) {
  const market = buildMarketFaq(
    PLACE,
    neighborhoodMarketFaqInput({
      published,
      monthsOfSupply: null,
      medianDaysToPending: OVERLAY.daysToPending,
      soldCount12mo: 120,
      refreshedAt: '2026-09-22T12:00:00Z',
    }),
  )
  const note = neighborhoodCountNote({
    placeName: PLACE,
    supplyCount: OVERLAY.active,
    boundaryCount: published.activeCount,
  })
  const { answers } = buildPlaceAnswers({
    placeName: PLACE,
    cityName: 'Bend',
    figures: {
      monthsOfSupply: OVERLAY.monthsSupply,
      monthsOfSupplyActiveCount: OVERLAY.active,
      activeCount: published.activeCount,
      activeCountNotes: note ? [note] : null,
      closedCount: { count: 120, windowLabel: 'over the past 12 months' },
      daysToPending: OVERLAY.daysToPending,
      medianListPrice: published.medianListPrice,
    },
    sourceTrace: `regional MLS, detached single-family homes inside the ${PLACE} boundary`,
    asOfLabel: market.asOfLabel,
    valueAsk: { href: '/sell/valuation', onPage: false },
    extra: market.faqs,
  })
  const faqItems = answersFaqItems(answers)
  return { market, faqItems }
}

describe('neighborhood Dataset and FAQPage come from one read (AEO-1)', () => {
  it('publishes the boundary figures in the Dataset, the same ones the FAQ prints', () => {
    const { market, faqItems } = pageChain()
    const byName = Object.fromEntries(market.datasetVariables.map((v) => [v.name, v.value]))
    expect(byName['Median List Price']).toBe(1_312_500)
    expect(byName['Active Listings']).toBe(54)
    expect(datasetFaqConflicts(market.datasetVariables, faqItems)).toEqual([])

    const price = faqItems.find((f) => f.question === `What is the median home price in ${PLACE}?`)
    const count = faqItems.find((f) => f.question === `How many single-family homes are for sale in ${PLACE}?`)
    expect(price?.answer).toContain('$1,312,500')
    expect(count?.answer).toContain('54 single-family homes')
  })

  it('emits Place additionalProperty and Dataset variableMeasured that agree with the FAQPage', () => {
    const { market, faqItems } = pageChain()
    const schemas = buildNeighborhoodSchemas({
      neighborhoodName: PLACE,
      neighborhoodSlug: 'awbrey-butte',
      cityName: 'Bend',
      citySlug: 'bend',
      hasMap: true,
      datasetVariables: market.datasetVariables,
      faqItems,
      asOfIso: market.asOfIso,
      asOfLabel: market.asOfLabel,
      homes: [],
    })
    const dataset = datasetOf(schemas)
    const place = placeOf(schemas)
    for (const vars of [dataset.variableMeasured, place.additionalProperty ?? []]) {
      expect(vars.find((v) => v.name === 'Median List Price')?.value).toBe(1_312_500)
      expect(vars.find((v) => v.name === 'Active Listings')?.value).toBe(54)
      expect(datasetFaqConflicts(vars, faqItems)).toEqual([])
    }
  })

  it('withholds, rather than prints, an overlay figure the FAQ contradicts', () => {
    // The pre-fix wiring: the Dataset fed from the overlay, the FAQ from the boundary.
    const { faqItems } = pageChain()
    const overlayMarket = buildMarketFaq(
      PLACE,
      neighborhoodMarketFaqInput({
        published: { activeCount: OVERLAY.active, medianListPrice: OVERLAY.medianList },
        monthsOfSupply: null,
        medianDaysToPending: OVERLAY.daysToPending,
        soldCount12mo: 120,
        refreshedAt: '2026-09-22T12:00:00Z',
      }),
    )
    expect(datasetFaqConflicts(overlayMarket.datasetVariables, faqItems).map((c) => c.variable)).toEqual([
      'Median List Price',
      'Active Listings',
    ])
    const schemas = buildNeighborhoodSchemas({
      neighborhoodName: PLACE,
      neighborhoodSlug: 'awbrey-butte',
      cityName: 'Bend',
      citySlug: 'bend',
      hasMap: true,
      datasetVariables: overlayMarket.datasetVariables,
      faqItems,
      asOfIso: null,
      asOfLabel: null,
    })
    const dataset = datasetOf(schemas)
    expect(dataset.variableMeasured.map((v) => v.name)).toEqual(['Median Days to Pending', 'Homes Sold (12 months)'])
  })

  it('says why the supply ratio counts fewer homes, in plain words with both numbers', () => {
    const note = neighborhoodCountNote({ placeName: PLACE, supplyCount: 45, boundaryCount: 54 })
    expect(note).toContain('45 homes')
    expect(note).toContain('54')
    expect(note).not.toMatch(/honest counts|place membership|population|market layer/i)
    expect(neighborhoodCountNote({ placeName: PLACE, supplyCount: 54, boundaryCount: 54 })).toBeNull()
    expect(neighborhoodCountNote({ placeName: PLACE, supplyCount: null, boundaryCount: 54 })).toBeNull()
  })

  it('never falls back to the overlay when the boundary read is missing', () => {
    expect(neighborhoodPublishedFigures(null)).toEqual({ activeCount: null, medianListPrice: null })
  })
})

describe('the neighborhood page wires both sinks to the one read (source contract)', () => {
  const src = readFileSync('app/cities/[slug]/[neighborhoodSlug]/page.tsx', 'utf8')

  it('feeds buildMarketFaq through neighborhoodMarketFaqInput with the published figures', () => {
    expect(src).toMatch(/neighborhoodPublishedFigures\(/)
    expect(src).toMatch(/const marketFaqInput = neighborhoodMarketFaqInput\(\{\s*published,/)
    expect(src).toMatch(/buildMarketFaq\(neighborhood\.name, marketFaqInput\)/)
    expect(src).not.toMatch(/medianListPrice:\s*hud\.medianList/)
    expect(src).not.toMatch(/activeCount:\s*hud\.active/)
  })

  it('feeds the Q&A the same published figures and hands the FAQ to the schema builder', () => {
    expect(src).toMatch(/const nbhAnswerActive = published\.activeCount/)
    expect(src).toMatch(/medianListPrice:\s*published\.medianListPrice/)
    expect(src).toMatch(/faqItems:\s*answerFaqs/)
  })
})
