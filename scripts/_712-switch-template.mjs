#!/usr/bin/env node
/**
 * Switch 712 SW 1st St (sale GUID f50fe2a6...) to use the new
 * "Residential Sale — Legacy" template (id 1784213) via
 * PUT /api/files/sales/{guid}/checklistType.
 *
 * Then verify by re-fetching and showing the new checklistType + activity count.
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
const NEW_TEMPLATE_ID = 1784213
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

// Current state
console.log(`Before:`)
const beforeR = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${GUID}`, { headers: H(session) })
const before = (await beforeR.json()).value?.sale ?? {}
console.log(`  checklistType: "${before.checklistType}"`)
console.log(`  activities:    ${before.checklist?.activities?.length ?? 0}`)

if (!EXECUTE) {
  console.log(`\n[DRY RUN] Would PUT checklistTypeId=${NEW_TEMPLATE_ID}. Pass --execute to apply.`)
  process.exit(0)
}

console.log(`\nPUT /api/files/sales/${GUID}/checklistType  body: { checklistTypeId: ${NEW_TEMPLATE_ID} }`)
const putR = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${GUID}/checklistType`, {
  method: 'PUT',
  headers: H(session),
  body: JSON.stringify({ checklistTypeId: NEW_TEMPLATE_ID }),
})
console.log(`  HTTP ${putR.status}`)
if (!putR.ok) {
  const txt = await putR.text()
  console.error(`  Body: ${txt.slice(0, 400)}`)
  process.exit(1)
}

await new Promise((r) => setTimeout(r, 2000))

console.log(`\nAfter:`)
const afterR = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${GUID}`, { headers: H(session) })
const after = (await afterR.json()).value?.sale ?? {}
console.log(`  checklistType: "${after.checklistType}"`)
console.log(`  activities:    ${after.checklist?.activities?.length ?? 0}`)

// Diff activity name set
const beforeNames = new Set((before.checklist?.activities ?? []).map((a) => a.activityName?.trim()))
const afterNames = new Set((after.checklist?.activities ?? []).map((a) => a.activityName?.trim()))
const added = [...afterNames].filter((n) => !beforeNames.has(n))
const removed = [...beforeNames].filter((n) => !afterNames.has(n))
console.log(`\nActivity diff:`)
console.log(`  Added (${added.length}):`)
for (const a of added) console.log(`    + "${a}"`)
console.log(`  Removed (${removed.length}):`)
for (const r of removed) console.log(`    - "${r}"`)
