#!/usr/bin/env node
/**
 * Assign 712's canonical docs to the new Residential Sale — Legacy (Master)
 * template activities (template id 1784578). The switch dropped all prior
 * assignments — this script rebuilds them with the side-of-rep purity rules.
 *
 * Excluded from this pass per handoff "Do not touch":
 *   - Caldwell Letter 2 (6c07c12d) — Nagorski OCR pending review
 *   - MLSCO Listing Contract ODS (11020384) — Matt re-signing
 *
 * Failed-cycle docs (04042024MBEB_*) stay folder-only — closing-cycle is
 * 04022024AB only.
 *
 * Usage:
 *   node scripts/_712-assign-new-template.mjs              # dry-run
 *   node scripts/_712-assign-new-template.mjs --execute    # apply
 */
import crypto from 'node:crypto'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const BASE = 'https://api-latest.skyslope.com'
const GUID = 'f50fe2a6-226c-4f81-8a59-9fc9a46ea5df'
const EXECUTE = process.argv.includes('--execute')

// docId prefix (lowercase) -> activityId
// All docIds checked with prefix .startsWith() (lowercase) for safety
const PLAN = [
  // Closing-cycle (04022024AB) docs
  { docPrefix: '301ce46e', activityId: 1070022598, note: 'RSA' },
  { docPrefix: '55f790db', activityId: 1070022609, note: '003 Seller Counteroffer' },
  { docPrefix: '1f01b01f', activityId: 1070022617, note: '002 Addendum' },
  { docPrefix: '2c7fdcdc', activityId: 1070022617, note: '002 Addendum' },
  { docPrefix: '4d3b48cd', activityId: 1070022617, note: '002 Addendum' },
  { docPrefix: '720dbeb1', activityId: 1070022617, note: '002 Residential Addendum' },
  { docPrefix: '1f0f0dd1', activityId: 1070022617, note: '002 Residential Addendum' },
  { docPrefix: 'ef69fb6f', activityId: 1070022617, note: '021 LBP Disclosure Addendum' },
  { docPrefix: '142b9231', activityId: 1070022622, note: '022A Buyer Repair' },
  { docPrefix: '83912edb', activityId: 1070022622, note: '022B Seller Repair' },
  { docPrefix: '4c8f0c9b', activityId: 1070022617, note: '025 Exterior Siding' },
  { docPrefix: 'b69dd220', activityId: 1070022617, note: '025 Residential Exterior Siding' },
  { docPrefix: 'b5242029', activityId: 1070022631, note: '059 Receipt of Reports / Removal of Contingencies' },
  { docPrefix: '9210cc08', activityId: 1070022637, note: '091 Notice of Real Estate Compensation' },
  { docPrefix: '1d4c1221', activityId: 1070022637, note: '110 Notice from Seller to Buyer' },
  { docPrefix: 'ab8bcee9', activityId: 1070022613, note: 'Broker Notes (closing cycle)' },
  // Reports + closing docs (no sale-#-in-name)
  { docPrefix: 'adb90420', activityId: 1070022599, note: '020 SPD' },
  { docPrefix: 'd28e6874', activityId: 1070022632, note: '040 DLA Sellers (DEDICATED slot)' },
  { docPrefix: '5c3d1878', activityId: 1070022610, note: '043 Electronic Funds Advisory' },
  { docPrefix: '3a29b3c2', activityId: 1070022610, note: '043 Electronic Funds Advisory (dup)' },
  { docPrefix: '30c8a6f2', activityId: 1070022610, note: '043 Electronic Funds Advisory (dup)' },
  { docPrefix: '2c52ee38', activityId: 1070022605, note: 'Earnest Money Receipt' },
  { docPrefix: '20d1e3eb', activityId: 1070022605, note: 'Receipt For Funds (closing-side EM evidence)' },
  { docPrefix: '12ac1533', activityId: 1070022629, note: 'Oregon DataShare Property Data Form (DEDICATED slot)' },
  { docPrefix: 'b343d739', activityId: 1070022608, note: 'Pre-Approval Letter' },
  { docPrefix: 'b2e92cee', activityId: 1070022612, note: 'Preliminary Title Report (executed)' },
  { docPrefix: 'abe92cee', activityId: 1070022612, note: 'Preliminary Title Report (early version)' },
  { docPrefix: 'b1e92cee', activityId: 1070022612, note: 'Preliminary Title Report (dup)' },
  { docPrefix: 'bfc500c8', activityId: 1070022628, note: 'Lead-Based Paint Pamphlet' },
  { docPrefix: '96386c1a', activityId: 1070022615, note: 'Home Inspection Repair Request List' },
  { docPrefix: '95664b3f', activityId: 1070022615, note: 'Wood Destroying Insect Inspection' },
]

const DO_NOT_TOUCH = [
  '6c07c12d', // Caldwell Letter 2 (Nagorski OCR pending)
  '11020384', // MLSCO Listing Contract (Matt re-signing)
]

async function login() {
  const ts = new Date().toISOString()
  const env = process.env
  const hmac = crypto.createHmac('sha256', env.SKYSLOPE_ACCESS_SECRET.trim()).update(`${env.SKYSLOPE_CLIENT_ID.trim()}:${env.SKYSLOPE_CLIENT_SECRET.trim()}:${ts}`).digest('base64')
  const r = await skyslopeFetchWithRetry(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `ss ${env.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`, Timestamp: ts },
    body: JSON.stringify({ ClientId: env.SKYSLOPE_CLIENT_ID.trim(), ClientSecret: env.SKYSLOPE_CLIENT_SECRET.trim() }),
  })
  return (await r.json()).Session
}
function apiHeaders(session) { return { 'Content-Type': 'application/json', Session: session, timestamp: new Date().toISOString(), Accept: 'application/json' } }

const session = await login()
const hdrs = apiHeaders(session)

// Resolve docId prefixes to full lowercase docIds
const dr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${GUID}/documents`, { headers: hdrs })
const docs = (await dr.json()).value?.documents || []
const docById = new Map()
for (const d of docs) {
  const id = (d.docId || d.id || '').toLowerCase()
  if (id) docById.set(id.slice(0, 8), { id, name: d.fileName })
}

console.log(`MODE: ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}`)
console.log(`Plan: ${PLAN.length} assignments\n`)

let ok = 0, fail = 0, notFound = 0
for (const p of PLAN) {
  const doc = docById.get(p.docPrefix)
  if (!doc) {
    console.log(`  MISSING ${p.docPrefix} (${p.note})`)
    notFound++
    continue
  }
  if (DO_NOT_TOUCH.includes(p.docPrefix)) {
    console.log(`  SKIP ${p.docPrefix} ${p.note} — in do-not-touch list`)
    continue
  }
  console.log(`  ASSIGN ${p.docPrefix} → act ${p.activityId}  "${p.note}"  (${doc.name.substring(0, 70)})`)
  if (!EXECUTE) { ok++; continue }
  const r = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${GUID}/checklist-items/${p.activityId}`, {
    method: 'POST', headers: hdrs, body: JSON.stringify({ documentGuid: doc.id }),
  })
  if (r.ok) { ok++; console.log(`    HTTP ${r.status} OK`) }
  else { fail++; console.log(`    HTTP ${r.status}: ${(await r.text()).substring(0, 200)}`) }
}

console.log(`\n=== SUMMARY ===`)
console.log(`OK: ${ok}`)
console.log(`Failed: ${fail}`)
console.log(`Doc not found (already mapped or removed): ${notFound}`)
console.log(EXECUTE ? '' : '\n[DRY RUN] Use --execute to apply.')
