/**
 * Chart labels, measured in a real browser.
 *
 * The CMA's gutter charts right-anchor their labels, so a label wider than its
 * gutter grows off the frame and the SVG clips its START, which is the comp's
 * number or the group's name. On 2026-09-25 the 12-comp letter printed
 * "01 Comparable Stree…" for "1. 401 Comparable Stree…", and the first-price
 * chart printed "without a price cut · yours is in this group".
 *
 * The unit tests hold the layout to labelWidth, the estimate the charts are
 * built with, so they cannot catch the estimate running short. This measures
 * every text run with the browser's own metrics, in both faces a PDF can
 * render in: the offline fallback and Geist. The labels are the worst the
 * data allows: all-caps MLS addresses heavy in W and M, a bold subject row,
 * four-digit counts.
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer, { type Browser } from 'puppeteer-core'
import { askOutcomeBarsSvg, daysToOfferSvg, type AskOutcome, type DaysRow } from './market-charts'

const CHROME =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  process.env.CHROME_PATH ||
  (process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/usr/bin/google-chrome')
const hasChrome = existsSync(CHROME)

const GEIST_DIR = join(process.cwd(), 'node_modules/geist/dist/fonts/geist-sans')
const geist = (file: string) => readFileSync(join(GEIST_DIR, file)).toString('base64')

const worstAddresses = [
  '64645 WOODWARD MEADOW WAY NW',
  '19080 MOUNTAIN MEADOW WAY WEST',
  '20735 NW WHITEWATER MEADOWS MEWS',
  '61535 MMMM WWWW MANOR WAY #1400',
  '401 Comparable Street Northwest',
  '3310 NW Colonial Dr',
]

const daysRows: DaysRow[] = [
  ...Array.from({ length: 12 }, (_, i) => ({
    label: `${i + 1}. ${worstAddresses[i % worstAddresses.length]}`,
    days: 3 + i * 9,
    subject: false,
    valueLabel: `${3 + i * 9} days`,
  })),
  { label: 'MMMM WWWW MEADOW WAY NW', days: 192, subject: true, valueLabel: '192 days, no offer' },
]

const outcome: AskOutcome = {
  city: 'Bend',
  windowMonths: 12,
  groups: [
    { key: 'sold-no-cut', n: 1302, medianDays: 9, medianSoldToOriginalAskPct: 100, soldToOriginalAskN: 1302 },
    { key: 'sold-after-cut', n: 1188, medianDays: 61, medianCutPct: 12.5, medianSoldToOriginalAskPct: 94.3, soldToOriginalAskN: 1188 },
    { key: 'did-not-sell', n: 1141, medianDays: 117, medianCutPct: 16.8 },
  ],
}

const charts: Array<[string, string]> = [
  ['days strip', daysToOfferSvg(daysRows, 'How fast homes like yours went', { days: 18, label: 'Bend median 18 days' })],
  ['first price, no group', askOutcomeBarsSvg(outcome, null)],
  ['first price, sold without a cut', askOutcomeBarsSvg(outcome, 'sold-no-cut')],
  ['first price, sold after a cut', askOutcomeBarsSvg(outcome, 'sold-after-cut')],
  ['first price, came off unsold', askOutcomeBarsSvg(outcome, 'did-not-sell')],
]

const FACES: Array<[string, string]> = [
  ['fallback', 'system-ui, sans-serif'],
  ['Geist', "'Geist', system-ui, sans-serif"],
]

/** Every text run whose measured extent leaves the viewBox, in user units. */
async function outside(browser: Browser, svg: string, family: string): Promise<string[]> {
  const page = await browser.newPage()
  try {
    await page.setContent(
      `<!doctype html><style>
        @font-face { font-family: 'Geist'; font-weight: 400; src: url(data:font/woff2;base64,${geist('Geist-Regular.woff2')}) format('woff2'); }
        @font-face { font-family: 'Geist'; font-weight: 600; src: url(data:font/woff2;base64,${geist('Geist-SemiBold.woff2')}) format('woff2'); }
        body { margin: 0; font-family: ${family}; }
        .box { width: 700px; }
        svg { width: 100%; height: auto; display: block; }
      </style><div class="box">${svg}</div>`,
      { waitUntil: 'load' },
    )
    await page.evaluate(() => document.fonts.ready)
    return await page.evaluate(() => {
      const root = document.querySelector('svg') as SVGSVGElement
      const W = root.viewBox.baseVal.width
      const bad: string[] = []
      for (const t of root.querySelectorAll('text')) {
        const x = Number(t.getAttribute('x') ?? 0)
        const len = t.getComputedTextLength()
        const anchor = t.getAttribute('text-anchor') ?? 'start'
        const left = anchor === 'end' ? x - len : anchor === 'middle' ? x - len / 2 : x
        if (left < 0 || left + len > W) bad.push(`"${t.textContent}" spans ${left.toFixed(1)}..${(left + len).toFixed(1)} of 0..${W}`)
      }
      return bad
    })
  } finally {
    await page.close()
  }
}

describe.skipIf(!hasChrome)('CMA chart labels stay inside the frame', () => {
  it('in the fallback face and in Geist, on the worst labels the data allows', async () => {
    const browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    try {
      const failures: string[] = []
      for (const [name, svg] of charts) {
        expect(svg, name).toContain('<svg')
        for (const [face, family] of FACES) {
          for (const miss of await outside(browser, svg, family)) failures.push(`${name} (${face}): ${miss}`)
        }
      }
      expect(failures).toEqual([])
    } finally {
      await browser.close().catch(() => {})
    }
  }, 120_000)
})
