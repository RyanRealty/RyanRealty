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

async function expectClean(a: RenderCmaArgs, label: string) {
  const { html } = renderCmaHtml(a)
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
    expect(report.pageCount).toBeGreaterThan(6)
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
    expect(report.pageCount).toBeGreaterThan(4)
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
