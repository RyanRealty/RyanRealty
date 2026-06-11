#!/usr/bin/env node
/**
 * Quick probe: dump the Move-to-Folder dropdown menu options on
 * Canceled-B's Documents page to discover Matt's new "Archive" folder
 * ID and value-encoding.
 *
 * Also captures the checkbox input names so the bulk-move script knows
 * how to address each doc.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const STATE_PATH = 'tmp/skyslope-session.json'
const OUT_DIR = 'tmp/skyslope-ui-menu-probe'
const TXN_ID_B64 = 'MjAxNzY4NTM='
const DOCS_URL = `https://app.skyslope.com/TransactionDocuments.aspx?TransactionID=${TXN_ID_B64}&ListingID=MA==&checklistId=MA==`

await fs.mkdir(OUT_DIR, { recursive: true })

const browser = await chromium.launch({ headless: false, slowMo: 100 })
const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1500, height: 950 } })
const page = await context.newPage()

try {
  await page.goto(DOCS_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await page.screenshot({ path: path.join(OUT_DIR, 'landing.png'), fullPage: true })

  const menuItems = await page.evaluate(() => {
    const list = document.querySelector('#divdrpDownMoveButton ol#menu, #divdrpDownMoveButton ol, #divdrpDownMoveButton ul')
    if (!list) return { found: false }
    const items = []
    for (const li of list.querySelectorAll('li')) {
      items.push({
        id: li.id || null,
        value: li.getAttribute('value'),
        text: (li.textContent || '').trim(),
        onclick: li.getAttribute('onclick'),
      })
    }
    return { found: true, items }
  })

  console.log('Move dropdown menu items:')
  console.log(JSON.stringify(menuItems, null, 2))

  // Also capture checkbox structure for first few rows
  const checkboxInfo = await page.evaluate(() => {
    const boxes = document.querySelectorAll('#ContentPlaceHolder1_GVListingCheckList input[type="checkbox"]')
    const out = []
    for (let i = 0; i < Math.min(boxes.length, 5); i++) {
      const b = boxes[i]
      out.push({ name: b.name, id: b.id, value: b.value, checked: b.checked })
    }
    return { total: boxes.length, sample: out }
  })
  console.log('\nCheckbox info:')
  console.log(JSON.stringify(checkboxInfo, null, 2))

  // Look for the move/action buttons
  const buttons = await page.evaluate(() => {
    const list = []
    for (const el of document.querySelectorAll('button, input[type="submit"], input[type="button"], a.btn')) {
      const t = ((el.value || el.textContent || '').trim()).slice(0, 40)
      if (!t) continue
      list.push({ tag: el.tagName.toLowerCase(), text: t, id: el.id, name: el.name, onclick: (el.getAttribute('onclick') || '').slice(0, 200) })
    }
    return list
  })
  console.log(`\nButtons/actions found: ${buttons.length}`)
  for (const b of buttons.filter((b) => /Move|Assign|Unassign|Folder|Trash|Delete|Download/i.test(b.text))) {
    console.log(`  [${b.tag}] "${b.text}"  id=${b.id}  onclick=${b.onclick.slice(0, 80)}`)
  }

  await fs.writeFile(path.join(OUT_DIR, 'menu.json'), JSON.stringify({ menuItems, checkboxInfo, buttons }, null, 2))
} finally {
  await page.waitForTimeout(1000)
  await browser.close()
}
