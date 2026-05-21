#!/usr/bin/env node
/**
 * Checklist reassignment for the Ordway folder, per the audit findings.
 *
 * Two operations:
 *   1. UNASSIGN — remove links from active checklist items to ARCHIVE-tagged docs
 *      (POST /api/files/sales/{guid}/checklist-items/{activityId}/unassign)
 *   2. ASSIGN — link the now-canonical MAIN docs to the right activities
 *      (POST /api/files/sales/{guid}/checklist-items/{activityId})
 *
 * Each POST body is { documentGuid }.
 *
 * Usage: node --env-file=.env.local scripts/_ordway-checklist-reassign.mjs [--dry-run]
 */
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const BASE = 'https://api-latest.skyslope.com'
const FOLDER = 'f88642ff-22e6-4618-b9e1-40b168a439e1'
const DRY = process.argv.includes('--dry-run')

const UNASSIGNS = [
  // (activityId, docId, currentName-for-log)
  [1050931905, '23db633c-ab63-46b0-94fa-d147ecffcf0b', 'ARCHIVE - MR05042025_001_RSA - not_executed'],
  [1050931905, 'd2463c20-1f44-4087-8de7-779dd97a011a', 'ARCHIVE - MR04262025_001_RSA - not_executed'],
  [1050931907, '4f0cb4a9-e970-4b9f-90b9-7b4f62f5bb9f', 'ARCHIVE - MR05042025_004_Buyer Counteroffer - not_executed'],
  [1050931908, '68f8d4d8-4d8e-4837-a143-024bd109b2ff', 'ARCHIVE - MR05072025_022A_Buyer Repair 2 (buyer-only draft) - superseded'],
  [1050931920, 'b398431e-e93f-416e-99a6-f139f94b1c1d', 'ARCHIVE - MR05072025_091 - duplicate'],
  [1050931921, '9fd378d1-a856-48e8-8376-27643b53344a', 'ARCHIVE - MR05072025_060_Cont Removal 2 (buyer-only) - superseded'],
  [1050931921, '75b3a021-438e-490e-9e34-e591d966a98a', 'ARCHIVE - MR05072025_060_Cont Removal 1 (buyer-only) - superseded'],
  [1050931939, '7a081090-aed0-4065-8670-20c9b4b3b739', 'ARCHIVE - MR04262025_024_OAA - superseded'],
  [1050931939, '05766a76-fa01-4cff-8c78-8c9da28bcb0a', 'ARCHIVE - MR05072025_024_OAA (buyer-only) - superseded'],
]

const ASSIGNS = [
  // (activityId, docId, target-canonical-name-for-log)
  [1050931920, '7b2a56d3-6a54-f111-bb41-12f8d622e63f', 'MR05072025_X_091_Notice of Real Estate Compensation'],
  [1050931939, 'fddeaf39-6954-f111-bb41-12f8d622e63f', 'MR05072025_X_Earnest Money Receipt - Western Title'],
  [1050931940, '70951002-2f55-f111-bb41-12f8d622e63f', 'MR05072025_X_Preliminary Title Report - Western Title'],
  [1050931941, '3d3413fc-2e55-f111-bb41-12f8d622e63f', 'MR05072025_X_Final Buyer Statement (buyer-signed)'],
  [1050931908, '3c3513fc-2e55-f111-bb41-12f8d622e63f', 'MR05072025_X_022A_Buyers Repair Addendum 2 (fully executed)'],
  [1050931912, '973413fc-2e55-f111-bb41-12f8d622e63f', 'MR05072025_X_024_Owner Association Addendum (fully executed)'],
  [1050931915, 'd53413fc-2e55-f111-bb41-12f8d622e63f', 'MR05072025_X_060_Contingency Removal Addendum 1 (fully executed)'],
  [1050931915, '1b3513fc-2e55-f111-bb41-12f8d622e63f', 'MR05072025_X_060_Contingency Removal Addendum 2 (fully executed)'],
]

async function login() {
  const ts = new Date().toISOString()
  const env = process.env
  const hmac = crypto
    .createHmac('sha256', env.SKYSLOPE_ACCESS_SECRET.trim())
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

console.log(`UNASSIGN ops: ${UNASSIGNS.length}`)
console.log(`ASSIGN ops:   ${ASSIGNS.length}`)
console.log('')

if (DRY) {
  for (const [act, docId, label] of UNASSIGNS) console.log(`  UNASSIGN  act ${act}  doc ${docId.slice(0, 8)}  (${label})`)
  for (const [act, docId, label] of ASSIGNS) console.log(`  ASSIGN    act ${act}  doc ${docId.slice(0, 8)}  (${label})`)
  console.log('\n[DRY RUN] No mutations sent.')
  process.exit(0)
}

const session = await login()
const log = []

console.log('=== UNASSIGN ===')
for (const [actId, docId, label] of UNASSIGNS) {
  const url = `${BASE}/api/files/sales/${FOLDER}/checklist-items/${actId}/unassign`
  try {
    const r = await skyslopeFetchWithRetry(url, {
      method: 'POST',
      headers: apiHeaders(session),
      body: JSON.stringify({ documentGuid: docId }),
    })
    const ok = r.ok
    const status = r.status
    const text = await r.text()
    log.push({ op: 'unassign', actId, docId, label, ok, status, response: text.slice(0, 200) })
    console.log(`  ${ok ? 'OK' : 'FAIL'} [${status}]  act ${actId}  doc ${docId.slice(0, 8)}  ${label.slice(0, 55)}`)
    await new Promise((r) => setTimeout(r, 250))
  } catch (e) {
    log.push({ op: 'unassign', actId, docId, label, ok: false, error: e.message })
    console.log(`  ERR  ${e.message}`)
  }
}

console.log('')
console.log('=== ASSIGN ===')
for (const [actId, docId, label] of ASSIGNS) {
  const url = `${BASE}/api/files/sales/${FOLDER}/checklist-items/${actId}`
  try {
    const r = await skyslopeFetchWithRetry(url, {
      method: 'POST',
      headers: apiHeaders(session),
      body: JSON.stringify({ documentGuid: docId }),
    })
    const ok = r.ok
    const status = r.status
    const text = await r.text()
    log.push({ op: 'assign', actId, docId, label, ok, status, response: text.slice(0, 200) })
    console.log(`  ${ok ? 'OK' : 'FAIL'} [${status}]  act ${actId}  doc ${docId.slice(0, 8)}  ${label.slice(0, 55)}`)
    await new Promise((r) => setTimeout(r, 250))
  } catch (e) {
    log.push({ op: 'assign', actId, docId, label, ok: false, error: e.message })
    console.log(`  ERR  ${e.message}`)
  }
}

await fs.writeFile(`tmp/skyslope-pdfs/${FOLDER}/checklist-reassign-log.json`, JSON.stringify(log, null, 2))
console.log(`\nWrote tmp/skyslope-pdfs/${FOLDER}/checklist-reassign-log.json`)
console.log(`OK:   ${log.filter((l) => l.ok).length}`)
console.log(`FAIL: ${log.filter((l) => !l.ok).length}`)
