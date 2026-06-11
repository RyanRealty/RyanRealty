#!/usr/bin/env node
/**
 * Set 712's officeGuid to Ryan Realty LLC, then assign the new
 * Legacy template. Steps:
 *   1. Look up Ryan Realty LLC's officeGuid (we have its integer
 *      office id 28920 but need the GUID for the API).
 *   2. PUT /api/files/sales/{guid}/office { officeGuid }
 *   3. PUT /api/files/sales/{guid}/checklistType { checklistTypeId: 1784213 }
 *   4. Verify by re-fetching and diffing activity sets.
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
const TEMPLATE_ID = 1784213
const EXECUTE = process.argv.includes('--execute')

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
  const e = process.env
  const hmac = crypto
    .createHmac('sha256', e.SKYSLOPE_ACCESS_SECRET.trim())
    .update(`${e.SKYSLOPE_CLIENT_ID.trim()}:${e.SKYSLOPE_CLIENT_SECRET.trim()}:${ts}`)
    .digest('base64')
  const r = await skyslopeFetchWithRetry(`${BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `ss ${e.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`,
      Timestamp: ts,
    },
    body: JSON.stringify({
      ClientId: e.SKYSLOPE_CLIENT_ID.trim(),
      ClientSecret: e.SKYSLOPE_CLIENT_SECRET.trim(),
    }),
  })
  return (await r.json()).Session
}

function H(session) {
  return {
    'Content-Type': 'application/json',
    Session: session,
    timestamp: new Date().toISOString(),
    Accept: 'application/json',
  }
}

await loadEnvLocal()
const session = await login()
console.log(`✓ Auth\n`)

// Find Ryan Realty LLC's officeGuid. Try the agents endpoint or look in an
// existing sale that already has officeGuid set.
console.log(`Step 1: Find Ryan Realty LLC officeGuid`)

// Sample sales to find one with officeGuid populated
const salesUrl = `${BASE}/api/files/sales?pageNumber=1&earliestDate=${Math.floor(Date.UTC(2020, 0, 1) / 1000)}&latestDate=${Math.floor(Date.now() / 1000)}`
const sr = await skyslopeFetchWithRetry(salesUrl, { headers: H(session) })
const sales = (await sr.json()).value?.sales ?? []
let officeGuid = null
const checked = []
for (const s of sales.slice(0, 8)) {
  const detailR = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${s.saleGuid}`, { headers: H(session) })
  const detail = (await detailR.json()).value?.sale ?? {}
  checked.push({ guid: s.saleGuid?.slice(0, 8), officeGuid: detail.officeGuid, status: detail.status })
  if (detail.officeGuid) {
    officeGuid = detail.officeGuid
    break
  }
}
console.log(`  Sampled: ${JSON.stringify(checked)}`)
if (!officeGuid) {
  console.log(`  No sale found with officeGuid. Trying agents endpoint`)
  // Try /api/agents/{guid} for Matt's agent record
  const agentR = await skyslopeFetchWithRetry(`${BASE}/api/agents/41c18058-6c25-4acb-affc-3afc4ea9ac52`, { headers: H(session) }).catch(() => null)
  if (agentR?.ok) {
    const agent = await agentR.json()
    console.log(`  agent response: ${JSON.stringify(agent).slice(0, 300)}`)
  }
}
if (!officeGuid) {
  console.error(`Could not resolve Ryan Realty officeGuid. Cannot proceed.`)
  process.exit(2)
}
console.log(`  → officeGuid = ${officeGuid}`)

if (!EXECUTE) {
  console.log(`\n[DRY RUN] Would PUT office + PUT checklistType. Pass --execute.`)
  process.exit(0)
}

console.log(`\nStep 2: PUT /api/files/sales/${GUID.slice(0, 8)}.../office  body: { officeGuid: ${officeGuid.slice(0, 8)}... }`)
const offR = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${GUID}/office`, {
  method: 'PUT',
  headers: H(session),
  body: JSON.stringify({ officeGuid }),
})
console.log(`  HTTP ${offR.status}`)
if (!offR.ok) {
  console.error(`  Body: ${(await offR.text()).slice(0, 300)}`)
  process.exit(1)
}

await new Promise((r) => setTimeout(r, 1500))

console.log(`\nStep 3: PUT /api/files/sales/${GUID.slice(0, 8)}.../checklistType  body: { checklistTypeId: ${TEMPLATE_ID} }`)
const ctR = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${GUID}/checklistType`, {
  method: 'PUT',
  headers: H(session),
  body: JSON.stringify({ checklistTypeId: TEMPLATE_ID }),
})
console.log(`  HTTP ${ctR.status}`)
if (!ctR.ok) {
  console.error(`  Body: ${(await ctR.text()).slice(0, 300)}`)
  process.exit(1)
}

await new Promise((r) => setTimeout(r, 2000))

console.log(`\nStep 4: Verify post-state`)
const afterR = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${GUID}`, { headers: H(session) })
const after = (await afterR.json()).value?.sale ?? {}
console.log(`  checklistType: "${after.checklistType}"`)
console.log(`  activities:    ${after.checklist?.activities?.length ?? 0}`)
console.log(`  officeGuid:    ${after.officeGuid}`)

// Show new activity inventory by category
const byCategory = new Map()
for (const a of (after.checklist?.activities ?? [])) {
  const cat = a.typeName ?? 'unknown'
  if (!byCategory.has(cat)) byCategory.set(cat, [])
  byCategory.get(cat).push(a)
}
for (const [cat, acts] of [...byCategory.entries()].sort()) {
  console.log(`\n--- ${cat} (${acts.length}) ---`)
  for (const a of acts) console.log(`  activityId=${a.activityId} ${a.status?.padEnd(11)} "${a.activityName}"`)
}
