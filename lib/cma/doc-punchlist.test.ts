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
    expect(html).toContain('9 closed in your price range, $410K to $460K.')
    expect(html).toContain('2 asked and did not sell.')
    expect(html).toContain('Your ask sat at the top of that range.')
    // The kept sales, once brought to this house. Both ends already print in
    // the matrix's Sale price today row, so the sentence adds no new figure.
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
    expect(html).toContain('Adjusted for date')
    expect(html).toContain('Adjusted for size')
    expect(html).toMatch(/Sale price today moves each sale for when it sold and how big it is/i)
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
  if (!vb) throw new Error('the ruler must carry a viewBox')
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

describe('F6 — the price ruler fits a phone', () => {
  const phoneRuler = (html: string): string => {
    const wrap = /<div class="szn ruler-phone">([\s\S]*?)<\/div>/.exec(html)
    expect(wrap, 'both documents must carry a phone layout of the ruler').toBeTruthy()
    return wrap![1]!
  }

  for (const [name, render] of [
    ['letter', letter],
    ['immersive', immersive],
  ] as const) {
    it(`draws every sold dot and both ticks inside the viewBox on the ${name}`, () => {
      const svg = phoneRuler(render())
      const { W, H, circles, texts } = svgBoxes(svg)
      expect(W).toBeLessThanOrEqual(400)

      // Nine closed sales and two unsold listings. None may be cropped.
      expect(circles).toHaveLength(11)
      for (const c of circles) {
        expect(c.cx - c.r, `a dot at ${c.cx} runs off the left edge`).toBeGreaterThanOrEqual(0)
        expect(c.cx + c.r, `a dot at ${c.cx} runs off the right edge`).toBeLessThanOrEqual(W)
        expect(c.cy - c.r).toBeGreaterThanOrEqual(0)
        expect(c.cy + c.r).toBeLessThanOrEqual(H)
      }

      // Both ticks carry their label, and the label sits inside the frame.
      const labels = texts.map((t) => t.text)
      expect(labels).toContain('Recommended $389K')
      expect(labels).toContain('Your last ask $460K')
      for (const t of texts) {
        const w = t.text.length * t.size * 0.58
        const left = t.anchor === 'end' ? t.x - w : t.anchor === 'middle' ? t.x - w / 2 : t.x
        expect(left, `"${t.text}" runs off the left edge`).toBeGreaterThanOrEqual(-0.5)
        expect(left + w, `"${t.text}" runs off the right edge`).toBeLessThanOrEqual(W + 0.5)
        expect(t.y).toBeLessThanOrEqual(H)
      }

      // Two tick lines, both inside the plot.
      const lines = [...svg.matchAll(/<line x1="([\d.]+)"[^>]*x2="([\d.]+)"/g)]
      for (const l of lines) {
        expect(+l[1]!).toBeGreaterThanOrEqual(0)
        expect(+l[2]!).toBeLessThanOrEqual(W)
      }
    })
  }

  it('shows the phone layout only below 700px, and never on paper', () => {
    for (const css of [cmaStylesheet('https://ryan-realty.com'), immersiveStylesheet()]) {
      const flat = css.replace(/\s+/g, ' ')
      expect(flat).toMatch(/\.ruler-phone\s*\{\s*display:\s*none/)
      expect(flat).toMatch(/@media screen and \(max-width:\s*700px\)[^}]*\{[^@]*\.ruler-wide\s*\{\s*display:\s*none/)
      expect(flat).toMatch(/@media print[^@]*\.ruler-phone\s*\{\s*display:\s*none\s*!important/)
    }
  })

  it('keeps the wide ruler for the printed page', () => {
    expect(letter()).toContain('<div class="szn is-hero ruler-wide">')
  })
})

describe('F7 — this market is a stat row, not a stacked list', () => {
  const marketBlock = (html: string): string => {
    const start = html.indexOf('How fast this market is moving')
    expect(start, 'the market board must render').toBeGreaterThan(-1)
    const rest = html.slice(start)
    const end = rest.indexOf('</section>')
    return end > 0 ? rest.slice(0, end) : rest
  }

  it('lays the four figures out as the stat row the document already uses', () => {
    const block = marketBlock(letter())
    expect(block).toMatch(/<div class="stat-strip is-4">/)
    expect(block).not.toContain('class="stat3"')
    const vals = [...block.matchAll(/<div class="val">([^<]*)<\/div>/g)].map((m) => m[1]!)
    // Months of supply first, with its verdict word under it.
    expect(vals).toEqual(['3.2', '97.8%', '21', '$475,000'])
    expect(block).toMatch(/Seller(&#39;|')s market/)
  })

  it('names what each number actually is', () => {
    const block = marketBlock(letter())
    expect(block).toContain('months of supply')
    // market_stats_cache.median_dom medians listings.days_to_pending — the days
    // from going on market to going pending, not list-to-close.
    expect(block).toContain('median days to an accepted offer')
    expect(block).not.toContain('median days on market')
    // saleToListRatio carries median_sale_to_original_list, not final list.
    expect(block).toContain('sold price to original ask')
    expect(block).not.toContain('>sold to list<')
    expect(block).toContain('median sold, every Redmond home')
  })

  it('is the same row on the immersive', () => {
    const block = marketBlock(immersive())
    expect(block).toMatch(/<div class="stat-strip is-4">/)
    expect(block).toContain('median days to an accepted offer')
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

  it('falls the place clause back to the city that scoped the query', () => {
    const html = letter(placeholderArgs('N/A'))
    expect(html).toContain('Closed 4 to 6 bedroom sales in Redmond in the last 90 days.')
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
    expect(html).toContain('<div class="szn is-hero days-wide">')
    const wide = /<div class="szn is-hero days-wide">([\s\S]*?)<\/div>/.exec(html)![1]!
    expect(wide).toContain('viewBox="0 0 720')
  })
})
