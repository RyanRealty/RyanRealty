#!/usr/bin/env node
/**
 * Phase 7 PATCH renames for Ochoco Way.
 * Body: JSON { FileName }. Skip noop. Sanitize embedded periods.
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
function sanitize(s) {
  const lastDot = s.lastIndexOf('.')
  return s.split('').map((c, i) => c === '.' && i !== lastDot ? '-' : c).join('')
    .replace(/–|—/g, '-').replace(/…/g, ' etc').replace(/&/g, ' and ')
    .replace(/[<>:"|?*]/g, '').replace(/\s+/g, ' ').trim()
}

await loadEnv()
const session = await login()
console.log('✓ Authenticated')

const plan = JSON.parse(await fs.readFile(`${ROOT}/tmp/ochoco-way-phase0/v2-rename-plan.json`, 'utf8'))
const docsJson = JSON.parse(await fs.readFile(`${ROOT}/tmp/ochoco-way-phase0/documents.json`, 'utf8'))
const currentByDocId = {}
for (const d of (docsJson.value?.documents || [])) {
  const id = (d.id || d.docId || '').toLowerCase()
  if (id) currentByDocId[id] = d.fileName || d.documentName
}

const log = []
let ok = 0, skip = 0, fail = 0
for (const r of plan) {
  const docId = r.docId.toLowerCase()
  const current = currentByDocId[docId] || r.currentName
  const proposed = sanitize(r.proposedName)
  if (current === proposed) { skip++; log.push({ docId, status: 'noop', name: current }); continue }
  const url = `${BASE}/api/files/sales/${GUID}/documents/${docId}`
  const pr = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Session: session, Accept: 'application/json' }, body: JSON.stringify({ FileName: proposed }) })
  const body = await pr.text()
  if (pr.ok) {
    ok++; log.push({ docId, status: pr.status, from: current, to: proposed })
    console.log(`✓ ${r.short} (${pr.status}): ${current.substring(0, 40)} → ${proposed.substring(0, 70)}`)
  } else {
    fail++; log.push({ docId, status: pr.status, from: current, to: proposed, error: body.substring(0, 300) })
    console.log(`✗ ${r.short} (${pr.status}): ${proposed.substring(0, 60)}`)
    console.log(`    Error: ${body.substring(0, 200)}`)
  }
}
await fs.writeFile(`${ROOT}/tmp/ochoco-way-phase0/patch-log.json`, JSON.stringify(log, null, 2))
console.log(`\nDone. OK=${ok} SKIP=${skip} FAIL=${fail}`)
if (fail > 0) process.exit(1)
