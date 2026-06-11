#!/usr/bin/env node
/**
 * Bulk-move every ARCHIVE-prefixed document in the three Nordic
 * transactions into a per-transaction "Archive" custom folder, using
 * the SkySlope UI (not the API — `folder` field PATCH is decoupled
 * from the UI folder navigation).
 *
 * Per-transaction flow:
 *   1. Navigate to TransactionDocuments.aspx
 *   2. Read move dropdown to discover the Archive folder value, OR
 *      create it via the CreateFolderModal if missing
 *   3. Check every ARCHIVE-prefixed checkbox (inside .bg1 grid)
 *   4. Invoke __doPostBack('divdrpDownMoveButton', '<value>:Archive')
 *   5. Wait for postback, screenshot, verify count drop
 *
 * Usage:
 *   node scripts/_nordic-ui-move-to-archive.mjs                   # dry-run (no postback)
 *   node scripts/_nordic-ui-move-to-archive.mjs --execute         # actually move
 *   node scripts/_nordic-ui-move-to-archive.mjs --only Canceled-B # one transaction
 *
 * Output: tmp/nordic-ui-archive/<label>/{before,after}.png + report.json
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const STATE_PATH = 'tmp/skyslope-session.json'
const OUT_ROOT = 'tmp/nordic-ui-archive'

const NORDIC = [
  { label: 'Canceled-B', txnInt: '20176853' }, // seller-side canceled (33 ARCHIVE docs, has Archive folder)
  { label: 'Canceled-A', txnInt: '20176813' }, // buyer-side canceled (14 ARCHIVE docs)
  { label: 'Closed', txnInt: '20597300' },     // closed (72 ARCHIVE docs)
]

const APPLY = process.argv.includes('--execute')
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice('--only='.length) ||
  (process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null)

await fs.mkdir(OUT_ROOT, { recursive: true })

function b64(s) { return Buffer.from(String(s)).toString('base64') }
function docsUrl(txnInt) {
  return `https://app.skyslope.com/TransactionDocuments.aspx?TransactionID=${b64(txnInt)}&ListingID=MA==&checklistId=MA==`
}

async function findArchiveValue(page) {
  return await page.evaluate(() => {
    const items = document.querySelectorAll('#divdrpDownMoveButton ol li, #divdrpDownMoveButton ul li')
    for (const li of items) {
      const text = (li.textContent || '').trim()
      if (/^Archive$/i.test(text)) {
        return { value: li.getAttribute('value'), id: li.id, text }
      }
    }
    return null
  })
}

async function createArchiveFolder(page) {
  console.log(`  Archive folder missing — creating via CreateFolderModal`)
  // Click the Add Folder button to open the modal
  await page.click('#CreateFolderModalButton', { force: true })
  await page.waitForTimeout(1500)
  // Find the folder-name input inside #CreateFolderModal and fill it
  const filled = await page.evaluate(() => {
    const modal = document.querySelector('#CreateFolderModal')
    if (!modal) return { ok: false, reason: 'no-modal' }
    const input = modal.querySelector('input[type="text"], input[type="search"]')
    if (!input) return { ok: false, reason: 'no-input' }
    input.value = 'Archive'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    return { ok: true, inputId: input.id, inputName: input.name }
  })
  console.log(`    filled folder name input: ${JSON.stringify(filled)}`)
  if (!filled.ok) throw new Error(`CreateFolderModal: ${filled.reason}`)
  // Find and click a Save/Create/Add button in the modal
  const submitted = await page.evaluate(() => {
    const modal = document.querySelector('#CreateFolderModal')
    const btns = modal.querySelectorAll('button, input[type="submit"], input[type="button"]')
    for (const b of btns) {
      const t = ((b.value || b.textContent || '').trim()).toLowerCase()
      if (/^(save|create|add|ok|submit)$/i.test(t)) {
        b.click()
        return { ok: true, clicked: t }
      }
    }
    return { ok: false, reason: 'no-save-button' }
  })
  console.log(`    submitted folder modal: ${JSON.stringify(submitted)}`)
  if (!submitted.ok) throw new Error(`CreateFolderModal save: ${submitted.reason}`)
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(3500)
}

async function processTransaction(page, txn) {
  const dir = path.join(OUT_ROOT, txn.label)
  await fs.mkdir(dir, { recursive: true })
  const report = { label: txn.label, txnInt: txn.txnInt }
  console.log(`\n=== ${txn.label} (txnInt=${txn.txnInt}) ===`)

  await page.goto(docsUrl(txn.txnInt), { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  if (/LoginIntegrated\.aspx/i.test(page.url())) throw new Error('Session expired')
  await page.screenshot({ path: path.join(dir, '01-before.png'), fullPage: true })

  // Discover Archive folder value, create if missing
  let archive = await findArchiveValue(page)
  if (!archive) {
    if (!APPLY) {
      console.log(`  [DRY] Archive folder missing — would create via UI modal then bulk-move`)
      report.dryRunMissingArchive = true
      return report
    }
    await createArchiveFolder(page)
    archive = await findArchiveValue(page)
    if (!archive) throw new Error('Archive folder still missing after creation attempt')
  }
  console.log(`  Archive folder: value="${archive.value}" id=${archive.id}`)
  report.archive = archive

  // Inventory ARCHIVE-prefixed docs visible in main view
  const inventory = await page.evaluate(() => {
    const rows = document.querySelectorAll('#ContentPlaceHolder1_GVListingCheckList tr')
    const out = []
    for (const tr of rows) {
      const labelSpan = tr.querySelector('span[id*="lblName"]')
      if (!labelSpan) continue
      const fileName = (labelSpan.textContent || '').trim()
      if (!/^ARCHIVE\s/i.test(fileName)) continue
      const checkbox = tr.querySelector('input[type="checkbox"][id*="chkdoc"]')
      if (!checkbox) continue
      out.push({ fileName, checkboxId: checkbox.id, checkboxName: checkbox.name })
    }
    return out
  })
  console.log(`  ARCHIVE-prefixed docs in main view: ${inventory.length}`)
  for (const d of inventory.slice(0, 5)) console.log(`    ${d.fileName}`)
  if (inventory.length > 5) console.log(`    ... + ${inventory.length - 5} more`)
  report.candidateCount = inventory.length

  if (inventory.length === 0) {
    console.log(`  Nothing to move. Skipping.`)
    report.skipped = true
    return report
  }

  if (!APPLY) {
    console.log(`  [DRY] Would check ${inventory.length} checkboxes and __doPostBack to Archive (${archive.value})`)
    report.dryRun = true
    return report
  }

  // Check every candidate checkbox
  const checked = await page.evaluate((ids) => {
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
    return { checked: n, total: ids.length, bg1Checked: document.querySelectorAll('.bg1 input[type=checkbox]:checked').length }
  }, inventory.map((d) => d.checkboxId))
  console.log(`  Checked ${checked.checked}/${checked.total} checkboxes (.bg1 sees ${checked.bg1Checked} checked)`)
  await page.screenshot({ path: path.join(dir, '02-checked.png'), fullPage: true })

  if (checked.bg1Checked < inventory.length) {
    console.error(`  ! .bg1 sees only ${checked.bg1Checked} checked, expected ${inventory.length}. Postback may move only those it sees.`)
  }

  // Invoke postback
  console.log(`  __doPostBack('divdrpDownMoveButton', '${archive.value}:Archive')`)
  await page.evaluate((value) => {
    __doPostBack('divdrpDownMoveButton', value + ':Archive')
  }, archive.value)

  await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(5000)
  await page.screenshot({ path: path.join(dir, '03-after.png'), fullPage: true })

  // Re-inventory: count ARCHIVE-prefixed docs that are *unchecked* and at the
  // top level of the gridview (not nested under a folder row). The safest
  // proxy: count rows whose checkbox is enabled and label matches.
  const after = await page.evaluate(() => {
    const rows = document.querySelectorAll('#ContentPlaceHolder1_GVListingCheckList tr')
    let nArchiveTopLevel = 0
    let nAllArchive = 0
    for (const tr of rows) {
      const lbl = tr.querySelector('span[id*="lblName"]')
      const chk = tr.querySelector('input[type="checkbox"][id*="chkdoc"]')
      if (!lbl) continue
      const text = (lbl.textContent || '').trim()
      if (!/^ARCHIVE\s/i.test(text)) continue
      nAllArchive++
      // top-level rows have a real checkbox; nested-under-folder rows don't
      if (chk) nArchiveTopLevel++
    }
    return { nArchiveTopLevel, nAllArchive }
  })
  console.log(`  ARCHIVE-prefixed: top-level=${after.nArchiveTopLevel}, total-in-DOM=${after.nAllArchive}`)
  report.afterCount = after.nArchiveTopLevel
  report.archiveInDomTotal = after.nAllArchive
  report.moved = inventory.length - after.nArchiveTopLevel
  return report
}

// Resolve Closed Nordic integer transaction id by visiting ManageTransactions
async function resolveClosedNordic(page) {
  console.log(`Resolving Closed Nordic integer txnInt...`)
  await page.goto('https://app.skyslope.com/ManageTransactions.aspx', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const closedTxns = await page.evaluate(() => {
    const out = []
    // Cast a wider net: every <tr> with data-url or any element with data-url
    const all = document.querySelectorAll('[data-url]')
    for (const el of all) {
      const text = (el.textContent || '').slice(0, 1500)
      if (!/Nordic/i.test(text)) continue
      const url = el.getAttribute('data-url') || ''
      const m = url.match(/TransactionID=([A-Za-z0-9%=]+)/)
      let integer = null
      if (m) {
        try { integer = atob(decodeURIComponent(m[1])) } catch {}
      }
      // Try to detect Closed vs Canceled via badge text
      const status = (text.match(/\b(Closed|Cancel(?:ed)?|Pending|Active)\b/i) || [])[1] || '?'
      out.push({ integer, url, status, sample: text.replace(/\s+/g, ' ').slice(0, 200) })
    }
    return out
  })
  console.log(`  All Nordic rows on Manage page:`)
  for (const t of closedTxns) console.log(`    int=${t.integer}  status=${t.status}  "${t.sample.slice(0, 80)}"`)
  // Prefer one with status Closed (and not already in known canceled txnInts)
  const knownCanceled = new Set(['20176813', '20176853'])
  const closed = closedTxns.find((t) => t.integer && t.status === 'Closed' && !knownCanceled.has(t.integer))
    || closedTxns.find((t) => t.integer && !knownCanceled.has(t.integer))
  console.log(`  → picking Closed Nordic: int=${closed?.integer}`)
  return closed?.integer || null
}

const browser = await chromium.launch({ headless: false, slowMo: 150 })
const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1500, height: 950 } })
const page = await context.newPage()

const grand = { mode: APPLY ? 'execute' : 'dry-run', transactions: [] }

try {
  // Resolve Closed Nordic txnInt if needed
  const closed = NORDIC.find((t) => t.label === 'Closed')
  if (!closed.txnInt) {
    closed.txnInt = await resolveClosedNordic(page)
    if (!closed.txnInt) console.error(`Could not resolve Closed Nordic txnInt. Skipping that transaction.`)
  }

  for (const txn of NORDIC) {
    if (ONLY && txn.label !== ONLY) continue
    if (!txn.txnInt) { grand.transactions.push({ label: txn.label, error: 'no-txnInt' }); continue }
    try {
      const r = await processTransaction(page, txn)
      grand.transactions.push(r)
    } catch (e) {
      console.error(`  ! ${txn.label} failed: ${e.message}`)
      grand.transactions.push({ label: txn.label, error: e.message })
    }
  }
} catch (e) {
  console.error('FATAL', e)
} finally {
  await fs.writeFile(path.join(OUT_ROOT, 'report.json'), JSON.stringify(grand, null, 2))
  console.log(`\n=== SUMMARY ===`)
  for (const t of grand.transactions) {
    if (t.error) console.log(`  ${t.label}: ERROR ${t.error}`)
    else if (t.dryRun) console.log(`  ${t.label}: [DRY] would move ${t.candidateCount} docs to Archive (${t.archive?.value})`)
    else if (t.dryRunMissingArchive) console.log(`  ${t.label}: [DRY] Archive folder missing — would create + move`)
    else if (t.skipped) console.log(`  ${t.label}: nothing to move`)
    else console.log(`  ${t.label}: moved ${t.moved} (before=${t.candidateCount}, after=${t.afterCount})`)
  }
  console.log(`Report → ${path.join(OUT_ROOT, 'report.json')}`)
  await page.waitForTimeout(2000)
  await browser.close()
}
