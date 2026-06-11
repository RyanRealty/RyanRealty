#!/usr/bin/env node
/**
 * Probe: dump current `folder` field for all docs in the 3 Nordic folders,
 * grouped by Admin / Trash / null / other.
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const BASE = 'https://api-latest.skyslope.com'
const FOLDERS = [
  { guid: 'ce3c30de-1b10-4946-bf06-6dbad8e1d53d', label: 'Closed' },
  { guid: '6be4810f-eda4-433d-ad6f-f27b80a1c6e0', label: 'Canceled-A' },
  { guid: '0ec95d31-1fed-4519-a114-e967513eac33', label: 'Canceled-B' },
]

async function loadEnvLocal() {
  const raw = await fs.readFile('.env.local', 'utf8').catch(() => '')
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 0) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (process.env[k] === undefined) process.env[k] = v
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
    headers: { 'Content-Type': 'application/json', Authorization: `ss ${env.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`, Timestamp: ts },
    body: JSON.stringify({ ClientId: env.SKYSLOPE_CLIENT_ID.trim(), ClientSecret: env.SKYSLOPE_CLIENT_SECRET.trim() }),
  })
  return (await r.json()).Session
}

function apiHeaders(session) {
  return { 'Content-Type': 'application/json', Session: session, timestamp: new Date().toISOString(), Accept: 'application/json' }
}

await loadEnvLocal()
const session = await login()

for (const folder of FOLDERS) {
  console.log(`\n=== ${folder.label} (${folder.guid.slice(0, 8)}) ===`)
  const r = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${folder.guid}/documents`, { headers: apiHeaders(session) })
  const docs = (await r.json()).value?.documents || []
  const groups = new Map()
  const archiveByFolder = new Map()
  for (const d of docs) {
    const fld = d.folder ?? '(null)'
    groups.set(fld, (groups.get(fld) || 0) + 1)
    const fn = d.fileName || d.docName || ''
    if (/^ARCHIVE[\s_-]/i.test(fn)) {
      archiveByFolder.set(fld, (archiveByFolder.get(fld) || 0) + 1)
    }
  }
  console.log(`  Total docs: ${docs.length}`)
  console.log(`  By folder field:`)
  for (const [k, v] of [...groups.entries()].sort()) {
    const arc = archiveByFolder.get(k) || 0
    console.log(`    ${k.padEnd(10)} → ${String(v).padStart(3)} total  (${arc} ARCHIVE-prefixed)`)
  }
  // Sample one doc to see all available fields
  if (docs.length) {
    const sample = docs[0]
    console.log(`  Sample doc fields: ${Object.keys(sample).sort().join(', ')}`)
  }
}
