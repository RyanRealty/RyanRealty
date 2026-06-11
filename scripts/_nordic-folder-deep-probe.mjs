#!/usr/bin/env node
/**
 * Deep probe for Canceled-B (0ec95d31):
 *   1. Find the 2 docs Matt sees in Trash (by filename keyword)
 *   2. Dump every field on those 2 docs vs an Admin doc vs a main-bucket doc
 *      to see what differentiates the folder state
 *   3. Try every plausible folder enum value (broader list)
 *   4. Inspect checklist activity status across all activities
 *   5. Use addDocumentsToSaleForm endpoint to see what fields SkySlope
 *      exposes for new uploads (may hint at folder choices)
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const BASE = 'https://api-latest.skyslope.com'
const FOLDER_GUID = '0ec95d31-1fed-4519-a114-e967513eac33' // Canceled-B
const SMOKE_DOC_ID = '751df22e-5661-44a8-8746-049be6383e08' // currently folder=Admin

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

console.log(`=== STEP 1: Pull all Canceled-B documents + identify Trash docs ===\n`)
const dr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${FOLDER_GUID}/documents`, { headers: apiHeaders(session) })
const docs = (await dr.json()).value?.documents || []
console.log(`Total docs in /documents: ${docs.length}`)

// Find the Repair Addendum + Buyer's Contingent docs (Matt's reported Trash entries)
const repairMatches = docs.filter((d) => /repair addendum/i.test(d.fileName || ''))
const contingentMatches = docs.filter((d) => /contingent right/i.test(d.fileName || ''))
console.log(`\nRepair Addendum matches (${repairMatches.length}):`)
for (const d of repairMatches) console.log(`  ${(d.id||'').slice(0,8)}  "${d.fileName}"`)
console.log(`\nBuyer's Contingent Right matches (${contingentMatches.length}):`)
for (const d of contingentMatches) console.log(`  ${(d.id||'').slice(0,8)}  "${d.fileName}"`)

console.log(`\n=== STEP 2: Try expanded folder enum candidates ===\n`)
const candidates = [
  'admin', 'ADMIN', 'Admin',
  'trash', 'TRASH', 'Trash',
  'Incomplete', 'incomplete', 'INCOMPLETE',
  'Submitted', 'Sent', 'BrokerReview', 'Broker Review', 'In Review',
  'Working', 'Final', 'Active', 'Approved', 'Rejected',
  'OnHold', 'Pending', 'Review', 'Submission', 'Submitted To Broker',
]
const docUrl = `${BASE}/api/files/sales/${FOLDER_GUID}/documents/${SMOKE_DOC_ID}`
const accepted = []
for (const v of candidates) {
  const r = await skyslopeFetchWithRetry(docUrl, {
    method: 'PATCH', headers: apiHeaders(session),
    body: JSON.stringify({ Folder: v }),
  })
  const text = await r.text()
  let body; try { body = JSON.parse(text) } catch { body = { raw: text.slice(0, 200) } }
  const returned = body?.value?.folder ?? body?.folder ?? '?'
  const errs = body?.errors?.join('; ') || ''
  const mark = (r.ok && (returned === v || returned?.toLowerCase() === v.toLowerCase())) ? '✓ ACCEPTED' : ''
  console.log(`  Folder="${v.padEnd(22)}" HTTP ${r.status} returned="${returned}" ${errs ? `errors=[${errs.slice(0,80)}]` : ''} ${mark}`)
  if (r.ok && returned !== '?') accepted.push({ tried: v, returned })
}
console.log(`\nUnique returned values across accepted PATCHes:`, [...new Set(accepted.map((a) => a.returned))])

console.log(`\n=== STEP 3: Reset smoke doc back to Admin (where we left it) ===`)
const reset = await skyslopeFetchWithRetry(docUrl, {
  method: 'PATCH', headers: apiHeaders(session),
  body: JSON.stringify({ Folder: 'Admin' }),
})
console.log(`  HTTP ${reset.status}`)

console.log(`\n=== STEP 4: Look at checklist for doc-status hints ===\n`)
const fr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${FOLDER_GUID}`, { headers: apiHeaders(session) })
const sale = (await fr.json()).value?.sale
const activities = sale?.checklist?.activities || []
console.log(`Activities: ${activities.length}`)
// Find any with checklistDocs whose IDs match Repair or Contingent docs
const trashIds = new Set([...repairMatches, ...contingentMatches].map((d) => d.id))
let foundLinks = 0
for (const a of activities) {
  for (const cd of (a.checklistDocs || [])) {
    if (trashIds.has(cd.id || cd.docId || cd.documentGuid)) {
      foundLinks++
      console.log(`  Trash doc linked to activity:`)
      console.log(`    activityId=${a.activityId} name="${(a.activityName||'').trim()}" status=${a.status}`)
      console.log(`    cd keys: ${Object.keys(cd).sort().join(', ')}`)
      console.log(`    cd: ${JSON.stringify(cd, null, 2).slice(0, 400)}`)
    }
  }
}
if (!foundLinks) console.log('  (no checklist links to Trash docs — they are unassigned)')

console.log(`\n=== STEP 5: addDocumentsToSaleForm hint ===\n`)
const af = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${FOLDER_GUID}/addDocumentsToSaleForm`, { headers: apiHeaders(session) })
const afBody = await af.json()
console.log(`HTTP ${af.status}`)
const fields = afBody?.value?.fields || afBody?.value || afBody
console.log(JSON.stringify(fields, null, 2).slice(0, 2000))
