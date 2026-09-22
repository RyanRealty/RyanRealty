import { describe, expect, it } from 'vitest'
import { buildMarketFaq } from './market-faq'
import {
  MIN_PLACE_FAQ_EXTRA_CHARS,
  appendPlaceFaqExtras,
  buildPlaceFaqExtras,
} from './place-faq-extras'

const PLACE_COUNT_TRACE = 'live MLS through Oregon Data Share, active single-family listings, counted per place'
const PARKS_TRACE =
  'Named parks from the Central Oregon parks registry, each with a page of its own. Features, parking, and hours print only when the official park page states them.'
const TRAILS_TRACE =
  'Named trails from the Central Oregon trails registry, each with a page of its own. Distance and difficulty print only when the land manager publishes them.'
const OPEN_HOUSE_TRACE =
  'Open houses scheduled in the next 7 days, live from the MLS through Oregon Data Share'
const MARKET_TRACE =
  'regional MLS through Oregon Data Share, read through the Market Truth metric layer: detached single-family houses whose MLS City is Bend.'
const MIX_TRACE =
  'market_metric financing_mix, Bend detached closed sales, 12-month window. Shares under 5% are not published.'
const ALERTS_TRACE =
  '148 houses: regional MLS through Oregon Data Share, Market Truth new listings in the last 30 days for Bend (detached single-family; Coming Soon excluded).'
const MEDIAN_TRACE =
  'Median asking price $899,000, market_metric median_list_active, Bend detached, the same row this page\'s market section prints'
const MART_TRACE =
  'Closed MLS sales through Oregon Data Share, Bend, all property types, calendar year 2025. Not active inventory.'

const PULSE_QUESTION =
  /median home price|homes are for sale|buyer's or seller's|take to sell|stay on the market|homes sold in .+ in the last year/i

describe('buildPlaceFaqExtras', () => {
  it('emits nothing without named sources already on the page', () => {
    expect(
      buildPlaceFaqExtras({
        placeName: 'Bend',
        grain: 'city',
        neighborhoods: [{ name: 'Awbrey Butte' }, { name: 'Century West' }],
        parks: [{ name: 'Drake Park' }],
        saleToOriginalPct: 97.6,
        cashShare: 0.275,
        newListings30d: 148,
        medianListPrice: 899_000,
      }),
    ).toEqual([])
  })

  it('omits a one-name neighborhood list and parks without a source', () => {
    const extras = buildPlaceFaqExtras({
      placeName: 'Bend',
      grain: 'city',
      neighborhoods: [{ name: 'Awbrey Butte' }],
      neighborhoodsSource: PLACE_COUNT_TRACE,
      parks: [{ name: 'Drake Park' }],
    })
    expect(extras.map((e) => e.question).join(' ')).not.toMatch(/neighborhoods/i)
    expect(extras.map((e) => e.question).join(' ')).not.toMatch(/parks/i)
  })

  it('names Bend neighborhoods from the ledger already on the page', () => {
    const extras = buildPlaceFaqExtras({
      placeName: 'Bend',
      grain: 'city',
      neighborhoods: [
        { name: 'Awbrey Butte' },
        { name: 'Century West' },
        { name: 'Mountain View' },
        { name: 'Old Bend' },
        { name: 'Southeast Bend' },
        { name: 'Southwest Bend' },
        { name: 'Pilot Butte' },
      ],
      neighborhoodsSource: PLACE_COUNT_TRACE,
    })
    const row = extras.find((e) => e.question === 'Which neighborhoods are in Bend?')
    expect(row).toBeTruthy()
    expect(row!.answer.length).toBeGreaterThanOrEqual(MIN_PLACE_FAQ_EXTRA_CHARS)
    expect(row!.answer).toContain('Awbrey Butte')
    expect(row!.answer).toContain('Century West')
    expect(row!.answer).toContain('1 more named on this page')
    expect(row!.answer).toContain('live single-family count')
    expect(row!.source).toBe(PLACE_COUNT_TRACE)
    expect(row!.question).not.toMatch(PULSE_QUESTION)
  })

  it('names parks and trails from the registry sections already on the page', () => {
    const extras = buildPlaceFaqExtras({
      placeName: 'Bend',
      grain: 'city',
      parks: [{ name: 'Drake Park' }, { name: 'Shevlin Park' }],
      parksSource: PARKS_TRACE,
      trails: [{ name: 'Deschutes River Trail' }],
      trailsSource: TRAILS_TRACE,
    })
    const parks = extras.find((e) => e.question === 'What parks are in Bend?')
    const trails = extras.find((e) => e.question === 'What trails are in Bend?')
    expect(parks?.answer).toContain('Drake Park')
    expect(parks?.answer).toContain('Shevlin Park')
    expect(parks?.answer.length).toBeGreaterThanOrEqual(MIN_PLACE_FAQ_EXTRA_CHARS)
    expect(parks?.source).toBe(PARKS_TRACE)
    expect(trails?.answer).toContain('Deschutes River Trail')
    expect(trails?.question).toBe('What trails are in Bend?')
    expect(trails?.source).toBe(TRAILS_TRACE)
  })

  it('lists sibling neighborhoods under the city name, not the subject neighborhood', () => {
    const extras = buildPlaceFaqExtras({
      placeName: 'Awbrey Butte',
      cityName: 'Bend',
      grain: 'neighborhood',
      neighborhoods: [{ name: 'Century West' }, { name: 'Mountain View' }],
      neighborhoodsSource: PLACE_COUNT_TRACE,
    })
    const row = extras.find((e) => e.question === 'Which neighborhoods are in Bend?')
    expect(row?.answer).toContain('Century West')
    expect(row?.answer).toContain('other designated neighborhoods')
    expect(row?.question).not.toBe('Which neighborhoods are in Awbrey Butte?')
  })

  it('asks near, not in, for neighborhood parks', () => {
    const extras = buildPlaceFaqExtras({
      placeName: 'Awbrey Butte',
      grain: 'neighborhood',
      parks: [{ name: 'Awbrey Butte Park' }],
      parksSource: 'Straight-line distance from this place to the curated Central Oregon parks registry.',
    })
    expect(extras[0]?.question).toBe('What parks are near Awbrey Butte?')
  })

  it('lists this week\'s open houses from the ledger already on the page', () => {
    const extras = buildPlaceFaqExtras({
      placeName: 'Bend',
      grain: 'city',
      openHouses: [
        { address: '123 NW Bond Street', when: 'Sat 1:00 PM-3:00 PM' },
        { address: '456 SW Brookswood Blvd' },
      ],
      openHousesSource: OPEN_HOUSE_TRACE,
    })
    const row = extras.find((e) => e.question === 'Are there open houses in Bend this week?')
    expect(row?.answer).toContain('2 open houses')
    expect(row?.answer).toContain('123 NW Bond Street')
    expect(row?.answer).toContain('Sat 1:00 PM-3:00 PM')
    expect(row?.answer.length).toBeGreaterThanOrEqual(MIN_PLACE_FAQ_EXTRA_CHARS)
    expect(row?.source).toBe(OPEN_HOUSE_TRACE)
  })

  it('does not put city-scoped open houses on a neighborhood FAQ', () => {
    const extras = buildPlaceFaqExtras({
      placeName: 'Awbrey Butte',
      grain: 'neighborhood',
      openHouses: [{ address: '123 NW Bond Street' }],
      openHousesSource: OPEN_HOUSE_TRACE,
    })
    expect(extras.map((e) => e.question).join(' ')).not.toMatch(/open houses/i)
  })

  it('explains sale-to-original instead of restating a Dataset variable', () => {
    const extras = buildPlaceFaqExtras({
      placeName: 'Bend',
      grain: 'city',
      saleToOriginalPct: 97.6,
      saleToOriginalSource: MARKET_TRACE,
    })
    const row = extras.find((e) => e.question === 'Do homes in Bend sell for the asking price?')
    expect(row?.answer).toContain('97.6%')
    expect(row?.answer).toContain('last 12 months')
    expect(row?.answer).toContain('Under 100%')
    expect(row?.answer.length).toBeGreaterThanOrEqual(MIN_PLACE_FAQ_EXTRA_CHARS)
    expect(row?.source).toBe(MARKET_TRACE)
    expect(row?.question).not.toMatch(PULSE_QUESTION)
  })

  it('explains cash and the published financing mix', () => {
    const extras = buildPlaceFaqExtras({
      placeName: 'Bend',
      grain: 'city',
      cashShare: 0.275,
      financing: [
        { name: 'conventional', label: '63.5%' },
        { name: 'cash', label: '27.5%' },
      ],
      mixSource: MIX_TRACE,
    })
    const row = extras.find((e) => e.question === 'How do buyers in Bend pay?')
    expect(row?.answer).toContain('27.5%')
    expect(row?.answer).toContain('63.5% conventional')
    expect(row?.answer).toContain('not a suggestion about your down payment')
    expect(row?.answer.length).toBeGreaterThanOrEqual(MIN_PLACE_FAQ_EXTRA_CHARS)
    expect(row?.source).toBe(MIX_TRACE)
  })

  it('repeats the alerts-strip new-listings claim with that strip\'s source', () => {
    const extras = buildPlaceFaqExtras({
      placeName: 'Bend',
      grain: 'city',
      newListings30d: 148,
      newListingsSource: ALERTS_TRACE,
    })
    const row = extras.find((e) => e.question === 'How many new houses listed in Bend in the last 30 days?')
    expect(row?.answer).toContain('148')
    expect(row?.answer).toContain('last 30 days')
    expect(row?.answer).toContain('Coming Soon excluded')
    expect(row?.answer.length).toBeGreaterThanOrEqual(MIN_PLACE_FAQ_EXTRA_CHARS)
    expect(row?.source).toBe(ALERTS_TRACE)
  })

  it('opens affordability on the published median and does not invent a monthly payment', () => {
    const extras = buildPlaceFaqExtras({
      placeName: 'Bend',
      grain: 'city',
      medianListPrice: 899_000,
      medianListSource: MEDIAN_TRACE,
      rate: { pct: 6.71, weekLabel: 'Sep 7, 2026', sourceName: 'Freddie Mac 30-year fixed' },
    })
    const row = extras.find((e) => e.question === 'How much house can I afford in Bend?')
    expect(row?.answer).toContain('$899,000')
    expect(row?.answer).toContain('6.71%')
    expect(row?.answer).toContain('Freddie Mac 30-year fixed')
    expect(row?.answer).not.toMatch(/\$\d{1,3},\d{3} a month/)
    expect(row?.answer.length).toBeGreaterThanOrEqual(MIN_PLACE_FAQ_EXTRA_CHARS)
    expect(row?.source).toBe(MEDIAN_TRACE)
  })

  it('names calendar-year closed volume as all property types, not SFR pulse', () => {
    const extras = buildPlaceFaqExtras({
      placeName: 'Bend',
      grain: 'city',
      yearClosed: { year: 2025, volume: '$3.9B', soldCount: 4122 },
      yearClosedSource: MART_TRACE,
    })
    const row = extras.find((e) => e.question === 'How much Bend real estate closed in 2025?')
    expect(row?.answer).toContain('$3.9B')
    expect(row?.answer).toContain('4,122')
    expect(row?.answer).toContain('all property types')
    expect(row?.answer).toContain('not a single-family-only figure')
    expect(row?.answer.length).toBeGreaterThanOrEqual(MIN_PLACE_FAQ_EXTRA_CHARS)
    expect(row?.source).toBe(MART_TRACE)
  })

  it('never invents HOA dollars or school numbers', () => {
    const extras = buildPlaceFaqExtras({
      placeName: 'Bend',
      grain: 'city',
      neighborhoods: [{ name: 'Awbrey Butte' }, { name: 'Century West' }],
      neighborhoodsSource: PLACE_COUNT_TRACE,
      parks: [{ name: 'Drake Park' }],
      parksSource: PARKS_TRACE,
    })
    const blob = extras.map((e) => `${e.question} ${e.answer}`).join(' ')
    expect(blob).not.toMatch(/HOA/i)
    expect(blob).not.toMatch(/school district/i)
    expect(blob).not.toMatch(/rating/)
  })
})

describe('appendPlaceFaqExtras', () => {
  it('keeps pulse Dataset variables and adds extras only to FAQPage items', () => {
    const pulse = buildMarketFaq('Bend', {
      grain: 'city',
      source: 'market-truth',
      activeCount: 603,
      medianListPrice: 899_000,
      monthsOfSupply: 3.9,
      soldCount12mo: 1840,
      refreshedAt: '2026-09-06',
    })
    const extras = buildPlaceFaqExtras({
      placeName: 'Bend',
      grain: 'city',
      parks: [{ name: 'Drake Park' }],
      parksSource: PARKS_TRACE,
    })
    const merged = appendPlaceFaqExtras(pulse, extras)
    expect(merged.datasetVariables).toEqual(pulse.datasetVariables)
    expect(merged.faqs.length).toBeGreaterThan(pulse.faqs.length)
    expect(merged.faqs.some((f) => f.question === 'What parks are in Bend?')).toBe(true)
    expect(pulse.faqs.every((f) => PULSE_QUESTION.test(f.question))).toBe(true)
    expect(extras.every((f) => !PULSE_QUESTION.test(f.question))).toBe(true)
    expect(extras.every((f) => f.answer.length >= MIN_PLACE_FAQ_EXTRA_CHARS)).toBe(true)
  })

  it('drops an extra whose question the pulse FAQ already answered', () => {
    const pulse = buildMarketFaq('Bend', { grain: 'city', medianListPrice: 899_000 })
    const merged = appendPlaceFaqExtras(pulse, [
      {
        question: 'What is the median home price in Bend?',
        answer: 'A long restatement that would otherwise pass the character floor because it is more than one hundred twenty characters of copy.',
        source: MARKET_TRACE,
      },
    ])
    expect(merged.faqs.filter((f) => f.question.includes('median home price'))).toHaveLength(1)
  })
})
