#!/usr/bin/env node
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
  return { Session: session, timestamp: new Date().toISOString(), Accept: 'application/json' }
}

await loadEnvLocal()
const session = await login()

const paths = [
  '/api/checklistTypes',
  '/api/offices',
  `/api/files/sales/${GUID}/updateChecklistTypeForm`,
  `/api/files/sales/${GUID}/updateSaleForm`,
]

for (const p of paths) {
  const r = await skyslopeFetchWithRetry(`${BASE}${p}`, { headers: H(session) })
  console.log(`\n${p} → HTTP ${r.status}`)
  console.log((await r.text()).slice(0, 2000))
}

const officeGuid = 'b6f368a9-f0a1-489d-b2e3-f1e8de11f4d4'
for (const q of ['?transactionType=Sale', '?TransactionType=Sale', '']) {
  const r = await skyslopeFetchWithRetry(`${BASE}/api/offices/${officeGuid}/checklistTypes${q}`, { headers: H(session) })
  console.log(`\n/api/offices/.../checklistTypes${q} → HTTP ${r.status}`)
  const txt = await r.text()
  console.log(txt.slice(0, 6000))
  if (r.ok) break
}
