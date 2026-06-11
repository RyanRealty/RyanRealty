#!/usr/bin/env node
/**
 * Phase 8b for 29500 SE Ochoco Way: create Archive custom folder + bulk-move
 * every ARCHIVE-prefixed doc into it via __doPostBack.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const STATE_PATH = 'tmp/skyslope-session.json'
const OUT_DIR = 'tmp/ochoco-way-ui-archive'
const TARGET = { label: '29500 SE Ochoco Way', saleGuid: 'eb9a24d6-f766-4fb7-bfca-a9c7e5b83cf5', txnInt: '21849962' }
const APPLY = process.argv.includes('--execute')

await fs.mkdir(OUT_DIR, { recursive: true })
function b64(s) { return Buffer.from(String(s)).toString('base64') }

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
  console.log('  Archive folder missing — creating via CreateFolderModal')
  await page.click('#CreateFolderModalButton', { force: true })
  await page.waitForTimeout(1500)
  await page.evaluate(() => {
    const modal = document.querySelector('#CreateFolderModal')
    const input = modal?.querySelector('input[type="text"], input[type="search"]')
    if (input) {
      input.value = 'Archive'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }
  })
  await page.evaluate(() => {
    const modal = document.querySelector('#CreateFolderModal')
    for (const b of modal.querySelectorAll('button, input[type="submit"], input[type="button"]')) {
      const t = ((b.value || b.textContent || '').trim()).toLowerCase()
      if (/^(save|create|add|ok|submit)$/i.test(t)) { b.click(); return }
    }
  })
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(3500)
}

const browser = await chromium.launch({ headless: false, slowMo: 200 })
const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1500, height: 950 } })
const page = await context.newPage()

const report = { ...TARGET }
try {
  console.log(`Using TxnInt = ${TARGET.txnInt}`)
  const docsUrl = `https://app.skyslope.com/TransactionDocuments.aspx?TransactionID=${b64(TARGET.txnInt)}&ListingID=MA==&checklistId=MA==`
  console.log(`Navigating to ${docsUrl}`)
  await page.goto(docsUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  if (/LoginIntegrated\.aspx/i.test(page.url())) throw new Error('Session expired')
  await page.screenshot({ path: path.join(OUT_DIR, '01-before.png'), fullPage: true })

  let archive = await findArchiveValue(page)
  if (!archive) {
    if (!APPLY) { console.log('  [DRY] Archive folder missing — would create + bulk-move'); report.dryRunMissingArchive = true }
    else { await createArchiveFolder(page); archive = await findArchiveValue(page); if (!archive) throw new Error('Archive folder still missing') }
  }
  if (archive) { console.log(`  Archive folder: value="${archive.value}" id=${archive.id}`); report.archive = archive }

  const inventory = await page.evaluate(() => {
    const out = []
    for (const tr of document.querySelectorAll('#ContentPlaceHolder1_GVListingCheckList tr')) {
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
  for (const d of inventory.slice(0, 6)) console.log(`    ${d.fileName.substring(0, 70)}`)
  if (inventory.length > 6) console.log(`    ... + ${inventory.length - 6} more`)
  report.candidateCount = inventory.length

  if (inventory.length === 0) console.log('  Nothing to move.')
  else if (!APPLY) console.log(`  [DRY] Would check ${inventory.length} boxes and postback to Archive`)
  else {
    const checked = await page.evaluate((ids) => {
      let n = 0
      for (const id of ids) {
        const el = document.getElementById(id)
        if (!el) continue
        if (!el.checked) { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); el.dispatchEvent(new Event('click', { bubbles: true })) }
        if (el.checked) n++
      }
      return { checked: n, bg1Checked: document.querySelectorAll('.bg1 input[type=checkbox]:checked').length }
    }, inventory.map((d) => d.checkboxId))
    console.log(`  Checked ${checked.checked}/${inventory.length} (.bg1=${checked.bg1Checked})`)
    await page.screenshot({ path: path.join(OUT_DIR, '02-checked.png'), fullPage: true })
    console.log(`  __doPostBack('divdrpDownMoveButton', '${archive.value}:Archive')`)
    await page.evaluate((v) => __doPostBack('divdrpDownMoveButton', `${v}:Archive`), archive.value)
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(5000)
    await page.screenshot({ path: path.join(OUT_DIR, '03-after.png'), fullPage: true })
    report.executed = true

    // Re-count
    const after = await page.evaluate(() => {
      let stillArchive = 0
      for (const tr of document.querySelectorAll('#ContentPlaceHolder1_GVListingCheckList tr')) {
        const lbl = tr.querySelector('span[id*="lblName"]')
        if (!lbl) continue
        if (/^ARCHIVE\s/i.test(lbl.textContent.trim())) stillArchive++
      }
      return stillArchive
    })
    console.log(`\n  Post-move ARCHIVE in main: ${after} (was ${inventory.length})`)
    report.postMove = { inMainStill: after, candidateCount: inventory.length, moved: inventory.length - after }
  }
} catch (e) {
  console.error('FATAL', e.message)
  report.error = e.message
  try { await page.screenshot({ path: path.join(OUT_DIR, 'ERROR.png'), fullPage: true }) } catch {}
} finally {
  await fs.writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2))
  await page.waitForTimeout(2000)
  await browser.close()
}
