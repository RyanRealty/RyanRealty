#!/usr/bin/env node
/**
 * Phase 8c: ASSIGN 21 canonical Bear St docs to their checklist activities.
 *
 * POST /api/files/sales/{guid}/checklist-items/{activityId}
 * body: { documentGuid: "<docId>" }
 *
 * Source of truth: tmp/bear-st-phase0/v6-checklist-plan.json
 */
import fs from 'node:fs/promises'
import crypto from 'node:crypto'

const ROOT = '/Users/matthewryan/RyanRealty'
const GUID = '2b9046c3-25aa-4efd-b4b1-bd381d6f2a8d'
const BASE = 'https://api-latest.skyslope.com'

async function loadEnvLocal() {
  const txt = await fs.readFile(`${ROOT}/.env.local`, 'utf8')
  for (const raw of txt.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    let val = m[2]
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
    if (!(m[1] in process.env)) process.env[m[1]] = val
  }
}

async function login() {
  const ts = new Date().toISOString()
  const e = process.env
  const hmac = crypto.createHmac('sha256', e.SKYSLOPE_ACCESS_SECRET.trim())
    .update(`${e.SKYSLOPE_CLIENT_ID.trim()}:${e.SKYSLOPE_CLIENT_SECRET.trim()}:${ts}`)
    .digest('base64')
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `ss ${e.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`, Timestamp: ts },
    body: JSON.stringify({ ClientId: e.SKYSLOPE_CLIENT_ID.trim(), ClientSecret: e.SKYSLOPE_CLIENT_SECRET.trim() }),
  })
  return (await r.json()).Session
}

await loadEnvLocal()
const session = await login()
console.log('✓ Authenticated\n')

const plan = JSON.parse(await fs.readFile(`${ROOT}/tmp/bear-st-phase0/v6-checklist-plan.json`, 'utf8'))
const assigns = plan.assign

const log = []
let ok = 0, failed = 0
for (const a of assigns) {
  const url = `${BASE}/api/files/sales/${GUID}/checklist-items/${a.activityId}`
  const ts = new Date().toISOString()
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Session: session, timestamp: ts, Accept: 'application/json' },
    body: JSON.stringify({ documentGuid: a.docId }),
  })
  const body = await r.text()
  if (r.ok) {
    ok++
    log.push({ docId: a.docId, activityId: a.activityId, activityName: a.activityName, status: r.status })
    console.log(`✓ (${r.status}) ${a.docId.substring(0, 8)} → ${a.activityId} ${a.activityName.substring(0, 40)}`)
  } else {
    failed++
    log.push({ docId: a.docId, activityId: a.activityId, activityName: a.activityName, status: r.status, error: body.substring(0, 200) })
    console.log(`✗ (${r.status}) ${a.docId.substring(0, 8)} → ${a.activityId} ${a.activityName.substring(0, 40)}`)
    console.log(`    Error: ${body.substring(0, 200)}`)
  }
}

await fs.writeFile(`${ROOT}/tmp/bear-st-phase0/assign-log.json`, JSON.stringify(log, null, 2))
console.log(`\nDone. OK=${ok} FAILED=${failed} (total ${assigns.length})`)
if (failed > 0) process.exit(1)
