import { describe, it, expect } from 'vitest'
import { buildPlaceAnswers, answersFaqItems, type PlaceAnswersInput } from './place-answers'
import { buildMarketFaq } from './market-faq'
import { marketVerdict } from '@/lib/market/classify'

const base: PlaceAnswersInput = {
  placeName: 'Awbrey Butte',
  cityName: 'Bend',
  figures: {},
  sourceTrace: 'market_metric neighborhood:bend-awbrey-butte',
  asOfLabel: 'September 2026',
  valueAsk: { href: '/sell/valuation', onPage: false },
}

/** The live Awbrey Butte read, 2026-09-08 (see the node's figure traces). */
const awbrey: PlaceAnswersInput = {
  ...base,
  figures: {
    monthsOfSupply: 4.9,
    monthsOfSupplyActiveCount: 49,
    activeCount: 60,
    activeCountTrace: 'the recorded Awbrey Butte boundary, publicly active MLS statuses',
    closedCount: { count: 120, windowLabel: 'over the past 12 months' },
    daysToPending: 29,
    cityDaysToPending: 23,
    saleToOriginal: 0.949938337085399,
    citySaleToOriginal: 0.96990316388811,
    cashShare: 0.391666666666667,
    cityCashShare: 0.27764365041043,
    medianSalePrice: { price: 1183500, windowLabel: 'over the past 12 months' },
    medianListPrice: 1312499.5,
  },
}

const questionsOf = (input: PlaceAnswersInput) =>
  buildPlaceAnswers(input).answers.map((a) => a.question)

describe('buildPlaceAnswers — §0: a null figure is a missing question, never a guess', () => {
  it('emits nothing but the closing ask when it has no figures', () => {
    const { answers } = buildPlaceAnswers(base)
    expect(answers).toHaveLength(1)
    expect(answers[0]?.question).toBe('What is my Awbrey Butte home worth?')
    // No basis figure, so no invented sales count in the body either.
    expect(JSON.stringify(answers[0]?.body)).not.toMatch(/\d/)
  })

  it('drops a figure that is zero, negative or not a number', () => {
    const q = questionsOf({
      ...base,
      figures: {
        monthsOfSupply: 0,
        activeCount: -3,
        daysToPending: Number.NaN,
        cashShare: null,
        saleToOriginal: undefined,
      },
    })
    expect(q).toEqual(['What is my Awbrey Butte home worth?'])
  })

  it('carries a trace on every figured answer, stamped by the query that owns it', () => {
    const { answers } = buildPlaceAnswers(awbrey)
    const figured = answers.filter((a) => a.figure)
    expect(figured.length).toBeGreaterThanOrEqual(5)
    for (const answer of figured) expect(answer.source).toBeTruthy()
    // The metric-layer figures carry the metric layer's compute date; the two
    // boundary-read figures carry that read's own clause and no borrowed date.
    for (const id of ['answer-verdict', 'answer-pace', 'answer-ask', 'answer-cash', 'answer-sales']) {
      expect(answers.find((a) => a.id === id)?.source).toContain('updated September 2026')
    }
    expect(answers.find((a) => a.id === 'answer-inventory')?.source).not.toContain('updated')
  })

  it('does not double the stop when the caller ends its clause with one', () => {
    const { answers } = buildPlaceAnswers({
      ...awbrey,
      sourceTrace: 'the subdivision statistics cache. A closed-price statistic is withheld.',
    })
    expect(answers[0]?.source).not.toMatch(/\.\s*,/)
  })
})

describe('buildPlaceAnswers — the verdict is the number, drawn', () => {
  it('states the verdict lib/market/classify.ts computes, and bands the same rule', () => {
    const { answers } = buildPlaceAnswers(awbrey)
    const verdict = answers.find((a) => a.id === 'answer-verdict')
    expect(verdict?.question).toBe("Is Awbrey Butte a buyer's or seller's market?")
    expect(verdict?.figure?.value).toBe('4.9')
    expect(String(verdict?.body)).toContain('4.9 months of supply, which is a balanced market')
    expect(marketVerdict(4.9).kind).toBe('balanced')
    const mark = verdict?.figure?.mark
    expect(mark).toMatchObject({ kind: 'scale', min: 0, max: 12, at: 4.9 })
    expect(mark && 'bands' in mark ? mark.bands?.map((b) => b.to) : null).toEqual([4, 6, 12])
  })

  it('names its own numerator so the two honest active counts cannot be read as one', () => {
    const { answers } = buildPlaceAnswers(awbrey)
    const verdict = answers.find((a) => a.id === 'answer-verdict')
    const inventory = answers.find((a) => a.id === 'answer-inventory')
    expect(verdict?.source).toContain('49 listings')
    expect(inventory?.figure?.value).toBe('60')
    expect(inventory?.source).toContain('publicly active MLS statuses')
  })

  it('still ASKS the question where the grain cannot publish a supply reading', () => {
    const { answers } = buildPlaceAnswers({
      ...base,
      placeName: 'Tetherow',
      figures: { closedCount: { count: 24, windowLabel: 'over the past 12 months' } },
    })
    const verdict = answers.find((a) => a.id === 'answer-verdict')
    expect(verdict?.question).toBe("Is Tetherow a buyer's or seller's market?")
    expect(String(verdict?.body)).toContain('fewer sales we can attribute to it on its own')
    expect(verdict?.figure?.value).toBe('24')
    expect(verdict?.figure?.mark).toMatchObject({ kind: 'tally', count: 24 })
  })

  it('asks nothing about the verdict when it has neither a ratio nor a count', () => {
    const q = questionsOf({ ...base, figures: { activeCount: 15 } })
    expect(q).not.toContain("Is Awbrey Butte a buyer's or seller's market?")
  })
})

describe('buildPlaceAnswers — one figure, one row', () => {
  it('does not print the closed count twice when it answered the verdict', () => {
    const { answers } = buildPlaceAnswers({
      ...base,
      figures: { closedCount: { count: 24, windowLabel: 'over the past 12 months' } },
      extra: [
        { question: 'How many homes sold in Awbrey Butte in the last year?', answer: '24 closed.' },
      ],
    })
    expect(answers.filter((a) => a.question.startsWith('How many homes sold'))).toHaveLength(0)
    expect(answers.filter((a) => a.figure?.value === '24')).toHaveLength(1)
  })

  it('gives the closed count its own row when the verdict did not need it', () => {
    const { answers } = buildPlaceAnswers(awbrey)
    const sold = answers.find((a) => a.id === 'answer-sales')
    expect(sold?.figure?.value).toBe('120')
    expect(sold?.figure?.mark).toMatchObject({ kind: 'tally', count: 120 })
  })

  it('asks only ONE pace question — to-pending outranks on-market', () => {
    const { answers } = buildPlaceAnswers({
      ...base,
      figures: {
        daysToPending: 29,
        daysOnMarket: { days: 57, windowLabel: 'year to date' },
      },
    })
    const pace = answers.filter((a) => a.id === 'answer-pace')
    expect(pace).toHaveLength(1)
    expect(pace[0]?.figure?.label).toBe('median days to pending')
    expect(String(pace[0]?.body)).not.toContain('57')
  })

  it('falls back to days on market with its own label where no to-pending figure exists', () => {
    const { answers } = buildPlaceAnswers({
      ...base,
      figures: { daysOnMarket: { days: 27, windowLabel: 'year to date' } },
    })
    const pace = answers.find((a) => a.id === 'answer-pace')
    expect(pace?.question).toContain('stay on the market')
    expect(pace?.figure?.label).toBe('median days on market')
  })
})

describe('buildPlaceAnswers — the comparison mark names the city out loud', () => {
  it('puts the parent city on the same rule and in the sentence', () => {
    const { answers } = buildPlaceAnswers(awbrey)
    const pace = answers.find((a) => a.id === 'answer-pace')
    expect(pace?.figure?.mark).toMatchObject({ context: { at: 23, label: 'Bend 23' } })
    expect(String(pace?.body)).toContain('Across Bend the median over the same window was 23 days')
  })

  it('drops the comparison when the page has no city to name it with', () => {
    const { answers } = buildPlaceAnswers({
      ...awbrey,
      cityName: null,
    })
    const pace = answers.find((a) => a.id === 'answer-pace')
    expect(pace?.figure?.mark).not.toHaveProperty('context')
    expect(String(pace?.body)).not.toMatch(/23 days/)
  })

  it('anchors the sale-to-list rule at the asking price', () => {
    const ask = buildPlaceAnswers(awbrey).answers.find((a) => a.id === 'answer-ask')
    expect(ask?.figure?.value).toBe('95.0%')
    expect(ask?.figure?.mark).toMatchObject({
      kind: 'scale',
      min: 85,
      max: 105,
      context: { at: 100, label: 'the asking price' },
    })
  })
})

describe('buildPlaceAnswers — the closing ask', () => {
  it('points at the field on this page when there is one', () => {
    const { answers } = buildPlaceAnswers({
      ...awbrey,
      valueAsk: { href: '#value', onPage: true },
    })
    const last = answers[answers.length - 1]
    expect(last?.id).toBe('answer-value')
    expect(last?.action).toEqual({ label: 'Value my Awbrey Butte home', href: '#value' })
    expect(String(last?.body)).toContain('value field at the top of this page')
  })

  it('points at the valuation spine when the page carries no field', () => {
    const last = buildPlaceAnswers(awbrey).answers.at(-1)
    expect(last?.action?.href).toBe('/sell/valuation')
    expect(String(last?.body)).toContain('120 single-family homes that closed')
  })

  it('stays last even when unfigured questions are merged in', () => {
    const { answers } = buildPlaceAnswers({
      ...awbrey,
      extra: [{ question: 'Does Awbrey Butte have an HOA?', answer: 'No master HOA.' }],
    })
    expect(answers.at(-1)?.id).toBe('answer-value')
    expect(answers.at(-2)?.question).toBe('Does Awbrey Butte have an HOA?')
  })
})

describe('answersFaqItems — the schema is MADE FROM the rendered rows', () => {
  it('matches the visible questions one for one, in order', () => {
    const { answers } = buildPlaceAnswers(awbrey)
    const items = answersFaqItems(answers)
    expect(items.map((i) => i.question)).toEqual(answers.map((a) => a.question))
  })

  it('carries every paragraph the row renders, joined', () => {
    const { answers } = buildPlaceAnswers(awbrey)
    const items = answersFaqItems(answers)
    for (const [i, answer] of answers.entries()) {
      const paragraphs = typeof answer.body === 'string' ? [answer.body] : answer.body
      for (const paragraph of paragraphs) expect(items[i]?.answer).toContain(paragraph)
    }
  })

  it('drops a row with no question or no body rather than emitting an empty Question', () => {
    expect(
      answersFaqItems([
        { question: '  ', body: 'orphan answer' },
        { question: 'Real?', body: ['  ', ''] },
        { question: 'Kept?', body: 'yes' },
      ]),
    ).toEqual([{ question: 'Kept?', answer: 'yes' }])
  })
})

describe('the two builders answer one question set, not two', () => {
  it('absorbs every core market question lib/site/market-faq.ts asks', () => {
    // The prose builder still supplies the questions with no figure (HOA, the
    // school district, which subdivisions a community holds). Its FIGURED four
    // must be absorbed by question text, or a place page ships each of them
    // twice with two different sentences — which /communities/tetherow did for
    // the closed count until this dedupe landed.
    const { faqs } = buildMarketFaq('Awbrey Butte', {
      grain: 'neighborhood',
      source: 'market-truth',
      activeCount: 60,
      medianListPrice: 1312499.5,
      medianSalePrice: 1183500,
      medianSaleMonthLabel: 'August 2026',
      monthsOfSupply: 4.9,
      pulseActiveCount: 60,
      medianDaysToPending: 29,
      soldCount12mo: 120,
      refreshedAt: '2026-09-08T12:40:03.471304+00:00',
      hoaAnnualEstimate: 900,
    })
    const { answers } = buildPlaceAnswers({ ...awbrey, extra: faqs })
    const seen = new Map<string, number>()
    for (const answer of answers) {
      const key = answer.question.toLowerCase()
      seen.set(key, (seen.get(key) ?? 0) + 1)
    }
    expect([...seen.values()].filter((n) => n > 1)).toEqual([])
    // And the unfigured one still arrives.
    expect(answers.some((a) => a.question === 'Does Awbrey Butte have an HOA?')).toBe(true)
  })
})

/* SITE-08 pass 2. The plat grain is the only one that publishes a per-year
   closed count, so it is the only one whose count row can be drawn as two runs
   of marks — this year against the year before, from the same read. */
describe('the closed-sales drawing', () => {
  const platClosed = (priorWindow: { count: number; label: string } | null) =>
    buildPlaceAnswers({
      ...base,
      placeName: 'Ridge At Eagle Crest',
      figures: { closedCount: { count: 26, windowLabel: 'in 2025', priorWindow } },
    }).answers.find((a) => a.id === 'answer-verdict')?.figure?.mark

  it('draws the year before as a second run, named', () => {
    const mark = platClosed({ count: 31, label: 'in 2024' })
    expect(mark).toMatchObject({
      kind: 'tally',
      count: 26,
      runLabel: 'in 2025',
      context: { count: 31, label: 'in 2024' },
    })
  })

  it('drops a prior run it cannot draw rather than half-drawing it', () => {
    expect(platClosed(null)).not.toHaveProperty('context')
    expect(platClosed({ count: 0, label: 'in 2024' })).not.toHaveProperty('context')
    expect(platClosed({ count: 31, label: '   ' })).not.toHaveProperty('context')
  })

  it('leaves a grain with no prior window as one run', () => {
    const mark = buildPlaceAnswers({
      ...base,
      figures: { closedCount: { count: 120, windowLabel: 'over the past 12 months' } },
    }).answers.find((a) => a.id === 'answer-verdict')?.figure?.mark
    expect(mark).toMatchObject({ kind: 'tally', count: 120 })
    expect(mark).not.toHaveProperty('context')
  })
})

describe('per-figure traces — one trace per query, never borrowed', () => {
  it('lets a figure from another population name its own source', () => {
    // The plat case: the days-on-market figure is the statistics-cache row (the
    // page default), the yearly closed count is the sales-history RPC, and the
    // list median is the live counted set. One clause for all three shipped
    // "$785,000 median list price" under "closed single-family sales … a
    // closed-price statistic at plat grain is withheld".
    const { answers } = buildPlaceAnswers({
      ...base,
      placeName: 'Ridge At Eagle Crest',
      sourceTrace: 'the subdivision statistics cache, closed single-family sales, year to date.',
      figures: {
        closedCount: { count: 26, windowLabel: 'in 2025', trace: 'the yearly closed-sale RPC, counts only.' },
        daysOnMarket: { days: 27, windowLabel: 'year to date' },
        medianListPrice: 785000,
        medianListPriceTrace: 'the list prices of the active single-family listings on this plat.',
        activeCount: 15,
        activeCountTrace: 'active single-family listings under this plat name in Redmond.',
      },
    })
    const source = (id: string) => answers.find((a) => a.id === id)?.source ?? ''
    expect(source('answer-verdict')).toContain('yearly closed-sale RPC')
    expect(source('answer-price')).toContain('list prices of the active single-family listings')
    expect(source('answer-price')).not.toContain('closed single-family sales')
    expect(source('answer-inventory')).toContain('active single-family listings under this plat name')
    // The page default still covers the figure it actually describes.
    expect(source('answer-pace')).toContain('subdivision statistics cache')
  })

  it('does not date an override with the page stamp, and trims its trailing stop', () => {
    // The plat's asOfLabel is its statistics-cache refreshed_at. Stamping the
    // live inventory read with it dates one query by another's clock.
    const { answers } = buildPlaceAnswers({
      ...base,
      figures: { activeCount: 15, activeCountTrace: 'listings under this plat name in Redmond.' },
    })
    expect(answers.find((a) => a.id === 'answer-inventory')?.source).toBe(
      'listings under this plat name in Redmond',
    )
  })

  it('still stamps every figure the page default DOES describe', () => {
    const { answers } = buildPlaceAnswers({
      ...base,
      figures: { daysOnMarket: { days: 27, windowLabel: 'year to date' } },
    })
    expect(answers.find((a) => a.id === 'answer-pace')?.source).toContain('updated September 2026')
  })
})

describe('the reader\'s sentence and the machine handle are separate fields', () => {
  it('passes sourceKey straight through, so V3Answers can emit it as data-source-key', () => {
    const out = buildPlaceAnswers({
      ...base,
      sourceKey: 'market_metric:neighborhood:bend-awbrey-butte',
    })
    expect(out.sourceKey).toBe('market_metric:neighborhood:bend-awbrey-butte')
  })

  it('reports no key when the caller has none, rather than inventing one', () => {
    expect(buildPlaceAnswers({ ...base }).sourceKey).toBeNull()
  })

  it('gives an extra row its own source line and counts it as a published trace', () => {
    const out = buildPlaceAnswers({
      ...base,
      extra: [
        {
          question: 'Does Tetherow have an HOA?',
          answer: 'Yes. Annual HOA dues run $2,052, the median of the 135 current listings that report dues.',
          source: 'regional MLS, the median of the 135 current listings that report dues',
        },
        { question: 'What school district serves Tetherow?', answer: 'Bend-La Pine Schools.' },
      ],
    })
    const hoa = out.answers.find((a) => a.question.endsWith('have an HOA?'))
    const school = out.answers.find((a) => a.question.startsWith('What school district'))
    expect(hoa?.source).toBe('regional MLS, the median of the 135 current listings that report dues')
    // A prose row with no figure and no number owes no trace, and must not be
    // given an empty one — an empty source line reads as a missing source.
    expect(school?.source).toBeUndefined()
    expect(out.traces).toContain('regional MLS, the median of the 135 current listings that report dues')
  })
})

/**
 * SITE-24. The boundary question. A sub-plat of a resort has no figure on any
 * name-joined row — every home inside Golf Homes At Tetherow is recorded in the
 * MLS under "Tetherow" — so before this the section rendered its heading,
 * "questions, answered with the number", over a single row that was the
 * valuation ask and carried no number at all.
 */
describe('buildPlaceAnswers — the lifetime count attributed by boundary', () => {
  const plat: PlaceAnswersInput = {
    ...base,
    placeName: 'Golf Homes at Tetherow',
    figures: {
      lifetimeClosedCount: {
        count: 107,
        trace: 'live MLS through Oregon Data Share through the recorded-plat closed-sale index',
      },
    },
  }

  it('answers the boundary question on a plat that can answer nothing else', () => {
    const { answers } = buildPlaceAnswers(plat)
    const row = answers.find((a) => a.id === 'answer-lifetime-sales')
    expect(row).toBeDefined()
    expect(row?.question).toBe('How many homes have ever sold in Golf Homes at Tetherow?')
    expect(row?.figure?.value).toBe('107')
    expect(row?.figure?.mark).toMatchObject({ kind: 'tally', count: 107 })
    // The method is in the body, because a count a name join cannot produce is
    // only trustworthy if the reader is told how it was produced.
    expect([row?.body ?? ''].flat().join(' ')).toMatch(/where the home actually sits/)
    expect(row?.source).toMatch(/recorded-plat closed-sale index/)
  })

  it('puts the boundary count in the FAQPage payload, so the markup matches the page', () => {
    const items = answersFaqItems(buildPlaceAnswers(plat).answers)
    expect(items.some((i) => i.question.includes('ever sold in Golf Homes at Tetherow'))).toBe(true)
  })

  it('§0: a missing or zero lifetime count is an absent question, never a zero', () => {
    for (const figures of [{}, { lifetimeClosedCount: null }, { lifetimeClosedCount: { count: 0 } }]) {
      const { answers } = buildPlaceAnswers({ ...plat, figures })
      expect(answers.find((a) => a.id === 'answer-lifetime-sales')).toBeUndefined()
    }
  })

  /**
   * The two counts coexist and they measure different sets: the yearly count is
   * a name join over one window, the lifetime count is a boundary join over all
   * of them. The boundary row sits after the name row, because a reader asks
   * how it is selling now before asking how much has ever sold here.
   */
  /**
   * §0 rule 5 in one word. The boundary count is every property type and this
   * plat is townhomes; the page's own population label is single-family.
   */
  it('lets the closed figure name its own population instead of the page\'s', () => {
    const { answers } = buildPlaceAnswers({
      ...plat,
      figures: {
        closedCount: { count: 7, windowLabel: 'in 2025', populationLabel: 'homes' },
      },
    })
    const body = answers.flatMap((a) => [a.body].flat()).join(' ')
    expect(body).toMatch(/7 homes closed/)
    expect(body).not.toMatch(/7 single-family homes closed/)
  })

  it('sits after the yearly closed count and does not replace it', () => {
    const { answers } = buildPlaceAnswers({
      ...plat,
      figures: {
        closedCount: { count: 26, windowLabel: 'in 2025' },
        lifetimeClosedCount: { count: 107 },
      },
    })
    const ids = answers.map((a) => a.id)
    // With no months-of-supply the yearly count answers the verdict question.
    expect(ids).toContain('answer-verdict')
    expect(ids.indexOf('answer-lifetime-sales')).toBeGreaterThan(ids.indexOf('answer-verdict'))
    const figures = answers.map((a) => a.figure?.value)
    expect(figures).toContain('26')
    expect(figures).toContain('107')
  })
})
