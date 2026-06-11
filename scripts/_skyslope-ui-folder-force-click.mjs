#!/usr/bin/env node
/**
 * Force-click each visible folder row at the bottom of the Documents
 * view, bypassing actionability checks. Then capture the post-click
 * page state to see if the folder filter actually applied.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const STATE_PATH = 'tmp/skyslope-session.json'
const OUT_DIR = 'tmp/skyslope-ui-force-click'
const TXN_ID_B64 = 'MjAxNzY4NTM='
const DOCS_URL = `https://app.skyslope.com/TransactionDocuments.aspx?TransactionID=${TXN_ID_B64}&ListingID=MA==&checklistId=MA==`

await fs.mkdir(OUT_DIR, { recursive: true })

const browser = await chromium.launch({ headless: false, slowMo: 200 })
const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1500, height: 950 } })
const page = await context.newPage()

const report = {}

try {
  for (const folderLabel of ['Admin', 'Incomplete', 'Trash']) {
    console.log(`\n=== Force-clicking "${folderLabel}" folder row ===`)
    await page.goto(DOCS_URL, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)

    // Find the folder ROW (not the dropdown menu item) — it should contain
    // a fa-folder icon and the label text. The bottom folder rows are inside
    // the GVListingCheckList table.
    const folderRow = page.locator(`#ContentPlaceHolder1_GVListingCheckList span.fa-folder + span:has-text("${folderLabel}"), #ContentPlaceHolder1_GVListingCheckList span:has-text("${folderLabel}")`).filter({ has: page.locator(':scope') }).first()

    // Alternate: find the <a> with onclick that has the folder name base64-encoded
    const folderB64 = Buffer.from(folderLabel).toString('base64')
    console.log(`  base64(${folderLabel}) = ${folderB64}`)

    const anchorWithB64 = page.locator(`a[onclick*="${folderB64}"]`).first()
    console.log(`  anchorWithB64 count: ${await anchorWithB64.count()}`)

    let didClick = false
    try {
      await anchorWithB64.scrollIntoViewIfNeeded({ timeout: 3000 })
      await anchorWithB64.click({ force: true, timeout: 5000 })
      didClick = true
      console.log(`  force-clicked folder anchor`)
    } catch (e) {
      console.log(`  anchor force-click failed: ${e.message.slice(0, 100)}`)
    }

    if (!didClick) {
      // Try invoking the onclick handler directly
      try {
        await page.evaluate((b64) => {
          const sel = `a[onclick*="${b64}"]`
          const links = document.querySelectorAll(sel)
          if (links.length) {
            // Force click via dispatch
            const ev = new MouseEvent('click', { bubbles: true, cancelable: true })
            links[0].dispatchEvent(ev)
            return links.length
          }
          return 0
        }, folderB64)
        didClick = true
        console.log(`  dispatched click event via page.evaluate`)
      } catch (e) {
        console.log(`  dispatch failed: ${e.message.slice(0, 80)}`)
      }
    }

    await page.waitForTimeout(3500)

    const url = page.url()
    const shot = path.join(OUT_DIR, `folder-${folderLabel.toLowerCase()}.png`)
    await page.screenshot({ path: shot, fullPage: true })

    // Extract visible filenames from the file list area only (within the
    // checklist gridview, skipping the folder rows themselves)
    const docs = await page.evaluate(() => {
      const out = []
      const labels = document.querySelectorAll('#ContentPlaceHolder1_GVListingCheckList span[id*="lblName"]')
      for (const s of labels) {
        const t = (s.textContent || '').trim()
        if (t && t !== 'Admin' && t !== 'Incomplete' && t !== 'Trash') out.push(t)
      }
      return out
    })
    console.log(`  url: ${url}`)
    console.log(`  ${docs.length} doc names extracted:`)
    for (const d of docs.slice(0, 20)) console.log(`    ${d}`)
    if (docs.length > 20) console.log(`    ... + ${docs.length - 20} more`)

    report[folderLabel] = { url, docs }
  }
} catch (e) {
  console.error('FATAL', e)
} finally {
  await fs.writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2))
  await page.waitForTimeout(1500)
  await browser.close()
}
