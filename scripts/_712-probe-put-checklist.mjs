#!/usr/bin/env node
/** Diagnose why PUT checklistType fails on 712 — compare error codes across template IDs. */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = 'https://api-latest.skyslope.com'
const GUID = 'f50fe2a6-226c-4f81-8a59-9fc9a46ea5df'

async function loadEnvLocal() {
  const txt = await fs.readFile(path.join(REPO, '.env.local'), 'utf8')
  for (const raw of txt.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    let val = m[2]
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
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
    body: JSON.stringify({ ClientId: e.SKYSLOPE_CLIENT_ID.trim(), ClientSecret: e.SKYSLOPE_CLIENT_SECRET.trim() }),
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
const saleR = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${GUID}`, { headers: H(session) })
const sale = (await saleR.json()).value?.sale ?? {}
console.log(`712 status=${sale.status} officeGuid=${sale.officeGuid ?? 'null'} checklist="${sale.checklistType}"`)

// Find a Pending sale with officeGuid for contrast test
const listR = await skyslopeFetchWithRetry(`${BASE}/api/files/sales?pageNumber=1&earliestDate=${Math.floor(Date.UTC(2020,0,1)/1000)}&latestDate=${Math.floor(Date.now()/1000)}`, { headers: H(session) })
const sales = (await listR.json()).value?.sales ?? []
let pendingWithOffice = null
for (const s of sales.slice(0, 15)) {
  const dr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${s.saleGuid}`, { headers: H(session) })
  const d = (await dr.json()).value?.sale ?? {}
  if (d.officeGuid && d.status === 'Pending') {
    pendingWithOffice = { guid: s.saleGuid, officeGuid: d.officeGuid, checklistType: d.checklistType }
    break
  }
}
console.log(`Pending w/ office sample: ${JSON.stringify(pendingWithOffice)}`)

async function tryPut(targetGuid, id, label) {
  const r = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${targetGuid}/checklistType`, {
    method: 'PUT',
    headers: H(session),
    body: JSON.stringify({ checklistTypeId: id }),
  })
  console.log(`${label} PUT ${id} → HTTP ${r.status} ${(await r.text()).slice(0, 120)}`)
}

// Only run mutating tests when explicitly requested
if (!process.argv.includes('--mutate')) {
  console.log('\nNo mutations (pass --mutate to run PUT tests).')
  process.exit(0)
}

console.log('\n--- Mutating tests on 712 ---')
await tryPut(GUID, 1639421, '712 same-template')
await tryPut(GUID, 1635390, '712 legacy-standard')
await tryPut(GUID, 1784213, '712 legacy-new')

if (pendingWithOffice) {
  console.log('\n--- Mutating test on pending sale (1784213 only) ---')
  await tryPut(pendingWithOffice.guid, 1784213, 'pending legacy-new')
}
