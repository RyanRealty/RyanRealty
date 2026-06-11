#!/usr/bin/env node
/**
 * Explore SkySlope UI paths to change checklist type on 712 sale.
 * Output: tmp/712-ui-checklist-explore/
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const STATE_PATH = 'tmp/skyslope-session.json'
const OUT = 'tmp/712-ui-checklist-explore'
const TXN_INT = '21849771'
const TXN_B64 = Buffer.from(TXN_INT).toString('base64')
await fs.mkdir(OUT, { recursive: true })

const URLS = [
  `https://app.skyslope.com/TransactionDocuments.aspx?TransactionID=${TXN_B64}&ListingID=MA==&checklistId=MA==`,
  `https://app.skyslope.com/TransactionInfo.aspx?TransactionID=${TXN_B64}&ListingID=MA==`,
  `https://app.skyslope.com/EditTransaction.aspx?TransactionID=${TXN_B64}&ListingID=MA==`,
  `https://app.skyslope.com/ManageTransactions.aspx`,
]

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1500, height: 950 } })
const page = await context.newPage()

for (let i = 0; i < URLS.length; i++) {
  const url = URLS[i]
  console.log(`\n=== ${url} ===`)
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  if (/LoginIntegrated/i.test(page.url())) throw new Error('Session expired')
  const label = url.split('/').pop()?.split('?')[0] ?? `page-${i}`
  await page.screenshot({ path: path.join(OUT, `${String(i).padStart(2, '0')}-${label}.png`), fullPage: true })

  const hits = await page.evaluate(() => {
    const norm = (s) => (s || '').replace(/\s+/g, ' ').trim()
    const selects = [...document.querySelectorAll('select')].map((s) => ({
      id: s.id,
      name: s.name,
      visible: s.offsetParent !== null,
      options: [...s.options].slice(0, 20).map((o) => norm(o.text)),
    }))
    const labels = [...document.querySelectorAll('label, span, td, th, a, button, input')]
      .map((el) => norm(el.innerText || el.value || ''))
      .filter((t) => /checklist|property type|template|office/i.test(t))
      .slice(0, 40)
    const links = [...document.querySelectorAll('a[href]')]
      .map((a) => ({ text: norm(a.innerText).slice(0, 60), href: a.getAttribute('href') || '' }))
      .filter((l) => /edit|info|setting|checklist|property|office/i.test(l.text + ' ' + l.href))
      .slice(0, 30)
    return { title: document.title, url: location.href, selects, labels, links }
  })
  console.log(JSON.stringify(hits, null, 2))
}

await browser.close()
console.log(`\nScreenshots: ${OUT}/`)
