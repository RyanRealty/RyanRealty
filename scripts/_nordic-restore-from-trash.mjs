#!/usr/bin/env node
/**
 * Restore every doc currently in the SkySlope UI "Trash" folder back
 * to Main Documents across the three Nordic transactions, leaving any
 * checklist activity assignment intact (per Matt's "do number 1"
 * decision 2026-05-24).
 *
 * Per-transaction flow:
 *   1. Navigate to TransactionDocuments.aspx
 *   2. Snapshot the row set (BEFORE)
 *   3. Click the Trash row's imgPlus link to inline-expand it
 *      (calls DisplayRows postback)
 *   4. Snapshot the row set (AFTER) — newly-visible rows are Trash contents
 *   5. Dry-run: report what would be restored
 *      Execute: check those rows, fire
 *        __doPostBack('divdrpDownMoveButton', '<txnInt>Z0-0:Main Documents')
 *
 * Usage:
 *   node scripts/_nordic-restore-from-trash.mjs                       # dry-run
 *   node scripts/_nordic-restore-from-trash.mjs --execute             # restore
 *   node scripts/_nordic-restore-from-trash.mjs --only Canceled-B     # one txn
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const STATE_PATH = 'tmp/skyslope-session.json'
const OUT_ROOT = 'tmp/nordic-restore-from-trash'

const NORDIC = [
  { label: 'Canceled-B', txnInt: '20176853' }, // seller-side, has 2 X docs in Trash
  { label: 'Canceled-A', txnInt: '20176813' }, // buyer-side
  { label: 'Closed', txnInt: '20597300' },
]

const APPLY = process.argv.includes('--execute')
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7) ||
  (process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null)

await fs.mkdir(OUT_ROOT, { recursive: true })

function b64(s) { return Buffer.from(String(s)).toString('base64') }
function docsUrl(txnInt) {
  return `https://app.skyslope.com/TransactionDocuments.aspx?TransactionID=${b64(txnInt)}&ListingID=MA==&checklistId=MA==`
}

async function snapshotRows(page) {
  return await page.evaluate(() => {
    const out = []
    for (const tr of document.querySelectorAll('#ContentPlaceHolder1_GVListingCheckList tr')) {
      const lbl = tr.querySelector('span[id*="lblName"]')
      if (!lbl) continue
      const text = (lbl.textContent || '').trim()
      const anchor = tr.querySelector('a[onclick*="opendoc"]')
      let docKey = null
      if (anchor) {
        const m = (anchor.getAttribute('onclick') || '').match(/opendoc\('DocumentView\.aspx\?k=([a-f0-9]+)/)
        if (m) docKey = m[1]
      }
      const checkbox = tr.querySelector('input[type="checkbox"][id*="chkdoc"]')
      // Visibility: ASP.NET uses style.display='none' for collapsed folder
      // contents; offsetParent === null when hidden.
      const visible = tr.offsetParent !== null
      out.push({
        text,
        docKey,
        checkboxId: checkbox?.id || null,
        checkboxName: checkbox?.name || null,
        visible,
      })
    }
    return out
  })
}

async function expandTrash(page) {
  // Find Trash row and click its imgPlus
  const found = await page.evaluate(() => {
    for (const tr of document.querySelectorAll('#ContentPlaceHolder1_GVListingCheckList tr')) {
      const lbl = tr.querySelector('span[id*="lblName"]')
      if (!lbl || (lbl.textContent || '').trim() !== 'Trash') continue
      const plus = tr.querySelector('a[id*="imgPlus"]')
      if (!plus) return { found: false, reason: 'no plus anchor in trash row' }
      return { found: true, plusId: plus.id, onclick: (plus.getAttribute('onclick') || '').slice(0, 200) }
    }
    return { found: false, reason: 'no trash row' }
  })
  if (!found.found) throw new Error(`Trash expand: ${found.reason}`)
  console.log(`  Expanding Trash via #${found.plusId}`)
  // Click the actual anchor by its ID — Playwright handles scrolling
  await page.locator(`#${found.plusId}`).click({ force: true, timeout: 8000 })
  await page.waitForLoadState('domcontentloaded').catch(() => {})
  await page.waitForTimeout(3500)
}

async function processTransaction(page, txn) {
  const dir = path.join(OUT_ROOT, txn.label)
  await fs.mkdir(dir, { recursive: true })
  console.log(`\n=== ${txn.label} (txnInt ${txn.txnInt}) ===`)

  const url = docsUrl(txn.txnInt)
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  if (/LoginIntegrated\.aspx/i.test(page.url())) throw new Error('Session expired')

  const before = await snapshotRows(page)
  const beforeVisible = before.filter((r) => r.visible)
  console.log(`  Rows before Trash expand: ${before.length} total, ${beforeVisible.length} visible`)
  await page.screenshot({ path: path.join(dir, '01-before.png'), fullPage: true })

  await expandTrash(page)
  await page.screenshot({ path: path.join(dir, '02-trash-expanded.png'), fullPage: true })
  const after = await snapshotRows(page)
  const afterVisible = after.filter((r) => r.visible)
  console.log(`  Rows after Trash expand: ${after.length} total, ${afterVisible.length} visible`)

  // Rows that became visible (display flipped from none → visible)
  const beforeVisibleKeys = new Set(beforeVisible.map((r) => r.docKey).filter(Boolean))
  const newRows = afterVisible.filter((r) => r.docKey && !beforeVisibleKeys.has(r.docKey))
  console.log(`  Trash docs revealed (became visible): ${newRows.length}`)
  for (const r of newRows) console.log(`    "${r.text}"  docKey=${r.docKey?.slice(0,8)}  checkbox=${r.checkboxId}`)

  if (newRows.length === 0) {
    console.log(`  Nothing in Trash for this transaction. Skipping.`)
    return { label: txn.label, trashDocs: 0 }
  }

  const candidatesWithCheckbox = newRows.filter((r) => r.checkboxId)
  console.log(`  With checkboxes: ${candidatesWithCheckbox.length}/${newRows.length}`)

  if (!APPLY) {
    console.log(`  [DRY] Would check ${candidatesWithCheckbox.length} boxes and postback to Main Documents`)
    return { label: txn.label, trashDocs: newRows.length, restorable: candidatesWithCheckbox.length, dryRun: true }
  }

  // Check all Trash doc checkboxes
  const checkResult = await page.evaluate((ids) => {
    let n = 0
    for (const id of ids) {
      const el = document.getElementById(id)
      if (!el) continue
      if (!el.checked) {
        el.checked = true
        el.dispatchEvent(new Event('change', { bubbles: true }))
        el.dispatchEvent(new Event('click', { bubbles: true }))
      }
      if (el.checked) n++
    }
    return { checked: n, bg1Checked: document.querySelectorAll('.bg1 input[type=checkbox]:checked').length }
  }, candidatesWithCheckbox.map((r) => r.checkboxId))
  console.log(`  Checked ${checkResult.checked} boxes (.bg1 sees ${checkResult.bg1Checked})`)
  await page.screenshot({ path: path.join(dir, '03-checked.png'), fullPage: true })

  if (checkResult.bg1Checked === 0) {
    throw new Error('No .bg1 checkboxes registered as checked. Postback will short-circuit.')
  }

  // Fire postback to Main Documents
  const mainValue = `${txn.txnInt}Z0-0`
  console.log(`  __doPostBack('divdrpDownMoveButton', '${mainValue}:Main Documents')`)
  await page.evaluate((val) => {
    __doPostBack('divdrpDownMoveButton', `${val}:Main Documents`)
  }, mainValue)
  await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(5000)
  await page.screenshot({ path: path.join(dir, '04-after-restore.png'), fullPage: true })

  return { label: txn.label, trashDocs: newRows.length, restored: candidatesWithCheckbox.length }
}

const browser = await chromium.launch({ headless: false, slowMo: 200 })
const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1500, height: 950 } })
const page = await context.newPage()

const grand = { mode: APPLY ? 'execute' : 'dry-run', generatedAt: new Date().toISOString(), transactions: [] }

try {
  for (const txn of NORDIC) {
    if (ONLY && txn.label !== ONLY) continue
    try {
      const r = await processTransaction(page, txn)
      grand.transactions.push(r)
    } catch (e) {
      console.error(`  ! ${txn.label} failed: ${e.message}`)
      grand.transactions.push({ label: txn.label, error: e.message })
    }
  }
} finally {
  await fs.writeFile(path.join(OUT_ROOT, 'report.json'), JSON.stringify(grand, null, 2))
  console.log(`\n=== SUMMARY ===`)
  for (const t of grand.transactions) {
    if (t.error) console.log(`  ${t.label}: ERROR ${t.error}`)
    else if (t.dryRun) console.log(`  ${t.label}: [DRY] would restore ${t.restorable}/${t.trashDocs} Trash docs to Main`)
    else if (t.trashDocs === 0) console.log(`  ${t.label}: Trash empty`)
    else console.log(`  ${t.label}: restored ${t.restored}/${t.trashDocs}`)
  }
  console.log(`Report → ${path.join(OUT_ROOT, 'report.json')}`)
  await page.waitForTimeout(2000)
  await browser.close()
}
