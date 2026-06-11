#!/usr/bin/env node
/**
 * Phase 8b v2 for Bear St: move ARCHIVE-prefixed docs to Archive folder
 * ONE AT A TIME using Playwright's native page.check() (real user click).
 *
 * The bulk approach (_bear-st-ui-move-to-archive.mjs) moved only 1 of 21.
 * The JS-dispatched check events didn't accumulate properly. This script
 * goes one-at-a-time which is slower but reliable.
 *
 * Usage:
 *   node scripts/_bear-st-ui-move-to-archive-v2.mjs
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const STATE_PATH = 'tmp/skyslope-session.json'
const OUT_DIR = 'tmp/bear-st-ui-archive-v2'
const TXN_INT = '21889443'
const ARCHIVE_VALUE = '21889443Z33209-1'  // already discovered

function b64(s) { return Buffer.from(String(s)).toString('base64') }

await fs.mkdir(OUT_DIR, { recursive: true })

const browser = await chromium.launch({ headless: true, slowMo: 100 })
const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1500, height: 950 } })
const page = await context.newPage()

const docsUrl = `https://app.skyslope.com/TransactionDocuments.aspx?TransactionID=${b64(TXN_INT)}&ListingID=MA==&checklistId=MA==`
console.log(`Navigating to ${docsUrl}`)
await page.goto(docsUrl, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3500)

// Get inventory of remaining ARCHIVE-prefixed docs in MAIN (not yet moved)
async function getInventory() {
  return await page.evaluate(() => {
    const out = []
    let inArchiveFolder = false
    for (const tr of document.querySelectorAll('#ContentPlaceHolder1_GVListingCheckList tr')) {
      const text = (tr.textContent || '').trim()
      // Skip folder header rows
      if (/^\s*[-+]?\s*(Admin|Archive|Trash)\s*(Delete|Rename|$)/.test(text.slice(0, 50))) {
        if (text.includes('Archive')) inArchiveFolder = true
        else if (text.includes('Trash')) inArchiveFolder = false
        continue
      }
      // Skip docs already inside Archive (nested under Archive header)
      if (inArchiveFolder) continue
      const lbl = tr.querySelector('span[id*="lblName"]')
      if (!lbl) continue
      const fileName = (lbl.textContent || '').trim()
      if (!/^ARCHIVE\s/i.test(fileName)) continue
      const cb = tr.querySelector('input[type="checkbox"][id*="chkdoc"]')
      if (!cb) continue
      out.push({ fileName, checkboxId: cb.id })
    }
    return out
  })
}

const log = []
let pass = 0
const MAX_PASSES = 25

while (pass < MAX_PASSES) {
  pass++
  const inventory = await getInventory()
  console.log(`\nPass ${pass}: ${inventory.length} ARCHIVE-prefixed docs still in main`)
  if (inventory.length === 0) {
    console.log(`✓ All ARCHIVE-prefixed docs have been moved.`)
    break
  }

  // Check JUST the first one using native click
  const target = inventory[0]
  console.log(`  Moving: ${target.fileName.slice(0, 70)}`)

  // Set checked + dispatch events (NOT el.click() which would toggle back).
  // This is the pattern the bulk script used that DID register bg1=21.
  await page.evaluate((id) => {
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ block: 'center' })
    if (!el.checked) {
      el.checked = true
      el.dispatchEvent(new Event('change', { bubbles: true }))
      el.dispatchEvent(new Event('click', { bubbles: true }))
    }
  }, target.checkboxId)
  await page.waitForTimeout(300)

  // Verify .bg1 count
  const checkedCount = await page.evaluate(() => document.querySelectorAll('.bg1 input[type=checkbox]:checked').length)
  if (checkedCount !== 1) {
    console.log(`    Warning: .bg1 sees ${checkedCount} checked, expected 1`)
  }

  // Fire postback
  await page.evaluate((v) => __doPostBack('divdrpDownMoveButton', `${v}:Archive`), ARCHIVE_VALUE)
  await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(2500)

  // Verify the doc is no longer in main
  const stillThere = await page.evaluate((id) => {
    const cb = document.getElementById(id)
    if (!cb) return 'no-element'
    const tr = cb.closest('tr')
    if (!tr) return 'no-tr'
    // Check if the row is now nested inside Archive folder (between Archive header and Trash)
    let archiveHeaderSeen = false
    for (const r of document.querySelectorAll('#ContentPlaceHolder1_GVListingCheckList tr')) {
      const t = (r.textContent || '').trim()
      if (/^\s*[-+]?\s*Archive\s*(Delete|Rename|$)/.test(t.slice(0, 30))) { archiveHeaderSeen = true; continue }
      if (/^\s*[-+]?\s*Trash/.test(t.slice(0, 20))) break
      if (r === tr && archiveHeaderSeen) return 'inside-archive'
    }
    return 'still-in-main'
  }, target.checkboxId)

  log.push({ pass, docName: target.fileName, checkboxId: target.checkboxId, result: stillThere })
  console.log(`    Result: ${stillThere}`)
  if (stillThere === 'still-in-main') {
    console.log(`    ! Move failed for this doc — taking screenshot + continuing`)
    await page.screenshot({ path: path.join(OUT_DIR, `fail-pass${pass}.png`), fullPage: true })
  }
}

await page.screenshot({ path: path.join(OUT_DIR, 'final-state.png'), fullPage: true })

await fs.writeFile(path.join(OUT_DIR, 'move-log.json'), JSON.stringify(log, null, 2))
const moved = log.filter((e) => e.result === 'inside-archive').length
const failed = log.filter((e) => e.result === 'still-in-main').length
console.log(`\n=== DONE ===`)
console.log(`Passes run: ${pass}`)
console.log(`Moved: ${moved}`)
console.log(`Failed: ${failed}`)
console.log(`Report: ${OUT_DIR}/move-log.json`)

await browser.close()
