#!/usr/bin/env node
/**
 * Phase 8b for 712 SW 1st St (f50fe2a6 / TxnInt to-be-resolved):
 * auto-create an "Archive" custom folder in the SkySlope Documents UI
 * if missing, then bulk-move every ARCHIVE-prefixed doc into it via
 * ASP.NET postback.
 *
 * Adapted from scripts/_nordic-ui-move-to-archive.mjs — same proven
 * flow, different folder.
 *
 * Usage:
 *   node scripts/_712-ui-move-to-archive.mjs              # dry-run
 *   node scripts/_712-ui-move-to-archive.mjs --execute    # apply
 *
 * Requires fresh tmp/skyslope-session.json from
 * scripts/_skyslope-login-capture.mjs.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const STATE_PATH = 'tmp/skyslope-session.json'
const OUT_DIR = 'tmp/712-ui-archive'
const TARGET = {
  label: '712 SW 1st St',
  saleGuid: 'f50fe2a6-226c-4f81-8a59-9fc9a46ea5df',
  txnInt: '21849771', // resolved from ManageTransactions.aspx page 3
}
const APPLY = process.argv.includes('--execute')

await fs.mkdir(OUT_DIR, { recursive: true })

function b64(s) { return Buffer.from(String(s)).toString('base64') }

async function resolveTxnInt(page, propertyHint = '712') {
  console.log(`Resolving TxnInt for "${propertyHint}" via ManageTransactions.aspx...`)
  await page.goto('https://app.skyslope.com/ManageTransactions.aspx', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const hits = await page.evaluate((hint) => {
    const out = []
    for (const tr of document.querySelectorAll('tr')) {
      const text = (tr.textContent || '').slice(0, 400)
      if (!new RegExp(`\\b${hint}\\b`, 'i').test(text)) continue
      const href = tr.getAttribute('data-href') || tr.getAttribute('data-url')
      if (!href) continue
      let integer = null
      const m = href.match(/TransactionID=([A-Za-z0-9%=]+)/)
      if (m) {
        try { integer = atob(decodeURIComponent(m[1])) } catch {}
      }
      out.push({ id: tr.id, href, integer, sample: text.replace(/\s+/g, ' ').slice(0, 200) })
    }
    return out
  }, propertyHint)
  console.log(`  Found ${hits.length} matches:`)
  for (const h of hits) console.log(`    [${h.id}] int=${h.integer} :: ${h.sample.slice(0, 100)}`)
  if (hits.length === 0) throw new Error(`No TxnInt found for "${propertyHint}" on ManageTransactions.aspx`)
  return hits.find((h) => h.integer)?.integer
}

async function findArchiveValue(page) {
  return await page.evaluate(() => {
    for (const li of document.querySelectorAll('#divdrpDownMoveButton ol li, #divdrpDownMoveButton ul li')) {
      const text = (li.textContent || '').trim()
      if (/^Archive$/i.test(text)) return { value: li.getAttribute('value'), id: li.id }
    }
    return null
  })
}

async function createArchiveFolder(page) {
  console.log(`  Archive folder missing — creating via CreateFolderModal`)
  await page.click('#CreateFolderModalButton', { force: true })
  await page.waitForTimeout(1500)
  const filled = await page.evaluate(() => {
    const modal = document.querySelector('#CreateFolderModal')
    if (!modal) return { ok: false, reason: 'no-modal' }
    const input = modal.querySelector('input[type="text"], input[type="search"]')
    if (!input) return { ok: false, reason: 'no-input' }
    input.value = 'Archive'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    return { ok: true }
  })
  if (!filled.ok) throw new Error(`CreateFolderModal: ${filled.reason}`)
  const submitted = await page.evaluate(() => {
    const modal = document.querySelector('#CreateFolderModal')
    for (const b of modal.querySelectorAll('button, input[type="submit"], input[type="button"]')) {
      const t = ((b.value || b.textContent || '').trim()).toLowerCase()
      if (/^(save|create|add|ok|submit)$/i.test(t)) { b.click(); return { ok: true, clicked: t } }
    }
    return { ok: false, reason: 'no-save-button' }
  })
  if (!submitted.ok) throw new Error(`CreateFolderModal save: ${submitted.reason}`)
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(3500)
}

const browser = await chromium.launch({ headless: false, slowMo: 200 })
const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1500, height: 950 } })
const page = await context.newPage()

const report = { label: TARGET.label, saleGuid: TARGET.saleGuid }
try {
  const txnInt = TARGET.txnInt
  report.txnInt = txnInt
  console.log(`\nUsing TxnInt = ${txnInt}\n`)

  const docsUrl = `https://app.skyslope.com/TransactionDocuments.aspx?TransactionID=${b64(txnInt)}&ListingID=MA==&checklistId=MA==`
  console.log(`Navigating to ${docsUrl}`)
  await page.goto(docsUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  if (/LoginIntegrated\.aspx/i.test(page.url())) throw new Error('Session expired — re-run login capture')
  await page.screenshot({ path: path.join(OUT_DIR, '01-before.png'), fullPage: true })

  let archive = await findArchiveValue(page)
  if (!archive) {
    if (!APPLY) {
      console.log(`  [DRY] Archive folder missing — would create + bulk-move`)
      report.dryRunMissingArchive = true
    } else {
      await createArchiveFolder(page)
      archive = await findArchiveValue(page)
      if (!archive) throw new Error('Archive folder still missing after creation')
    }
  }
  if (archive) {
    console.log(`  Archive folder: value="${archive.value}" id=${archive.id}`)
    report.archive = archive
  }

  const inventory = await page.evaluate(() => {
    const rows = document.querySelectorAll('#ContentPlaceHolder1_GVListingCheckList tr')
    const out = []
    for (const tr of rows) {
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
  console.log(`\n  ARCHIVE-prefixed docs visible: ${inventory.length}`)
  for (const d of inventory.slice(0, 8)) console.log(`    ${d.fileName}`)
  if (inventory.length > 8) console.log(`    ... + ${inventory.length - 8} more`)
  report.candidateCount = inventory.length

  if (inventory.length === 0) {
    console.log('  Nothing to move.')
  } else if (!APPLY) {
    console.log(`  [DRY] Would check ${inventory.length} boxes and postback to Archive (${archive?.value || '?'})`)
  } else {
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
      return { checked: n, bg1Checked: document.querySelectorAll('.bg1 input[type=checkbox]:checked').length }
    }, inventory.map((d) => d.checkboxId))
    console.log(`  Checked ${checked.checked}/${inventory.length} boxes (.bg1=${checked.bg1Checked})`)
    if (checked.bg1Checked === 0) throw new Error('No .bg1 checkboxes registered as checked.')
    await page.screenshot({ path: path.join(OUT_DIR, '02-checked.png'), fullPage: true })

    console.log(`  __doPostBack('divdrpDownMoveButton', '${archive.value}:Archive')`)
    await page.evaluate((v) => __doPostBack('divdrpDownMoveButton', `${v}:Archive`), archive.value)
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(5000)
    await page.screenshot({ path: path.join(OUT_DIR, '03-after.png'), fullPage: true })
    report.executed = true
  }
} catch (e) {
  console.error('FATAL', e.message)
  report.error = e.message
  try { await page.screenshot({ path: path.join(OUT_DIR, 'ERROR.png'), fullPage: true }) } catch {}
} finally {
  await fs.writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2))
  console.log(`\nReport → ${path.join(OUT_DIR, 'report.json')}`)
  await page.waitForTimeout(2000)
  await browser.close()
}
