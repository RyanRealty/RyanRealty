#!/usr/bin/env node
/**
 * Reuses saved login state to navigate Canceled-B's Documents view and
 * actually click into the Admin and Incomplete sub-folders, capturing
 * the doc lists inside each. Uses doPostBack invocation directly
 * (matching SkySlope's RaiseDropDownPostBack pattern) rather than
 * fighting with overlapping locators.
 *
 * Output: tmp/skyslope-ui-verify-admin/{folder}.{png,txt}
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const STATE_PATH = 'tmp/skyslope-session.json'
const OUT_DIR = 'tmp/skyslope-ui-verify-admin'
const TXN_ID_B64 = 'MjAxNzY4NTM=' // 20176853 = Canceled-B Nordic
const DOCS_URL = `https://app.skyslope.com/TransactionDocuments.aspx?TransactionID=${TXN_ID_B64}&ListingID=MA==&checklistId=MA==`
// Folder IDs discovered from DOM:
//   Main Documents = 20176853, Admin = 245, Incomplete = 21551, Trash = 246
const FOLDERS_TO_VISIT = [
  { label: 'Admin', id: 245, value: '20176853Z245-0' },
  { label: 'Incomplete', id: 21551, value: '20176853Z21551-1' },
]

await fs.mkdir(OUT_DIR, { recursive: true })

const browser = await chromium.launch({ headless: false, slowMo: 150 })
const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1500, height: 950 } })
const page = await context.newPage()

const report = { generatedAt: new Date().toISOString(), folders: [] }

try {
  console.log(`Navigating to ${DOCS_URL}`)
  await page.goto(DOCS_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  if (/LoginIntegrated\.aspx/i.test(page.url())) {
    throw new Error('Session expired. Re-run _skyslope-login-capture.mjs.')
  }
  await page.screenshot({ path: path.join(OUT_DIR, '00-landing.png'), fullPage: true })

  for (const folder of FOLDERS_TO_VISIT) {
    console.log(`\nClicking into ${folder.label} (id=${folder.id})...`)

    // Approach 1: scroll the folder anchor into view and click it directly
    const anchor = page.locator('div.dd-list a, ol.dd-list a, .dd-item a').filter({ hasText: folder.label }).first()
    let clicked = false
    if (await anchor.count()) {
      try {
        await anchor.scrollIntoViewIfNeeded({ timeout: 3000 })
        await anchor.click({ timeout: 4000 })
        clicked = true
        console.log(`  clicked anchor`)
      } catch (e) {
        console.log(`  anchor click failed: ${e.message.slice(0, 100)}`)
      }
    }

    // Approach 2: invoke the ASP.NET postback directly from page context.
    // The SkySlope handler is RaiseDropDownPostBack(element) where the
    // element's `value` attribute encodes the target folder.
    if (!clicked) {
      try {
        await page.evaluate((val) => {
          const fake = document.createElement('li')
          fake.value = val
          // Try the global handler
          if (typeof RaiseDropDownPostBack === 'function') RaiseDropDownPostBack(fake)
        }, folder.value)
        clicked = true
        console.log(`  invoked RaiseDropDownPostBack via page.evaluate`)
      } catch (e) {
        console.log(`  postback eval failed: ${e.message.slice(0, 100)}`)
      }
    }

    await page.waitForTimeout(2500)
    await page.waitForLoadState('domcontentloaded').catch(() => {})
    await page.waitForTimeout(1500)

    const shotPath = path.join(OUT_DIR, `folder-${folder.label.toLowerCase()}.png`)
    await page.screenshot({ path: shotPath, fullPage: true })
    const visibleText = await page.locator('body').innerText().catch(() => '')
    await fs.writeFile(path.join(OUT_DIR, `folder-${folder.label.toLowerCase()}.txt`), visibleText)
    const html = await page.content()
    await fs.writeFile(path.join(OUT_DIR, `folder-${folder.label.toLowerCase()}.html`), html)

    // Try to extract doc rows (the page has tables / list)
    const docRows = await page.evaluate(() => {
      const docs = []
      const lblSpans = document.querySelectorAll('span[id*="lblName"], span[id*="GVListingCheckList_lblName"], span.truncate')
      for (const s of lblSpans) {
        const t = (s.textContent || '').trim()
        if (t && /\.(pdf|jpe?g|png|docx?|zip)$/i.test(t)) docs.push(t)
        else if (t && /^ARCHIVE/i.test(t)) docs.push(t)
      }
      return [...new Set(docs)]
    })
    console.log(`  Folder "${folder.label}" — extracted ${docRows.length} doc names:`)
    for (const d of docRows.slice(0, 30)) console.log(`    ${d}`)

    report.folders.push({
      label: folder.label,
      url: page.url(),
      visibleDocs: docRows,
      visibleDocCount: docRows.length,
      screenshot: shotPath,
    })

    // Re-navigate to docs root before next folder
    if (folder !== FOLDERS_TO_VISIT.at(-1)) {
      await page.goto(DOCS_URL, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(2000)
    }
  }
} catch (e) {
  console.error('FATAL', e)
} finally {
  await fs.writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2))
  console.log(`\nReport → ${path.join(OUT_DIR, 'report.json')}`)
  await page.waitForTimeout(1000)
  await browser.close()
}
