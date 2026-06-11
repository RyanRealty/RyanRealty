#!/usr/bin/env node
/**
 * Probe variants of how to PATCH the document `folder` field. Tries:
 *   1. ?Folder=Admin in query (swagger-documented)
 *   2. body { Folder: 'Admin' }
 *   3. body { folder: 'Admin' } (lowercase)
 *   4. body { FileName: <unchanged>, Folder: 'Admin' } (mirror working pattern)
 *   5. body { Folder: 'Admin' } with Content-Type omitted
 *
 * Stops on the first successful variant. Reports each attempt's status
 * + response body. The target doc is the first ARCHIVE-prefixed doc in
 * Canceled-B (smallest folder, easy to roll back if anything sticks).
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

const dr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${FOLDER_GUID}/documents`, { headers: apiHeaders(session) })
const docs = (await dr.json()).value?.documents || []
const target = docs.find((d) => /^ARCHIVE[\s_-]/i.test(d.fileName || d.docName || ''))
if (!target) { console.error('No ARCHIVE doc in Canceled-B'); process.exit(1) }
const docId = target.docId || target.id
const fn = target.fileName || target.docName
const docUrl = `${BASE}/api/files/sales/${FOLDER_GUID}/documents/${docId}`
console.log(`Target: ${docId.slice(0, 8)}  "${fn}"\n`)

const variants = [
  { label: '1. query ?Folder=Admin',
    init: { method: 'PATCH', headers: apiHeaders(session) },
    url: `${docUrl}?Folder=Admin` },
  { label: '2. body { Folder: Admin }',
    init: { method: 'PATCH', headers: apiHeaders(session), body: JSON.stringify({ Folder: 'Admin' }) },
    url: docUrl },
  { label: '3. body { folder: Admin } (lowercase)',
    init: { method: 'PATCH', headers: apiHeaders(session), body: JSON.stringify({ folder: 'Admin' }) },
    url: docUrl },
  { label: '4. body { FileName, Folder: Admin }',
    init: { method: 'PATCH', headers: apiHeaders(session), body: JSON.stringify({ FileName: fn, Folder: 'Admin' }) },
    url: docUrl },
  { label: '5. body { Folder: Admin } no Content-Type',
    init: { method: 'PATCH', headers: { Session: session, timestamp: new Date().toISOString(), Accept: 'application/json' }, body: JSON.stringify({ Folder: 'Admin' }) },
    url: docUrl },
  { label: '6. query ?folder=Admin (lowercase)',
    init: { method: 'PATCH', headers: apiHeaders(session) },
    url: `${docUrl}?folder=Admin` },
  { label: '7. query ?Folder=Admin&FileName=<unchanged>',
    init: { method: 'PATCH', headers: apiHeaders(session) },
    url: `${docUrl}?${new URLSearchParams({ FileName: fn, Folder: 'Admin' })}` },
]

for (const v of variants) {
  console.log(`--- ${v.label} ---`)
  console.log(`URL: ${v.url}`)
  if (v.init.body) console.log(`Body: ${v.init.body}`)
  try {
    const r = await skyslopeFetchWithRetry(v.url, v.init)
    const text = await r.text()
    let body
    try { body = JSON.parse(text) } catch { body = { raw: text.slice(0, 300) } }
    const folderField = body?.value?.folder ?? body?.folder ?? '(missing)'
    console.log(`HTTP ${r.status}  folder="${folderField}"`)
    if (r.ok && folderField === 'Admin') {
      console.log(`\n✓ SUCCESS with variant: ${v.label}`)
      console.log(`Returned body:`)
      console.log(JSON.stringify(body, null, 2))
      console.log(`\nUse this variant for the bulk script.`)
      // Sanity: also verify by re-GET? GET doesn't return folder, so we
      // trust the response body. Visually confirm in SkySlope UI.
      process.exit(0)
    }
    console.log(`Body:`, JSON.stringify(body).slice(0, 250))
  } catch (e) {
    console.log(`ERR ${e.message}`)
  }
  console.log()
}

console.log('\nAll variants failed or returned wrong folder. Inspect output above.')
process.exit(2)
