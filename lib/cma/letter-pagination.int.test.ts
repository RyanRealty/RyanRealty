/**
 * Letter pagination: no heading-only sheet, no one-line trailer, no spill
 * above a section header. Same Chrome / pdfjs harness as page-safety.
 *
 * The 16-page Murphy packet (tip d8561759a) printed a heading alone on
 * page 5, left two-thirds of page 9 blank, spilled a source note and a
 * caption above the next chapter header, and parked the prepared line on
 * its own last sheet. This fails any of those shapes.
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer, { type Browser } from 'puppeteer-core'
import { renderCmaHtml, type RenderCmaArgs } from './render'
import type { CmaAdjustedComp, CmaBroker, CmaPricing, CmaSubject } from './types'
import type { CmaBandRival, CmaBandRivalSet } from './band-rivals'
import type { CmaExpiredPeer, CmaExpiredPeerSet } from './market-status'
import type { CompArea } from '@/lib/pricing/comp-area'
import { extractPdfTextRuns, inspectPdfPageSafety, type PdfTextRun } from '@/lib/pdf/assert-page-safety'
import { pdfRenderOptions, CMA_MARGIN_IN, marginsToPt, PAPER } from '@/lib/pdf/page-contract'

const CHROME =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  process.env.CHROME_PATH ||
  (process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/usr/bin/google-chrome')
const hasChrome = existsSync(CHROME)

const subject: CmaSubject = {
  listingKey: 'S1',
  mlsNumber: '1',
  streetAddress: '15991 Falcon',
  city: 'La Pine',
  state: 'OR',
  postalCode: '97739',
  subdivision: 'Tall Pines',
  latitude: 43.7,
  longitude: -121.5,
  beds: 3,
  baths: 2,
  sqft: 1600,
  lotAcres: 0.25,
  propertySubType: 'Single Family Residence',
  yearBuilt: 1998,
  garageSpaces: 2,
  photoUrl: 'https://cdn.example/falcon.jpg',
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  standardStatus: 'Expired',
  lastListPrice: 525000,
  lastListDate: '2026-03-01',
  listingHistoryLine: null,
} as CmaSubject

const pricing: CmaPricing = {
  conservative: 485000,
  recommended: 497800,
  highEnd: 510000,
  valueLow: 485000,
  valueHigh: 510000,
  predictedClose: 490000,
  confidence: 'High',
  confidenceReason: 'Tight',
  notes: [],
} as unknown as CmaPricing

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

const AREA: CompArea = {
  kind: 'radius',
  names: [],
  radiusMiles: 2,
  centre: { lat: 43.7, lng: -121.5 },
  source: 'fixture',
  sentence: 'within two miles of your home',
}

function comp(i: number): CmaAdjustedComp {
  return {
    listingKey: `C${i}`,
    mlsNumber: `2200000${i}`,
    address: `${10 + i} Pine`,
    city: 'La Pine',
    subdivision: 'Tall Pines',
    latitude: 43.71,
    longitude: -121.51,
    beds: 3,
    baths: 2,
    sqft: 1580 + i,
    lotAcres: 0.22,
    propertySubType: null,
    yearBuilt: 1999,
    photoUrl: null,
    publicRemarks: null,
    viewDescription: null,
    taxAnnual: null,
    listPrice: 510000,
    closePrice: 500000 + i * 1000,
    closeDate: '2026-06-01',
    daysToOffer: 10,
    domTotal: 20,
    selectionTier: 'subdivision',
    monthsSinceClose: 2,
    timeAdjustment: 0,
    timeAdjustedPrice: 500000,
    ppsfTimeAdjusted: 316,
    sizeAdjustment: 0,
    adjustedPrice: 500000 + i * 1000,
    weight: 1,
    listingHistoryLine:
      'Listed May 1, 2026 at $529,000, cut to $510,000, sold Jun 1, 2026 at $500,000 · 20 days on market',
  } as unknown as CmaAdjustedComp
}

function rival(i: number, status: 'Active' | 'Pending'): CmaBandRival {
  return {
    listingKey: `R${i}`,
    address: `${20 + i} Pine`,
    listPrice: 515000 + i * 4000,
    status,
    daysOnMarket: 18 + i,
    photoUrl: null,
    latitude: 43.7,
    longitude: -121.5,
    beds: 3,
    baths: 2,
    sqft: 1610,
    yearBuilt: 1998,
    lotAcres: 0.24,
    propertySubType: 'Single Family Residence',
    originalListPrice: 529000,
    onMarketDate: '2026-08-01',
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
    latitude: 43.059,
    longitude: -121.312,
  } as CmaExpiredPeer
}

function letterCraftArgs(): RenderCmaArgs {
  return {
    subject,
    comps: Array.from({ length: 5 }, (_, i) => comp(i + 1)),
    market: null,
    pricing,
    broker,
    client: { name: 'Owner', email: null, phone: null, notes: null },
    mapDataUri: 'data:image/png;base64,COMPSMAP',
    subjectMapDataUri: 'data:image/png;base64,SUBJECTMAP',
    mapOverlay: {
      view: { centerLat: 43.7, centerLng: -121.5, zoom: 14, width: 640, height: 400 },
      pins: [
        { key: null, family: 'subject', lat: 43.7, lng: -121.5 },
        { key: '1', family: 'closed', lat: 43.71, lng: -121.51 },
        { key: 'A', family: 'active', lat: 43.7, lng: -121.5 },
      ],
    },
    generatedAtIso: '2026-09-12T00:00:00.000Z',
    subjectTrace: 't',
    compTrace: [],
    excludedOutliers: [],
    expiredAudit: {
      findings: [{ code: 'ask-above-range', fact: 'The final asking price was $525,000.' }],
      finalCycle: { initialAsk: 549000, cuts: [] },
    } as never,
    bandRivals: {
      lo: 480000,
      hi: 520000,
      activeCount: 1,
      pendingCount: 1,
      rivals: [rival(1, 'Active'), rival(2, 'Pending')],
      sentence: 'One home is for sale and one is under contract in this range.',
      source: 'fixture',
      area: AREA,
      widenedFrom: null,
      ringsTried: [2],
    } as CmaBandRivalSet,
  } as RenderCmaArgs
}

function fiveCompWithStatuses(): RenderCmaArgs {
  const peers = [peer(1), peer(2), peer(3)]
  const rivals = [rival(1, 'Active'), rival(2, 'Active'), rival(3, 'Pending')]
  return {
    ...letterCraftArgs(),
    subject: {
      ...subject,
      streetAddress: '123 Test Way',
      city: 'Bend',
      subdivision: 'N/A',
      postalCode: '97701',
      standardStatus: null,
      lastListPrice: null,
    },
    comps: Array.from({ length: 5 }, (_, i) => comp(i + 1)),
    bandRivals: {
      area: AREA,
      lo: 690000,
      hi: 740000,
      activeCount: 2,
      pendingCount: 1,
      rivals,
      sentence: 'Two homes are for sale and one is under contract in your price band.',
      source: 'fixture',
      widenedFrom: null,
      ringsTried: [2],
    } as CmaBandRivalSet,
    expiredPeers: {
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
    } as CmaExpiredPeerSet,
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

function isChrome(text: string): boolean {
  const t = text.trim()
  if (/^page\s+\d+\s+of\s+\d+$/i.test(t)) return true
  if (/^ryan realty/i.test(t) && /541/.test(t)) return true
  if (/^541[.\s]?703/.test(t)) return true
  return false
}

function letterRatio(text: string): number {
  const letters = text.replace(/[^A-Za-z]/g, '')
  if (letters.length === 0) return 0
  return letters.replace(/[^A-Z]/g, '').length / letters.length
}

function isPgMeta(text: string): boolean {
  const t = text.trim()
  if (!t.includes('·')) return false
  return letterRatio(t) > 0.85 && t.replace(/[^A-Za-z]/g, '').length >= 8
}

function isLetterSpaced(text: string): boolean {
  const parts = text.trim().split(/\s+/).filter(Boolean)
  return parts.length >= 5 && parts.every((p) => p.length <= 3)
}

function isSectionHead(text: string): boolean {
  const t = text.trim()
  if (isChrome(t) || isPgMeta(t)) return false
  const letters = t.replace(/[^A-Za-z]/g, '')
  return isLetterSpaced(t) && letters.length >= 10
}

function isBody(text: string): boolean {
  const t = text.trim()
  if (isChrome(t) || isPgMeta(t) || isSectionHead(t)) return false
  return /[a-z]/.test(t) && t.replace(/\s/g, '').length >= 12
}

function hasTableInk(runs: PdfTextRun[]): boolean {
  return runs.filter((r) => /\$[\d,]|\d+\s*(sqft|days|homes|%|ft)/i.test(r.text)).length >= 4
}

function contentSpan(runs: PdfTextRun[]): number {
  if (runs.length === 0) return 0
  return Math.max(...runs.map((r) => r.y1)) - Math.min(...runs.map((r) => r.y0))
}

function assertPagination(pages: PdfTextRun[][], sizes: { w: number; h: number }[], label: string) {
  const margins = marginsToPt(CMA_MARGIN_IN)
  const boxH = PAPER.heightPt - margins.top - margins.bottom
  const failures: string[] = []

  pages.forEach((all, idx) => {
    const pageNo = idx + 1
    const h = sizes[idx]?.h ?? PAPER.heightPt
    const cy0 = margins.bottom
    const body = all.filter((r) => !isChrome(r.text))
    const belowHead = body.filter((r) => !isPgMeta(r.text))
    const heads = belowHead.filter((r) => isSectionHead(r.text))
    const prose = belowHead.filter((r) => isBody(r.text))
    const header = body.filter((r) => isPgMeta(r.text)).sort((a, b) => b.y1 - a.y1)[0]
    const next = pages[idx + 1] ?? []
    const nextHeader = next.some((r) => isPgMeta(r.text))
    const thisStartsSection = Boolean(header)
    const nextContinues = !nextHeader && next.length > 0

    if (pageNo === pages.length) {
      const fill = contentSpan(body) / boxH
      if (fill < 0.15) {
        failures.push(
          `${label} p${pageNo}: last sheet is ${(fill * 100).toFixed(1)}% content (need ≥15%)`,
        )
      }
    }

    // Near-blank spillover: a continuation sheet (no chapter header) whose
    // text covers under about a third of the page. The cover is page 1.
    // A one-line "Prepared for" spill and a trailing source note land here.
    // The cover's letter-spaced "RECOMMENDED" is not a chapter heading.
    // Chart and table pages often extract as short runs, so "no prose run"
    // is not enough. A heading-only sheet is also short.
    const onlyHeading =
      pageNo > 1 &&
      heads.length > 0 &&
      prose.length === 0 &&
      !hasTableInk(belowHead) &&
      contentSpan(belowHead) / boxH < 0.3
    if (onlyHeading) {
      failures.push(`${label} p${pageNo}: content is only a heading ("${heads[0]?.text}")`)
    }

    // A continuation sheet that is almost empty: the cover's "Prepared for"
    // spill, or the last disclosure sentence sitting alone before the close.
    if (pageNo > 1 && !thisStartsSection) {
      const fill = contentSpan(belowHead) / boxH
      if (fill < 0.12) {
        failures.push(
          `${label} p${pageNo}: near-blank spillover, content span ${(fill * 100).toFixed(0)}%`,
        )
      }
    }

    // Heading then a jumped block: this sheet opens a section, the next sheet
    // continues it, and this sheet is mostly empty.
    if (thisStartsSection && nextContinues) {
      const fill = contentSpan(body) / boxH
      if (fill < 0.4) {
        failures.push(
          `${label} p${pageNo}: section opens then jumps, sheet is only ${(fill * 100).toFixed(0)}% full`,
        )
      }
    }

    const lowestHead = [...heads].sort((a, b) => a.y0 - b.y0)[0]
    if (pageNo > 1 && lowestHead && lowestHead.y0 < cy0 + 0.25 * boxH) {
      const under = belowHead.filter((r) => r.y1 < lowestHead.y0 - 2 && (isBody(r.text) || hasTableInk([r])))
      if (under.length === 0) {
        failures.push(
          `${label} p${pageNo}: orphaned heading at the bottom ("${lowestHead.text.slice(0, 48)}")`,
        )
      }
    }

    if (header) {
      const above = body.filter((r) => r.y0 > header.y1 + 2 && (isBody(r.text) || isSectionHead(r.text)))
      const headerFromTop = (sizes[idx]?.h ?? PAPER.heightPt) - margins.top - header.y1
      // A mid-page chapter start is fine. Spill is a leftover line or caption
      // sitting above a header that is trying to open the sheet.
      if (above.length > 0 && headerFromTop < 0.35 * boxH && contentSpan(above) < 0.25 * boxH) {
        failures.push(
          `${label} p${pageNo}: "${above[0]?.text.slice(0, 60)}" sits above the section header`,
        )
      }
    }
  })

  if (failures.length) {
    throw new Error(`${label}: ${failures.join(' | ')}`)
  }
}

const offerTiming = {
  city: 'Bend',
  windowMonths: 12,
  n: 2238,
  medianDays: 26,
  points: [
    { days: 7, pct: 31.2 },
    { days: 14, pct: 44.1 },
    { days: 30, pct: 54 },
    { days: 60, pct: 68.9 },
    { days: 90, pct: 79.8 },
    { days: 180, pct: 93.3 },
  ],
}

const askOutcome = {
  city: 'Bend',
  windowMonths: 12,
  groups: [
    { key: 'sold-no-cut', n: 1217, medianDays: 6, medianSoldToOriginalAskPct: 100 },
    { key: 'sold-after-cut', n: 1021, medianDays: 69, medianCutPct: 5.8, medianSoldToOriginalAskPct: 91.9 },
    { key: 'did-not-sell', n: 809, medianDays: 117 },
  ],
}

const realization = {
  city: 'Bend',
  windowMonths: 12,
  buckets: [
    { weeks: '0-2', n: 686, medianPctOfOriginalAsk: 100, reason: null },
    { weeks: '3-4', n: 302, medianPctOfOriginalAsk: 97.4, reason: null },
    { weeks: '5-8', n: 280, medianPctOfOriginalAsk: 95.1, reason: null },
    { weeks: '9-16', n: 240, medianPctOfOriginalAsk: 93.2, reason: null },
    { weeks: '17+', n: 190, medianPctOfOriginalAsk: 90.4, reason: null },
  ],
}

/**
 * Jones: a net of a few lines lands the closing in the leftover under basis
 * and limits, which used to split the reach list and leave the signature.
 * Sage Stone: a long competition lead ends the matrix in a short tail in
 * front of the priced-right spread, which used to sit alone on the next sheet.
 */
function shapedLetter(opts: { comps: number; leadRepeats: number }): RenderCmaArgs {
  const base = fiveCompWithStatuses()
  const recommended = 497800
  const lines = [
    { label: 'Our fee', amount: 14934, source: '3% of the list price' },
    { label: "Buyer's agent", amount: 12445, source: '2.5% of the list price, if you offer it' },
    { label: 'Title insurance', amount: 1342, source: "Oregon owner's policy rate" },
  ]
  const lead =
    'Nearby homes are still for sale in this range and a buyer can choose them instead. '.repeat(
      opts.leadRepeats,
    )
  const peers = [peer(1), peer(2), peer(3)]
  const rivals = [rival(1, 'Active'), rival(2, 'Pending')]
  return {
    ...base,
    subject: {
      ...base.subject,
      streetAddress: opts.leadRepeats > 0 ? '60320 Sage Stone' : '2667 Jones',
      city: 'Bend',
      postalCode: '97701',
      standardStatus: 'Expired',
      lastListPrice: 525000,
      lastListDate: '2026-04-11',
    },
    comps: Array.from({ length: opts.comps }, (_, i) => comp(i + 1)),
    pricing: {
      ...(base.pricing as object),
      sellerNet: {
        basis: 'list',
        list: recommended,
        lines,
        net: recommended - lines.reduce((sum, line) => sum + line.amount, 0),
        sentence: '',
        unknowns: ['escrow'],
      },
    } as CmaPricing,
    market: {
      geoSlug: 'bend',
      geoLabel: 'Bend',
      periodStart: '2025-09-01',
      periodEnd: '2026-09-01',
      soldCount365: 2200,
      medianSalePrice: 700000,
      medianDom: 26,
      medianPpsf: 340,
      saleToListRatio: 0.98,
      yoyMedianPriceDeltaPct: 2,
      activeCount: 745,
      pendingCount: 200,
      monthsOfSupply: 3.6,
      mosFormula: 'active / (closed_6mo / 6)',
      marketVerdict: 'seller',
      methodologyVersion: 'v3',
      computedAt: '2026-09-27T00:00:00.000Z',
      pulseUpdatedAt: '2026-09-27T00:00:00.000Z',
      offerTiming,
      askOutcome,
      originalAskRealization: realization,
    } as never,
    bandRivals: {
      ...(base.bandRivals as object),
      activeCount: 1,
      pendingCount: 1,
      rivals,
      sentence: lead ? `${lead}One home is under contract.` : 'One home is for sale and one is under contract.',
    } as CmaBandRivalSet,
    expiredPeers: {
      ...(base.expiredPeers as object),
      peers,
      count: peers.length,
    } as CmaExpiredPeerSet,
  } as RenderCmaArgs
}

function pageText(runs: PdfTextRun[]): string {
  return runs.map((r) => r.text).join(' ')
}

function contentFill(runs: PdfTextRun[]): number {
  const margins = marginsToPt(CMA_MARGIN_IN)
  const boxH = PAPER.heightPt - margins.top - margins.bottom
  const body = runs.filter((r) => !isChrome(r.text) && !isPgMeta(r.text))
  return contentSpan(body) / boxH
}

/** The signature and the closing heading are one section. A split leaves the licence alone. */
function assertClosingTogether(pages: PdfTextRun[][], label: string) {
  const texts = pages.map(pageText)
  const sig = texts.findIndex((t) => /201206613/.test(t))
  if (sig < 0) throw new Error(`${label}: signature licence is not on any sheet`)
  const body = texts[sig]!
  if (!/NEXT STEP|S O R R Y|WHAT HAPPENS NEXT/i.test(body)) {
    throw new Error(`${label}: signature is on p${sig + 1} without the closing heading`)
  }
  const fill = contentFill(pages[sig]!)
  if (fill < 0.45) {
    throw new Error(`${label}: closing sheet is only ${(fill * 100).toFixed(0)}% full`)
  }
}

function assertNoNearBlank(pages: PdfTextRun[][], label: string, min = 0.35) {
  const failures: string[] = []
  pages.forEach((runs, idx) => {
    if (idx === 0) return
    const fill = contentFill(runs)
    if (fill < min) {
      failures.push(`p${idx + 1} ${(fill * 100).toFixed(0)}% ("${pageText(runs).slice(0, 70)}")`)
    }
  })
  if (failures.length) throw new Error(`${label}: near-blank page ${failures.join(' | ')}`)
}

function flatPage(runs: PdfTextRun[]): string {
  return runs
    .map((r) => r.text)
    .join('')
    .replace(/\s+/g, '')
    .toLowerCase()
}

/** One bar chart's labels. A sliced SVG puts the top row and the bottom row on different sheets. */
function assertChartAtomic(pages: PdfTextRun[][], label: string) {
  const flats = pages.map(flatPage)
  const at = (needle: string) => flats.findIndex((t) => t.includes(needle))
  const curve = at('daystoanacceptedoffer')
  if (curve < 0) throw new Error(`${label}: offer curve is missing or split mid-label`)
  const bars = ['soldwithoutapricecut', 'soldafterapricecut', 'yoursisinthisgroup']
    .map(at)
    .filter((i) => i >= 0)
  if (bars.length >= 2 && new Set(bars).size !== 1) {
    throw new Error(`${label}: bar chart rows land on different sheets`)
  }
}

async function assertLetterPages(
  a: RenderCmaArgs,
  label: string,
  opts?: { nearBlank?: boolean; minFill?: number },
) {
  const { html } = renderCmaHtml(a)
  expect(html).toContain('class="spread"')
  const pdf = await renderPdf(html)
  const safety = await inspectPdfPageSafety(pdf, { margins: CMA_MARGIN_IN })
  if (!safety.ok) {
    throw new Error(`${label}: page safety ${safety.violations.length} on ${safety.pageCount} sheets`)
  }
  const { pages, sizes } = await extractPdfTextRuns(new Uint8Array(pdf))
  expect(pages.length).toBeGreaterThan(3)
  assertPagination(pages, sizes, label)
  assertClosingTogether(pages, label)
  assertChartAtomic(pages, label)
  if (opts?.nearBlank) assertNoNearBlank(pages, label, opts.minFill ?? 0.35)
}

describe.skipIf(!hasChrome)('CMA letter pagination', () => {
  it('letter-craft fixture has no heading-only, trailer, or spill-above-header pages', async () => {
    const { html } = renderCmaHtml(letterCraftArgs())
    const pdf = await renderPdf(html)
    const { pages, sizes } = await extractPdfTextRuns(new Uint8Array(pdf))
    expect(pages.length).toBeGreaterThan(3)
    assertPagination(pages, sizes, 'letter-craft')
  }, 120_000)

  it('5-comp letter with actives and expireds paginates cleanly', async () => {
    const a = fiveCompWithStatuses()
    const { html } = renderCmaHtml(a)
    expect(html).toContain('comp-matrix is-active')
    expect(html).toContain('data-status="expired"')
    const pdf = await renderPdf(html)
    const { pages, sizes } = await extractPdfTextRuns(new Uint8Array(pdf))
    expect(pages.length).toBeGreaterThan(3)
    assertPagination(pages, sizes, '5-comp')
  }, 120_000)

  it('Jones shape keeps the closing heading with the signature', async () => {
    await assertLetterPages(shapedLetter({ comps: 5, leadRepeats: 0 }), 'jones')
  }, 120_000)

  it('Sage Stone shape does not leave a near-blank matrix tail', async () => {
    await assertLetterPages(shapedLetter({ comps: 5, leadRepeats: 20 }), 'sage', { nearBlank: true })
  }, 120_000)

  it.each([5, 13, 20, 40])('%i comps paginate without a split close', async (n) => {
    await assertLetterPages(shapedLetter({ comps: n, leadRepeats: 0 }), `${n}-comp`)
  }, 180_000)

  it.each(['jones', 'sage-stone', 'monterey-mews', 'mcclellan', 'nugget'] as const)(
    '%s snapshot shape keeps the close together and does not slice a chart',
    async (name) => {
      const raw = JSON.parse(
        readFileSync(join(process.cwd(), 'lib/cma/fixtures/letter-shapes', `${name}.json`), 'utf8'),
      ) as RenderCmaArgs
      const a = {
        ...raw,
        broker,
        client: { name: null, email: null, phone: null, notes: null },
        mapDataUri:
          'data:image/svg+xml,' +
          encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"/>'),
        subjectMapDataUri: null,
        documentStatus: 'draft',
      } as RenderCmaArgs
      // A disclosure that will not share a sheet with the close can land near
      // 30% full. The blank matrix tails these rows used to print were under 20%.
      await assertLetterPages(a, name, { nearBlank: true, minFill: 0.22 })
    },
    120_000,
  )
})
