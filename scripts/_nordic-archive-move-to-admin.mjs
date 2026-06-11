#!/usr/bin/env node
/**
 * Moves every ARCHIVE-prefixed document in the three Nordic folders into
 * SkySlope's native broker-only "Admin" folder via the JSON API.
 *
 * SkySlope only supports three values for the document `folder` field:
 *   - Admin   (broker/auditor only — used here as the archive bucket)
 *   - Trash   (literal trash; do not use for archives)
 *   - null    (default / main file list — current state of every doc)
 *
 * Custom folders cannot be created. See:
 * `PATCH /api/files/sales/{saleGuid}/documents/{documentGuid}`
 * swagger description on api-latest.skyslope.com.
 *
 * Usage:
 *   node scripts/_nordic-archive-move-to-admin.mjs                # dry-run
 *   node scripts/_nordic-archive-move-to-admin.mjs --execute      # apply
 *   node scripts/_nordic-archive-move-to-admin.mjs --revert       # dry-run for null
 *   node scripts/_nordic-archive-move-to-admin.mjs --revert --execute   # move back
 *
 * The script is idempotent. It does not depend on the document's current
 * folder value (the GET endpoint doesn't return it) — it always PATCHes
 * Folder=Admin (or =null for --revert) regardless of prior state.
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const BASE = 'https://api-latest.skyslope.com'
const REPORT_PATH = 'tmp/nordic-archive-move-report.json'
const FOLDERS = [
  { guid: 'ce3c30de-1b10-4946-bf06-6dbad8e1d53d', label: 'Closed' },
  { guid: '6be4810f-eda4-433d-ad6f-f27b80a1c6e0', label: 'Canceled-A' },
  { guid: '0ec95d31-1fed-4519-a114-e967513eac33', label: 'Canceled-B' },
]
const APPLY = process.argv.includes('--execute')
const REVERT = process.argv.includes('--revert')
const TARGET_FOLDER_VALUE = REVERT ? null : 'Admin'

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
    headers: {
      'Content-Type': 'application/json',
      Authorization: `ss ${env.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`,
      Timestamp: ts,
    },
    body: JSON.stringify({
      ClientId: env.SKYSLOPE_CLIENT_ID.trim(),
      ClientSecret: env.SKYSLOPE_CLIENT_SECRET.trim(),
    }),
  })
  const j = await r.json()
  if (!j.Session) throw new Error(`Auth failed: ${JSON.stringify(j).slice(0, 200)}`)
  return j.Session
}

function apiHeaders(session) {
  return {
    'Content-Type': 'application/json',
    Session: session,
    timestamp: new Date().toISOString(),
    Accept: 'application/json',
  }
}

function isArchiveName(name) {
  return !!name && /^ARCHIVE[\s_-]/i.test(name)
}

await loadEnvLocal()
const session = await login()
console.log(`Auth ok. Apply=${APPLY} Revert=${REVERT} Target folder=${TARGET_FOLDER_VALUE ?? '(null/main)'}\n`)

const report = {
  mode: APPLY ? 'execute' : 'dry-run',
  targetFolder: TARGET_FOLDER_VALUE,
  generatedAt: new Date().toISOString(),
  folders: {},
}
let grandFound = 0
let grandPatched = 0
let grandFailed = 0

for (const folder of FOLDERS) {
  console.log(`=== ${folder.label} (${folder.guid.slice(0, 8)}) ===`)
  const dr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${folder.guid}/documents`, { headers: apiHeaders(session) })
  if (!dr.ok) {
    console.log(`  ! documents GET HTTP ${dr.status}`)
    report.folders[folder.label] = { error: `HTTP ${dr.status}` }
    continue
  }
  const docs = (await dr.json()).value?.documents || []
  const archiveDocs = docs.filter((d) => isArchiveName(d.fileName || d.docName || ''))
  console.log(`  Documents total=${docs.length}, ARCHIVE-prefixed=${archiveDocs.length}`)
  grandFound += archiveDocs.length

  const folderReport = { guid: folder.guid, found: archiveDocs.length, items: [] }
  let patched = 0, fail = 0

  for (const d of archiveDocs) {
    const docId = d.docId || d.id
    const fn = d.fileName || d.docName || ''
    if (!docId) {
      console.log(`  ! no docId for "${fn.substring(0, 70)}"`)
      fail++; grandFailed++
      folderReport.items.push({ docId: null, fileName: fn, status: 'no-id' })
      continue
    }

    // Swagger documents Folder as a query param but that returns HTTP 500.
    // Confirmed via smoke test (_nordic-smoke-folder-variants.mjs) that the
    // working contract is PATCH with body { Folder: "Admin" } or { Folder: null }.
    const url = `${BASE}/api/files/sales/${folder.guid}/documents/${docId}`
    const body = JSON.stringify({ Folder: TARGET_FOLDER_VALUE })

    if (!APPLY) {
      console.log(`  WOULD-PATCH ${docId.slice(0, 8)}  "${fn.substring(0, 70)}"`)
      folderReport.items.push({ docId, fileName: fn, status: 'would-patch' })
      patched++
      continue
    }

    const r = await skyslopeFetchWithRetry(url, { method: 'PATCH', headers: apiHeaders(session), body })
    const text = await r.text()
    let body
    try { body = JSON.parse(text) } catch { body = { raw: text.slice(0, 200) } }
    if (r.ok) {
      patched++; grandPatched++
      const newFolder = body?.value?.folder ?? body?.folder ?? '?'
      console.log(`  PATCH ${docId.slice(0, 8)}  folder=${newFolder}  "${fn.substring(0, 60)}"`)
      folderReport.items.push({ docId, fileName: fn, status: 'patched', returnedFolder: newFolder })
    } else {
      fail++; grandFailed++
      console.log(`  ! HTTP ${r.status} for ${docId.slice(0, 8)} "${fn.substring(0, 60)}": ${JSON.stringify(body).slice(0, 200)}`)
      folderReport.items.push({ docId, fileName: fn, status: `fail-${r.status}`, body })
    }
  }

  console.log(`  Folder summary: ${APPLY ? 'patched' : 'would-patch'}=${patched}, failed=${fail}`)
  Object.assign(folderReport, { totals: { patched, fail } })
  report.folders[folder.label] = folderReport
}

console.log(`\n=== TOTALS ===`)
console.log(`  ARCHIVE-prefixed docs found: ${grandFound}`)
console.log(`  ${APPLY ? 'Patched' : 'Would-patch'}: ${grandPatched}`)
console.log(`  Failed: ${grandFailed}`)

await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true })
await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2))
console.log(`\nReport → ${REPORT_PATH}`)
if (!APPLY) console.log(`\n[DRY RUN] Re-run with --execute to apply.`)
