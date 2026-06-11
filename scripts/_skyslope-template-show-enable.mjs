#!/usr/bin/env node
/**
 * Enable the "Show" checkbox for the new Residential Sale — Legacy
 * template (id 1784213) so it becomes available for folder assignment.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const STATE_PATH = path.join(process.cwd(), 'tmp/skyslope-session.json')
const OUTDIR = path.join(process.cwd(), 'tmp/template-show-enable')
await fs.mkdir(OUTDIR, { recursive: true })

const TEMPLATE_ID = 1784213
const TEMPLATE_NAME = 'Residential Sale — Legacy'
const OFFICE_ID = 28920
const EXECUTE = process.argv.includes('--execute')

const browser = await chromium.launch({ headless: true, slowMo: 100 })
const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1600, height: 1000 } })
const page = await context.newPage()
let snapIdx = 0
async function snap(label) {
  await page.screenshot({ path: path.join(OUTDIR, `${String(snapIdx++).padStart(2, '0')}-${label}.png`) })
}

try {
  console.log(`Opening office templates list (officeid=${OFFICE_ID})`)
  await page.goto(`https://app.skyslope.com/BrokerMasterChecklist.aspx?officeid=${OFFICE_ID}&Type=MQ==`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  await snap('open')

  console.log(`Finding "${TEMPLATE_NAME}" row + dumping ALL its inputs`)
  const found = await page.evaluate((name) => {
    const norm = (s) => (s || '').replace(/\s+/g, ' ').trim()
    const rows = [...document.querySelectorAll('table tr')]
    for (const r of rows) {
      const cells = [...(r.cells || [])].map((c) => norm(c.innerText))
      if (cells.some((c) => c === name)) {
        const allInputs = [...r.querySelectorAll('input')].map((i) => ({
          type: i.type,
          name: i.name,
          id: i.id,
          checked: i.checked,
          value: i.value,
        }))
        const allCheckboxes = [...r.querySelectorAll('input[type="checkbox"]')].map((c) => ({
          id: c.id,
          name: c.name,
          checked: c.checked,
        }))
        const cellHtml = [...(r.cells || [])].map((c) => c.innerHTML.slice(0, 200))
        return { ok: true, cells, allInputs, allCheckboxes, cellHtml }
      }
    }
    return { ok: false }
  }, TEMPLATE_NAME)
  console.log(`  Result: ${JSON.stringify(found)}`)
  if (!found.ok || !found.showCheckboxId) throw new Error(`Could not find Show checkbox for "${TEMPLATE_NAME}"`)

  if (found.showCheckboxChecked) {
    console.log(`  Show is ALREADY checked. No action needed.`)
    await browser.close()
    process.exit(0)
  }

  if (!EXECUTE) {
    console.log(`\n[DRY RUN] Show is unchecked. Would force-check + click Save. Pass --execute.`)
    await browser.close()
    process.exit(0)
  }

  console.log(`Force-check via JS`)
  const checked = await page.evaluate((id) => {
    const cb = document.getElementById(id)
    if (!cb) return { ok: false }
    cb.checked = true
    cb.dispatchEvent(new Event('change', { bubbles: true }))
    cb.dispatchEvent(new Event('click', { bubbles: true }))
    return { ok: true, checked: cb.checked, hidden: cb.offsetParent === null }
  }, found.showCheckboxId)
  console.log(`  ${JSON.stringify(checked)}`)
  await snap('show-checked')

  // SkySlope's typical pattern: Show changes are auto-saved on toggle via a
  // page postback. But to be safe, look for a global Save / Submit button.
  console.log(`Looking for save / submit button...`)
  const saveProbe = await page.evaluate(() => {
    return [...document.querySelectorAll('a, button, input[type="submit"]')]
      .filter((e) => e.offsetParent !== null)
      .filter((e) => /save|submit|update|apply/i.test((e.innerText || e.value || e.id || '').trim()))
      .map((e) => ({ tag: e.tagName.toLowerCase(), text: (e.innerText || e.value || '').trim().slice(0, 40), id: e.id }))
  })
  console.log(`  Save candidates: ${JSON.stringify(saveProbe)}`)

  // If there's a save button, click it. Otherwise the change may auto-postback.
  if (saveProbe.length > 0) {
    const sel = `#${saveProbe[0].id}`
    console.log(`  Clicking ${sel}`)
    await page.locator(sel).click()
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2500)
    await snap('after-save')
  } else {
    console.log(`  No explicit save button. Triggering postback by toggling and waiting.`)
    await page.waitForTimeout(2000)
  }

  // Verify
  console.log(`Verifying`)
  await page.goto(`https://app.skyslope.com/BrokerMasterChecklist.aspx?officeid=${OFFICE_ID}&Type=MQ==`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  const after = await page.evaluate((name) => {
    const norm = (s) => (s || '').replace(/\s+/g, ' ').trim()
    for (const r of document.querySelectorAll('table tr')) {
      const cells = [...(r.cells || [])].map((c) => norm(c.innerText))
      if (cells.some((c) => c === name)) {
        const showCb = r.querySelector('input[type="checkbox"][id*="chkShowHide"]')
        return { ok: true, checked: showCb?.checked, cells }
      }
    }
    return { ok: false }
  }, TEMPLATE_NAME)
  console.log(`  After: ${JSON.stringify(after)}`)
  await snap('verify')
} catch (err) {
  console.error(`ERROR: ${err.message}`)
  process.exitCode = 1
  await snap('error')
} finally {
  await browser.close()
}
