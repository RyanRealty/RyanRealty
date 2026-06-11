#!/usr/bin/env node
/**
 * Discover what folder values SkySlope actually accepts beyond the
 * swagger-documented Admin/Trash/null, and confirm where the smoke
 * test doc currently lives.
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const BASE = 'https://api-latest.skyslope.com'
const FOLDER_GUID = '0ec95d31-1fed-4519-a114-e967513eac33' // Canceled-B
const SMOKE_DOC_ID = '751df22e-5661-44a8-8746-049be6383e08'

async function loadEnvLocal() {
  const raw = await fs.readFile('.env.local', 'utf8').catch(() => '')
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 0) continue
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
    .update(`${env.SKYSLOPE_CLIENT_ID.trim()}:${env.SKYSLOPE_CLIENT_SECRET.trim()}:${ts}`)
    .digest('base64')
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

await loadEnvLocal()
const session = await login()

console.log(`=== STEP 1: Re-GET Canceled-B documents — locate smoke doc ===\n`)
const dr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${FOLDER_GUID}/documents`, { headers: apiHeaders(session) })
const docs = (await dr.json()).value?.documents || []
const smokeDoc = docs.find((d) => (d.docId || d.id) === SMOKE_DOC_ID)
if (smokeDoc) {
  console.log(`Smoke doc still listed in /documents:`)
  console.log(JSON.stringify(smokeDoc, null, 2))
  console.log(`\nALL FIELDS: ${Object.keys(smokeDoc).sort().join(', ')}\n`)
} else {
  console.log(`Smoke doc ${SMOKE_DOC_ID} NOT in /documents response (filtered out?).\n`)
}

// Also dump first 3 docs to confirm field set
console.log(`Sample of other docs (first 2) — field set:`)
for (const d of docs.slice(0, 2)) {
  console.log(`  ${(d.docId || d.id).slice(0, 8)} "${(d.fileName || d.docName || '').slice(0, 60)}"`)
  console.log(`    fields: ${Object.keys(d).sort().join(', ')}`)
}

console.log(`\n=== STEP 2: Probe folder enum — try other values via PATCH ===\n`)
const candidates = ['Incomplete', 'incomplete', 'Pending', 'Review', 'Archive', 'Archived', 'Completed', 'Complete']
const docUrl = `${BASE}/api/files/sales/${FOLDER_GUID}/documents/${SMOKE_DOC_ID}`
for (const v of candidates) {
  const r = await skyslopeFetchWithRetry(docUrl, {
    method: 'PATCH',
    headers: apiHeaders(session),
    body: JSON.stringify({ Folder: v }),
  })
  const text = await r.text()
  let body
  try { body = JSON.parse(text) } catch { body = { raw: text.slice(0, 200) } }
  const returned = body?.value?.folder ?? body?.folder ?? '?'
  console.log(`  Folder="${v}"  HTTP ${r.status}  returned folder="${returned}"`)
  if (r.ok && returned === v) {
    console.log(`    ✓ ACCEPTED. SkySlope honors this folder value.`)
  }
}

console.log(`\n=== STEP 3: Reset smoke doc to Admin (where we left it) ===\n`)
const reset = await skyslopeFetchWithRetry(docUrl, {
  method: 'PATCH',
  headers: apiHeaders(session),
  body: JSON.stringify({ Folder: 'Admin' }),
})
const rtext = await reset.text()
let rbody
try { rbody = JSON.parse(rtext) } catch { rbody = { raw: rtext.slice(0, 200) } }
console.log(`HTTP ${reset.status}, returned folder="${rbody?.value?.folder ?? '?'}"`)

console.log(`\n=== STEP 4: Look at full /api/files/sales/{guid} response for hidden folder hints ===\n`)
const fr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${FOLDER_GUID}`, { headers: apiHeaders(session) })
const fbody = await fr.json()
const sale = fbody.value?.sale
console.log(`sale top-level keys: ${Object.keys(sale || {}).sort().join(', ')}`)
// Look at any doc-related arrays nested elsewhere
if (sale?.documents) console.log(`  sale.documents length: ${sale.documents.length}`)
if (sale?.docs) console.log(`  sale.docs length: ${sale.docs.length}`)
if (sale?.checklist?.activities) {
  console.log(`  sale.checklist.activities: ${sale.checklist.activities.length}`)
  // Dump the activity status enum we see
  const statuses = new Set(sale.checklist.activities.map((a) => a.status).filter(Boolean))
  console.log(`  activity status values present: ${[...statuses].join(', ')}`)
  const typeNames = new Set(sale.checklist.activities.map((a) => a.typeName).filter(Boolean))
  console.log(`  activity typeName values present: ${[...typeNames].join(', ')}`)
}
