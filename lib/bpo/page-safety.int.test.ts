/**
 * THE PAGE CONTRACT, applied to the real BPO renderer.
 *
 * The bug this locks: the detail half of a BPO lived in one `.page` div that
 * carried `padding: 0.7in 0.75in` and fragmented across as many sheets as its
 * content needed. CSS padding on a fragmented box is applied once at the top of
 * the box and once at the bottom, so sheet 1 had a top margin, the last sheet
 * had a bottom margin, and every sheet in between had NONE. Measured on a
 * 5-sheet document: body text 1.5pt from the paper edge on sheets 3, 4 and 5.
 *
 * Every BPO longer than two sheets printed that way, which is most of them.
 *
 * The fixture below is deliberately long enough to produce interior sheets,
 * because a two-sheet fixture cannot reproduce the defect.
 */
import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import puppeteer, { type Browser } from 'puppeteer-core'
import { renderBpoHtml, type RenderBpoArgs } from './render'
import { pdfRenderOptions, type RunningMarks } from '@/lib/pdf/page-contract'
import { inspectPdfPageSafety, formatViolations } from '@/lib/pdf/assert-page-safety'

const CHROME =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  process.env.CHROME_PATH ||
  (process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/usr/bin/google-chrome')
const hasChrome = existsSync(CHROME)

const MARKS: RunningMarks = {
  headerLeft: 'RYAN REALTY',
  headerRight: 'BROKER PRICE OPINION',
  footerLeft: 'Ryan Realty · 541.703.3095',
}

/**
 * Body of the rule for `selector` that sits at the top level of the stylesheet,
 * i.e. outside every `@media` / `@page` / `@font-face` block. Walks braces
 * rather than pattern-matching, because an at-rule block contains rules whose
 * own braces defeat any regex.
 */
function topLevelRule(source: string, selector: string): string | null {
  // Comments sit between rules and would otherwise be read as part of the next
  // selector.
  const css = source.replace(/\/\*[^]*?\*\//g, '')
  let depth = 0
  let i = 0
  let selectorStart = 0
  while (i < css.length) {
    const ch = css[i]
    if (ch === '{') {
      if (depth === 0) {
        const sel = css.slice(selectorStart, i).trim()
        const isAtRule = sel.startsWith('@')
        const bodyStart = i + 1
        // Find the matching close brace.
        let d = 1
        let j = bodyStart
        while (j < css.length && d > 0) {
          if (css[j] === '{') d++
          else if (css[j] === '}') d--
          j++
        }
        if (!isAtRule && sel.split(',').some((s) => s.trim() === selector)) {
          return css.slice(bodyStart, j - 1)
        }
        i = j
        selectorStart = i
        continue
      }
      depth++
    } else if (ch === '}') {
      depth = Math.max(0, depth - 1)
      if (depth === 0) selectorStart = i + 1
    }
    i++
  }
  return null
}

function comp(i: number) {
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
  }
}

function args(compCount: number, rationaleParas: number): RenderBpoArgs {
  return {
    subject: {
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
    },
    comps: Array.from({ length: compCount }, (_, i) => comp(i + 1)),
    market: null,
    history: {
      cycles: [],
      attemptsCount: 0,
      failedAttemptsCount: 0,
      currentCycle: null,
      currentIsActive: false,
      currentDaysOnMarket: null,
      currentListPrice: null,
      currentOriginalListPrice: null,
      currentCutFromOriginalPct: null,
      peakAskingPrice: null,
      totalDeclineFromPeakPct: null,
      lastSalePrice: null,
      lastSaleDate: null,
      signals: [],
      listingPressureAdjustmentPct: 0,
      trace: [],
    },
    opinion: {
      opinionValue: 715000,
      valueLow: 690000,
      valueHigh: 740000,
      confidence: 'High',
      confidenceReason: 'tight comp set',
      vsCurrentListPct: null,
      compAnchor: 712000,
      priceOverride: null,
      reasoning: ['Comps reconcile tightly on size and recency.'],
    },
    offer: {
      mode: 'seller',
      posture: 'balanced',
      leverageScore: 50,
      headline: 'Price at the reconciled midpoint.',
      openingOffer: null,
      targetOffer: null,
      ceiling: null,
      recommendedList: 715000,
      expectedOfferLow: 690000,
      expectedOfferHigh: 735000,
      leverage: ['Supply is balanced at 4.4 months.'],
      terms: ['Standard financing contingency.'],
    },
    broker: {
      id: 'id-matt',
      slug: 'matthew-ryan',
      displayName: 'Matt Ryan',
      title: 'Owner & Principal Broker',
      licenseNumber: '201206613',
      email: 'matt@ryan-realty.com',
      phone: '541.703.3095',
      photoUrl: '/images/brokers/ryan-matt.png',
    },
    rationale: Array.from(
      { length: rationaleParas },
      (_, i) =>
        `Paragraph ${i + 1}. The reconciliation weights the closest comparables by living area and recency, and the adjusted range holds across all three methods for this subject property in Bend, Oregon.`,
    ).join('\n\n'),
    purpose: 'Pre-listing',
    generatedAtIso: '2026-07-30T00:00:00.000Z',
    site: null,
    development: null,
    rental: null,
  } as unknown as RenderBpoArgs
}

async function renderAndInspect(html: string) {
  let browser: Browser | null = null
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    const page = await browser.newPage()
    await page.setRequestInterception(true)
    page.on('request', (r) => {
      if (/^https?:/.test(r.url())) r.abort().catch(() => {})
      else r.continue().catch(() => {})
    })
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    await page.emulateMediaType('print')
    const pdf = Buffer.from(await page.pdf(pdfRenderOptions(MARKS)))
    return await inspectPdfPageSafety(pdf)
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}

describe.skipIf(!hasChrome)('BPO page safety', () => {
  it('keeps interior sheets inside the contract', async () => {
    const { html } = renderBpoHtml(args(14, 40))
    const report = await renderAndInspect(html)
    if (!report.ok) {
      throw new Error(
        `${report.violations.length} violation(s) over ${report.pageCount} sheet(s): ${formatViolations(report.violations)}`,
      )
    }
    // Interior sheets are the whole point — a fixture that fits on two proves
    // nothing about the defect.
    expect(report.pageCount).toBeGreaterThanOrEqual(3)
  }, 120_000)

  it('does not reserve the bands with padding on a fragmenting box', () => {
    const { html } = renderBpoHtml(args(3, 4))

    // The contract's @page rule is what reserves the bands on every sheet.
    expect(html).toMatch(/@page\s*\{[^}]*margin:/)

    // The unconditional .page rule must carry no padding. Padding there is the
    // original defect: it reserves the bands only on the first and last sheet
    // of a box that fragments. Screen-only padding is fine, so measure the rule
    // that applies outside any at-rule.
    const css = html.match(/<style>([^]*?)<\/style>/)?.[1] ?? ''
    expect(css).not.toBe('')

    const pageRule = topLevelRule(css, '.page')
    expect(pageRule).not.toBeNull()
    expect(pageRule).not.toMatch(/padding/)
    // ...and it must not pin a height either, which would clip rather than flow.
    expect(pageRule).not.toMatch(/(^|[^-])height\s*:/)
  })
})
