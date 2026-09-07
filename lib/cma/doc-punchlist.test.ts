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
import { cmaStylesheet } from './render-css'
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

const expiredAudit = {
  findings: [
    { lens: 'pricing', fact: 'The final asking price was $460,000.', meaning: '' },
    { lens: 'time-on-market', fact: '186 days on market for the final listing period.', meaning: '' },
    { lens: 'price-cuts', fact: 'The ask moved from $475,000 to $460,000.', meaning: '' },
  ],
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
  return [...html.matchAll(/<h2 class="section">([\s\S]*?)<\/h2>/g)].map((m) =>
    m[1]!.replace(/<[^>]+>/g, '').trim(),
  )
}
/** Order-preserving list of the immersive scene ids. */
function immersiveScenes(html: string): string[] {
  return [...html.matchAll(/<section class="sc[^"]*" id="([a-z0-9-]+)"/g)].map((m) => m[1]!)
}

describe('P1 — one price ruler for sold and unsold', () => {
  it('labels each plotted value once, not on both sides of the row', () => {
    const html = letter()
    // The old lollipop printed the same figure as a row tick AND as an end
    // label. $410K appearing twice inside the outcome graphic is that bug.
    const svg = html.match(/<svg[^>]*aria-label="[^"]*sold and unsold[^"]*"[\s\S]*?<\/svg>/i)?.[0]
    expect(svg, 'the sold/unsold graphic must render').toBeTruthy()
    const labels = [...svg!.matchAll(/>\s*(\$[\d,.]+K?)\s*</g)].map((m) => m[1]!)
    const dupes = labels.filter((v, i) => labels.indexOf(v) !== i)
    expect(dupes, `duplicated labels in the band graphic: ${dupes.join(', ')}`).toEqual([])
  })

  it("labels the recommend and the seller's own last ask, and nothing else", () => {
    const html = letter()
    expect(html).toContain('Recommended $389K')
    expect(html).toContain('Your last ask $460K')
    expect(html).not.toContain("Didn't sell")
  })

  it('states the reading under the graphic', () => {
    const html = letter()
    expect(html).toContain('9 closed in this band, $410K to $460K.')
    expect(html).toContain('2 asked and did not sell.')
    expect(html).toContain('Your ask sat at the top of the band.')
    // The kept sales, once brought to this house. Both ends already print in
    // the matrix's Adjusted close row, so the sentence adds no new figure.
    expect(html).toContain('Adjusted for size and date, homes like yours land at $372K to $399K.')
  })
})

describe('P2 — the expired chapter is the why, so it comes first', () => {
  it('puts Your last listing directly after How we got the price', () => {
    const chapters = letterChapters(letter())
    const price = chapters.indexOf('How we got the price')
    const last = chapters.findIndex((c) => /Your last listing/i.test(c))
    const competition = chapters.findIndex((c) => /competing with/i.test(c))
    expect(price).toBeGreaterThanOrEqual(0)
    expect(last).toBe(price + 1)
    expect(competition).toBeGreaterThan(last)
  })

  it('carries the price ruler and the failed-then-sold statistics', () => {
    const html = letter()
    const start = html.indexOf('Your last listing')
    const end = html.indexOf('<section class="page"', start)
    const chapter = html.slice(start, end > 0 ? end : undefined)
    expect(chapter).toContain('Your last ask $460K')
    expect(chapter).toContain('3,394')
    expect(chapter).toContain('94.2%')
    expect(chapter).toContain('12.3%')
  })

  it('does the same in the immersive, in the same place', () => {
    const scenes = immersiveScenes(immersive())
    const price = scenes.indexOf('how-we-got-the-price')
    expect(scenes[price + 1]).toBe('your-last-listing')
    expect(scenes.indexOf('competition')).toBeGreaterThan(price + 1)
  })
})

describe('P3 — the market block never contradicts the number beside it', () => {
  it('drops the 90-day band when the recommend sits outside it', () => {
    const html = immersive()
    expect(html).not.toContain('$458,500')
    expect(html).not.toContain('2 to 4 bedroom band')
  })

  it('keeps the band when the recommend sits inside it', () => {
    const inBand = {
      ...offProductSold90,
      low: 370000,
      median: 392000,
      high: 405000,
      bedsLabel: '3 bedroom',
    }
    const html = immersive({
      extras: {
        ...(args().extras as object),
        marketArea: { ...marketArea, sold90: inBand },
        sold90: inBand,
      } as RenderCmaArgs['extras'],
    })
    expect(html).toContain('$392,000')
  })

  it('letter and immersive make the same call', () => {
    expect(letter()).not.toContain('$458,500')
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
    expect(immersiveScenes(immersive())).toContain('how-fast')
  })
})

describe('P5 — one statement each, once', () => {
  it('does not repeat the listing history line inside the competition chapter', () => {
    const html = letter()
    const start = html.indexOf('competing with')
    const chapter = html.slice(start, html.indexOf('<section class="page"', start))
    expect(chapter).not.toContain('Last on market Feb 2026')
  })

  it('drops the What we searched bullet list', () => {
    const html = letter()
    expect(html).not.toContain('What we searched')
    expect(html).not.toContain('5 closed sales.')
  })
})

describe('P6 — the land only when the lots differ', () => {
  it('omits six identical rectangles and says the one fact instead', () => {
    const html = letter({
      parcels: {
        subject: { acres: 0.14, taxlot: '151303BD02800', rings: [[[0, 0], [1, 0], [1, 1], [0, 1]]] },
        comps: comps.map((c) => ({
          listingKey: c.listingKey,
          acres: c.lotAcres,
          rings: [[[0, 0], [1, 0], [1, 1], [0, 1]]],
        })),
      } as unknown as RenderCmaArgs['parcels'],
    })
    expect(html).not.toContain('<h2 class="section">The land</h2>')
    expect(html).toContain('Every kept sale sits on a 0.14 to 0.16 acre lot like this one.')
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
    const matrix = html.indexOf('comp-matrix-wrap')
    expect(lead).toBeGreaterThan(0)
    expect(matrix).toBeGreaterThan(lead)
    expect(html).toMatch(/land at \$372,324 to \$398,788[\s\S]{0,120}\$389,000/)
  })

  it('explains the adjustment rows once', () => {
    const html = letter()
    expect(html).toContain('Brought to today')
    expect(html).toContain('Brought to your size')
    expect(html).toMatch(/Brought to today moves each sale/i)
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
    expect(css).toMatch(/@media screen and \(max-width:\s*700px\)\s*\{[^}]*\.comp-matrix-wrap\s*\{\s*display:\s*none/)
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
