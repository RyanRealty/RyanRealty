/**
 * CMA document punch list (docs/plans/CMA_DOC_PUNCHLIST_2026-09-07.md).
 *
 * Every assertion here is a thing a seller reading the document saw wrong on
 * 2026-09-07: a chart that printed every value twice, a comps table that
 * collapsed to one character per line on a phone, a market block that
 * contradicted the number beside it, a count-up animation that shipped false
 * figures into a screenshot. Each one is stated against the RENDERED HTML,
 * not against an internal helper, so a future refactor cannot pass the test
 * while regressing the page.
 */
import { describe, expect, it } from 'vitest'
import { renderCmaHtml, type RenderCmaArgs } from './render'
import { renderImmersiveCmaHtml } from './immersive'
import { immersiveStylesheet } from './immersive-css'
import { immersiveInteractionCss, immersiveInteractionScript } from './immersive-interactions'
import { priceHistoryLineSvg, pricePathFromFinalCycle } from './price-path'
import { cmaStylesheet } from './render-css'
import { askOutcomeBarsSvg, askOutcomeDaysPhrase, niceAxis } from './market-charts'
import type { CmaAdjustedComp, CmaBroker, CmaPricing, CmaSubject } from './types'
import type { CmaMarketArea } from './market-status'
import type { ExpiredAuditData } from './expired-audit'

const subject: CmaSubject = {
  listingKey: 'S1',
  mlsNumber: '220000850',
  streetAddress: '2465 7th',
  city: 'Redmond',
  state: 'OR',
  postalCode: '97756',
  subdivision: 'Diamond Bar Ranch',
  latitude: 44.272,
  longitude: -121.174,
  beds: 3,
  baths: 2,
  sqft: 1440,
  lotAcres: 0.14,
  propertySubType: 'Single Family Residence',
  yearBuilt: 2004,
  garageSpaces: 2,
  photoUrl: 'https://cdn.example/subject.jpg',
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  standardStatus: 'Withdrawn',
  lastListPrice: 460000,
  lastListDate: '2026-02-01',
  listingHistoryLine: 'Last on market Feb 2026 at $460,000 (withdrawn).',
}

const baseComp: CmaAdjustedComp = {
  listingKey: 'C1',
  mlsNumber: '1',
  address: '730 Quince',
  city: 'Redmond',
  subdivision: 'Diamond Bar Ranch',
  latitude: 44.273,
  longitude: -121.175,
  beds: 3,
  baths: 2,
  sqft: 1665,
  lotAcres: 0.14,
  propertySubType: 'Single Family Residence',
  yearBuilt: 2005,
  garageSpaces: 2,
  photoUrl: 'https://cdn.example/c1.jpg',
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  listPrice: 465000,
  closePrice: 457000,
  closeDate: '2026-07-06',
  daysToOffer: 1,
  domTotal: 25,
  selectionTier: 'subdivision',
  proximity: '0.06 miles SE',
  monthsSinceClose: 2,
  timeAdjustment: -39211,
  timeAdjustedPrice: 417789,
  ppsfTimeAdjusted: 251,
  sizeAdjustment: -28229,
  adjustedPrice: 389560,
  weight: 1,
}

/** Five kept sales, days to offer 1 / 4 / 5 / 3 / 51, adjusted $372K to $399K. */
const comps: CmaAdjustedComp[] = [
  baseComp,
  {
    ...baseComp,
    listingKey: 'C2',
    address: '840 Quince',
    sqft: 1280,
    closePrice: 410000,
    closeDate: '2026-04-24',
    daysToOffer: 4,
    domTotal: 34,
    photoUrl: 'https://cdn.example/c2.jpg',
    adjustedPrice: 385615,
    lotAcres: 0.14,
  },
  {
    ...baseComp,
    listingKey: 'C3',
    address: '1737 7th',
    sqft: 1502,
    closePrice: 460000,
    closeDate: '2026-04-24',
    daysToOffer: 5,
    domTotal: 27,
    photoUrl: 'https://cdn.example/c3.jpg',
    adjustedPrice: 398788,
    lotAcres: 0.15,
  },
  {
    ...baseComp,
    listingKey: 'C4',
    address: '2485 7th',
    sqft: 1440,
    closePrice: 410500,
    closeDate: '2026-02-06',
    daysToOffer: 3,
    domTotal: 36,
    photoUrl: 'https://cdn.example/c4.jpg',
    adjustedPrice: 372324,
    lotAcres: 0.14,
  },
  {
    ...baseComp,
    listingKey: 'C5',
    address: '735 Oak',
    sqft: 1556,
    closePrice: 450000,
    closeDate: '2025-12-15',
    daysToOffer: 51,
    domTotal: 105,
    photoUrl: 'https://cdn.example/c5.jpg',
    adjustedPrice: 396229,
    lotAcres: 0.16,
  },
]

const broker: CmaBroker = {
  id: 'id-matt',
  slug: 'matthew-ryan',
  displayName: 'Matt Ryan',
  title: 'Owner & Principal Broker',
  licenseNumber: '201206613',
  email: 'matt@ryan-realty.com',
  phone: '541.703.3095',
  photoUrl: '/images/brokers/ryan-matt.png',
}

const pricing = {
  method1Low: 380000,
  method1Mid: 389000,
  method1High: 398000,
  method2: 388000,
  method3: 389000,
  conservative: 380000,
  recommended: 389000,
  highEnd: 398000,
  valueLow: 380000,
  valueHigh: 398000,
  predictedClose: 380000,
  confidence: 'High',
  confidenceReason: 'Tight set.',
  needsReview: false,
  reviewReason: null,
  notes: [],
} as unknown as CmaPricing

/** Sold 90 band whose median ($458,500) sits nowhere near the recommend. */
const offProductSold90 = {
  count: 4,
  low: 455000,
  median: 458500,
  high: 515000,
  bedsLabel: '2 to 4 bedroom',
  source: 'Closed 2 to 4 bedroom sales in Diamond Bar Ranch in the last 90 days.',
}

const marketArea: CmaMarketArea = {
  grain: 'subdivision',
  label: 'Diamond Bar Ranch',
  source: 'Oregon Data Share MLS. Diamond Bar Ranch.',
  priceLo: 331000,
  priceHi: 460000,
  selected: null,
  active: null,
  pending: null,
  expired: null,
  closed: null,
  sold90: offProductSold90,
  listingTrend: [
    { month: '2025-09', newListings: 1, medianAsk: 446000 },
    { month: '2025-10', newListings: 0, medianAsk: null },
    { month: '2025-11', newListings: 1, medianAsk: 450000 },
    { month: '2025-12', newListings: 3, medianAsk: 400000 },
    { month: '2026-01', newListings: 0, medianAsk: null },
    { month: '2026-02', newListings: 3, medianAsk: 485000 },
  ],
  outcomes: {
    lo: 331000,
    hi: 460000,
    sold: [410000, 411000, 430000, 442000, 446000, 450000, 455000, 457000, 460000],
    unsold: [360000, 460000],
    list: 389000,
    lastAsk: 460000,
    soldShown: 9,
    unsoldShown: 2,
    soldTotal: 9,
    unsoldTotal: 2,
    label: 'Diamond Bar Ranch',
    source: 'Oregon Data Share MLS. Diamond Bar Ranch, $331,000 to $460,000, last 12 months.',
  },
  expiredPeers: [
    {
      listingKey: 'U1',
      address: '1500 Antler',
      listPrice: 360000,
      originalListPrice: 375000,
      status: 'Expired',
      daysOnMarket: 140,
      onMarketDate: '2025-09-01',
      photoUrl: 'https://cdn.example/u1.jpg',
      listingHistoryLine: null,
      beds: 3,
      baths: 2,
      sqft: 1300,
      yearBuilt: 2001,
      lotAcres: 0.14,
      propertySubType: 'Single Family Residence',
    },
  ],
} as unknown as CmaMarketArea

/**
 * `askExposure` is what says WHICH ask ran the clock (round-four class B).
 * Without it chapter 1 prints the days and the city's median and claims
 * nothing causal, so the default fixture carries it: one ask, $460,000, for
 * the whole 186 days, which is the document these assertions were written
 * against.
 */
const expiredAudit = {
  findings: [
    { lens: 'pricing', fact: 'The final asking price was $460,000.', meaning: '' },
    { lens: 'time-on-market', fact: '186 days on market for the final listing period.', meaning: '' },
    { lens: 'price-cuts', fact: 'The ask moved from $475,000 to $460,000.', meaning: '' },
  ],
  finalCycle: {
    listDate: '2026-02-26',
    initialAsk: 460000,
    cuts: [],
    cutsDated: true,
    finalAsk: 460000,
    offMarketDate: '2026-08-31',
    status: 'Withdrawn',
    days: 186,
  },
  askExposure: {
    segments: [
      { ask: 460000, from: '2026-02-26', to: '2026-08-31', days: 186, sharePct: 100, pctAboveRangeTop: 15.6 },
    ],
    dominant: 460000,
    final: 460000,
    sentence: 'It asked $460,000 for 186 days.',
  },
} as unknown as ExpiredAuditData

function args(over: Partial<RenderCmaArgs> = {}): RenderCmaArgs {
  return {
    subject,
    comps,
    market: {
      geoSlug: 'redmond',
      geoLabel: 'Redmond',
      periodStart: '2025-09-07',
      periodEnd: '2026-09-07',
      soldCount365: 188,
      medianSalePrice: 475000,
      medianDom: 21,
      medianPpsf: 290,
      saleToListRatio: 0.978,
      yoyMedianPriceDeltaPct: 1.2,
      activeCount: 40,
      pendingCount: 12,
      monthsOfSupply: 3.2,
      mosFormula: 'pulse',
      marketVerdict: 'seller',
      methodologyVersion: 'v3-2026-05-07',
      computedAt: '2026-09-07',
      pulseUpdatedAt: '2026-09-07',
      trend: [],
    },
    pricing,
    broker,
    client: { name: 'Blair Auld', email: null, phone: null, notes: null },
    mapDataUri: 'data:image/png;base64,aaa',
    generatedAtIso: '2026-09-06T00:00:00.000Z',
    subjectTrace: 't',
    compTrace: [],
    excludedOutliers: [],
    expiredAudit,
    extras: {
      seasonality: null,
      band: {
        lo: 350000,
        hi: 428000,
        activeCount: 27,
        pendingCount: 6,
        activeMedianAsk: 399000,
        activeMedianDom: 30,
        source: 'band fixture',
        rivals: [
          {
            listingKey: 'A1',
            address: '123 Heritage',
            listPrice: 399000,
            status: 'Active',
            daysOnMarket: 11,
            photoUrl: null,
            latitude: 44.27,
            longitude: -121.17,
          },
        ],
      },
      subdivisionPulse: null,
      financing: null,
      photoBench: null,
      marketArea,
      sold90: offProductSold90,
    },
    ...over,
  } as unknown as RenderCmaArgs
}

function letter(over: Partial<RenderCmaArgs> = {}): string {
  return renderCmaHtml(args(over)).html
}
function immersive(over: Partial<RenderCmaArgs> = {}): string {
  return renderImmersiveCmaHtml({ ...args(over), broker }, 'https://ryan-realty.com')
}

/** Order-preserving list of the `<section class="page">` chapter headings. */
function letterChapters(html: string): string[] {
  return [...html.matchAll(/<h2 class="section[^"]*">([\s\S]*?)<\/h2>/g)].map((m) =>
    m[1]!.replace(/<[^>]+>/g, '').trim(),
  )
}
/** Order-preserving list of the immersive scene ids. */
function immersiveScenes(html: string): string[] {
  return [...html.matchAll(/<section class="sc[^"]*" id="([a-z0-9-]+)"/g)].map((m) => m[1]!)
}

describe('chapter 2 — priced right sells, priced high sits', () => {
  // P1 built a price ruler of sold and unsold dots. Matt 2026-09-07: "the chart
  // means nothing." CMA_REIMAGINED_2026-09-07.md chapter 2 replaces it with two
  // graphics from local data plus the unsold listings as short linked rows.
  it('argues the claim from local numbers, not a slogan', () => {
    const html = letter()
    expect(html).toContain('What overpricing costs.')
    expect(html).toContain('How fast homes like yours went')
    expect(html).toContain('The listings near you that did not sell.')
    // The ruler is gone from both documents.
    expect(html).not.toContain('ruler-wide')
    expect(html).not.toContain('Recommended $389K')
    expect(html).not.toContain("Didn't sell")
    expect(immersive()).not.toContain('ruler-wide')
  })

  it('tells one story per unsold listing, never a matrix', () => {
    const chapter = letter().split('The listings near you that did not sell.')[1]!.split('</section>')[0]!
    expect(chapter).toContain('dns-card')
    expect(chapter).toContain('class="price-path"')
    expect(chapter).not.toContain('comp-matrix')
    expect(chapter).toMatch(/<a class="dns-addr" href="https:\/\/ryan-realty\.com\/[^"]*utm_source=cma/)
  })
})

describe('chapter 1 — what happened comes FIRST, before the number', () => {
  // CMA_REIMAGINED_2026-09-07.md moved it ahead of the price. P2 put it second,
  // after How we got the price; the blueprint's reader gives the document
  // ninety seconds and wants their own listing explained before anything else.
  it('opens the document on what happened to their listing', () => {
    const chapters = letterChapters(letter())
    const happened = chapters.findIndex((c) => /and did not sell\./i.test(c))
    const price = chapters.indexOf('$389,000.')
    const competition = chapters.findIndex((c) => /compete with/i.test(c))
    expect(happened).toBe(0)
    expect(price).toBeGreaterThan(happened)
    expect(competition).toBeGreaterThan(price)
  })

  it('carries the failed-then-sold statistics', () => {
    const html = letter()
    const start = html.indexOf('and did not sell.')
    const end = html.indexOf('<section class="page"', start)
    const chapter = html.slice(start, end > 0 ? end : undefined)
    expect(chapter).toContain('3,394')
    expect(chapter).toContain('94.2%')
    expect(chapter).toContain('12.3%')
  })

  it('does the same in the immersive, in the same place', () => {
    const scenes = immersiveScenes(immersive()).filter((x) => x !== 'top')
    expect(scenes[0]).toBe('what-happened')
    expect(scenes.indexOf('what-its-worth')).toBeGreaterThan(0)
    expect(scenes.indexOf('competition')).toBeGreaterThan(scenes.indexOf('what-its-worth'))
  })
})

describe('the 90-day bed-count board is cut, so it cannot contradict the number', () => {
  // P3 dropped the board when the recommend sat outside it. The blueprint cuts
  // it outright: chapter 5 is four city figures, the median-close line and one
  // sentence about the street. A board built on beds rather than living area
  // describes a different product whatever the recommend is.
  it('never prints the bed-count band', () => {
    const html = immersive()
    expect(html).not.toContain('$458,500')
    expect(html).not.toContain('bedroom band')
    expect(html).not.toContain('id="sold-90"')
    expect(html).not.toContain('closed in 90 days')
  })
})

describe('P4 — how fast homes like yours went, not a month ledger', () => {
  it('replaces the new-listings ledger', () => {
    const html = letter()
    expect(html).not.toContain('New listings and asking prices')
    expect(html).toContain('How fast homes like yours went')
  })

  it('plots every kept sale and the subject on one days axis', () => {
    const html = letter()
    const svg = html.match(/<svg[^>]*aria-label="[^"]*how fast[^"]*"[\s\S]*?<\/svg>/i)?.[0]
    expect(svg).toBeTruthy()
    for (const address of ['730 Quince', '840 Quince', '1737 7th', '2485 7th', '735 Oak']) {
      expect(svg).toContain(address)
    }
    expect(svg).toContain('2465 7th')
    expect(svg).toContain('51 days')
    // The subject's bar is the one that never terminates in an offer.
    expect(svg).toMatch(/\d+ days, no offer/)
  })

  it('is in the immersive too', () => {
    // Folded into chapter 2 — the days chart IS "priced high sits".
    expect(immersiveScenes(immersive())).toContain('priced-right')
  })
})

describe('P5 — one statement each, once', () => {
  it('does not repeat the listing history line inside the competition chapter', () => {
    const html = letter()
    const start = html.indexOf('compete with')
    const chapter = html.slice(start, html.indexOf('<section class="page"', start))
    expect(chapter).not.toContain('Last on market Feb 2026')
  })

  it('drops the What we searched bullet list', () => {
    const html = letter()
    expect(html).not.toContain('What we searched')
    expect(html).not.toContain('5 closed sales.')
  })
})

describe('the land is cut, drawn or not', () => {
  // P6 kept the chapter when the lots differed. CMA_REIMAGINED_2026-09-07.md
  // cuts it outright: recorded lot outlines answer none of the three questions
  // this document exists to answer.
  it('draws no lot outlines even when the parcels differ', () => {
    const html = letter({
      parcels: {
        subject: { acres: 0.14, taxlot: '151303BD02800', rings: [[[0, 0], [1, 0], [1, 1], [0, 1]]] },
        comps: comps.map((c, i) => ({
          listingKey: c.listingKey,
          acres: (c.lotAcres ?? 0.14) * (1 + i),
          rings: [[[0, 0], [1 + i, 0], [1 + i, 1], [0, 1]]],
        })),
      } as unknown as RenderCmaArgs['parcels'],
    })
    // Measure the document, not the stylesheet that still names the classes.
    const body = html.split('</style>')[1]!
    expect(body).not.toContain('<h2 class="section">The land</h2>')
    expect(body).not.toContain('lot-strip')
  })
})

describe('P7 — we, not I', () => {
  it('never speaks as I outside a signed letter', () => {
    const html = immersive()
    expect(html).not.toMatch(/\bI am here\b/)
    expect(html).not.toMatch(/(^|[\s>"])I\s+(am|will|can|have|would|think)\b/)
  })
})

describe('P8 — the matrix gets a reading before the reader enters it', () => {
  it('leads with the adjusted range and the recommend', () => {
    // Measure the document, not the stylesheet that names the same classes.
    const html = letter().split('</style>')[1]!
    const lead = html.indexOf('The sales that set this price')
    const matrix = html.indexOf('comp-matrix-wrap', lead)
    expect(lead).toBeGreaterThan(0)
    expect(matrix).toBeGreaterThan(lead)
    // ONE STATEMENT OF THE RANGE, in the chapter's lead, off
    // pricing.valueLow/valueHigh — the same pair the cover prints. The table's
    // lead used to restate the span of the adjusted sales to the dollar, which
    // on a trimmed range was the UNTRIMMED pair and a second answer
    // (tasteReview round two, §3.F).
    expect(html).toMatch(/The sales support \$380,000 to \$398,000\./)
    expect(html).not.toMatch(/land at \$372,324 to \$398,788/)
    expect(html).toMatch(/closed sales below set this number, each moved for/)
    expect(html.indexOf('$389,000.')).toBeLessThan(html.indexOf('The sales support $380,000'))
  })

  it('explains the adjustment rows once', () => {
    const html = letter()
    // Form 1004 order, line by line (research item 1): the three adjustments
    // itemized, then the net, then the two percentages, then the price today.
    expect(html).toContain('Adjusted for date')
    // The row label carries what the sign means, so no sentence has to.
    expect(html).toContain('Adjusted for size (theirs vs yours)')
    // "Adjusted for style" prints only where a style adjustment was made: a
    // row every column leaves empty is dropped rather than printed as dashes.
    expect(html).toContain('Net adjustment')
    expect(html).toContain('Every adjustment added up')
    expect(html).toContain('Sale price today')
    // Both explaining sentences are gone: the labels carry the sign, and the
    // identity rows fold into ONE sentence (tasteReview round three, §3).
    expect(html).not.toContain('A minus figure means')
    expect(html).not.toContain('A plus means yours')
    expect(html).not.toMatch(/Sale price today is the sale price plus every adjustment above it/i)
    expect(html).not.toMatch(/Every home here is [^.]+\. Every home here is/)
  })
})

describe('P10 — one chapter order, both documents', () => {
  it('renders the same chapters in the same order on both paths', () => {
    const scenes = immersiveScenes(immersive()).filter((s) => s !== 'top')
    const chapters = letterChapters(letter())
    // Every immersive scene has a letter chapter and vice versa: same count,
    // same order. The ids are the shared spine's ids.
    expect(scenes.length).toBe(chapters.length)
  })

  it('carries the disclosure on the immersive too', () => {
    const html = immersive()
    expect(html).toContain('id="disclosure"')
    expect(html).toContain('It is not an appraisal.')
  })

  it('drops the services pitch from the seller document', () => {
    const html = letter()
    expect(html).not.toContain('How recent sellers sold')
    expect(html).not.toContain('MLS and portal distribution')
  })
})

describe('F1 — the immersive comps table on a phone', () => {
  it('hides the side-by-side matrix and shows the stack below 700px', () => {
    const css = immersiveStylesheet()
    expect(css).toMatch(/@media screen and \(max-width:\s*700px\)\s*\{[^}]*\.comp-matrix-wrap,\s*\.matrix-group-h\s*\{\s*display:\s*none/)
    expect(css).toMatch(/@media screen and \(max-width:\s*700px\)\s*\{[\s\S]{0,200}\.comp-stack\s*\{\s*display:\s*block/)
  })
})

describe('F2 — the letter shows the matrix on screen at reading width', () => {
  it('shows the matrix and hides the cards above 700px', () => {
    const css = cmaStylesheet('https://ryan-realty.com')
    expect(css).toMatch(/\.comp-matrix-wrap\s*\{\s*display:\s*block/)
    expect(css).toMatch(/@media screen and \(max-width:\s*700px\)\s*\{[\s\S]{0,300}\.comp-stack\s*\{\s*display:\s*block/)
  })

  it('loads every comp thumbnail eagerly so no photo box renders blank', () => {
    const html = letter()
    const thumbs = [...html.matchAll(/<img class="matrix-thumb"[^>]*>/g)].map((m) => m[0])
    expect(thumbs.length).toBeGreaterThan(0)
    for (const t of thumbs) expect(t).not.toContain('loading="lazy"')
  })
})

describe('F4 — a data figure never animates through a false value', () => {
  it('carries no count-up hooks anywhere in the immersive', () => {
    const html = immersive()
    expect(html).not.toContain('data-count')
    expect(html).toContain('3,394')
  })
})

describe('no chapter is headed with an MLS placeholder', () => {
  it('drops the subdivision chapter when the MLS carries no subdivision', () => {
    // 65365 Concorde shipped a chapter headed "N/A" on both documents.
    const story = {
      facts: {
        name: 'N/A',
        totalSales: 12,
        years: [{ year: 2025, count: 4, medianClose: 1_400_000, medianPpsf: 520 }],
        recordHigh: null,
        recordLow: null,
        medianDomRecent: 40,
        saleToListRecentPct: 97.5,
        subjectSqftPercentile: 60,
        vintageSpan: null,
        source: 'fixture',
      },
      sections: [{ heading: 'A street', body: 'Sales cluster here.' }],
      notableSales: [],
      model: 'x',
      costUsd: 0,
      photoSalesReviewed: 0,
    } as unknown as RenderCmaArgs['subdivisionStory']
    expect(letter({ subdivisionStory: story })).not.toContain('>N/A<')
    expect(immersive({ subdivisionStory: story })).not.toContain('>N/A<')
  })
})

describe('a price never ships without the sales that set it', () => {
  it('draws the matrix on the three-sale set the pricing unit priced from', () => {
    const three = comps.slice(0, 3)
    const html = letter({ comps: three })
    expect(html).toContain('comp-matrix-wrap')
    expect(html).toContain('The sales that set this price')
    for (const address of ['730 Quince', '840 Quince', '1737 7th']) {
      expect(html).toContain(address)
    }
  })
})

describe('the subject only has days-without-an-offer when it actually sat', () => {
  const soldLongAgo: CmaSubject = {
    ...subject,
    standardStatus: 'Closed',
    lastListDate: '2004-11-01',
    lastListPrice: 140000,
    listingHistoryLine: 'Last on market Nov 2004 at $140,000 (closed).',
  }

  it('never claims a house that sold in 2004 sat 7,969 days', () => {
    const html = letter({ subject: soldLongAgo, expiredAudit: undefined })
    expect(html).not.toContain('7,969')
    expect(html).not.toMatch(/Yours sat [\d,]+ days/)
  })

  it('still draws the kept sales for that subject', () => {
    const html = letter({ subject: soldLongAgo, expiredAudit: undefined })
    expect(html).toContain('How fast homes like yours went')
    expect(html).toContain('51 days')
  })

  it('keeps the subject row when the listing actually failed', () => {
    expect(letter()).toMatch(/\d+ days, no offer/)
  })
})

// ── F6 · F7 (orchestrator look-pass, 2026-09-07) ────────────────────────────

/** Every circle and every text box in an SVG, in that SVG's own viewBox units. */
function svgBoxes(svg: string): {
  W: number
  H: number
  circles: Array<{ cx: number; cy: number; r: number }>
  texts: Array<{ x: number; y: number; size: number; anchor: string; text: string }>
} {
  const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg)
  if (!vb) throw new Error('the graphic must carry a viewBox')
  const circles = [...svg.matchAll(/<circle cx="([-\d.]+)" cy="([-\d.]+)" r="([\d.]+)"/g)].map(
    (m) => ({ cx: +m[1]!, cy: +m[2]!, r: +m[3]! }),
  )
  const texts = [...svg.matchAll(/<text ([^>]*)>([\s\S]*?)<\/text>/g)].map((m) => {
    const attrs = m[1]!
    const at = (k: string) => /* istanbul ignore next */ new RegExp(`${k}="([^"]*)"`).exec(attrs)?.[1]
    return {
      x: Number(at('x') ?? 0),
      y: Number(at('y') ?? 0),
      size: Number(at('font-size') ?? 12),
      anchor: at('text-anchor') ?? 'start',
      text: m[2]!.replace(/<[^>]+>/g, ' ').trim(),
    }
  })
  return { W: +vb[1]!, H: +vb[2]!, circles, texts }
}

describe('the phone layouts keep every mark inside the frame', () => {
  // F6's mechanism, re-pointed at the graphics that replaced the ruler: a wide
  // chart in a pan box crops the punchline, so each one ships a drawn-to-fit
  // layout and exactly one is ever visible.
  const phoneSvg = (html: string, cls: string): string => {
    const wrap = new RegExp(`<div class="szn ${cls}">([\\s\\S]*?)</div>`).exec(html)
    expect(wrap, `both documents must carry the ${cls} layout`).toBeTruthy()
    return wrap![1]!
  }

  for (const [name, render] of [
    ['letter', letter],
    ['immersive', immersive],
  ] as const) {
    it(`draws chapter 1's timeline inside the viewBox on the ${name}`, () => {
      const svg = phoneSvg(render(), 'timeline-phone')
      const { W, H, circles, texts } = svgBoxes(svg)
      expect(W).toBeLessThanOrEqual(400)
      for (const c of circles) {
        expect(c.cx - c.r, `a mark at ${c.cx} runs off the left edge`).toBeGreaterThanOrEqual(0)
        expect(c.cx + c.r, `a mark at ${c.cx} runs off the right edge`).toBeLessThanOrEqual(W)
        expect(c.cy - c.r).toBeGreaterThanOrEqual(0)
        expect(c.cy + c.r).toBeLessThanOrEqual(H)
      }
      for (const t of texts) {
        const w = t.text.length * t.size * 0.58
        const left = t.anchor === 'end' ? t.x - w : t.anchor === 'middle' ? t.x - w / 2 : t.x
        expect(left, `"${t.text}" runs off the left edge`).toBeGreaterThanOrEqual(-0.5)
        expect(left + w, `"${t.text}" runs off the right edge`).toBeLessThanOrEqual(W + 0.5)
        expect(t.y, `"${t.text}" runs off the bottom`).toBeLessThanOrEqual(H)
      }
    })
  }

  it('shows a phone layout only below 700px, and never on paper', () => {
    for (const css of [cmaStylesheet('https://ryan-realty.com'), immersiveStylesheet()]) {
      const flat = css.replace(/\s+/g, ' ')
      for (const cls of ['timeline', 'days']) {
        expect(flat).toMatch(new RegExp(`\\.${cls}-phone\\s*\\{\\s*display:\\s*none`))
        expect(flat).toMatch(
          new RegExp(`@media screen and \\(max-width:\\s*700px\\)[^}]*\\{[^@]*\\.${cls}-wide\\s*\\{\\s*display:\\s*none`),
        )
        expect(flat).toMatch(new RegExp(`@media print[^@]*\\.${cls}-phone\\s*\\{\\s*display:\\s*none\\s*!important`))
      }
    }
  })

  it('puts no chart in a pan box on a phone', () => {
    // CMA_REIMAGINED_2026-09-07.md § The register: "Nothing on a phone ever
    // sits inside a scroll box: every graphic has a phone drawing." The
    // median-close line was the last one held at min-width in an overflow box,
    // and it cropped six of its twelve months at 375.
    for (const css of [cmaStylesheet('https://ryan-realty.com'), immersiveStylesheet()]) {
      const flat = css.replace(/\s+/g, ' ')
      expect(flat).not.toMatch(/\.szn\.is-hero\s*\{\s*overflow-x:\s*auto/)
      expect(flat).not.toMatch(/\.szn[^{]*svg\s*\{\s*min-width/)
    }
  })

  it('keeps the wide layout for the printed page', () => {
    expect(letter()).toContain('<div class="szn timeline-wide">')
  })
})

describe('F7 / tasteReview 2 — this market is sentences and two bars, not a KPI grid', () => {
  const marketBlock = (html: string): string => {
    const start = html.indexOf('right now')
    expect(start, 'the market board must render').toBeGreaterThan(-1)
    const rest = html.slice(start)
    const end = rest.indexOf('</section>')
    return end > 0 ? rest.slice(0, end) : rest
  }

  it('puts every figure inside a sentence instead of a percent tile', () => {
    const block = marketBlock(letter())
    // TASTE.md names the tell: "a row of percent tiles ... with no plain
    // sentence saying what it means".
    expect(block).not.toMatch(/<div class="stat-strip is-4">/)
    expect(block).not.toContain('class="stat3"')
    expect(block).toContain('40 homes are for sale in Redmond right now')
    expect(block).toMatch(/about 13 sell in a typical month/)
    expect(block).toMatch(/3\.2 months to sell what is listed/)
    expect(block).toMatch(/seller(&#39;|')s market territory/)
  })

  it('names what each number actually is, in words', () => {
    const block = marketBlock(letter())
    // market_stats_cache.median_dom medians listings.days_to_pending — the days
    // from going on market to going pending, not list-to-close.
    expect(block).toContain('had an accepted offer inside 21 days')
    expect(block).not.toContain('median days on market')
    // saleToListRatio carries median_sale_to_original_list, not final list.
    // No third sold-to-first-ask figure here: chapter 2b prints it per group
    // off the 12-month local read and chapter 3's method prints the share the
    // price was carried to. Three numbers for one claim is a §0 failure.
    expect(block).not.toContain('percent of the price they first asked')
    expect(block).not.toContain('>sold to list<')
  })

  it('draws months of supply as two bars, whose ratio IS the published figure', () => {
    const block = marketBlock(letter())
    expect(block).toContain('class="szn mos-wide"')
    expect(block).toContain('Homes for sale in Redmond right now')
    expect(block).toContain('Homes that sell in a typical month')
  })

  it('is the same reading on the immersive', () => {
    const block = marketBlock(immersive())
    expect(block).toContain('had an accepted offer inside 21 days')
    expect(block).toContain('class="szn mos-wide"')
  })

  it('has a row to lay out in, on both stylesheets, and folds on a phone', () => {
    for (const css of [cmaStylesheet('https://ryan-realty.com'), immersiveStylesheet()]) {
      const flat = css.replace(/\s+/g, ' ')
      expect(flat).toMatch(/\.stat-strip\.is-4\s*\{\s*grid-template-columns:\s*repeat\(4,\s*1fr\)/)
      expect(flat).toMatch(/max-width:\s*(700|560)px\)[^@]*\.stat-strip/)
    }
  })

  it('gives the 90-day band figures a register on the letter too', () => {
    const flat = cmaStylesheet('https://ryan-realty.com').replace(/\s+/g, ' ')
    expect(flat).toMatch(/\.stat2 \.st-n \{[^}]*font-weight: 600/)
    expect(flat).toMatch(/\.stat2 \.st-l \{[^}]*text-transform: uppercase/)
  })

  it('keeps the median-close line under the row', () => {
    const trend = Array.from({ length: 12 }, (_, i) => ({
      periodStart: `2025-${String(i + 1).padStart(2, '0')}-01`,
      medianSalePrice: 461000 + i * 6000,
      soldCount: 20,
    }))
    const html = letter({
      market: { ...(args().market as object), trend } as RenderCmaArgs['market'],
    })
    const block = marketBlock(html)
    expect(block).toContain('Median close by month.')
    // The row reads first, the line under it.
    expect(block.indexOf('stat-strip')).toBeLessThan(block.indexOf('Median close by month.'))
  })
})

// ── Stream A step 4 (orchestrator look-pass, 2026-09-07) ────────────────────

describe('the market median is a tick on the days chart', () => {
  const daysSvg = (html: string): string => {
    const svg = /<svg[^>]*aria-label="[^"]*how fast[^"]*"[\s\S]*?<\/svg>/i.exec(html)?.[0]
    expect(svg, 'the days-to-offer chart must render').toBeTruthy()
    return svg!
  }

  for (const [name, render] of [
    ['letter', letter],
    ['immersive', immersive],
  ] as const) {
    it(`draws the ${name} tick at the city median, labelled with the city and the value`, () => {
      const svg = daysSvg(render())
      const { W, texts } = svgBoxes(svg)
      const label = texts.find((t) => t.text === 'Redmond median 21 days')
      expect(label, 'the tick carries the city name and the value from render_args').toBeTruthy()
      const w = label!.text.length * label!.size * 0.58
      const left = label!.anchor === 'end' ? label!.x - w : label!.x
      expect(left).toBeGreaterThanOrEqual(-0.5)
      expect(left + w).toBeLessThanOrEqual(W + 0.5)
      // A hairline the height of the bar rows, not another bar.
      const tick = /<line[^>]*class="days-median"[^>]*>/.exec(svg)
      expect(tick, 'the median is drawn as its own vertical hairline').toBeTruthy()
      const at = (k: string) => Number(new RegExp(`${k}="([\\d.]+)"`).exec(tick![0])?.[1] ?? NaN)
      expect(at('x1')).toBe(at('x2'))
      expect(at('y2')).toBeGreaterThan(at('y1'))
      expect(at('stroke-width')).toBeLessThanOrEqual(1.5)
    })
  }

  it('reads the tick in the caption, between the kept sales and the subject', () => {
    const html = letter()
    expect(html).toMatch(
      /Every sale below had an offer inside 51 days\. Redmond&#39;s median is 21\. Yours sat [\d,]+ days and never got one\./,
    )
  })

  it('leaves the chart alone when render_args carries no median', () => {
    const html = letter({
      market: { ...(args().market as object), medianDom: null } as RenderCmaArgs['market'],
    })
    const svg = daysSvg(html)
    expect(svg).not.toContain('days-median')
    expect(svg).not.toContain('median 21 days')
    expect(html).not.toContain('median is 21')
    expect(html).toContain('Every sale below had an offer inside 51 days.')
  })
})

describe('no MLS placeholder reaches a seller-facing source line', () => {
  /** A 90-day band this subject's recommend actually sits inside. */
  const inBand = (source: string) => ({
    count: 4,
    low: 370000,
    median: 392000,
    high: 405000,
    bedsLabel: '4 to 6 bedroom',
    source,
  })

  const placeholderArgs = (subdivision: string | null): Partial<RenderCmaArgs> => {
    const name = subdivision ?? 'N/A'
    const band = inBand(`Oregon Data Share MLS. Closed 4 to 6 bedroom sales in ${name} in the last 90 days.`)
    return {
      subject: { ...subject, subdivision },
      extras: {
        ...(args().extras as object),
        marketArea: {
          ...marketArea,
          label: name,
          source: `Oregon Data Share MLS. ${name}, priced $331,000 to $460,000, last 12 months.`,
          sold90: band,
          outcomes: {
            ...(marketArea.outcomes as object),
            label: name,
            source: `Oregon Data Share MLS. ${name}, $331,000 to $460,000, last 12 months.`,
          },
        },
        sold90: band,
      },
    } as unknown as Partial<RenderCmaArgs>
  }

  for (const [name, subdivision] of [
    ['an MLS placeholder subdivision', 'N/A'],
    ['no subdivision at all', null],
  ] as const) {
    for (const [doc, render] of [
      ['letter', letter],
      ['immersive', immersive],
    ] as const) {
      it(`prints no N/A on the ${doc} with ${name}`, () => {
        const html = render(placeholderArgs(subdivision)).replace(
          /data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+/g,
          '',
        )
        expect(html).not.toContain('N/A')
      })
    }
  }

  it('never prints an MLS placeholder as the place a figure came from', () => {
    // The 90-day board that shipped "Closed 4 to 6 bedroom sales in N/A" is
    // cut. The rule stands over the whole document: no placeholder reaches a
    // seller-facing source line (clientSourceLine owns the mechanism).
    const html = letter(placeholderArgs('N/A'))
    expect(html).not.toMatch(/\bin N\/A\b/)
    expect(html).not.toMatch(/\bN\/A,/)
  })

  it('keeps a real subdivision exactly as the MLS states it', () => {
    expect(letter()).toContain('Diamond Bar Ranch')
  })
})

// ── F8 (orchestrator look-pass, 2026-09-07) ─────────────────────────────────

describe('F8 — the days-to-offer strip fits a phone', () => {
  const phoneDays = (html: string): string => {
    const wrap = /<div class="szn days-phone">([\s\S]*?)<\/div>/.exec(html)
    expect(wrap, 'both documents must carry a phone layout of the days strip').toBeTruthy()
    return wrap![1]!
  }

  for (const [name, render] of [
    ['letter', letter],
    ['immersive', immersive],
  ] as const) {
    it(`draws every bar, the subject label and the median inside the viewBox on the ${name}`, () => {
      const svg = phoneDays(render())
      const { W, H, texts } = svgBoxes(svg)
      expect(W).toBeLessThanOrEqual(400)

      // Five kept sales and the subject's own failed listing.
      const labels = texts.map((t) => t.text)
      for (const addr of ['730 Quince', '840 Quince', '1737 7th', '2485 7th', '735 Oak']) {
        expect(labels.some((l) => l.includes(addr)), `${addr} lost its row`).toBe(true)
      }
      expect(labels.some((l) => /days, no offer$/.test(l)), 'the punchline label').toBe(true)
      expect(labels).toContain('Redmond median 21 days')

      // Six bars plus the axis plus the median hairline, none off the frame.
      const lines = [...svg.matchAll(/<line ([^>]*)\/>/g)].map((m) => m[1]!)
      const at = (a: string, k: string) => Number(new RegExp(`${k}="([-\\d.]+)"`).exec(a)?.[1] ?? 0)
      const bars = lines.filter((a) => at(a, 'stroke-width') >= 3 && at(a, 'y1') === at(a, 'y2'))
      expect(bars).toHaveLength(6)
      for (const a of lines) {
        expect(at(a, 'x1')).toBeGreaterThanOrEqual(0)
        expect(at(a, 'x2')).toBeLessThanOrEqual(W)
        expect(at(a, 'y1')).toBeGreaterThanOrEqual(0)
        expect(at(a, 'y2')).toBeLessThanOrEqual(H)
      }

      // Every text box — address, value, median label — inside the frame.
      for (const t of texts) {
        const w = t.text.length * t.size * 0.58
        const left = t.anchor === 'end' ? t.x - w : t.anchor === 'middle' ? t.x - w / 2 : t.x
        expect(left, `"${t.text}" runs off the left edge`).toBeGreaterThanOrEqual(-0.5)
        expect(left + w, `"${t.text}" runs off the right edge`).toBeLessThanOrEqual(W + 0.5)
        expect(t.y).toBeLessThanOrEqual(H)
        expect(t.y).toBeGreaterThanOrEqual(0)
      }
    })
  }

  it('shows the phone layout only below 700px, and never on paper', () => {
    for (const css of [cmaStylesheet('https://ryan-realty.com'), immersiveStylesheet()]) {
      const flat = css.replace(/\s+/g, ' ')
      expect(flat).toMatch(/\.days-phone\s*\{\s*display:\s*none/)
      expect(flat).toMatch(
        /@media screen and \(max-width:\s*700px\)[^}]*\{[^@]*\.days-wide\s*\{\s*display:\s*none/,
      )
      expect(flat).toMatch(/@media print[^@]*\.days-phone\s*\{\s*display:\s*none\s*!important/)
    }
  })

  it('leaves the wide strip exactly as it was for the printed page', () => {
    const html = letter()
    expect(html).toContain('<div class="szn days-wide">')
    const wide = /<div class="szn days-wide">([\s\S]*?)<\/div>/.exec(html)![1]!
    expect(wide).toContain('viewBox="0 0 720')
  })
})

/**
 * tasteReview 2026-09-07, item 1: the document must not contradict itself and
 * no control may publish a false status. Every assertion below is a defect a
 * separate evaluator found by reading the rendered document.
 */
describe('tasteReview 1 — nothing in the document argues with itself', () => {
  it('makes [hidden] beat every author display rule, so the competition filter really filters', () => {
    // `.rival-grid{display:grid}` beat the UA `[hidden]{display:none}`, so
    // choosing "Under contract" hid the "For sale now" heading and left all
    // eight cards on screen under the surviving heading. Four for-sale homes
    // were presented to the seller as under contract.
    const css = immersiveStylesheet().replace(/\s+/g, ' ')
    expect(css).toMatch(/\[hidden\]\s*\{\s*display:\s*none\s*!important/)
    const gridRule = /\.rival-grid\s*\{\s*display:\s*grid/.test(css)
    expect(gridRule).toBe(true)
    expect(css.indexOf('[hidden]{display:none!important}')).toBeGreaterThan(-1)
  })

  it('prints no net figure at all when the row holds no itemised sheet', () => {
    // Round-four class A. The chapter used to compute the list minus the
    // median seller concession and head it as what the seller keeps, with the
    // commission, title, escrow and loan payoff nowhere in the arithmetic.
    const paid = comps.map((c, i) => ({ ...c, concessions: [4000, 0, 0, 10000, 0][i] ?? 0 }))
    for (const html of [
      letter({ comps: paid, pricing: { ...pricing, sellerNet: { expectedConcessions: 7000 } } as never }),
      immersive({ comps: paid, pricing: { ...pricing, sellerNet: { expectedConcessions: 7000 } } as never }),
    ]) {
      expect(html).toContain('Net at list')
      expect(html).toContain('the commission written into your listing agreement')
      expect(html).not.toContain('Net at list is the list price minus')
      expect(html).not.toContain('What you keep')
    }
  })

  it('itemises every deduction with its source when the row holds the sheet', () => {
    const sheet = {
      ...pricing,
      sellerNet: {
        basis: 'Commission is the rate in your listing agreement.',
        list: 389000,
        lines: [
          { label: 'Commission', amount: 19450, source: 'Listing agreement, 5.0%' },
          { label: 'Title and escrow', amount: 2900, source: 'Deschutes County schedule' },
        ],
        net: 366650,
        sentence: null,
        unknowns: ['your loan payoff'],
      },
    } as never
    for (const html of [letter({ pricing: sheet }), immersive({ pricing: sheet })]) {
      expect(html).toContain('Listing agreement, 5.0%')
      expect(html).toContain('Deschutes County schedule')
      expect(html).toContain('$366,650')
      expect(html).toContain('This does not include your loan payoff.')
      expect(html).not.toContain('What you keep')
    }
  })

  it('gives every sale ONE day count, and says which measure it is', () => {
    const html = letter()
    // 730 Quince: 1 day to an accepted offer, 25 days list to close. The card
    // printed "1 day to offer" and the price path "25 days", unlabelled.
    expect(html).toContain('offer in 1 day')
    expect(html).not.toMatch(/sold \$457K · 25 days/)
  })

  it('sources the three regional relist figures on the screen that prints them', () => {
    for (const html of [letter(), immersive()]) {
      expect(html).toContain('These three figures are regional, not this city alone')
      expect(html).toContain('matched pairs')
    }
  })

  it('sources the competition counts, on the SAME date the byline prints', () => {
    const html = letter()
    expect(html).toContain('Homes for sale and under contract in Redmond between')
    // generatedAtIso is 2026-09-06T00:00Z, which is Sep 5 in Central Oregon.
    // Every date on the document reads the same clock (CLAUDE.md §0).
    const byline = /Prepared ([A-Z][a-z]+ \d+, \d{4})/.exec(html)?.[1]
    expect(byline).toBeTruthy()
    expect(html).toContain(`from the Oregon Data Share MLS as of ${byline}.`)
  })

  it('snaps the curve readout to the six measured days', () => {
    const script = immersive()
    expect(script).not.toContain('Between two measured days, read off the line')
    expect(script).toContain("hit.setAttribute('aria-valuetext'")
  })

  it('never labels the unsold bar as days to an accepted offer', () => {
    expect(askOutcomeDaysPhrase({ key: 'did-not-sell', n: 375, medianDays: 118 })).toBe(
      'median 118 days on market before it came off',
    )
    expect(askOutcomeDaysPhrase({ key: 'sold-no-cut', n: 375, medianDays: 9 })).toBe(
      'median 9 days to an accepted offer',
    )
  })

  it('states where the ask sat against the range ONCE, in chapter 1', () => {
    const html = letter()
    // tasteReview round two, §3.C: printing it in chapter 1 AND on chapter 2's
    // subject card put "15.3 percent above the top" and "at the top of what
    // they closed at" four lines apart in one paragraph. One verdict, one
    // place; the dollars-a-foot reading stays on the card.
    expect(
      (html.match(/above the top of the range homes like yours sold in\./g) ?? []).length,
    ).toBe(1)
    expect(html).toContain('a foot, unadjusted.')
  })

  it('gives "homes like yours" one meaning and drops the unsourced city median', () => {
    const html = letter()
    // §3.B / §3.D. Chapter 1's zone is the ADJUSTED range and says so; chapter
    // 5 states the RAW close prices and says so; the pooled city median that
    // sat above every month drawn under it is gone.
    expect(html).toContain('where homes like yours sold, adjusted for date and size')
    // tasteReview round three, §3: the raw top of that sentence IS the ask
    // chapter 1 says failed, so the adjusted pair rides in the same breath.
    expect(html).toMatch(
      /sales behind your price sold for \$[\d,]+ to \$[\d,]+ before adjusting for date and size; adjusted, they support \$[\d,]+ to \$[\d,]+\./,
    )
    expect(html).not.toContain('is every Redmond home, all sizes')
    expect(html).not.toContain('532,311')
  })
})

/**
 * tasteReview 2026-09-07, item 2: the answer gets a picture, and the report
 * chrome leaves the letter.
 */
describe('tasteReview 2 — the answer is drawn, and nothing floats over it', () => {
  it('opens chapter 3 on a dot strip, before the method and the grid', () => {
    for (const html of [letter(), immersive()]) {
      const worth = html.slice(html.indexOf('The sales that set this price') - 12000)
      expect(html).toContain('class="szn worth-wide"')
      expect(html).toContain('class="szn worth-phone"')
      expect(html).toContain('Where the sales put this home, and where we would list it')
      // The strip sits ABOVE the method sentences and the grid.
      const strip = html.indexOf('class="szn worth-wide"')
      const grid = html.indexOf('table class="kv is-wide comp-matrix"')
      expect(strip).toBeGreaterThan(-1)
      expect(grid).toBeGreaterThan(strip)
      expect(worth.length).toBeGreaterThan(0)
    }
  })

  it('states the method in at most three sentences and moves the weight sentence under the grid', () => {
    const html = letter()
    expect((html.match(/class="method-line"/g) ?? []).length).toBeLessThanOrEqual(3)
  })

  it('carries no fixed-position chrome anywhere on the seller document', () => {
    const html = immersive()
    expect(html).not.toContain('id="bar"')
    expect(html).not.toContain('id="prog"')
    expect(html).not.toMatch(/position\s*:\s*fixed/)
    // Print report is a quiet link in the closing chapter, not a button pinned
    // over every screen.
    expect(html).toContain('class="print-out r"')
    expect(html).toContain('data-rr-track="cma-print"')
  })

  it('draws its own tappable pins over the map tile', () => {
    const html = letter({
      mapOverlay: {
        view: { centerLat: 44.2726, centerLng: -121.1745, zoom: 15, width: 640, height: 360 },
        pins: [
          { n: null, lat: 44.272, lng: -121.174 },
          { n: 1, lat: 44.273, lng: -121.175 },
        ],
      },
    } as never)
    expect(html).toContain('class="pin-map-frame"')
    expect(html).toContain('class="pin-hit is-subject"')
    expect(html).toMatch(/<button type="button" class="pin-hit" data-comp="1" data-pin="1"/)
    expect(html).toContain('aria-label="1. 730 Quince"')
    // A cropped tile and a percentage-positioned pin cannot both be right.
    for (const css of [cmaStylesheet('https://ryan-realty.com'), immersiveStylesheet()]) {
      expect(css.replace(/\s+/g, ' ')).toMatch(
        /\.pin-map-frame \.pin-map ?\{[^}]*(max-height: ?none)/,
      )
    }
  })

  it('rebuilds chapter 5 with a rounded month axis so a flat market looks flat', () => {
    // A 13 percent spread must not fill the plot: the axis floor is a round
    // number, and the drawn band is never less than a quarter of the ceiling.
    expect(niceAxis([461000, 530000])).toEqual({ floor: 400000, ceil: 540000 })
    expect(niceAxis([100, 100]).ceil).toBe(100)
    expect(niceAxis([100, 100]).floor).toBeLessThanOrEqual(75)
  })

  it('draws every outcome bar in full navy, and gives the reader group the weight', () => {
    const svg = askOutcomeBarsSvg(
      {
        city: 'Redmond',
        windowMonths: 12,
        groups: [
          { key: 'sold-no-cut', n: 375, medianDays: 9 },
          { key: 'sold-after-cut', n: 180, medianDays: 58, medianCutPct: 4.1 },
          { key: 'did-not-sell', n: 232, medianDays: 118 },
        ],
      },
      null,
    )
    // Navy at 40 percent alpha over cream IS #97a0ac, and three separate
    // readers called every tinted bar grey. Full navy on all three; the
    // reader's own group carries twice the weight.
    const bars = [...svg.matchAll(/stroke="([^"]+)" stroke-width="(\d+)"/g)]
      .filter((m) => Number(m[2]) >= 5)
      .map((m) => ({ colour: m[1]!, weight: Number(m[2]) }))
    expect(bars).toHaveLength(3)
    for (const b of bars) expect(b.colour).toBe('#102742')
    const mine = askOutcomeBarsSvg(
      {
        city: 'Redmond',
        windowMonths: 12,
        groups: [
          { key: 'sold-no-cut', n: 375, medianDays: 9 },
          { key: 'sold-after-cut', n: 180, medianDays: 58 },
          { key: 'did-not-sell', n: 232, medianDays: 118 },
        ],
      },
      'did-not-sell',
    )
    expect(mine).toContain('Came off unsold · yours is in this group')
    const weights = [...mine.matchAll(/stroke="#102742" stroke-width="(\d+)"/g)].map((m) => Number(m[1]))
    expect(Math.max(...weights)).toBeGreaterThan(Math.min(...weights))
  })

  it('teaches no interaction in a caption', () => {
    const html = immersive()
    for (const caption of [
      'Tap a price change to read its date',
      'Tap a bar for the listings behind it',
      'Tap a month for its median close',
      'Drag along the curve, or use the arrow keys',
    ]) {
      expect(html, `instruction caption still shipping: ${caption}`).not.toContain(caption)
    }
    // The affordance is on the control instead.
    expect(html).toContain('pp-chev')
  })

  it('answers a short mark AT the mark, not a chart height below it', () => {
    const js = immersiveInteractionScript()
    const css = immersiveInteractionCss()
    // The evaluator on the timeline cut: "the answer appears 200px below the
    // mark you tapped, so your eye leaves the graphic. Annotate the mark."
    expect(js).toContain("var GROUPS=[['.tl-mark','',1],['.bar-row','',0],['.month-mark','',1],['.ws-dot','',1]]")
    expect(js).toContain("g.setAttribute('class','rr-note')")
    expect(js).toContain('if(g[2])note(svg,n,text)')
    // The sentence still reaches a screen reader; it only leaves the flow.
    expect(js).toContain("if(g[2])read.classList.add('is-sr')")
    expect(css).toMatch(/\.rr-read\.is-sr\{[^}]*clip-path:inset\(50%\)/)
    expect(css).toContain('.rr-note text{')
  })

  it('makes a bar tap say something the bar does not already print', () => {
    const svg = askOutcomeBarsSvg(
      {
        city: 'Redmond',
        windowMonths: 12,
        groups: [
          { key: 'sold-no-cut', n: 375, medianDays: 8 },
          { key: 'sold-after-cut', n: 214, medianDays: 57 },
          { key: 'did-not-sell', n: 232, medianDays: 117 },
        ],
      },
      null,
    )
    // Every figure the readout carried was already drawn on the row, which is
    // decoration. The gap between two bars is the one thing three bars on one
    // axis are for, and it is nowhere on the chart.
    expect(svg).toContain('49 days longer than the homes that sold without a price cut')
    expect(svg).toContain('109 days longer than the homes that sold without a price cut')
    expect(svg).toContain('109 days faster than the homes that came off unsold')
  })

  it('draws the sale number as the map pin it keys, never as a rank', () => {
    const html = immersive()
    // Sorting the grid reorders the columns; the pins keep their numbers,
    // because a number here is an identity. Drawn as the pin's own badge it
    // says so, and no caption has to.
    expect(html).toContain('class="pin-badge"')
    // In the SORTABLE grid and its cards. The number still reads as "1. 730
    // Quince" inside the two charts that list the sales in a fixed order,
    // where nothing reorders and a key before a name is just a key.
    expect(html).not.toMatch(/class="matrix-addr"[^>]*>\s*\d+\./)
    expect(html).not.toMatch(/class="comp-stack-addr"[^>]*>\s*\d+\./)
    expect(immersiveStylesheet()).toContain('.pin-badge{')
  })

  it('gives the closing two real buttons that carry identity', () => {
    const html = immersive()
    expect(html).toContain('class="btn pri"')
    expect(html).toContain('class="btn sec ghost"')
    expect(html).toContain('class="sc sc-navy pack"')
    expect(html).toContain('next-note')
  })
})

/**
 * tasteReview 2026-09-07, item 3: survivable on a phone, and finish the close.
 */
describe('tasteReview 3 — the phone document, and the close', () => {
  it('leads chapter 3 on a phone with their own home', () => {
    const html = immersive()
    const stack = html.slice(html.indexOf('class="comp-stack"'))
    const first = stack.split('comp-stack-card')[1] ?? ''
    expect(first).toContain('is-yours')
    expect(first).toContain('Your home · 2465 7th')
    expect(first).toContain('Listed $460,000')
  })

  it('draws every price path exactly once', () => {
    const html = immersive()
    expect(html).not.toContain('How each of these sales was priced')
    // One sparkline per sale in the grid, one full drawing per phone card.
    expect((html.match(/class="pp-spark"/g) ?? []).length).toBe(5)
  })

  it('gives every chart mark a real tap target, not a 7px dot', () => {
    const html = immersive()
    // The chapter 1 cut marker shipped as a 7x7px hit area.
    expect(html).toMatch(/<g class="tl-mark"[^>]*>\s*<circle [^>]*r="24" fill="transparent"/)
    // Every dated cut on a price path carries one too.
    const withCut = priceHistoryLineSvg(
      pricePathFromFinalCycle(
        {
          listDate: '2026-02-26',
          initialAsk: 475000,
          cuts: [{ date: '2026-07-28', ask: 460000 }],
          cutsDated: true,
          finalAsk: 460000,
          offMarketDate: '2026-09-01',
          status: 'withdrawn',
          days: 187,
        },
        '2465 7th',
      )!,
    )
    expect(withCut).toMatch(/<g class="pp-cut"[^>]*>\s*<circle [^>]*r="24" fill="transparent"/)
  })

  it('raises every block address link and pill to 44px on a phone', () => {
    const css = immersiveStylesheet().replace(/\s+/g, ' ')
    expect(css).toMatch(/a\.dns-addr[^{]*\{[^}]*min-height:\s*44px/)
    expect(css).toMatch(/\.print-out a\s*\{[^}]*min-height:\s*44px/)
    const controls = immersiveInteractionCss().replace(/\s+/g, ' ')
    expect(controls).toMatch(/\.rr-btn\{[^}]*min-height:\s*44px/)
    expect(controls).toMatch(/\.pp-toggle\{[^}]*min-height:\s*44px/)
  })

  it('announces the slider from the first render, and the bars as toggles', () => {
    const script = immersiveInteractionScript()
    expect(script).toContain("hit.setAttribute('aria-valuenow'")
    expect(script).toContain("hit.setAttribute('aria-valuetext'")
    // Set before any key press: put(...) runs once at the end of the block, and
    // it PRINTS the reading too — a visible handle with a dashed rule and no
    // label read to three separate reviewers as a hover state baked into the
    // screenshot.
    expect(script).toMatch(/put\(Math\.min\(3,pts\.length-1\)\)/)
    expect(script).toContain("n.setAttribute('aria-pressed','false')")
  })
})

/**
 * tasteReview 2026-09-07, item 4: break the eyebrow → title → figure →
 * sentence → source repetition where the chapters allow it.
 */
describe('tasteReview 4 — chapter 2b is one composed spread', () => {
  const withChapter2 = () =>
    args({
      market: {
        ...(args().market as object),
        offerTiming: {
          city: 'Redmond',
          windowMonths: 12,
          n: 678,
          medianDays: 26,
          points: [
            { days: 7, pct: 31.2 },
            { days: 14, pct: 44.1 },
            { days: 30, pct: 54.0 },
            { days: 60, pct: 68.9 },
            { days: 90, pct: 79.8 },
            { days: 180, pct: 95.6 },
          ],
        },
        askOutcome: {
          city: 'Redmond',
          windowMonths: 12,
          groups: [
            { key: 'sold-no-cut', n: 375, medianDays: 8, medianSoldToOriginalAskPct: 100 },
            { key: 'sold-after-cut', n: 303, medianDays: 67, medianCutPct: 3.9 },
            { key: 'did-not-sell', n: 232, medianDays: 118 },
          ],
        },
      },
    } as never)

  it('puts the curve and the bars side by side, and stacks them on a phone', () => {
    const html = renderCmaHtml(withChapter2()).html
    expect(html).toContain('<div class="spread">')
    expect((html.match(/class="spread-col"/g) ?? []).length).toBe(2)
    const css = immersiveStylesheet().replace(/\s+/g, ' ')
    expect(css).toMatch(/\.spread\{[^}]*grid-template-columns:\s*1fr 1fr/)
    expect(css).toMatch(/max-width:\s*900px\)\{\.spread\{grid-template-columns:\s*1fr/)
    // A ~520px column carries the drawn-to-fit layout, never the 720-unit one
    // scaled into half a screen.
    expect(css).toContain('.spread .timing-wide,.spread .outcome-wide{display:none}')
  })

  it('carries ONE source line for the whole chapter, not one per figure', () => {
    const html = renderCmaHtml(withChapter2()).html
    const chapter = html.slice(html.indexOf('What overpricing costs'))
    const block = chapter.slice(0, chapter.indexOf('</section>'))
    const sources = block.match(/from the Oregon Data Share MLS/g) ?? []
    expect(sources).toHaveLength(1)
    expect(block).toContain('Single-family listings in Redmond over the last 12 months')
    expect(block).toContain('Each figure above counts the listings it draws')
  })

  it('keeps every figure inside its own frame in both layouts', () => {
    const html = renderCmaHtml(withChapter2()).html
    expect(html).toContain('The first price decides the days')
    expect(html).toContain('When homes like yours get their offer')
  })
})

/**
 * tasteReview round three, §4.1 and §5.1 — the story chapter 1 tells is chosen
 * by the gap between the ask that failed and the top of the range, not written
 * into the chapter.
 *
 * The corrected pricing engine moved 2465 7th's ask from 15.3 percent above
 * the top of the range to 3.8 percent above it, and the document went on
 * arguing overpricing under a chapter titled "What overpricing costs" — while
 * chapter 5, four screens later, printed a raw top equal to the ask that
 * failed. Every assertion here is against the RENDERED document, in both
 * renderers, because the defect was only ever visible there.
 */
describe('chapter 1 — the story the numbers carry', () => {
  /** The final cycle, so the reading has days to talk about. */
  const cycle = {
    findings: (expiredAudit as unknown as { findings: unknown[] }).findings,
    finalCycle: {
      listDate: '2026-02-26',
      initialAsk: 475000,
      cuts: [{ date: '2026-05-14', ask: 460000 }],
      offMarketDate: '2026-09-01',
      status: 'Withdrawn',
      days: 187,
    },
    // $460,000 held 110 of the 187 days, so it is the ask the story is about
    // and the one every gap below is measured from (class B).
    askExposure: {
      segments: [
        { ask: 475000, from: '2026-02-26', to: '2026-05-14', days: 77, sharePct: 41.2, pctAboveRangeTop: null },
        { ask: 460000, from: '2026-05-14', to: '2026-09-01', days: 110, sharePct: 58.8, pctAboveRangeTop: null },
      ],
      dominant: 460000,
      final: 460000,
      sentence: 'It asked $475,000 for 77 days, then $460,000 for 110.',
    },
  } as unknown as ExpiredAuditData

  /** The same fixture with the value range moved, which is what moves the gap. */
  function withRange(valueLow: number, valueHigh: number): Partial<RenderCmaArgs> {
    return {
      expiredAudit: cycle,
      pricing: {
        ...(pricing as unknown as Record<string, unknown>),
        valueLow,
        valueHigh,
        conservative: valueLow,
        highEnd: valueHigh,
        recommended: Math.round((valueLow + valueHigh) / 2),
      },
    } as unknown as Partial<RenderCmaArgs>
  }

  const WALK =
    'days without an offer points at something other than the number. We would walk the house before saying what.'

  it('keeps the overpricing story when the ask was more than 10 percent above the range', () => {
    for (const html of [letter(withRange(380000, 398000)), immersive(withRange(380000, 398000))]) {
      expect(html).toContain('15.6 percent above the top of the range homes like yours sold in.')
      expect(html).toContain('It sat 187 days.')
      expect(html).toContain('What overpricing costs.')
      expect(html).not.toContain(WALK)
    }
  })

  it('states the facts and stops when the ask was near the range', () => {
    for (const html of [letter(withRange(420000, 445000)), immersive(withRange(420000, 445000))]) {
      expect(html).toContain('3.4 percent above the top of the range homes like yours sold in.')
      expect(html).toContain('It sat 187 days without an offer.')
      expect(html).toContain('Half of the homes that sold in Redmond had an offer inside 21 days.')
      expect(html).toContain(`At a price near the range, 187 ${WALK}`)
      // The title is the claim, so the title changes. The exhibits under it
      // measure the city, not this listing, so they do not.
      expect(html).toContain('What price and time look like in Redmond.')
      expect(html).not.toContain('What overpricing costs.')
      expect(html).toContain('The listings near you that did not sell.')
    }
  })

  it('says the ask was inside the range when it was, and still asks the question', () => {
    for (const html of [letter(withRange(440000, 470000)), immersive(withRange(440000, 470000))]) {
      expect(html).toContain('The asking price was inside the range homes like yours sold in.')
      expect(html).toContain('It sat 187 days without an offer.')
      expect(html).toContain(`At a price inside the range, 187 ${WALK}`)
      expect(html).toContain('What price and time look like in Redmond.')
      expect(html).not.toContain('What overpricing costs.')
    }
  })

  it('names no cause it cannot measure, in any of the three', () => {
    for (const range of [
      [380000, 398000],
      [420000, 445000],
      [440000, 470000],
    ] as const) {
      const html = letter(withRange(range[0], range[1]))
      // Condition, photography, access and terms are nowhere on the row.
      expect(html).not.toMatch(/because (?:the|it|your) (?:condition|photos|home was)/i)
      expect(html).not.toContain('something was wrong with')
    }
  })

  it('reconciles chapter 5 raw closes to the adjusted pair in one breath', () => {
    const html = letter(withRange(420000, 445000))
    expect(html).toMatch(
      /sold for \$410,000 to \$460,000 before adjusting for date and size; adjusted, they support \$420,000 to \$445,000\./,
    )
  })
})
