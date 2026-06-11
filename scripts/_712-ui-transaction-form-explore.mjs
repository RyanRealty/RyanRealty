#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const STATE_PATH = 'tmp/skyslope-session.json'
const OUT = 'tmp/712-ui-checklist-explore'
const TXN_B64 = Buffer.from('21849771').toString('base64')
await fs.mkdir(OUT, { recursive: true })

const URLS = [
  `https://app.skyslope.com/CreateTransaction.aspx?TransactionID=${TXN_B64}&ListingID=MA==&checklistId=MA==`,
  `https://app.skyslope.com/TransactionChecklist.aspx?TransactionID=${TXN_B64}&ListingID=MA==&checklistId=MA==`,
  `https://app.skyslope.com/CreateTransactionProperty.aspx?TransactionID=${TXN_B64}&ListingID=MA==&checklistId=MA==`,
]

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1500, height: 950 } })
const page = await context.newPage()

for (let i = 0; i < URLS.length; i++) {
  const url = URLS[i]
  console.log(`\n=== ${url} ===`)
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const label = url.split('/').pop()?.split('?')[0] ?? `page-${i}`
  await page.screenshot({ path: path.join(OUT, `tx-${String(i).padStart(2, '0')}-${label}.png`), fullPage: true })
  const hits = await page.evaluate(() => {
    const norm = (s) => (s || '').replace(/\s+/g, ' ').trim()
    const selects = [...document.querySelectorAll('select')].map((s) => ({
      id: s.id,
      name: s.name,
      visible: s.offsetParent !== null,
      disabled: s.disabled,
      value: s.value,
      options: [...s.options].map((o) => ({ text: norm(o.text), value: o.value })),
    }))
    const inputs = [...document.querySelectorAll('input[type="text"], input:not([type])')].map((i) => ({
      id: i.id,
      name: i.name,
      visible: i.offsetParent !== null,
      value: (i.value || '').slice(0, 80),
      readonly: i.readOnly,
    })).filter((i) => i.visible && /office|checklist|property|type/i.test(i.id + i.name + i.value))
    const text = norm(document.body.innerText)
    const snippet = text.match(/.{0,40}(CHECKLIST TYPE|OFFICE|Property Type|Residential).{0,80}/gi) ?? []
    return { title: document.title, url: location.href, selects: selects.filter((s) => s.visible || /office|checklist|property|type/i.test(s.id + s.name)), inputs, snippet }
  })
  console.log(JSON.stringify(hits, null, 2))
}

await browser.close()
