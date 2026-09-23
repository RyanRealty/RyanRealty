/**
 * VOICE-2 (visibility audit 2026-09-22): the folded source line is the one
 * clause a reader sees before opening a trace, and on production it read
 * "Median asking price $1", "market_metric financing_mix", "leftover
 * membership" and "public". This file runs the REAL publishers behind those
 * four lines through the same fold V3SourceLine renders (v3SourceParts) and
 * holds the visible name to two rules:
 *
 *   1. it is words a reader uses: no table or column names, no schema prefix,
 *      no stat_id, no snake_case, no "leftover";
 *   2. it never ends inside a price: "$1" out of "$1,312,500" is a wrong
 *      printed figure (CLAUDE.md section 0).
 */
import { describe, expect, it } from 'vitest'
import { v3SourceParts, sourceNameFromTrace } from './V3SourceLine'
import { buildCloseSubject, buildCloseView } from './V3ListingClose.view'
import { affordabilityFigures } from './V3PlaceAffordability.view'
import { publishPlaceAffordability } from '@/lib/place/publish-place-affordability'
import { publishListingPillRead } from '@/lib/listing/publish-listing-pill-read'
import { buildListingAskClaim } from '@/components/site/listing-detail/listing-ask'
import type { ListingCutFacts, ListingCutFigure } from '@/lib/data/market-truth/getListingCutFacts'
import type { LeftoverHudKpis } from '@/lib/market/publish-leftover-hud'

/** The audit's own pattern, verbatim. */
const MACHINE = /(^|\W)(public\.?|market_metric|_mv\b|stat_id=|leftover|[a-z]+_[a-z]+)(\W|$)/

/** True when the name stops inside a figure the trace goes on to finish. */
function endsInTruncatedFigure(name: string, trace: string): boolean {
  if (!/\$?\d$/.test(name)) return false
  const at = trace.indexOf(name)
  if (at < 0) return false
  return /^[,.]\d/.test(trace.slice(at + name.length))
}

function assertReaderName(input: { source: string; sourceName?: string | null }) {
  const { name, trace } = v3SourceParts({ source: input.source, sourceName: input.sourceName })
  expect(name, `machine words in "${name}"`).not.toMatch(MACHINE)
  expect(endsInTruncatedFigure(name, trace), `truncated figure in "${name}"`).toBe(false)
  expect(name.trim().length).toBeGreaterThan(0)
  // Section 0: folding never cuts the record.
  expect(trace).toContain(input.source)
  return name
}

describe('the fold never prints a truncated figure', () => {
  it('does not cut at a thousands comma, the same way it does not cut at a decimal point', () => {
    expect(sourceNameFromTrace('Median asking price $1,312,500, the homes for sale inside Awbrey Butte.')).toBe(
      'Median asking price $1,312,500',
    )
    expect(sourceNameFromTrace('2,073 closed sales, Bend detached')).toBe('2,073 closed sales')
    expect(sourceNameFromTrace('months of supply 3.5, seller’s market')).toBe('months of supply 3.5')
  })

  it('still cuts at a comma that is followed by a space', () => {
    expect(sourceNameFromTrace('live MLS through Oregon Data Share, 1,200 homes')).toBe(
      'live MLS through Oregon Data Share',
    )
  })

  it('the audit pattern and the truncation check catch the four names production printed', () => {
    // Guards on the guards: each production defect must fail this file's rules.
    expect('market_metric financing_mix').toMatch(MACHINE)
    expect('leftover membership').toMatch(MACHINE)
    expect('public').toMatch(MACHINE)
    expect(endsInTruncatedFigure('Median asking price $1', 'Median asking price $1,312,500,, the')).toBe(true)
  })
})

describe('place affordability: reader-facing names at every source line', () => {
  const base = {
    placeName: 'Awbrey Butte',
    placeSlug: 'awbrey-butte',
    grain: 'neighborhood' as const,
    // The live figure the audit read on /cities/bend/awbrey-butte, 2026-09-22.
    medianListPrice: 1_312_500,
    activeCount: 49,
    computedAt: '2026-09-22T18:21:00.000Z',
    browseHref: '/cities/bend/awbrey-butte#homes',
    rate: null,
    fallbackRatePct: 7,
    mix: {
      financing: [
        { key: 'conventional', share: 0.55, floor: false },
        { key: 'cash', share: 0.39, floor: false },
      ],
      features: [],
      bedrooms: [],
    },
    cashShare: 0.39,
  }

  for (const grain of ['city', 'neighborhood'] as const) {
    it(`${grain}: the median and the mix traces fold to words, and so does every drawn figure`, () => {
      const props = publishPlaceAffordability({ ...base, grain })!
      expect(props).not.toBeNull()
      // The raw traces as the FAQ extras receive them (no explicit name).
      expect(assertReaderName({ source: props.medianSource })).toBe('live MLS through Oregon Data Share')
      expect(assertReaderName({ source: props.mixSource })).toBe('closed MLS sales through Oregon Data Share')
      // The one-comma rule: the doubled comma the audit found is gone.
      expect(props.medianSource).not.toMatch(/,\s*,/)

      const figures = affordabilityFigures({
        placeName: props.placeName,
        mode: 'financed',
        solved: {
          price: 1_312_500,
          monthly: 7_000,
          ceiling: 1_310_000,
          ceilingMonthly: 6_990,
          downPayment: 262_000,
          loanAmount: 1_048_000,
        },
        medianListPrice: props.medianListPrice,
        medianMonthly: 7_000,
        medianSource: props.medianSource,
        medianSourceName: props.medianSourceName,
        termsSource: '20% down, 7%, 30 years.',
        mix: props.mix,
        mixSource: props.mixSource,
        mixSourceName: props.mixSourceName,
      })
      expect(figures.length).toBeGreaterThanOrEqual(3)
      for (const f of figures) assertReaderName(f)
    })
  }

  it('names the missing median in words rather than folding a sentence', () => {
    const props = publishPlaceAffordability({ ...base, medianListPrice: null, activeCount: null })!
    assertReaderName({ source: props.medianSource, sourceName: props.medianSourceName })
  })
})

describe('listing page: the pill read, the ask instrument and the close drawing', () => {
  it('the pill read opens with the feed in words', () => {
    const read = publishListingPillRead({
      daysLive: 112,
      daysToPending: 23,
      ppsf: 697,
      medianPpsf: 402,
      placeName: 'Bend',
      asOfLabel: 'Sep 22, 2026',
    })!
    expect(read.source.startsWith(`${read.sourceName},`)).toBe(true)
    expect(read.source).not.toMatch(/^Market Truth/)
    assertReaderName(read)
    assertReaderName({ source: read.source })
  })

  it('the ask instrument names its source in words, not "leftover membership"', () => {
    const hud: LeftoverHudKpis = {
      active: 578,
      pending: 259,
      closed30: null,
      new30: null,
      medianList: 990_000,
      saleToList: null,
      daysToPending: 30,
      monthsSupply: 3.3,
      sold12mo: null,
    }
    const claim = buildListingAskClaim({
      ask: 1_399_900,
      wholePropertyPrice: 1_399_900,
      hud,
      grain: { name: 'Bend', hubHref: '/cities/bend', geoSlug: 'bend', geoType: 'city' },
    })!
    expect(assertReaderName(claim)).toBe('live MLS through Oregon Data Share')
    expect(assertReaderName({ source: claim.source })).toBe('live MLS through Oregon Data Share')
  })

  it('the close drawing hands over a name, because its trace opens "public.market_metric"', () => {
    // The live /listing/220222277 trace shape, 2026-09-22.
    const cell = (value: number, label: string, sampleN: number, statId: string): ListingCutFigure => ({
      value,
      label,
      sampleN,
      source: `public.market_metric · stat_id=${statId} · geo_type=city · geo_slug=bend (Bend) · segment=detached · window_months=12 · definition_id=mt-v1 · n=${sampleN} · complete_through=2026-09-21 · read 2026-09-22`,
    })
    const facts: ListingCutFacts = {
      cityLabel: 'Bend',
      geoSlug: 'bend',
      windowMonths: 12,
      fetchedAt: '2026-09-22T13:00:00.000Z',
      completeThrough: '2026-09-21',
      cutShare: cell(0.456, '46%', 2050, 'pct_with_price_cut'),
      cutSize: cell(0.058, '5.8%', 936, 'median_price_cut_pct'),
      daysToPending: cell(30, '30 days', 1968, 'median_days_to_contract'),
    }
    // Without the name the fold is the defect the audit found.
    expect(sourceNameFromTrace(buildCloseView(facts).source)).toBe('public')

    const subject = buildCloseSubject({
      addressLine: '56370 Fireglass Loop',
      drop: { ask: 1_399_900, original: 1_449_900, drop: 50_000 },
      onMarketDate: '2026-05-28',
      now: new Date('2026-09-22T19:00:00Z'),
    })
    for (const view of [buildCloseView(facts), buildCloseView(facts, subject)]) {
      expect(view.sourceName).toContain('Bend')
      assertReaderName(view)
    }
  })
})
