#!/usr/bin/env node
/**
 * Phase 8a UNASSIGN + Phase 8c ASSIGN for Ochoco Way.
 */
import fs from 'node:fs/promises'
import crypto from 'node:crypto'

const ROOT = '/Users/matthewryan/RyanRealty'
const GUID = 'eb9a24d6-f766-4fb7-bfca-a9c7e5b83cf5'
const BASE = 'https://api-latest.skyslope.com'

async function loadEnv() {
  const txt = await fs.readFile(`${ROOT}/.env.local`, 'utf8')
  for (const raw of txt.split('\n')) {
    const m = raw.trim().match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    let val = m[2]; if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
    if (!(m[1] in process.env)) process.env[m[1]] = val
  }
}
async function login() {
  const ts = new Date().toISOString(); const e = process.env
  const hmac = crypto.createHmac('sha256', e.SKYSLOPE_ACCESS_SECRET.trim()).update(`${e.SKYSLOPE_CLIENT_ID.trim()}:${e.SKYSLOPE_CLIENT_SECRET.trim()}:${ts}`).digest('base64')
  const r = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `ss ${e.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`, Timestamp: ts }, body: JSON.stringify({ ClientId: e.SKYSLOPE_CLIENT_ID.trim(), ClientSecret: e.SKYSLOPE_CLIENT_SECRET.trim() }) })
  return (await r.json()).Session
}

await loadEnv()
const session = await login()
console.log('✓ Authenticated')

const cp = JSON.parse(await fs.readFile(`${ROOT}/tmp/ochoco-way-phase0/v2-checklist-plan.json`, 'utf8'))
const log = { unassign: [], assign: [] }

// === Phase 8a: UNASSIGN ===
console.log(`\n--- Phase 8a UNASSIGN (${cp.unassign.length} actions) ---`)
let ua_ok = 0, ua_fail = 0
for (const u of cp.unassign) {
  const url = `${BASE}/api/files/sales/${GUID}/checklist-items/${u.activityId}/unassign`
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Session: session, Accept: 'application/json' }, body: JSON.stringify({ documentGuid: u.docId }) })
  const body = await r.text()
  if (r.ok) {
    ua_ok++; log.unassign.push({ docId: u.docId, activityId: u.activityId, status: r.status })
    console.log(`✓ unassign (${r.status}) ${u.docId.substring(0,8)} off ${u.activityName}`)
  } else {
    ua_fail++; log.unassign.push({ docId: u.docId, activityId: u.activityId, status: r.status, error: body.substring(0, 200) })
    console.log(`✗ unassign (${r.status}) ${u.docId.substring(0,8)} off ${u.activityName}: ${body.substring(0, 100)}`)
  }
}

// === Phase 8c: ASSIGN ===
console.log(`\n--- Phase 8c ASSIGN (${cp.assign.length} actions) ---`)
let as_ok = 0, as_fail = 0
for (const a of cp.assign) {
  const url = `${BASE}/api/files/sales/${GUID}/checklist-items/${a.activityId}`
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Session: session, Accept: 'application/json' }, body: JSON.stringify({ documentGuid: a.docId }) })
  const body = await r.text()
  if (r.ok) {
    as_ok++; log.assign.push({ docId: a.docId, activityId: a.activityId, status: r.status })
    console.log(`✓ assign (${r.status}) ${a.docId.substring(0,8)} → ${a.activityName}`)
  } else {
    as_fail++; log.assign.push({ docId: a.docId, activityId: a.activityId, status: r.status, error: body.substring(0, 200) })
    console.log(`✗ assign (${r.status}) ${a.docId.substring(0,8)} → ${a.activityName}: ${body.substring(0, 100)}`)
  }
}

await fs.writeFile(`${ROOT}/tmp/ochoco-way-phase0/phase8-log.json`, JSON.stringify(log, null, 2))
console.log(`\nDone. UNASSIGN ok=${ua_ok} fail=${ua_fail}  ·  ASSIGN ok=${as_ok} fail=${as_fail}`)
