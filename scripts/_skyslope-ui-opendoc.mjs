#!/usr/bin/env node
/**
 * Invoke the SkySlope opendoc() folder function directly. Listen for new
 * pages or navigation. opendoc signature for folders:
 *   opendoc('DocumentView.aspx?k=', folderId, element, base64FolderName, isFolder)
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const STATE_PATH = 'tmp/skyslope-session.json'
const OUT_DIR = 'tmp/skyslope-ui-opendoc'
const TXN_ID_B64 = 'MjAxNzY4NTM='
const DOCS_URL = `https://app.skyslope.com/TransactionDocuments.aspx?TransactionID=${TXN_ID_B64}&ListingID=MA==&checklistId=MA==`

const FOLDERS = [
  { label: 'Admin', id: '0', b64: 'QWRtaW4=' },
  { label: 'Incomplete', id: '21551', b64: 'SW5jb21wbGV0ZQ==' },
  { label: 'Trash', id: '0', b64: 'VHJhc2g=' },
]

await fs.mkdir(OUT_DIR, { recursive: true })

const browser = await chromium.launch({ headless: false, slowMo: 200 })
const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1500, height: 950 } })
const page = await context.newPage()

const report = {}

context.on('page', async (newPage) => {
  console.log(`  >>> NEW PAGE OPENED: ${newPage.url()}`)
})

try {
  for (const folder of FOLDERS) {
    console.log(`\n=== opendoc("DocumentView.aspx?k=", "${folder.id}", null, "${folder.b64}", true) → ${folder.label} ===`)
    await page.goto(DOCS_URL, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    const pagesBefore = context.pages().length

    const result = await page.evaluate(({ id, b64 }) => {
      // Find the actual folder anchor (we need a real `this` element)
      const anchor = document.querySelector(`a[onclick*="${b64}"]`)
      if (!anchor) return { error: 'anchor not found' }
      try {
        if (typeof opendoc === 'function') {
          const r = opendoc('DocumentView.aspx?k=', id, anchor, b64, true)
          return { invoked: 'opendoc', returned: r }
        }
        // Fallback: dispatch the actual click via the onclick attribute
        const oc = anchor.getAttribute('onclick')
        // eslint-disable-next-line no-eval
        const r2 = eval(oc)
        return { invoked: 'eval-onclick', returned: r2 }
      } catch (e) {
        return { error: e.message }
      }
    }, { id: folder.id, b64: folder.b64 })

    console.log(`  result: ${JSON.stringify(result)}`)
    await page.waitForTimeout(3500)

    const pagesAfter = context.pages().length
    console.log(`  page count before: ${pagesBefore}, after: ${pagesAfter}`)

    // Inspect all pages for content
    for (const p of context.pages()) {
      console.log(`  page url: ${p.url()}`)
      if (p.url().includes('DocumentView') || p.url().includes('TransactionDocuments')) {
        const shot = path.join(OUT_DIR, `${folder.label.toLowerCase()}-${p.url().slice(-30).replace(/[^a-z0-9]+/gi, '_')}.png`)
        try { await p.screenshot({ path: shot, fullPage: true }) } catch {}
      }
    }

    report[folder.label] = { result, openPages: context.pages().map((p) => p.url()) }
  }
} catch (e) {
  console.error('FATAL', e)
} finally {
  await fs.writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2))
  await page.waitForTimeout(2000)
  await browser.close()
}
