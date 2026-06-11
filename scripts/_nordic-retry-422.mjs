#!/usr/bin/env node
/**
 * Targeted retry for the 10 422-failed PATCHes from the Nordic apply pass.
 * Reads each folder's report.jsonl, finds proposals whose target name
 * still contains en-dash/ellipsis/&, re-sanitizes, and PATCHes.
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

const REPORT_DIR = 'tmp/skyslope-form-compliance-2026-05-23'

async function login() {
  const ts = new Date().toISOString()
  const env = process.env
  const hmac = crypto.createHmac('sha256', env.SKYSLOPE_ACCESS_SECRET.trim()).update(`${env.SKYSLOPE_CLIENT_ID.trim()}:${env.SKYSLOPE_CLIENT_SECRET.trim()}:${ts}`).digest('base64')
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

function sanitize(s) {
  return String(s || '')
    .replace(/[\/\\:*?"<>|]/g, '')
    .replace(/[–—]/g, '-')   // en-dash, em-dash
    .replace(/…/g, 'etc')
    .replace(/&/g, ' and ')
    .replace(/\s+/g, ' ')
    .replace(/\./g, '-')
    .trim()
}

const session = await login()

const DRY = !process.argv.includes('--execute')
let totalRetries = 0
let okCount = 0
let stillFailCount = 0

for (const folder of FOLDERS) {
  const reportPath = `${REPORT_DIR}/${folder.guid.slice(0, 8)}-report.jsonl`
  const exists = await fs.access(reportPath).then(() => true).catch(() => false)
  if (!exists) {
    console.log(`No report for ${folder.label} — skipping.`)
    continue
  }
  const lines = (await fs.readFile(reportPath, 'utf8')).split('\n').filter(Boolean)
  console.log(`\n=== ${folder.label} (${folder.guid.slice(0,8)}) — ${lines.length} report entries ===`)
  // Pull live doc list to get current filenames
  const dr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${folder.guid}/documents`, { headers: apiHeaders(session) })
  const live = (await dr.json()).value?.documents || []
  const docByCurrentName = new Map()
  for (const d of live) {
    const id = d.docId || d.id || d.documentGuid
    if (id && d.fileName) docByCurrentName.set(d.fileName, id)
  }
  // Walk report, look for proposed names that contain forbidden chars
  for (const line of lines) {
    let entry
    try { entry = JSON.parse(line) } catch { continue }
    const proposed = entry.proposedName || entry.newName
    const oldName = entry.currentName || entry.oldName || ''
    const docId = entry.docId
    if (!proposed || !docId) continue
    // Look for any char that triggers SkySlope 422: en/em-dash, ellipsis,
    // ampersand, or internal period in the stem.
    const m = proposed.match(/^(.+)(\.[^.]+)$/)
    const stem = m ? m[1] : proposed
    const ext = m ? m[2] : ''
    if (!/[–—…&.]/.test(stem)) continue
    const sanitized = sanitize(stem) + ext
    if (sanitized === proposed) continue
    totalRetries++
    console.log(`  RETRY ${docId.slice(0, 8)}: "${oldName.slice(0, 40)}" → "${sanitized}"`)
    if (DRY) continue
    const r = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${folder.guid}/documents/${docId}`, {
      method: 'PATCH',
      headers: apiHeaders(session),
      body: JSON.stringify({ FileName: sanitized }),
    })
    if (r.ok) {
      okCount++
      console.log(`    HTTP ${r.status} OK`)
    } else {
      stillFailCount++
      const text = await r.text()
      console.log(`    HTTP ${r.status}: ${text.substring(0, 200)}`)
    }
  }
}

console.log(`\n=== RESULT ===`)
console.log(`Retries attempted: ${totalRetries}`)
console.log(`  OK: ${okCount}`)
console.log(`  Still failing: ${stillFailCount}`)
if (DRY) console.log(`\n[DRY RUN] Use --execute to apply.`)
