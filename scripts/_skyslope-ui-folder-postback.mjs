#!/usr/bin/env node
/**
 * Final approach: invoke the actual ASP.NET __doPostBack call for each
 * folder row in the Canceled-B Documents view, then capture what the
 * server returns. This is what the UI does when a user clicks Admin /
 * Incomplete / Trash row in the folder tree at the bottom of the page.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const STATE_PATH = 'tmp/skyslope-session.json'
const OUT_DIR = 'tmp/skyslope-ui-folder-postback'
const TXN_ID_B64 = 'MjAxNzY4NTM='
const DOCS_URL = `https://app.skyslope.com/TransactionDocuments.aspx?TransactionID=${TXN_ID_B64}&ListingID=MA==&checklistId=MA==`

const FOLDERS = [
  { label: 'Admin', postbackTarget: 'ctl00$ContentPlaceHolder1$GVListingCheckList$ctl49$lnkFileName' },
  { label: 'Incomplete', postbackTarget: 'ctl00$ContentPlaceHolder1$GVListingCheckList$ctl50$lnkFileName' },
  { label: 'Trash', postbackTarget: 'ctl00$ContentPlaceHolder1$GVListingCheckList$ctl51$lnkFileName' },
]

await fs.mkdir(OUT_DIR, { recursive: true })

const browser = await chromium.launch({ headless: false, slowMo: 200 })
const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1500, height: 950 } })
const page = await context.newPage()

const report = { folders: [] }

try {
  await page.goto(DOCS_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)

  for (const folder of FOLDERS) {
    console.log(`\n=== Entering folder "${folder.label}" via __doPostBack ===`)
    // Re-navigate to docs root before each click to ensure baseline
    await page.goto(DOCS_URL, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    // Invoke __doPostBack and wait for the resulting page to re-render
    await page.evaluate((target) => {
      if (typeof window.__doPostBack === 'function') window.__doPostBack(target, '')
    }, folder.postbackTarget)

    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(3000)

    const shotPath = path.join(OUT_DIR, `folder-${folder.label.toLowerCase()}.png`)
    await page.screenshot({ path: shotPath, fullPage: true })

    const url = page.url()
    // Pull breadcrumb / current folder indicator if present
    const breadcrumbText = await page.locator('.breadcrumb, [class*="breadcrumb"], .folder-path, #folderPath').first().innerText().catch(() => '')

    // Extract visible doc names from inside the GVListingCheckList table
    const docs = await page.evaluate(() => {
      const out = []
      const labels = document.querySelectorAll('#ContentPlaceHolder1_GVListingCheckList span[id*="lblName"], #ContentPlaceHolder1_GVListingCheckList span[id*="Label1"]')
      for (const s of labels) {
        const t = (s.textContent || '').trim()
        if (t && !out.includes(t)) out.push(t)
      }
      return out
    })

    console.log(`  url: ${url}`)
    console.log(`  breadcrumb: "${breadcrumbText.slice(0, 100)}"`)
    console.log(`  ${docs.length} doc labels visible:`)
    for (const d of docs.slice(0, 30)) console.log(`    ${d}`)
    if (docs.length > 30) console.log(`    ... + ${docs.length - 30} more`)

    report.folders.push({ label: folder.label, url, breadcrumb: breadcrumbText, docs })
  }
} catch (e) {
  console.error('FATAL', e)
} finally {
  await fs.writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2))
  await page.waitForTimeout(2000)
  await browser.close()
}
