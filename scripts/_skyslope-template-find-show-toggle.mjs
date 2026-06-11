#!/usr/bin/env node
/**
 * Find where the "Show" / "Active" toggle for a template lives.
 *
 * Strategies:
 *   1. Look on the template edit page header for any toggle.
 *   2. Look on the office list page for a hidden checkbox we missed.
 *   3. Compare with Residential — On-Site Utilities (active office template, presumably has Show=checked).
 *   4. Inspect Master view officeid=-1 for chkShowHide.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const STATE_PATH = path.join(process.cwd(), 'tmp/skyslope-session.json')
const OUTDIR = path.join(process.cwd(), 'tmp/template-find-show-toggle')
await fs.mkdir(OUTDIR, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1600, height: 1000 } })
const page = await context.newPage()

function b64(n) { return Buffer.from(String(n)).toString('base64') }

async function snap(label) {
  await page.screenshot({ path: path.join(OUTDIR, `${label}.png`), fullPage: true })
}

async function probeListInputs(label, url) {
  console.log(`\n=== ${label}: ${url} ===`)
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await snap(label)
  const rows = await page.evaluate(() => {
    const norm = (s) => (s || '').replace(/\s+/g, ' ').trim()
    return [...document.querySelectorAll('table tr')].map((r) => {
      const cells = [...(r.cells || [])].map((c) => norm(c.innerText))
      const inputs = [...r.querySelectorAll('input')].map((i) => ({
        type: i.type,
        id: i.id,
        name: i.name,
        checked: i.checked,
        visible: i.offsetParent !== null,
      }))
      // Look for hidden checkboxes too
      const hiddenCbs = [...r.querySelectorAll('input[type="checkbox"]')].map((c) => ({
        id: c.id,
        checked: c.checked,
      }))
      return { cells, inputs, hiddenCbs }
    }).filter((r) => r.cells.length > 1 && (
      /On-Site|Sale.*Legacy|Standard|Commercial/i.test(r.cells.join(' '))
    ))
  })
  for (const r of rows) {
    console.log(`  ${r.cells.slice(0,3).join(' | ')}`)
    for (const i of r.inputs) {
      console.log(`    input type=${i.type} id=${i.id} checked=${i.checked} visible=${i.visible}`)
    }
  }
}

await probeListInputs('office-28920-list', 'https://app.skyslope.com/BrokerMasterChecklist.aspx?officeid=28920&Type=MQ==')
await probeListInputs('master-neg1-list', 'https://app.skyslope.com/BrokerMasterChecklist.aspx?officeid=-1&Type=MQ==')

// Now visit the template edit page header to see if there's a Show toggle there
const editUrl = `https://app.skyslope.com/BrokerCheckListActivityListTransaction.aspx?${new URLSearchParams({
  PropertyTypeId: b64(1784213),
  CheckListType: '1',
  officeid: '28920',
  CheckListName: 'Residential Sale — Legacy',
  ParentID: '0',
  checkSingleOfficeAuditor: 'No',
})}`
console.log(`\n=== Template edit page header ===`)
await page.goto(editUrl, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)
await snap('edit-header')

// Dump all checkboxes/toggles in the page outside the activity table
const pageInputs = await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('input[type="checkbox"], input[type="radio"]')]
  return inputs.map((i) => ({
    type: i.type,
    id: i.id,
    name: i.name,
    checked: i.checked,
    visible: i.offsetParent !== null,
    parentTag: i.closest('tr') ? 'tr' : i.parentElement?.tagName,
    nearbyLabel: i.closest('label')?.innerText?.slice(0, 50) ?? '',
  }))
})
console.log(`  ${pageInputs.length} checkboxes/radios on page:`)
for (const i of pageInputs.slice(0, 40)) {
  if (i.parentTag === 'tr') continue // skip activity-table rows
  console.log(`    ${i.type} id=${i.id} checked=${i.checked} visible=${i.visible} label="${i.nearbyLabel}"`)
}

await browser.close()
console.log(`\nScreenshots: ${path.relative(process.cwd(), OUTDIR)}/`)
