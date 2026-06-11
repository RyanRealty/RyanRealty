#!/usr/bin/env node
/**
 * For each of the 3 Nordic transactions:
 *   1. Pull the checklist activities and build a map of docId -> [activities]
 *   2. Pull the Documents UI page and find docs nested under the Trash folder
 *   3. For each Trash doc, report whether it's also assigned to a checklist activity
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const BASE = 'https://api-latest.skyslope.com'
const STATE_PATH = 'tmp/skyslope-session.json'
const OUT_DIR = 'tmp/nordic-trash-probe'

const NORDIC = [
  { label: 'Canceled-B', guid: '0ec95d31-1fed-4519-a114-e967513eac33', txnInt: '20176853' },
  { label: 'Canceled-A', guid: '6be4810f-eda4-433d-ad6f-f27b80a1c6e0', txnInt: '20176813' },
  { label: 'Closed', guid: 'ce3c30de-1b10-4946-bf06-6dbad8e1d53d', txnInt: '20597300' },
]

async function loadEnv() {
  const raw = await fs.readFile('.env.local', 'utf8').catch(() => '')
  for (const line of raw.split('\n')) {
    const t = line.trim(); if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('='); if (eq < 0) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
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

await fs.mkdir(OUT_DIR, { recursive: true })
await loadEnv()
const session = await login()

const browser = await chromium.launch({ headless: false, slowMo: 100 })
const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1500, height: 950 } })
const page = await context.newPage()

const report = { generatedAt: new Date().toISOString(), folders: [] }

try {
  for (const txn of NORDIC) {
    console.log(`\n=== ${txn.label} (${txn.guid.slice(0,8)} / txnInt ${txn.txnInt}) ===`)

    // API: build docId → activity list mapping
    const fr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${txn.guid}`, { headers: apiHeaders(session) })
    const sale = (await fr.json()).value?.sale
    const activities = sale?.checklist?.activities || []
    const docToActivities = new Map()
    for (const a of activities) {
      for (const cd of (a.checklistDocs || [])) {
        const docId = cd.id || cd.docId || cd.documentGuid
        if (!docId) continue
        if (!docToActivities.has(docId)) docToActivities.set(docId, [])
        docToActivities.get(docId).push({ activityId: a.activityId, activityName: (a.activityName||'').trim(), status: a.status, typeName: a.typeName })
      }
    }
    console.log(`  ${activities.length} activities, ${docToActivities.size} unique docs across all checklistDocs`)

    // UI: navigate to Documents page and click Trash folder to see what's inside
    const docsUrl = `https://app.skyslope.com/TransactionDocuments.aspx?TransactionID=${b64(txn.txnInt)}&ListingID=MA==&checklistId=MA==`
    await page.goto(docsUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)

    // Find the Trash folder's <a> anchor (the one at the bottom file-list area,
    // not the move-dropdown menu item). Click it.
    const trashClicked = await page.evaluate(() => {
      const trashB64 = 'VHJhc2g='
      // The folder rows live in the GVListingCheckList. We want the anchor
      // whose onclick contains the base64 of "Trash" — there are two: the
      // dropdown menu item (no postback effect for navigation) and the
      // folder row (this is the navigation one).
      const anchors = document.querySelectorAll(`a[onclick*="${trashB64}"]`)
      // Pick the one that's a child of a tr in the GVListingCheckList
      for (const a of anchors) {
        if (a.closest('#ContentPlaceHolder1_GVListingCheckList')) {
          // Trigger native click to navigate into folder
          a.click()
          return { ok: true, anchorId: a.id, onclick: (a.getAttribute('onclick') || '').slice(0, 200) }
        }
      }
      return { ok: false }
    })
    console.log(`  Trash folder click: ${JSON.stringify(trashClicked)}`)
    await page.waitForLoadState('domcontentloaded').catch(() => {})
    await page.waitForTimeout(3000)
    await page.screenshot({ path: path.join(OUT_DIR, `${txn.label}-trash.png`), fullPage: true })

    // Capture visible docs and their docKey from opendoc onclicks
    const trashDocs = await page.evaluate(() => {
      const out = []
      for (const tr of document.querySelectorAll('#ContentPlaceHolder1_GVListingCheckList tr')) {
        const lbl = tr.querySelector('span[id*="lblName"]')
        if (!lbl) continue
        const name = (lbl.textContent || '').trim()
        if (!name || name === 'Admin' || name === 'Trash' || name === 'Incomplete' || name === 'Archive') continue
        // Find a matching opendoc anchor to extract the docKey
        const anchor = tr.querySelector('a[onclick*="opendoc"]')
        let docKey = null
        if (anchor) {
          const m = (anchor.getAttribute('onclick') || '').match(/opendoc\('DocumentView\.aspx\?k=([a-f0-9]+)/)
          if (m) docKey = m[1]
        }
        const idCell = tr.querySelector('input[type="checkbox"][id*="chkdoc"]')
        out.push({ name, docKey, checkboxId: idCell?.id })
      }
      return out
    })
    console.log(`  Visible docs after clicking Trash: ${trashDocs.length}`)
    for (const d of trashDocs) console.log(`    "${d.name}"  docKey=${d.docKey}`)

    // The docKey is a documentServiceKey, not the documentGuid. Cross-reference
    // by pulling all docs from the API and matching by documentServiceKey.
    const dr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${txn.guid}/documents`, { headers: apiHeaders(session) })
    const docs = (await dr.json()).value?.documents || []
    const keyToDoc = new Map()
    for (const d of docs) {
      if (d.documentServiceKey) keyToDoc.set(d.documentServiceKey, d)
    }

    const folderReport = { label: txn.label, guid: txn.guid, txnInt: txn.txnInt, trashItems: [] }
    for (const td of trashDocs) {
      const apiDoc = td.docKey ? keyToDoc.get(td.docKey) : null
      const apiDocId = apiDoc?.docId || apiDoc?.id || null
      const assignedActivities = apiDocId ? (docToActivities.get(apiDocId) || []) : []
      const item = {
        uiName: td.name,
        documentServiceKey: td.docKey,
        apiDocId,
        apiFileName: apiDoc?.fileName,
        assigned: assignedActivities.length > 0,
        activities: assignedActivities,
      }
      folderReport.trashItems.push(item)
      console.log(`\n    Trash item: "${td.name}"`)
      console.log(`      docId: ${apiDocId}`)
      console.log(`      apiFileName: ${apiDoc?.fileName}`)
      console.log(`      assigned to checklist: ${item.assigned ? 'YES' : 'no'}`)
      for (const act of assignedActivities) {
        console.log(`        - activityId=${act.activityId} "${act.activityName}" (${act.status}, ${act.typeName})`)
      }
    }
    report.folders.push(folderReport)
  }
} catch (e) {
  console.error('FATAL', e)
} finally {
  await fs.writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2))
  console.log(`\nReport → ${path.join(OUT_DIR, 'report.json')}`)
  await page.waitForTimeout(1500)
  await browser.close()
}
