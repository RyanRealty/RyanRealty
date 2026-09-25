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
    expect(row!.answer).toContain('single-family homes for sale there right now')
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
    expect(row?.answer).toContain('not counting Coming Soon')
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

  it('answers in plain words, with provenance left to the source line (AEO-5)', () => {
    const extras = buildPlaceFaqExtras({
      placeName: 'Bend',
      grain: 'city',
      neighborhoods: [{ name: 'Awbrey Butte' }, { name: 'Century West' }],
      neighborhoodsSource: PLACE_COUNT_TRACE,
      communities: [{ name: 'Tetherow' }, { name: 'Broken Top' }],
      communitiesSource: PLACE_COUNT_TRACE,
      parks: [{ name: 'Drake Park' }],
      parksSource: PARKS_TRACE,
      trails: [{ name: 'Deschutes River Trail' }],
      trailsSource: TRAILS_TRACE,
      openHouses: [{ address: '123 NW Bond Street', when: 'Sat 1:00 PM-3:00 PM' }],
      openHousesSource: OPEN_HOUSE_TRACE,
      saleToOriginalPct: 97.6,
      saleToOriginalSource: MARKET_TRACE,
      cashShare: 0.275,
      mixSource: MIX_TRACE,
      newListings30d: 148,
      newListingsSource: ALERTS_TRACE,
      medianListPrice: 899_000,
      medianListSource: MEDIAN_TRACE,
      yearClosed: { year: 2025, volume: '$3.9B', soldCount: 4122 },
      yearClosedSource: MART_TRACE,
    })
    expect(extras.length).toBeGreaterThanOrEqual(10)
    const provenance =
      /not a guess|not an invented|not a guessed|already (prints|shows|publishes)|OpenHouses pull|ledger|Market Truth|same MLS feed|registry list|separate inventory|—/i
    for (const row of extras) {
      expect(row.answer, row.question).not.toMatch(provenance)
      expect(row.source.length).toBeGreaterThan(0)
    }
    expect(extras.find((e) => e.question === 'Are there open houses in Bend this week?')?.answer).toContain(
      'There is 1 open house in Bend',
    )
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

describe('neighborhood facts (Matt 2026-09-24, "Add to neighborhoods")', () => {
  const character = {
    subType: 'Single Family Residence',
    noun: 'detached homes',
    homeCount: 4_800,
    yearBuilt: { p10: 1986, p90: 2017, sample: 4_461 },
    hoaPresence: { yes: 140, reported: 212, windowFrom: '2024-01-01' },
    dues: { medianMonthly: 45, reported: 130, windowFrom: '2024-01-01' },
  }
  const CHARACTER_TRACE = 'regional MLS listings, detached homes inside the Awbrey Butte boundary'
  const recorded = {
    id: 'd1',
    publishedName: 'AWBREY BUTTE',
    kind: 'ccr' as const,
    recordingRef: '346-1105',
    recordingType: 'book-page' as const,
    publisher: null,
    documentDate: null,
    book: 346,
    page: 1105,
    instrumentNumber: null,
    recordingYear: 1979,
    county: 'Deschutes',
    sourceIndexUrl: 'https://recording.deschutes.org/',
    sourceLabel: 'Deschutes County DIAL',
    url: 'https://example.com/ccr.pdf',
    fileBytes: 1000,
    pageCount: 12,
  }
  const amendment = { ...recorded, id: 'd2', kind: 'amendment' as const, recordingRef: '2007-36361', recordingType: 'year-instrument' as const, book: null, page: null, instrumentNumber: '2007-36361' }

  function neighborhood(over: Record<string, unknown> = {}) {
    return buildPlaceFaqExtras({
      placeName: 'Awbrey Butte',
      cityName: 'Bend',
      grain: 'neighborhood',
      character,
      characterSource: CHARACTER_TRACE,
      documents: [recorded, amendment],
      ...over,
    } as Parameters<typeof buildPlaceFaqExtras>[0])
  }

  it('answers how old the homes are with the section sentence and its sample', () => {
    const q = neighborhood().find((e) => e.question === 'How old are the homes in Awbrey Butte?')
    expect(q?.answer).toBe(
      'Eight in ten detached homes in Awbrey Butte were built between 1986 and 2017, based on 4,461 homes with a recorded build year.',
    )
    expect(q?.source).toBe(CHARACTER_TRACE)
  })

  it('answers the HOA question in the counted form, never "no HOA"', () => {
    const q = neighborhood().find((e) => e.question === 'Do homes in Awbrey Butte have an HOA?')
    expect(q?.answer).toBe(
      'Since January 2024, 212 detached listings here reported whether the home has an HOA. 140 of them do. ' +
        'Listings that reported nothing about an HOA are not counted either way. Confirm dues and governing documents through the association before relying on them.',
    )
    const none = neighborhood({ character: { ...character, hoaPresence: { yes: 0, reported: 40, windowFrom: '2024-01-01' } } })
    const answer = none.find((e) => e.question === 'Do homes in Awbrey Butte have an HOA?')?.answer ?? ''
    expect(answer).toContain('0 of them do.')
    expect(answer).not.toMatch(/\bno HOA\b|does not have an HOA/i)
  })

  it('answers the dues question with its median, type and window', () => {
    const q = neighborhood().find((e) => e.question === 'How much are HOA dues in Awbrey Butte?')
    expect(q?.answer).toContain('130 detached listings here reported a dues figure since January 2024. The median is $45 a month.')
    expect(q?.answer).toContain('Confirm them through the association before relying on them.')
  })

  it('says what CC&Rs are on file, never a bare yes for the whole place', () => {
    const q = neighborhood().find((e) => e.question === 'What CC&Rs are on file for Awbrey Butte?')
    expect(q?.answer).toBe(
      'This page links 2 recorded documents for Awbrey Butte: the declaration and 1 recorded amendment. ' +
        'They are copies of instruments recorded in Deschutes County, Oregon. ' +
        'A declaration covers the lots it describes, which may not be every home in Awbrey Butte. ' +
        'Later amendments may exist that are not shown here, so confirm the governing documents for a specific home through title before relying on them.',
    )
    expect(q?.answer).not.toMatch(/^Yes\b/)
    expect(q?.source).toBe('instruments recorded in Deschutes County, Oregon, copies via Deschutes County DIAL')
  })

  it('never calls an association-published copy a recorded instrument', () => {
    const published = {
      ...recorded,
      recordingType: 'association-published' as const,
      publisher: 'Awbrey Butte Homesites Association',
      documentDate: '2019-05-01',
      book: null,
      page: null,
    }
    const q = neighborhood({ documents: [published] }).find((e) => e.question === 'What CC&Rs are on file for Awbrey Butte?')
    expect(q?.answer).toContain("They are Awbrey Butte Homesites Association's own published copies, which carry no county instrument number.")
    expect(q?.answer).not.toMatch(/recorded in Deschutes County/)
    expect(q?.source).toBe("Awbrey Butte Homesites Association's published copies")
  })

  it('asks about governing documents, not CC&Rs, when no declaration is on file', () => {
    const extras = neighborhood({ documents: [{ ...recorded, kind: 'bylaws' as const }] })
    expect(extras.find((e) => e.question === 'What CC&Rs are on file for Awbrey Butte?')).toBeUndefined()
    expect(extras.find((e) => e.question === 'What governing documents are on file for Awbrey Butte?')?.answer).toMatch(
      /^This page links 1 recorded document for Awbrey Butte\./,
    )
  })

  it('drops every one of them without a source, without data, or on a city page', () => {
    expect(neighborhood({ characterSource: null }).map((e) => e.question)).toEqual(['What CC&Rs are on file for Awbrey Butte?'])
    expect(neighborhood({ character: null, documents: [] })).toEqual([])
    const city = buildPlaceFaqExtras({
      placeName: 'Bend',
      grain: 'city',
      character,
      characterSource: CHARACTER_TRACE,
      documents: [recorded],
    })
    const blob = city.map((e) => `${e.question} ${e.answer}`).join(' ')
    expect(blob).not.toMatch(/HOA|CC&Rs|build year/i)
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
