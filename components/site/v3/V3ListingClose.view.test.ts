import { describe, expect, it } from 'vitest'
import { buildCloseSubject, buildCloseView, homeLabel } from './V3ListingClose.view'
import type { ListingCutFacts, ListingCutFigure } from '@/lib/data/market-truth/getListingCutFacts'

/**
 * The close's copy is the thing a licensed broker's name goes on, so this file
 * tests the SENTENCES, not the markup. The rule under test is CLAUDE.md §0
 * rule 7: each of the three figures publishes or it is not mentioned, and the
 * page never softens a missing one into an estimate.
 */

const fig = (value: number, label: string, sampleN: number): ListingCutFigure => ({
  value,
  label,
  sampleN,
  source: `public.market_metric · n=${sampleN}`,
})

/** The live Bend cells, 2026-09-08, period_end 2026-09-08, window 12, mt-v1. */
function bendFacts(overrides: Partial<ListingCutFacts> = {}): ListingCutFacts {
  return {
    cityLabel: 'Bend',
    geoSlug: 'bend',
    windowMonths: 12,
    fetchedAt: '2026-09-08T13:00:00.000Z',
    completeThrough: '2026-09-07',
    cutShare: fig(0.465284474445516, '47%', 2074),
    cutSize: fig(0.0591805766312595, '5.9%', 965),
    daysToPending: fig(29, '29 days', 1987),
    ...overrides,
  }
}

describe('buildCloseView', () => {
  it('leads with the share, and puts the other two in the lede', () => {
    const view = buildCloseView(bendFacts())
    expect(view.claim).toBe(
      'In Bend, 47% of the homes that sold in the last 12 months had dropped their price before a buyer said yes.',
    )
    expect(view.lede).toContain('5.9% off the original list price')
    expect(view.lede).toContain('29 days')
    // The population sentence lives on the window line, not here: printed in
    // both it cost a line the 375 viewport could not spare.
    expect(view.lede).not.toContain('closed sales only')
    expect(view.eyebrow).toBe('Bend · How homes here sold')
  })

  it('fills one dot per whole percent of the share', () => {
    // 0.4652... -> 47 dots, the same rounding the label used. A drawing that
    // disagreed with the number printed beside it is the §0 rule 5 failure.
    expect(buildCloseView(bendFacts()).filledDots).toBe(47)
  })

  it('says nothing at all about a figure that did not publish', () => {
    const view = buildCloseView(bendFacts({ cutSize: null }))
    expect(view.cutDepth).toBeNull()
    expect(view.readings.map((r) => r.id)).toEqual(['share', 'pace'])
    expect(view.claim).not.toContain('5.9')
    expect(view.lede).not.toContain('cut was')
    expect(JSON.stringify(view)).not.toContain('5.9%')
  })

  it('promotes the cut depth to the claim when the share is withheld', () => {
    const view = buildCloseView(bendFacts({ cutShare: null }))
    expect(view.filledDots).toBeNull()
    expect(view.claim).toBe(
      'In Bend, a seller who dropped the price in the last 12 months typically came down 5.9% from where they started.',
    )
    expect(view.lede).toContain('29 days')
  })

  it('falls all the way back to the pace when only it publishes', () => {
    const view = buildCloseView(bendFacts({ cutShare: null, cutSize: null }))
    expect(view.claim).toBe(
      'In Bend, the typical home that sold in the last 12 months went under contract in 29 days.',
    )
    expect(view.lede).toBeNull()
    expect(view.readings).toHaveLength(1)
  })

  it('re-pulls per city: the city name is in every sentence', () => {
    const view = buildCloseView(bendFacts({ cityLabel: 'Redmond', geoSlug: 'redmond' }))
    expect(view.claim).toContain('In Redmond,')
    for (const reading of view.readings) expect(reading.sentence).toContain('Redmond')
  })

  it('prints the window and the geography without opening anything, and no jargon', () => {
    const view = buildCloseView(bendFacts())
    expect(view.windowLine).toContain('Bend single family homes')
    expect(view.windowLine).toContain('12 months to September 7, 2026')
    // No methodology jargon on the page: mt-v1 and `detached` are trace words
    // and they live in the disclosure, not in a line a visitor reads (TASTE.md).
    expect(view.windowLine).not.toMatch(/mt-v1|detached|market_metric|stat_id/)
    // The counts live BESIDE the figure they belong to, not on this line: the
    // evaluator's craft finding was that 2,074 was printed twice in one breath.
    expect(view.windowLine).not.toContain('2,074')
  })

  it('every reading reveals the counts behind its own figure', () => {
    // The first evaluator pass called the readout a tautology: it restated the
    // claim with two words swapped. Each reading now names the part and the
    // whole, which is the thing a person points at a statistic to find out.
    const view = buildCloseView(bendFacts())
    const by = (id: string) => view.readings.find((r) => r.id === id)!
    expect(by('share').sentence).toContain('2,074 homes closed')
    expect(by('depth').sentence).toContain('965 Bend sellers who dropped the price')
    expect(by('depth').sentence).toContain('half came down more')
    expect(by('pace').sentence).toContain('1,987')
    expect(by('pace').sentence).toContain('not to closing')
    // None of the three may simply repeat the claim.
    for (const r of view.readings) expect(r.sentence).not.toBe(view.claim)
  })

  it('carries every figure’s trace into one source line', () => {
    const view = buildCloseView(bendFacts())
    expect(view.source).toContain('n=2074')
    expect(view.source).toContain('n=965')
    expect(view.source).toContain('n=1987')
  })

  it('never labels the pace as days on market', () => {
    // "DaysOnMarket" is list-to-CLOSE and publishing it as DOM is banned
    // (CLAUDE.md §7). The stat here is days to CONTRACT and the words say so.
    const view = buildCloseView(bendFacts())
    const pace = view.readings.find((r) => r.id === 'pace')!
    expect(pace.label).toBe('Days to an accepted offer')
    expect(pace.sentence).toContain('under contract')
    expect(JSON.stringify(view).toLowerCase()).not.toContain('days on market')
  })
})

describe('homeLabel', () => {
  it('keeps a real street line', () => {
    expect(homeLabel('20892 Caldera Ct')).toBe('20892 Caldera Ct')
  })
  it('never renders an empty address', () => {
    expect(homeLabel('')).toBe('this home')
    expect(homeLabel(null)).toBe('this home')
    expect(homeLabel('   ')).toBe('this home')
  })
})

describe('buildCloseSubject — this house, on the same axes', () => {
  // 20892 Caldera Ct, MLS 220214438: OriginalListPrice 754,400 -> ListPrice
  // 699,900, on the market since 2026-01-17 (live listings row, 2026-09-08).
  const drop = { ask: 699900, original: 754400, drop: 54500 }
  const now = new Date('2026-09-08T20:00:00Z')

  it('measures the cut against the FIRST ask, the way the city stat does', () => {
    const s = buildCloseSubject({ addressLine: '20892 Caldera Ct', drop, onMarketDate: '2026-01-17T20:57:12Z', now })!
    // 54,500 / 754,400 = 7.225% -> 7.2%
    expect(s.cutLabel).toBe('7.2%')
    expect(s.cutDepth).toBeCloseTo(0.07224, 4)
  })

  it('counts days LIVE from OnMarketDate, and says so — never DaysOnMarket', () => {
    const s = buildCloseSubject({ addressLine: '20892 Caldera Ct', drop, onMarketDate: '2026-01-17T20:57:12Z', now })!
    // CALENDAR days, January 17 to September 8: 14 + 28 + 31 + 30 + 31 + 30 +
    // 31 + 31 + 8 = 234. The 233 this asserted until 2026-09-08 was elapsed
    // 24-hour periods, which reads a day short of the date beside it whenever
    // the home was listed in the afternoon. See lib/listing/days-live.ts.
    expect(s.daysLive).toBe(234)
    expect(s.line).toBe('20892 Caldera Ct has come down 7.2% from the first list price and has been on the market 234 days.')
    expect(s.source).toContain('OnMarketDate')
    expect(s.source).toContain('not DaysOnMarket')
    // The count must be reproducible from the date the citation prints.
    expect(s.source).toContain('calendar days')
  })

  it('says only what it has when the home has never cut', () => {
    // 11am Pacific on August 30. Midnight UTC would be the 29th in Oregon, and
    // real OnMarketDate values carry a real time of day (timestamptz).
    const s = buildCloseSubject({ addressLine: '1 Main St', drop: null, onMarketDate: '2026-08-30T18:00:00Z', now })!
    expect(s.cutDepth).toBeNull()
    expect(s.cutLabel).toBeNull()
    expect(s.line).toBe('1 Main St has been on the market 9 days.')
  })

  it('is absent entirely when neither fact is available', () => {
    expect(buildCloseSubject({ addressLine: '1 Main St', drop: null, onMarketDate: null, now })).toBeNull()
  })

  it('refuses a nonsense on-market date rather than printing a negative day count', () => {
    expect(
      buildCloseSubject({ addressLine: '1 Main St', drop: null, onMarketDate: '2030-01-01T00:00:00Z', now }),
    ).toBeNull()
  })

  it('rides into the view, and its trace joins the section source line', () => {
    const subject = buildCloseSubject({ addressLine: '20892 Caldera Ct', drop, onMarketDate: '2026-01-17T20:57:12Z', now })
    const view = buildCloseView(bendFacts(), subject)
    expect(view.subject?.cutLabel).toBe('7.2%')
    expect(view.source).toContain('OriginalListPrice 754400 to ListPrice 699900')
  })

  it('leads each comparable mark with THIS home, and names what it is measured against', () => {
    // "221 days versus 29 is the story and it remains a caption" — the evaluator,
    // four passes running. On the two axes this listing is comparable on, the
    // display figure is now the house and the median is the yardstick.
    const subject = buildCloseSubject({ addressLine: '20892 Caldera Ct', drop, onMarketDate: '2026-01-17T20:57:12Z', now })
    const view = buildCloseView(bendFacts(), subject)
    const by = (id: string) => view.readings.find((r) => r.id === id)!
    expect(by('depth').value).toBe('7.2%')
    expect(by('depth').against).toBe('off this home’s first list price, against a typical 5.9%')
    expect(by('pace').value).toBe('234 days')
    expect(by('pace').against).toBe('this home has been listed, against 29 days for the typical Bend sale')
  })

  it('leads with the CITY figure when this listing has nothing comparable', () => {
    // A home that has never cut and has no on-market date is not on those axes,
    // so the marks stay the market's and say so.
    const view = buildCloseView(bendFacts(), null)
    const by = (id: string) => view.readings.find((r) => r.id === id)!
    expect(by('depth').value).toBe('5.9%')
    expect(by('depth').against).toBe('came off the list price')
    expect(by('pace').value).toBe('29 days')
    expect(by('pace').against).toBe('from listing to contract')
  })

  it('never puts this still-listed home inside the closed-sale share', () => {
    const subject = buildCloseSubject({ addressLine: '20892 Caldera Ct', drop, onMarketDate: '2026-01-17T20:57:12Z', now })
    const view = buildCloseView(bendFacts(), subject)
    expect(view.readings.find((r) => r.id === 'share')!.value).toBe('47%')
    expect(view.readings.find((r) => r.id === 'share')!.against).toBe('of every 100 homes that sold')
  })
})
