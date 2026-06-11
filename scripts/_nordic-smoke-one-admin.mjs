#!/usr/bin/env node
/**
 * Smoke test: PATCH a single Canceled-B ARCHIVE-prefixed doc to
 * Folder=Admin, verify the response. If this succeeds with HTTP 200 and
 * the response reflects folder=Admin, the broker-level permission gate
 * works and the full bulk move is safe.
 *
 * Picks the first ARCHIVE-prefixed doc from Canceled-B to keep the
 * smoke small and easy to eyeball in the UI.
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const BASE = 'https://api-latest.skyslope.com'
const FOLDER_GUID = '0ec95d31-1fed-4519-a114-e967513eac33' // Canceled-B

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
  const hmac = crypto.createHmac('sha256', env.SKYSLOPE_ACCESS_SECRET.trim())
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

console.log(`Pulling Canceled-B documents...`)
const dr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${FOLDER_GUID}/documents`, { headers: apiHeaders(session) })
const docs = (await dr.json()).value?.documents || []
const target = docs.find((d) => /^ARCHIVE[\s_-]/i.test(d.fileName || d.docName || ''))
if (!target) {
  console.error('No ARCHIVE-prefixed doc found in Canceled-B')
  process.exit(1)
}
const docId = target.docId || target.id
const fn = target.fileName || target.docName
console.log(`Target doc:\n  id:       ${docId}\n  fileName: ${fn}\n`)

console.log(`PATCHing Folder=Admin...`)
const url = `${BASE}/api/files/sales/${FOLDER_GUID}/documents/${docId}?Folder=Admin`
const r = await skyslopeFetchWithRetry(url, { method: 'PATCH', headers: apiHeaders(session) })
const text = await r.text()
let body
try { body = JSON.parse(text) } catch { body = { raw: text.slice(0, 500) } }

console.log(`HTTP ${r.status}`)
console.log(`Response body:`)
console.log(JSON.stringify(body, null, 2))

if (!r.ok) {
  console.error(`\nFAIL — PATCH rejected. Check broker permissions on the HMAC credential.`)
  process.exit(2)
}

const returnedFolder = body?.value?.folder ?? body?.folder ?? '(missing)'
console.log(`\nReturned folder field: "${returnedFolder}"`)

if (returnedFolder === 'Admin') {
  console.log(`\n✓ SMOKE TEST PASSED. Doc moved to Admin folder.`)
  console.log(`\nNext step: bulk-execute with`)
  console.log(`  node scripts/_nordic-archive-move-to-admin.mjs --execute`)
  console.log(`\nTo revert this single test doc:`)
  console.log(`  curl -X PATCH '${BASE}/api/files/sales/${FOLDER_GUID}/documents/${docId}?Folder=' (with proper headers)`)
  console.log(`  or run the full revert: node scripts/_nordic-archive-move-to-admin.mjs --revert --execute`)
} else {
  console.log(`\n? PARTIAL — HTTP 200 but returned folder="${returnedFolder}" (expected "Admin"). Visually verify in SkySlope before bulk.`)
}
