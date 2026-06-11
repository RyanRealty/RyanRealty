#!/usr/bin/env node
/**
 * Download the free Oregon Real Estate Agency "Active Individuals" roster via
 * Playwright headless browser. The OREA portal is ASP.NET WebForms with
 * VIEWSTATE/EVENTVALIDATION constraints that are hard to replicate from
 * fetch(); Playwright drives the same form a human would click.
 *
 * Flow:
 *   1. Open https://orea.elicense.irondata.com/Lookup/GenerateRoster.aspx
 *   2. Click "Active Individuals" checkbox → click Continue
 *   3. On DownloadRoster.aspx, click the CSV download button
 *   4. Save the downloaded file to out/westside-bend-merge/orea_active_individuals.csv
 *
 * Usage:
 *   node scripts/orea-download-roster.mjs
 */

import { chromium } from 'playwright'
import { mkdir, copyFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUTDIR = resolve(ROOT, 'out/westside-bend-merge')
const OUTPATH = resolve(OUTDIR, 'orea_active_individuals.csv')

const ROSTER_URL = 'https://orea.elicense.irondata.com/Lookup/GenerateRoster.aspx'

async function main() {
  await mkdir(OUTDIR, { recursive: true })

  console.log('[orea] launching browser')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    acceptDownloads: true,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()

  try {
    console.log('[orea] step 1: open GenerateRoster.aspx')
    await page.goto(ROSTER_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })

    console.log('[orea] step 2: tick "Active Individuals" checkbox')
    // Find the checkbox whose accompanying label/text contains "Active Individuals"
    // Based on the HTML: <input id="ctl00_MainContentPlaceHolder_ckbRoster9" ...>Active Individuals...
    const checkbox = page.locator('#ctl00_MainContentPlaceHolder_ckbRoster9')
    await checkbox.waitFor({ state: 'visible', timeout: 30000 })
    await checkbox.check()

    console.log('[orea] step 3: click Continue')
    await Promise.all([
      page.waitForLoadState('domcontentloaded', { timeout: 60000 }),
      page.click('#ctl00_MainContentPlaceHolder_btnRosterContinue'),
    ])

    console.log('[orea] step 4: on download page, content preview:')
    const url = page.url()
    console.log('  current URL:', url)
    const title = await page.title()
    console.log('  page title:', title)

    // The roster takes ~10-30 seconds to generate. The download page may show
    // a "Refresh / Try again" link until ready. Poll for the download button.
    let attempts = 0
    while (attempts < 30) {
      const buttons = await page.locator('input[type="submit"], button').all()
      const labels = []
      for (const b of buttons) labels.push(((await b.getAttribute('value')) || (await b.textContent()) || '').trim())
      const hasCsv = labels.some((l) => /csv/i.test(l))
      const hasDownload = labels.some((l) => /download/i.test(l))
      console.log(`  [poll ${attempts}] buttons: ${labels.slice(0, 8).join(' | ')}`)
      if (hasCsv || hasDownload) break
      await page.waitForTimeout(2000)
      // Sometimes the page auto-refreshes; nudge it
      if (attempts % 5 === 4) await page.reload({ waitUntil: 'domcontentloaded' })
      attempts += 1
    }

    // Look for a button matching CSV
    const csvBtn = page.locator('input[type="submit"][value*="CSV" i], button:has-text("CSV")').first()
    const downloadBtn = page.locator('input[type="submit"][value*="Download" i], button:has-text("Download")').first()
    const target = (await csvBtn.count()) > 0 ? csvBtn : downloadBtn

    if ((await target.count()) === 0) {
      // Save the page HTML for debugging
      const html = await page.content()
      const dbg = OUTPATH.replace(/\.csv$/, '-debug-step4.html')
      await import('node:fs/promises').then((m) => m.writeFile(dbg, html, 'utf8'))
      throw new Error('Could not find CSV/Download button on roster page. HTML saved to ' + dbg)
    }

    console.log('[orea] step 5: click CSV download')
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 120000 }),
      target.click(),
    ])
    const path = await download.path()
    await copyFile(path, OUTPATH)
    const stat = await import('node:fs/promises').then((m) => m.stat(OUTPATH))
    console.log(`[orea] DOWNLOADED ${stat.size} bytes to ${OUTPATH}`)
  } finally {
    await context.close()
    await browser.close()
  }
}

main().catch((err) => {
  console.error('[orea] FATAL:', err.message)
  if (err.stack) console.error(err.stack)
  process.exit(1)
})
