/**
 * THE PAGE CONTRACT, verified against Chrome rather than against intent.
 *
 * These render real HTML through the real contract with the real browser and
 * measure the resulting PDF. A fixture here is deliberately abusive: more rows
 * than fit, unbreakable strings, an image taller than the sheet, a table that
 * runs for pages. If the contract holds under that, it holds under a CMA whose
 * narrative came back three paragraphs long.
 *
 * Needs a local Chrome. Skips (loudly) when there isn't one, so the unit suite
 * stays runnable on a machine without it — `test:int` is where this must pass.
 */
import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import puppeteer, { type Browser } from 'puppeteer-core'
import {
  pageContractCss,
  pdfRenderOptions,
  MARGIN_IN,
  type RunningMarks,
} from './page-contract'
import { inspectPdfPageSafety, formatViolations } from './assert-page-safety'

const CHROME =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  process.env.CHROME_PATH ||
  (process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/usr/bin/google-chrome')

const hasChrome = existsSync(CHROME)

const MARKS: RunningMarks = {
  headerLeft: 'RYAN REALTY',
  headerRight: 'COMPARATIVE MARKET ANALYSIS',
  footerLeft: 'Ryan Realty · 541.703.3095',
}

async function renderToPdf(body: string, extraCss = ''): Promise<Buffer> {
  let browser: Browser | null = null
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    const page = await browser.newPage()
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      ${pageContractCss()}
      body { font-family: system-ui, sans-serif; color: #102742; font-size: 11.5px; line-height: 1.5; }
      ${extraCss}
    </style></head><body>${body}</body></html>`
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    await page.emulateMediaType('print')
    const pdf = await page.pdf(pdfRenderOptions(MARKS))
    return Buffer.from(pdf)
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}

async function expectClean(body: string, extraCss = '') {
  const pdf = await renderToPdf(body, extraCss)
  const report = await inspectPdfPageSafety(pdf)
  if (!report.ok) {
    throw new Error(
      `${report.violations.length} violation(s) over ${report.pageCount} sheet(s): ${formatViolations(report.violations)}`,
    )
  }
  expect(report.pageCount).toBeGreaterThan(0)
  return report
}

describe.skipIf(!hasChrome)('page contract — rendered', () => {
  it('keeps every sheet clean when content flows past the first one', async () => {
    const rows = Array.from(
      { length: 220 },
      (_, i) =>
        `<p>Line ${i + 1} — comparable sale analysis for the subject property in Bend, Oregon, including the adjustment basis and the source row it came from.</p>`,
    ).join('')
    const report = await expectClean(rows)
    // The original defect only appeared on interior sheets, so a fixture that
    // fits on two proves nothing.
    expect(report.pageCount).toBeGreaterThanOrEqual(4)
  }, 60_000)

  it('keeps a long table clean across sheet boundaries', async () => {
    const trs = Array.from(
      { length: 160 },
      (_, i) =>
        `<tr><td>${1000 + i} SW Century Dr</td><td>3 / 2</td><td>1,${800 + i} sqft</td><td>$${(600 + i).toLocaleString()},000</td><td>2026-0${(i % 9) + 1}-14</td></tr>`,
    ).join('')
    await expectClean(
      `<table><thead><tr><th>Address</th><th>Bd/Ba</th><th>Size</th><th>Close</th><th>Date</th></tr></thead><tbody>${trs}</tbody></table>`,
      'table{width:100%;border-collapse:collapse;font-size:10px}td,th{padding:4px 6px;border-bottom:1px solid rgba(16,39,66,.18);text-align:left}',
    )
  }, 60_000)

  it('does not let an oversized image push content out of the box', async () => {
    // A 4000px-tall image cannot be paginated. Uncapped it clips; the contract
    // caps it to the content height so it scales instead.
    const png =
      'data:image/svg+xml;base64,' +
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="4000"><rect width="1200" height="4000" fill="#102742"/></svg>`,
      ).toString('base64')
    await expectClean(`<p>Before</p><img src="${png}" /><p>After the tall image</p>`)
  }, 60_000)

  it('keeps deliberate sheet breaks clean', async () => {
    const sections = Array.from(
      { length: 6 },
      (_, i) =>
        `<section class="sheet-break"><h2>Section ${i + 1}</h2>${Array.from({ length: 40 }, (_, j) => `<p>Section ${i + 1} paragraph ${j + 1} with enough copy to reach the bottom of the reserved content box.</p>`).join('')}</section>`,
    ).join('')
    const report = await expectClean(sections)
    expect(report.pageCount).toBeGreaterThanOrEqual(6)
  }, 60_000)

  it('reserves the same bands on the first and the last sheet', async () => {
    // Regression guard for the padding-on-a-wrapper model, whose margins were
    // correct on sheet 1 and absent everywhere after it.
    const rows = Array.from({ length: 200 }, (_, i) => `<p>Row ${i + 1}</p>`).join('')
    const pdf = await renderToPdf(rows)
    const report = await inspectPdfPageSafety(pdf)
    expect(report.ok).toBe(true)
    expect(report.pageCount).toBeGreaterThanOrEqual(3)
  }, 60_000)

  it('catches a document that opts out of the contract', async () => {
    // The inspector must fail the OLD model, or it is not proving anything
    // about the new one.
    let browser: Browser | null = null
    try {
      browser = await puppeteer.launch({
        executablePath: CHROME,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })
      const page = await browser.newPage()
      const rows = Array.from({ length: 200 }, (_, i) => `<p>Row ${i + 1} of the old flowing model</p>`).join('')
      await page.setContent(
        `<!DOCTYPE html><html><head><style>
          *{box-sizing:border-box}html,body{margin:0;padding:0;font-family:system-ui;font-size:11.5px;line-height:1.5}
          .page{width:8.5in;margin:0 auto;padding:${MARGIN_IN.top}in ${MARGIN_IN.left}in;position:relative}
        </style></head><body><div class="page">${rows}</div></body></html>`,
        { waitUntil: 'domcontentloaded' },
      )
      await page.emulateMediaType('print')
      const pdf = Buffer.from(
        await page.pdf({
          format: 'Letter',
          printBackground: true,
          preferCSSPageSize: false,
          margin: { top: '0', right: '0', bottom: '0', left: '0' },
        }),
      )
      const report = await inspectPdfPageSafety(pdf)
      expect(report.ok).toBe(false)
      expect(report.violations.some((v) => v.rule === 'EDGE')).toBe(true)
    } finally {
      if (browser) await browser.close().catch(() => {})
    }
  }, 60_000)
})
