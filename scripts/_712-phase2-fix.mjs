#!/usr/bin/env node
/**
 * Phase 2 — 712 SW 1st St checklist purity fixes.
 *
 * Pre-conditions verified by _712-phase0-audit.mjs:
 *  - Checklist type: Residential — Standard (superset; sub-case B)
 *  - 6 known misassignments captured
 *  - Side of representation: SELLER (Ryan Realty listing-side)
 *
 * 9 ops total (6 unassigns + 3 reassigns):
 *   1. UNASSIGN  5c3d1878  X_043 EFA           from 1050858504  RSA
 *   2. UNASSIGN  d28e6874  X_040 DLA Sellers   from 1050858542  Buyers Rep Agreement
 *   3. ASSIGN    d28e6874  X_040 DLA Sellers   to   1050858543  Disclosed Limited Agency
 *   4. UNASSIGN  b1e92cee  Prelim Title        from 1050858541  Initial Agency Disclosure (042)
 *   5. UNASSIGN  1d4c1221  X_110 Notice S→B    from 1050858536  Home Inspection
 *   6. ASSIGN    1d4c1221  X_110 Notice S→B    to   1050858519  Notice to Buyer | Seller
 *   7. UNASSIGN  b5242029  X_059 Removal       from 1050858520  Termination of Contract
 *   8. ASSIGN    b5242029  X_059 Removal       to   1050858514  Contingency Removal Addendum
 *   9. UNASSIGN  9120405e  Failed-Cycle BN     from 1050858523  Broker Notes
 *
 * Run with --execute to actually POST. Dry-run prints the operations.
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(__dirname, '..')
const BASE = 'https://api-latest.skyslope.com'
const GUID = 'f50fe2a6-226c-4f81-8a59-9fc9a46ea5df'
const EXECUTE = process.argv.includes('--execute')

const OPS = [
  { kind: 'unassign', docId: '5c3d1878-9b0f-4e85-94e0-2d4ad8a87c5f', activityId: 1050858504, why: 'RSA activity had EFA doc misassigned' },
  { kind: 'unassign', docId: 'd28e6874-fd62-4c12-8b50-6c0c9f86fb89', activityId: 1050858542, why: 'Buyers Rep had OREF 040 (Sellers) misassigned (we are seller-side, no buyer rep)' },
  { kind: 'assign',   docId: 'd28e6874-fd62-4c12-8b50-6c0c9f86fb89', activityId: 1050858543, why: 'OREF 040 belongs on Disclosed Limited Agency' },
  { kind: 'unassign', docId: 'b1e92cee-8c43-4a91-bcbf-29fed1ea567a', activityId: 1050858541, why: '042 activity had Prelim Title misassigned (totally unrelated form)' },
  { kind: 'unassign', docId: '1d4c1221-3a8e-4e15-9d51-7e8c4f86c5b4', activityId: 1050858536, why: 'Home Inspection had OREF 110 Notice from Seller misassigned' },
  { kind: 'assign',   docId: '1d4c1221-3a8e-4e15-9d51-7e8c4f86c5b4', activityId: 1050858519, why: 'OREF 110 belongs on Notice to Buyer | Seller' },
  { kind: 'unassign', docId: 'b5242029-9c14-4ed7-8c45-2ba14b81dcd3', activityId: 1050858520, why: 'Termination of Contract had OREF 059 (contingency removal) misassigned' },
  { kind: 'assign',   docId: 'b5242029-9c14-4ed7-8c45-2ba14b81dcd3', activityId: 1050858514, why: 'OREF 059 belongs on Contingency Removal Addendum' },
  { kind: 'unassign', docId: '9120405e-fc54-4f63-9c30-2ba80b1e7d3f', activityId: 1050858523, why: 'Broker Notes purity: only closing-cycle BN attached; failed-cycle BN is reference only' },
]

async function loadEnvLocal() {
  const txt = await fs.readFile(path.join(REPO, '.env.local'), 'utf8')
  for (const raw of txt.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    let val = m[2]
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1)
    if (!(m[1] in process.env)) process.env[m[1]] = val
  }
}

async function login() {
  const ts = new Date().toISOString()
  const env = process.env
  const hmac = crypto
    .createHmac('sha256', env.SKYSLOPE_ACCESS_SECRET.trim())
    .update(`${env.SKYSLOPE_CLIENT_ID.trim()}:${env.SKYSLOPE_CLIENT_SECRET.trim()}:${ts}`)
    .digest('base64')
  const r = await skyslopeFetchWithRetry(`${BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `ss ${env.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`,
      Timestamp: ts,
    },
    body: JSON.stringify({
      ClientId: env.SKYSLOPE_CLIENT_ID.trim(),
      ClientSecret: env.SKYSLOPE_CLIENT_SECRET.trim(),
    }),
  })
  if (!r.ok) throw new Error(`login HTTP ${r.status}`)
  return (await r.json()).Session
}

function apiHeaders(session) {
  return {
    'Content-Type': 'application/json',
    Session: session,
    timestamp: new Date().toISOString(),
    Accept: 'application/json',
  }
}

await loadEnvLocal()

// Resolve full GUIDs from the prefix by reading documents.json from Phase 0
const docsJson = JSON.parse(
  await fs.readFile(path.join(REPO, 'tmp/712-phase0/documents.json'), 'utf8'),
)
const documents = docsJson.value?.documents ?? docsJson.documents ?? docsJson.value ?? []

function resolveDocId(prefix) {
  const pre = prefix.toLowerCase()
  const matches = documents.filter((d) => {
    const id = (d.docId || d.id || d.documentGuid || '').toLowerCase()
    return id.startsWith(pre.slice(0, 8))
  })
  if (matches.length === 1) return (matches[0].docId || matches[0].id || matches[0].documentGuid).toLowerCase()
  if (matches.length === 0) {
    console.warn(`  ! no match for prefix ${prefix.slice(0, 8)}`)
    return null
  }
  console.warn(`  ! multiple matches for prefix ${prefix.slice(0, 8)}:`)
  for (const m of matches) console.warn(`      ${(m.docId || m.id || m.documentGuid).toLowerCase()}  ${m.fileName}`)
  return null
}

console.log(`712 SW 1st St — Phase 2 ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}`)
console.log(`Folder GUID: ${GUID}`)
console.log(`Operations: ${OPS.length}\n`)

const session = EXECUTE ? await login() : null

let ok = 0, fail = 0
for (let i = 0; i < OPS.length; i++) {
  const op = OPS[i]
  const resolved = resolveDocId(op.docId) ?? op.docId
  const doc = documents.find((d) => (d.docId || d.id || d.documentGuid || '').toLowerCase() === resolved)
  const name = doc?.fileName ?? '(unknown)'
  const url =
    op.kind === 'unassign'
      ? `${BASE}/api/files/sales/${GUID}/checklist-items/${op.activityId}/unassign`
      : `${BASE}/api/files/sales/${GUID}/checklist-items/${op.activityId}`
  console.log(`[${i + 1}/${OPS.length}] ${op.kind.toUpperCase()}  doc=${resolved.slice(0, 8)}  act=${op.activityId}`)
  console.log(`        ${name}`)
  console.log(`        ${op.why}`)
  if (!EXECUTE) continue
  const r = await skyslopeFetchWithRetry(url, {
    method: 'POST',
    headers: apiHeaders(session),
    body: JSON.stringify({ documentGuid: resolved }),
  })
  if (r.ok) {
    ok++
    console.log(`        ✓ HTTP ${r.status}`)
  } else {
    fail++
    const txt = await r.text()
    console.log(`        ✗ HTTP ${r.status}: ${txt.substring(0, 200)}`)
  }
}

console.log(`\n${EXECUTE ? 'EXECUTED' : 'DRY RUN'}: ok=${ok}  fail=${fail}  total=${OPS.length}`)
if (!EXECUTE) console.log('Pass --execute to apply.')
