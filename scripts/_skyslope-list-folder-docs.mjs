#!/usr/bin/env node
/**
 * Lightweight folder doc-list check — just lists docs in a SkySlope
 * folder without re-downloading binaries. Use to poll for newly-ingested
 * forwarded emails.
 *
 * Usage:
 *   node --env-file=.env.local scripts/_skyslope-list-folder-docs.mjs --kind=sale --guid=<guid>
 */
import fs from 'fs'
import crypto from 'crypto'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const BASE = 'https://api-latest.skyslope.com'
const args = process.argv.slice(2)
const arg = (n) => {
  for (const a of args) if (a.startsWith(`--${n}=`)) return a.slice(n.length + 3)
  return null
}
const KIND = arg('kind') || 'sale'
const GUID = arg('guid')
if (!GUID) {
  console.error('Usage: --kind=sale|listing --guid=<guid>')
  process.exit(1)
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
  return {
    'Content-Type': 'application/json',
    Session: session,
    timestamp: new Date().toISOString(),
    Accept: 'application/json',
  }
}

const session = await login()
const pathSeg = KIND === 'listing' ? 'listings' : 'sales'

// The /documents subresource returns the full list; the folder root
// only returns metadata.
const docsRes = await skyslopeFetchWithRetry(
  `${BASE}/api/files/${pathSeg}/${GUID}/documents`,
  { headers: apiHeaders(session) }
)
const docs = (await docsRes.json())?.value?.documents || []

// Filter real docs (drop pseudo-rows with fileSize === -1)
const real = docs.filter((d) => d && d.fileSize !== -1)

// Sort by upload date desc — newest first
real.sort((a, b) => String(b.uploadDate || '').localeCompare(String(a.uploadDate || '')))

console.log(`Folder ${GUID}: ${docs.length} docs total (${real.length} real)`)
console.log('')
console.log('NEWEST 20:')
for (const d of real.slice(0, 20)) {
  const sz = (d.fileSize == null ? '?' : String(d.fileSize)).padStart(8)
  console.log(`  ${d.uploadDate || '?'}  ${(d.docId || '').slice(0, 8)}  ${sz}b  ${d.fileName}`)
}
console.log('')
console.log(`Total real docs: ${real.length}`)
