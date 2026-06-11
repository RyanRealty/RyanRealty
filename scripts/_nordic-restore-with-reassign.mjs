#!/usr/bin/env node
/**
 * Restore a Trash doc that's locked by a checklist assignment.
 * Three-step dance:
 *   1. API: POST /checklist-items/{activityId}/unassign { documentGuid }
 *      (removes the SkySlope UI lock)
 *   2. UI: Playwright postback to move from Trash → Main
 *   3. API: POST /checklist-items/{activityId} { documentGuid }  (reassign)
 *
 * Currently scoped to the single known case (Canceled-B Repair Addendum).
 * Use --execute to apply. Dry-run by default.
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const BASE = 'https://api-latest.skyslope.com'
const STATE_PATH = 'tmp/skyslope-session.json'
const OUT_DIR = 'tmp/nordic-restore-with-reassign'
const APPLY = process.argv.includes('--execute')

const TARGETS = [
  {
    label: 'Canceled-B / Repair Addendum',
    saleGuid: '0ec95d31-1fed-4519-a114-e967513eac33',
    txnInt: '20176853',
    docId: '1eee37a4-58db-4efb-9ade-22e3c6b08700',
    docKey: '9438303d', // documentServiceKey prefix for matching the UI row
    activityId: 969195567,
    activityName: 'Repair Addendum',
    expectedFileName: "RRP04212025_X_C-527_Seller's Repair Addendum.pdf",
  },
]

await fs.mkdir(OUT_DIR, { recursive: true })

async function loadEnv() {
  const raw = await fs.readFile('.env.local', 'utf8').catch(() => '')
  for (const line of raw.split('\n')) {
    const t = line.trim(); if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('='); if (eq < 0) continue
    const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"'))) v = v.slice(1, -1)
    if (process.env[k] === undefined) process.env[k] = v
  }
}
async function login() {
  const ts = new Date().toISOString()
  const env = process.env
  const hmac = crypto.createHmac('sha256', env.SKYSLOPE_ACCESS_SECRET.trim())
    .update(`${env.SKYSLOPE_CLIENT_ID.trim()}:${env.SKYSLOPE_CLIENT_SECRET.trim()}:${ts}`).digest('base64')
  const r = await skyslopeFetchWithRetry(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `ss ${env.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`, Timestamp: ts },
    body: JSON.stringify({ ClientId: env.SKYSLOPE_CLIENT_ID.trim(), ClientSecret: env.SKYSLOPE_CLIENT_SECRET.trim() }),
  })
  return (await r.json()).Session
}
function apiHeaders(session) {
  return { 'Content-Type': 'application/json', Session: session, timestamp: new Date().toISOString(), Accept: 'application/json' }
}
function b64(s) { return Buffer.from(String(s)).toString('base64') }
function docsUrl(txnInt) {
  return `https://app.skyslope.com/TransactionDocuments.aspx?TransactionID=${b64(txnInt)}&ListingID=MA==&checklistId=MA==`
}

await loadEnv()
const session = await login()

const browser = await chromium.launch({ headless: false, slowMo: 200 })
const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1500, height: 950 } })
const page = await context.newPage()

const report = { mode: APPLY ? 'execute' : 'dry-run', targets: [] }

try {
  for (const t of TARGETS) {
    console.log(`\n=== ${t.label} ===`)
    console.log(`  docId=${t.docId}`)
    console.log(`  activityId=${t.activityId} "${t.activityName}"`)

    const targetReport = { ...t, steps: [] }

    // Step 1: API unassign
    console.log(`\n  [Step 1] POST /checklist-items/${t.activityId}/unassign`)
    if (APPLY) {
      const ur = await skyslopeFetchWithRetry(
        `${BASE}/api/files/sales/${t.saleGuid}/checklist-items/${t.activityId}/unassign`,
        { method: 'POST', headers: apiHeaders(session), body: JSON.stringify({ documentGuid: t.docId }) },
      )
      const utext = await ur.text()
      console.log(`    HTTP ${ur.status}: ${utext.slice(0, 200)}`)
      targetReport.steps.push({ step: 'unassign', http: ur.status, body: utext.slice(0, 200) })
      if (!ur.ok) {
        console.error(`  ! Unassign failed. Aborting.`)
        report.targets.push(targetReport)
        continue
      }
    } else {
      console.log(`    [DRY] skipped`)
      targetReport.steps.push({ step: 'unassign', dryRun: true })
    }

    // Step 2: UI move Trash → Main
    console.log(`\n  [Step 2] UI move from Trash → Main`)
    await page.goto(docsUrl(t.txnInt), { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)

    // Expand Trash
    const trashPlus = await page.evaluate(() => {
      for (const tr of document.querySelectorAll('#ContentPlaceHolder1_GVListingCheckList tr')) {
        const lbl = tr.querySelector('span[id*="lblName"]')
        if (!lbl || (lbl.textContent || '').trim() !== 'Trash') continue
        const plus = tr.querySelector('a[id*="imgPlus"]')
        return plus ? { id: plus.id } : null
      }
      return null
    })
    if (!trashPlus) throw new Error('Trash + icon not found')
    await page.locator(`#${trashPlus.id}`).click({ force: true, timeout: 8000 })
    await page.waitForTimeout(3500)
    await page.screenshot({ path: path.join(OUT_DIR, `${t.label.replace(/\W+/g, '_')}-01-expanded.png`), fullPage: true })

    // Find the target doc's row by docKey or filename match
    const found = await page.evaluate(({ docKey, fileName }) => {
      for (const tr of document.querySelectorAll('#ContentPlaceHolder1_GVListingCheckList tr')) {
        const lbl = tr.querySelector('span[id*="lblName"]')
        if (!lbl) continue
        const text = (lbl.textContent || '').trim()
        const anchor = tr.querySelector('a[onclick*="opendoc"]')
        let foundKey = null
        if (anchor) {
          const m = (anchor.getAttribute('onclick') || '').match(/opendoc\('DocumentView\.aspx\?k=([a-f0-9]+)/)
          if (m) foundKey = m[1]
        }
        const matchKey = docKey && foundKey?.startsWith(docKey)
        const matchName = text && fileName.startsWith(text.replace(/\.\.\.$/, ''))
        if (matchKey || matchName) {
          const cb = tr.querySelector('input[type="checkbox"][id*="chkdoc"]')
          return { text, docKey: foundKey, checkboxId: cb?.id, visible: tr.offsetParent !== null }
        }
      }
      return null
    }, { docKey: t.docKey, fileName: t.expectedFileName })

    if (!found || !found.checkboxId) {
      throw new Error(`Could not find target doc row (found: ${JSON.stringify(found)})`)
    }
    console.log(`    Found target row: "${found.text}" checkbox=${found.checkboxId} visible=${found.visible}`)

    if (APPLY) {
      // Check the box
      const checked = await page.evaluate((id) => {
        const el = document.getElementById(id)
        if (!el) return false
        if (!el.checked) {
          el.checked = true
          el.dispatchEvent(new Event('change', { bubbles: true }))
          el.dispatchEvent(new Event('click', { bubbles: true }))
        }
        return el.checked
      }, found.checkboxId)
      console.log(`    Checkbox checked: ${checked}`)
      const bg1 = await page.evaluate(() => document.querySelectorAll('.bg1 input[type=checkbox]:checked').length)
      console.log(`    .bg1 sees ${bg1} checked`)
      if (bg1 === 0) throw new Error('Checkbox not registered under .bg1 — postback would short-circuit')

      // Postback
      const mainValue = `${t.txnInt}Z0-0`
      console.log(`    __doPostBack('divdrpDownMoveButton', '${mainValue}:Main Documents')`)
      await page.evaluate((v) => { __doPostBack('divdrpDownMoveButton', `${v}:Main Documents`) }, mainValue)
      await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {})
      await page.waitForTimeout(5000)
      await page.screenshot({ path: path.join(OUT_DIR, `${t.label.replace(/\W+/g, '_')}-02-moved.png`), fullPage: true })
      targetReport.steps.push({ step: 'ui-move', applied: true })
    } else {
      console.log(`    [DRY] would check checkbox + postback to Main`)
      targetReport.steps.push({ step: 'ui-move', dryRun: true })
    }

    // Step 3: API reassign
    console.log(`\n  [Step 3] POST /checklist-items/${t.activityId}`)
    if (APPLY) {
      const rr = await skyslopeFetchWithRetry(
        `${BASE}/api/files/sales/${t.saleGuid}/checklist-items/${t.activityId}`,
        { method: 'POST', headers: apiHeaders(session), body: JSON.stringify({ documentGuid: t.docId }) },
      )
      const rtext = await rr.text()
      console.log(`    HTTP ${rr.status}: ${rtext.slice(0, 200)}`)
      targetReport.steps.push({ step: 'reassign', http: rr.status, body: rtext.slice(0, 200) })
    } else {
      console.log(`    [DRY] skipped`)
      targetReport.steps.push({ step: 'reassign', dryRun: true })
    }

    report.targets.push(targetReport)
  }
} finally {
  await fs.writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2))
  await page.waitForTimeout(2000)
  await browser.close()
  console.log(`\nReport → ${path.join(OUT_DIR, 'report.json')}`)
  if (!APPLY) console.log(`[DRY] Use --execute to apply.`)
}
