#!/usr/bin/env node
/**
 * For the Closed Nordic transaction:
 *   1. List every doc with a checklist activity assignment (API)
 *   2. Drive Playwright to expand only the Trash folder
 *   3. Capture which docKeys are under Trash
 *   4. Cross-reference: any doc that is BOTH (assigned to an activity) AND
 *      (visible inside Trash) is a compliance concern
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const BASE = 'https://api-latest.skyslope.com'
const STATE_PATH = 'tmp/skyslope-session.json'
const OUT_DIR = 'tmp/nordic-closed-assigned-vs-trash'
const TXN_ID_B64 = 'MjA1OTczMDA='
const SALE_GUID = 'ce3c30de-1b10-4946-bf06-6dbad8e1d53d'
const DOCS_URL = `https://app.skyslope.com/TransactionDocuments.aspx?TransactionID=${TXN_ID_B64}&ListingID=MA==&checklistId=MA==`

await fs.mkdir(OUT_DIR, { recursive: true })

async function loadEnv() {
  const raw = await fs.readFile('.env.local', 'utf8').catch(() => '')
  for (const line of raw.split('\n')) {
    const t = line.trim(); if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('='); if (eq < 0) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
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

await loadEnv()
const session = await login()

// API: build map of assigned doc IDs (lowercase normalized) -> activities + filenames
const fr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${SALE_GUID}`, { headers: apiHeaders(session) })
const sale = (await fr.json()).value?.sale
const activities = sale?.checklist?.activities || []
const assignedById = new Map()
for (const a of activities) {
  for (const cd of (a.checklistDocs || [])) {
    const rawId = cd.id || cd.docId || cd.documentGuid
    if (!rawId) continue
    const docId = rawId.toLowerCase()
    if (!assignedById.has(docId)) assignedById.set(docId, [])
    assignedById.get(docId).push({ activityId: a.activityId, name: (a.activityName||'').trim(), status: a.status, typeName: a.typeName })
  }
}

const dr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${SALE_GUID}/documents`, { headers: apiHeaders(session) })
const apiDocs = (await dr.json()).value?.documents || []
const idToDoc = new Map()
const keyToDoc = new Map()
for (const d of apiDocs) {
  const id = (d.docId || d.id || '').toLowerCase()
  if (id) idToDoc.set(id, d)
  if (d.documentServiceKey) keyToDoc.set(d.documentServiceKey, d)
}

console.log(`API: ${activities.length} activities, ${assignedById.size} docs in checklistDocs (case-normalized)`)
console.log(`\nAssigned docs (filename + activity):`)
for (const [docId, acts] of assignedById) {
  const doc = idToDoc.get(docId)
  const fn = doc?.fileName || '(filename unknown)'
  console.log(`  ${docId.slice(0,8)}  "${fn.slice(0,80)}"`)
  for (const a of acts) console.log(`    → ${a.name}  (${a.status})`)
}

// UI: open page, expand JUST the Trash folder (skip Archive/Admin/Incomplete)
const browser = await chromium.launch({ headless: false, slowMo: 200 })
const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1500, height: 950 } })
const page = await context.newPage()

await page.goto(DOCS_URL, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)

// Find the + (expand) link in the Trash row only.
const trashExpand = await page.evaluate(() => {
  for (const tr of document.querySelectorAll('#ContentPlaceHolder1_GVListingCheckList tr')) {
    const lbl = tr.querySelector('span[id*="lblName"]')
    if (!lbl || (lbl.textContent || '').trim() !== 'Trash') continue
    const plus = tr.querySelector('a[id*="imgPlus"], .fa-plus, [id*="imgPlus"]')
    if (plus) {
      const r = plus.getBoundingClientRect()
      return { x: r.x + r.width/2, y: r.y + r.height/2, html: (plus.outerHTML || '').slice(0,200) }
    }
  }
  return null
})
console.log(`\nTrash expand handle: ${JSON.stringify(trashExpand)}`)
if (!trashExpand) {
  console.error('Could not find Trash expand handle.')
  await browser.close()
  process.exit(1)
}

// Snapshot rows BEFORE expanding Trash
const rowsBefore = await page.evaluate(() => {
  const rows = []
  for (const tr of document.querySelectorAll('#ContentPlaceHolder1_GVListingCheckList tr')) {
    const lbl = tr.querySelector('span[id*="lblName"]')
    if (!lbl) continue
    const anchor = tr.querySelector('a[onclick*="opendoc"]')
    let docKey = null
    if (anchor) {
      const m = (anchor.getAttribute('onclick') || '').match(/opendoc\('DocumentView\.aspx\?k=([a-f0-9]+)/)
      if (m) docKey = m[1]
    }
    rows.push({ text: (lbl.textContent || '').trim(), docKey })
  }
  return rows
})

await page.mouse.click(trashExpand.x, trashExpand.y)
await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {})
await page.waitForTimeout(4000)
await page.screenshot({ path: path.join(OUT_DIR, 'trash-expanded.png'), fullPage: true })

const rowsAfter = await page.evaluate(() => {
  const rows = []
  for (const tr of document.querySelectorAll('#ContentPlaceHolder1_GVListingCheckList tr')) {
    const lbl = tr.querySelector('span[id*="lblName"]')
    if (!lbl) continue
    const anchor = tr.querySelector('a[onclick*="opendoc"]')
    let docKey = null
    if (anchor) {
      const m = (anchor.getAttribute('onclick') || '').match(/opendoc\('DocumentView\.aspx\?k=([a-f0-9]+)/)
      if (m) docKey = m[1]
    }
    rows.push({ text: (lbl.textContent || '').trim(), docKey })
  }
  return rows
})

const beforeKeys = new Set(rowsBefore.map((r) => r.docKey).filter(Boolean))
const newRows = rowsAfter.filter((r) => r.docKey && !beforeKeys.has(r.docKey))
console.log(`\nRows BEFORE Trash expand: ${rowsBefore.length}; AFTER: ${rowsAfter.length}`)
console.log(`New rows revealed (Trash contents): ${newRows.length}`)

console.log(`\nDocs in Trash (cross-referenced with assignments):`)
const trashAssignmentHits = []
for (const nr of newRows) {
  const apiDoc = keyToDoc.get(nr.docKey)
  const apiDocId = (apiDoc?.docId || apiDoc?.id || '').toLowerCase()
  const acts = apiDocId ? (assignedById.get(apiDocId) || []) : []
  const tag = acts.length > 0 ? `*** ASSIGNED to ${acts.map((a) => `"${a.name}" (${a.status})`).join(', ')} ***` : '(unassigned)'
  console.log(`  "${nr.text || '(no label)'}" docKey=${nr.docKey.slice(0,8)} fn="${apiDoc?.fileName || '?'}" ${tag}`)
  if (acts.length > 0) trashAssignmentHits.push({ docId: apiDocId, fileName: apiDoc?.fileName, activities: acts })
}

console.log(`\n=== Compliance flags ===`)
console.log(`  Trash docs that ALSO have checklist activity assignments: ${trashAssignmentHits.length}`)
for (const h of trashAssignmentHits) {
  console.log(`    ${h.docId.slice(0,8)}  "${h.fileName}"`)
  for (const a of h.activities) console.log(`      activityId=${a.activityId}  "${a.name}"  status=${a.status}`)
}

await fs.writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  assignedDocsCount: assignedById.size,
  trashDocsCount: newRows.length,
  complianceFlags: trashAssignmentHits,
}, null, 2))

await page.waitForTimeout(2000)
await browser.close()
