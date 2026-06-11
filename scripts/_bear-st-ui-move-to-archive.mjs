#!/usr/bin/env node
/**
 * Phase 8b for 15352 Bear St (2b9046c3): auto-create "Archive" custom
 * folder if missing, then bulk-move every ARCHIVE-prefixed doc into it
 * via ASP.NET postback.
 *
 * Adapted from _712-ui-move-to-archive.mjs — same proven flow.
 *
 * Usage:
 *   node scripts/_bear-st-ui-move-to-archive.mjs              # dry-run
 *   node scripts/_bear-st-ui-move-to-archive.mjs --execute    # apply
 *
 * Requires fresh tmp/skyslope-session.json from scripts/_skyslope-login-capture.mjs.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const STATE_PATH = 'tmp/skyslope-session.json'
const OUT_DIR = 'tmp/bear-st-ui-archive'
const TARGET = {
  label: '15352 Bear St',
  saleGuid: '2b9046c3-25aa-4efd-b4b1-bd381d6f2a8d',
  txnInt: '21889443',  // resolved from ManageTransactions.aspx Closed page 2 via imgBtnNext3
}
const APPLY = process.argv.includes('--execute')

await fs.mkdir(OUT_DIR, { recursive: true })

function b64(s) { return Buffer.from(String(s)).toString('base64') }

async function dismissMfaModal(page) {
  await page.evaluate(() => {
    // Click "Not Now" if MFA modal visible
    const btns = [...document.querySelectorAll('button, a')]
    for (const b of btns) {
      const t = (b.textContent || '').trim().toLowerCase()
      if (t === 'not now' || t === 'dismiss' || t === 'close') { b.click(); return }
    }
    // Or hide any visible modal overlay
    for (const m of document.querySelectorAll('.modal, [role="dialog"], .ui-dialog')) {
      m.style.display = 'none'
    }
  })
  await page.waitForTimeout(500)
}

async function harvestHits(page, hintRegex) {
  return await page.evaluate((hintStr) => {
    const re = new RegExp(hintStr, 'i')
    const out = []
    for (const tr of document.querySelectorAll('tr')) {
      const text = (tr.textContent || '').slice(0, 400)
      if (!re.test(text)) continue
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
  }, hintRegex)
}

async function resolveTxnInt(page, propertyHint) {
  console.log(`Resolving TxnInt for "${propertyHint}" via ManageTransactions.aspx...`)
  await page.goto('https://app.skyslope.com/ManageTransactions.aspx', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await dismissMfaModal(page)
  await page.screenshot({ path: path.join(OUT_DIR, 'discovery-01-initial.png'), fullPage: true })

  // Try direct hit on initial page
  let hits = await harvestHits(page, propertyHint)
  console.log(`  Initial scan: ${hits.length} hits`)

  // If no hits, try paging through Closed Transactions section
  if (hits.length === 0) {
    console.log(`  Paging through Closed Transactions to Be Archived...`)
    for (let pageNum = 2; pageNum <= 20; pageNum++) {
      // Click "Next" or page number in the Closed Transactions pagination
      const advanced = await page.evaluate((p) => {
        // Find pagination near the Closed Transactions table
        const allPagers = document.querySelectorAll('.pagination, [class*="pager"], [class*="paging"]')
        for (const pager of allPagers) {
          const next = [...pager.querySelectorAll('a, button')].find((b) => {
            const t = (b.textContent || '').trim()
            return t === String(p) || (t.toLowerCase() === 'next' && p === 99)
          })
          if (next) { next.click(); return true }
        }
        return false
      }, pageNum)
      if (!advanced) break
      await page.waitForTimeout(1500)
      hits = await harvestHits(page, propertyHint)
      if (hits.length > 0) { console.log(`  Found on page ${pageNum}: ${hits.length} hits`); break }
    }
  }

  // Also try the search box if still nothing
  if (hits.length === 0) {
    console.log(`  Trying search box for "15352 Bear"...`)
    await page.evaluate(() => {
      const inps = document.querySelectorAll('input[type="search"], input[type="text"][id*="search" i], input[type="text"][id*="Search"], input[id*="txtSearch" i]')
      for (const inp of inps) {
        inp.value = '15352 Bear'
        inp.dispatchEvent(new Event('input', { bubbles: true }))
        inp.dispatchEvent(new Event('change', { bubbles: true }))
        inp.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }))
      }
    })
    await page.waitForTimeout(3000)
    hits = await harvestHits(page, propertyHint)
    await page.screenshot({ path: path.join(OUT_DIR, 'discovery-02-after-search.png'), fullPage: true })
  }

  for (const h of hits) console.log(`    [${h.id}] int=${h.integer} :: ${h.sample.slice(0, 100)}`)
  if (hits.length === 0) throw new Error(`No TxnInt found for "${propertyHint}"`)
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
  console.log(`\nUsing TxnInt = ${txnInt} (hard-coded after Closed page 2 discovery)\n`)

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
