/**
 * THE PAGE CONTRACT, applied to the real CMA renderer.
 *
 * The bug this locks: `.page` was a fixed 11in box with `overflow: hidden`, so
 * a section whose content ran long had the overflow CLIPPED — the rows were
 * absent from the delivered PDF with no error and no visible truncation. A
 * measured delivered CMA lost 9px of a comparable's stat line that way, and
 * before it clipped it crowded the footer band.
 *
 * The overstuffed fixture below is the regression: a comp set and narrative
 * far larger than one sheet holds. Under the old CSS its content vanished.
 * Under the contract it becomes more sheets, and every sheet is measured.
 */
import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import puppeteer, { type Browser } from 'puppeteer-core'
import { renderCmaHtml, type RenderCmaArgs } from './render'
import type { CmaAdjustedComp, CmaBroker, CmaPricing, CmaSubject } from './types'
import type { CmaBandRival, CmaBandRivalSet } from './band-rivals'
import type { CmaExpiredPeer, CmaExpiredPeerSet } from './market-status'
import type { CompArea } from '@/lib/pricing/comp-area'
import { inspectPdfPageSafety, formatViolations } from '@/lib/pdf/assert-page-safety'
import { pdfRenderOptions, CMA_MARGIN_IN } from '@/lib/pdf/page-contract'

const CHROME =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  process.env.CHROME_PATH ||
  (process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/usr/bin/google-chrome')
const hasChrome = existsSync(CHROME)

const subject: CmaSubject = {
  listingKey: null,
  mlsNumber: null,
  streetAddress: '123 Test Way',
  city: 'Bend',
  state: 'OR',
  postalCode: '97701',
  subdivision: 'N/A',
  latitude: 44.06,
  longitude: -121.31,
  beds: 3,
  baths: 2,
  sqft: 1800,
  lotAcres: 0.2,
  propertySubType: null,
  yearBuilt: 2005,
  garageSpaces: 2,
  photoUrl: null,
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: 4200,
  standardStatus: null,
  lastListPrice: null,
  lastListDate: null,
  listingHistoryLine: null,
}

function comp(i: number): CmaAdjustedComp {
  return {
    listingKey: `C${i}`,
    mlsNumber: `2200000${i}`,
    address: `${400 + i} Comparable Street Northwest`,
    city: 'Bend',
    subdivision: null,
    latitude: 44.05,
    longitude: -121.3,
    beds: 3,
    baths: 2,
    sqft: 1850 + i,
    lotAcres: 0.22,
    propertySubType: null,
    yearBuilt: 2006,
    photoUrl: null,
    publicRemarks: null,
    viewDescription: null,
    taxAnnual: 4300,
    listPrice: 720000,
    closePrice: 712000 + i * 1000,
    closeDate: '2026-05-15',
    daysToOffer: 12,
    domTotal: 12,
    selectionTier: 'primary',
    proximity: '1.75 miles NW',
    competingArea: null,
    monthsSinceClose: 2,
    timeAdjustment: 0,
    timeAdjustedPrice: 712000,
    ppsfTimeAdjusted: 385,
    sizeAdjustment: -2000,
    adjustedPrice: 710000,
    weight: 1,
  } as CmaAdjustedComp
}

const pricing: CmaPricing = {
  method1Low: 690000,
  method1Mid: 715000,
  method1High: 740000,
  method2: 718000,
  method3: 712000,
  convergenceSpreadPct: 1.2,
  converged: true,
  conservative: 705000,
  recommended: 715000,
  highEnd: 735000,
  valueLow: 690000,
  valueHigh: 740000,
  confidence: 'High',
  confidenceReason: 'tight comp set',
  needsReview: false,
  reviewReason: null,
  compPpsfCv: 0.04,
  priceOverride: null,
  improvementsValueAdd: null,
  notes: [],
} as CmaPricing

const broker: CmaBroker = {
  id: 'id-matt',
  slug: 'matthew-ryan',
  displayName: 'Matt Ryan',
  title: 'Owner & Principal Broker',
  licenseNumber: '201206613',
  email: 'matt@ryan-realty.com',
  phone: '541.703.3095',
  photoUrl: '/images/brokers/ryan-matt.png',
} as CmaBroker

function args(overrides: Partial<RenderCmaArgs> = {}): RenderCmaArgs {
  return {
    subject,
    comps: [comp(1)],
    market: null,
    pricing,
    broker,
    client: { name: 'Test Seller', email: null, phone: null, notes: null },
    mapDataUri: null,
    generatedAtIso: '2026-07-30T00:00:00.000Z',
    subjectTrace: 'subject trace',
    compTrace: ['comp trace'],
    excludedOutliers: [],
    sellerImprovementsText: null,
    site: null,
    expiredAudit: null,
    development: null,
    rental: null,
    ...overrides,
  } as RenderCmaArgs
}

async function renderPdf(html: string): Promise<Buffer> {
  let browser: Browser | null = null
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    const page = await browser.newPage()
    await page.setViewport({ width: 1024, height: 1320, deviceScaleFactor: 1 })
    // Offline: brand fonts and the logo live on the site. Geometry does not
    // depend on them resolving, and a network wait makes the test flaky.
    await page.setRequestInterception(true)
    page.on('request', (r) => {
      if (/^https?:/.test(r.url())) r.abort().catch(() => {})
      else r.continue().catch(() => {})
    })
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    await page.emulateMediaType('print')
    const pdf = await page.pdf(
      pdfRenderOptions({ footerLeft: 'Ryan Realty · 541.703.3095' }, CMA_MARGIN_IN),
    )
    return Buffer.from(pdf)
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}

async function expectClean(a: RenderCmaArgs, label: string, extraCss?: string) {
  let { html } = renderCmaHtml(a)
  if (extraCss) html = html.replace('</head>', `<style>${extraCss}</style></head>`)
  const pdf = await renderPdf(html)
  const report = await inspectPdfPageSafety(pdf, { margins: CMA_MARGIN_IN })
  if (!report.ok) {
    throw new Error(
      `${label}: ${report.violations.length} violation(s) over ${report.pageCount} sheet(s): ${formatViolations(report.violations)}`,
    )
  }
  return report
}

describe.skipIf(!hasChrome)('CMA page safety', () => {
  it('a baseline CMA keeps every sheet inside the contract', async () => {
    const report = await expectClean(args(), 'baseline')
    expect(report.pageCount).toBeGreaterThan(3)
  }, 90_000)

  it('an overstuffed CMA FLOWS onto clean extra sheets', async () => {
    // Twelve comps and a long improvements narrative — far past what one sheet
    // holds. Under the old fixed-height model this rendered "successfully" with
    // the excess clipped away and gone. Under the flowing model it becomes more
    // sheets, every one of them inside the contract.
    const long = Array.from(
      { length: 60 },
      (_, i) =>
        `Seller improvement ${i + 1}: full interior repaint, new hardware, and refinished flooring throughout the main level.`,
    ).join(' ')
    const report = await expectClean(
      args({
        comps: Array.from({ length: 12 }, (_, i) => comp(i + 1)),
        sellerImprovementsText: long,
        compTrace: Array.from({ length: 24 }, (_, i) => `comp trace row ${i + 1} with a long source citation`),
      }),
      'overstuffed',
    )
    // The floors moved down with CMA_REIMAGINED_2026-09-07.md, which cut four
    // chapters off the document. What they prove is unchanged: the overstuffed
    // case still spills onto several sheets, and expectClean above already
    // asserted every one of them is inside the contract.
    expect(report.pageCount).toBeGreaterThan(5)
  }, 120_000)

  it('a section long enough to spill gets a properly margined continuation sheet', async () => {
    // The exact shape that broke the library: one section holding more than a
    // sheet. The old model clipped it; the intermediate un-clipped model let it
    // run to the paper edge on the continuation sheet. It must now simply be
    // two clean sheets.
    const huge = Array.from(
      { length: 200 },
      (_, i) => `Improvement note ${i + 1} describing work completed on the property in detail.`,
    ).join(' ')
    const report = await expectClean(args({ sellerImprovementsText: huge }), 'spilling-section')
    expect(report.pageCount).toBeGreaterThan(3)
  }, 120_000)

  it('.page never clips its own overflow', async () => {
    // The mechanism check, independent of any one fixture: a CMA stylesheet
    // that reintroduces overflow:hidden with a fixed height silently destroys
    // content, and no geometry check on the PDF can see what was never drawn.
    const { html } = renderCmaHtml(args())
    // Both the screen rule and the @media print rule. The print one is the
    // dangerous one — it governs the PDF and is easy to miss when reading the
    // stylesheet top to bottom.
    expect(html).not.toMatch(/\.page\s*\{[^}]*overflow:\s*(hidden|clip)/)
    expect(html).not.toMatch(/\.page\s*\{[^}]*max-height:/)
    // And the bands must come from @page, not from padding on the section box.
    expect(html).toMatch(/@page\s*\{[^}]*margin:\s*0\.4in/)
    // The in-body absolute footer is gone — it could not follow a spilled
    // section, so it printed mid-document with the tail running under it.
    expect(html).not.toContain('class="pg-footer"')
  })
})

// ── The comp-count sweep ────────────────────────────────────────────────────
// Every comp count a broker can pick, with every status the letter prints:
// closed sales, homes for sale and under contract (matrix 3 and the FlexMLS
// status table's Active and Pending groups), and listings that came off
// unsold (matrix 2 and the Expired group). The 12-comp overstuffed case above
// is one point on this line. The nightly failed at 12 on the days chart's
// labels (fixed in #379, held by chart-labels.int.test.ts), and the sweep
// found three more overflows no single fixture reached: the matrix address
// head at five sales to a table, and nowrap ask/outcome cells.
const AREA: CompArea = {
  kind: 'radius',
  names: [],
  radiusMiles: 2,
  centre: { lat: 44.06, lng: -121.31 },
  source: 'fixture',
  sentence: 'within two miles of your home',
}

function rival(i: number, status: 'Active' | 'Pending'): CmaBandRival {
  return {
    listingKey: `R${i}`,
    address: `${60 + i} Competing Listing Boulevard Southwest`,
    listPrice: 729000 + i * 4000,
    status,
    daysOnMarket: 20 + i * 7,
    photoUrl: null,
    latitude: 44.061,
    longitude: -121.305,
    beds: 3,
    baths: 2.5,
    sqft: 1820 + i * 10,
    yearBuilt: 2008,
    lotAcres: 0.21,
    propertySubType: 'Single Family Residence',
    originalListPrice: 749000 + i * 4000,
    onMarketDate: '2026-06-01',
    listingHistoryLine: null,
  }
}

function peer(i: number): CmaExpiredPeer {
  return {
    listingKey: `E${i}`,
    address: `${900 + i} Withdrawn Unsold Terrace Northeast`,
    listPrice: 765000 + i * 5000,
    originalListPrice: 799000 + i * 5000,
    status: 'Expired',
    daysOnMarket: 140 + i * 11,
    onMarketDate: '2026-01-10',
    photoUrl: null,
    listingHistoryLine: null,
    whyItSat: 'Sat 140 days and cut its ask twice; its last ask per square foot ran above every sale behind your price.',
    beds: 3,
    baths: 2,
    sqft: 1790 + i * 10,
    yearBuilt: 2004,
    lotAcres: 0.19,
    propertySubType: 'Single Family Residence',
    latitude: 44.059,
    longitude: -121.312,
  } as CmaExpiredPeer
}

function sweepArgs(n: number): RenderCmaArgs {
  const rivals = [rival(1, 'Active'), rival(2, 'Active'), rival(3, 'Active'), rival(4, 'Pending'), rival(5, 'Pending')]
  const peers = [peer(1), peer(2), peer(3)]
  const bandRivals = {
    area: AREA,
    lo: 690000,
    hi: 740000,
    activeCount: 3,
    pendingCount: 2,
    rivals,
    sentence: 'Three homes are for sale and two are under contract in your price band.',
    source: 'fixture',
    widenedFrom: null,
    ringsTried: [2],
  } as CmaBandRivalSet
  const expiredPeers = {
    area: AREA,
    windowMonths: 12,
    windowsTried: [12],
    widenedTo: null,
    count: peers.length,
    areaTotal: peers.length,
    found: peers.length,
    likeYours: false,
    shortfall: false,
    sentence: 'Three listings like yours came off unsold in the last year.',
    peers,
  } as CmaExpiredPeerSet
  return args({
    // Every third sale carries a seven-figure ask path: "$1.25M"-wide figures
    // are what a nowrap cell could not hold (cma-20506-murphy, +3pt right).
    comps: Array.from({ length: n }, (_, i) => {
      const c = comp(i + 1)
      return i % 3 === 2
        ? ({ ...c, listPrice: 1_895_000, closePrice: 1_812_500, timeAdjustedPrice: 1_812_500, adjustedPrice: 1_810_000 } as CmaAdjustedComp)
        : c
    }),
    bandRivals,
    expiredPeers,
  } as Partial<RenderCmaArgs>)
}

/**
 * The fallback faces run wider than the brand face, and the fixture never
 * loads the brand face (network is aborted). Geometry that holds only under
 * one platform's fallback is how this test passed on a Mac and failed on the
 * Linux nightly. Verdana (macOS) and DejaVu Sans (Linux) are the wide ends of
 * what a sans fallback resolves to; the sweep runs under both the stylesheet's
 * own stack and this one.
 */
const WIDE_FALLBACK_CSS = '*{font-family:Verdana,"DejaVu Sans",sans-serif !important}'

const SWEEP_COUNTS = [1, 2, 3, 5, 6, 7, 12, 13, 20, 40]

describe.skipIf(!hasChrome)('CMA page safety across every comp count', () => {
  it.each(SWEEP_COUNTS)('%i comps, every status, stay inside the margins', async (n) => {
    const html = renderCmaHtml(sweepArgs(n)).html
    // The sweep is only worth something if the tables it claims to cover are
    // on the sheet. From three sales up that is the FlexMLS status table with
    // all four statuses and the days chart; under three the letter prints no
    // pricing page, so neither exists and the matrices are what is measured.
    if (n >= 3) {
      for (const status of ['closed', 'active', 'pending', 'expired']) {
        expect(html).toContain(`<tbody data-status="${status}"`)
      }
      expect(html).toContain('aria-label="How fast homes like yours went"')
    }
    expect(html).toContain('comp-matrix is-active')
    await expectClean(sweepArgs(n), `sweep ${n} comps`)
    await expectClean(sweepArgs(n), `sweep ${n} comps, wide fallback face`, WIDE_FALLBACK_CSS)
  }, 120_000)
})
