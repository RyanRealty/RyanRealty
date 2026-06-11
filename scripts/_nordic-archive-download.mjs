#!/usr/bin/env node
/**
 * Downloads every ARCHIVE-prefixed document from the three Nordic
 * folders to ~/Documents/RyanRealty-Archive/Nordic/{Closed,Canceled-A,Canceled-B}/
 *
 * Pure JSON API. No browser needed.
 *
 * Usage:
 *   node scripts/_nordic-archive-download.mjs              # dry-run: list only
 *   node scripts/_nordic-archive-download.mjs --execute    # download
 *
 * Each downloaded file keeps its SkySlope filename. Existing local files
 * with the same name are skipped (idempotent).
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  fetchSkyslopeDocumentBinary,
  skyslopeFetchWithRetry,
} from './skyslope-files-api.mjs'

const BASE = 'https://api-latest.skyslope.com'
const DEST_ROOT = path.join(os.homedir(), 'Documents/RyanRealty-Archive/Nordic')
const REPORT_PATH = 'tmp/nordic-archive-download-report.json'

const FOLDERS = [
  { guid: 'ce3c30de-1b10-4946-bf06-6dbad8e1d53d', label: 'Closed' },
  { guid: '6be4810f-eda4-433d-ad6f-f27b80a1c6e0', label: 'Canceled-A' },
  { guid: '0ec95d31-1fed-4519-a114-e967513eac33', label: 'Canceled-B' },
]
const APPLY = process.argv.includes('--execute')

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

function apiHeadersFactory(session) {
  return () => ({
    'Content-Type': 'application/json',
    Session: session,
    timestamp: new Date().toISOString(),
    Accept: 'application/json',
  })
}

function isArchiveName(name) {
  return !!name && /^ARCHIVE[\s_-]/i.test(name)
}

function sanitizeFileName(name) {
  // Avoid path traversal; SkySlope names are already sanitized but be safe.
  return name.replace(/[\\/]/g, '_').replace(/[\x00-\x1f]/g, '').trim() || 'unnamed.bin'
}

function humanBytes(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

await loadEnvLocal()
const session = await login()
const getHeaders = apiHeadersFactory(session)
console.log(`Auth ok. Apply mode = ${APPLY}\n`)
console.log(`Destination: ${DEST_ROOT}\n`)

const report = {
  mode: APPLY ? 'execute' : 'dry-run',
  generatedAt: new Date().toISOString(),
  destRoot: DEST_ROOT,
  folders: {},
}

let grandFound = 0
let grandDownloaded = 0
let grandSkippedExisting = 0
let grandFailed = 0
let grandBytes = 0

for (const folder of FOLDERS) {
  console.log(`=== ${folder.label} (${folder.guid.slice(0, 8)}) ===`)
  const destDir = path.join(DEST_ROOT, folder.label)
  await fs.mkdir(destDir, { recursive: true })

  const dr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${folder.guid}/documents`, { headers: getHeaders() })
  if (!dr.ok) {
    console.log(`  ! documents GET failed HTTP ${dr.status}`)
    report.folders[folder.label] = { error: `HTTP ${dr.status}` }
    continue
  }
  const dbody = await dr.json()
  const docs = dbody.value?.documents || dbody.value || []
  const archiveDocs = docs.filter((d) => isArchiveName(d.fileName || d.docName || ''))
  console.log(`  Documents total=${docs.length}, ARCHIVE-prefixed=${archiveDocs.length}`)
  grandFound += archiveDocs.length

  const folderReport = { dir: destDir, found: archiveDocs.length, items: [] }
  let dl = 0, skip = 0, fail = 0, bytes = 0

  for (const d of archiveDocs) {
    const fn = sanitizeFileName(d.fileName || d.docName || `unnamed-${(d.docId || d.id || '').slice(0, 8)}.bin`)
    const dest = path.join(destDir, fn)
    const url = d.url
    const item = { docId: d.docId || d.id, fileName: fn, status: 'pending', dest }

    if (!url) {
      console.log(`  ! ${fn.substring(0, 70)} — no download url`)
      item.status = 'no-url'
      fail++
      grandFailed++
      folderReport.items.push(item)
      continue
    }

    const exists = await fs.stat(dest).then(() => true).catch(() => false)
    if (exists) {
      skip++
      grandSkippedExisting++
      item.status = 'skipped-exists'
      folderReport.items.push(item)
      continue
    }

    if (!APPLY) {
      console.log(`  WOULD-DL ${fn.substring(0, 80)}`)
      item.status = 'would-download'
      folderReport.items.push(item)
      continue
    }

    const { ok, status, contentType, buf } = await fetchSkyslopeDocumentBinary(url, getHeaders)
    if (!ok || buf.length === 0) {
      console.log(`  ! ${fn.substring(0, 70)} — HTTP ${status} (${contentType}, ${humanBytes(buf.length)})`)
      item.status = `fail-http-${status}`
      fail++
      grandFailed++
      folderReport.items.push(item)
      continue
    }
    await fs.writeFile(dest, buf)
    dl++
    bytes += buf.length
    grandDownloaded++
    grandBytes += buf.length
    console.log(`  DL ${humanBytes(buf.length).padStart(10)}  ${fn.substring(0, 80)}`)
    item.status = 'downloaded'
    item.bytes = buf.length
    folderReport.items.push(item)
  }

  console.log(`  Folder summary: downloaded=${dl}, skipped-existing=${skip}, failed=${fail}, bytes=${humanBytes(bytes)}`)
  Object.assign(folderReport, { totals: { downloaded: dl, skippedExisting: skip, failed: fail, bytes } })
  report.folders[folder.label] = folderReport
}

console.log(`\n=== TOTALS ===`)
console.log(`  ARCHIVE-prefixed docs found: ${grandFound}`)
console.log(`  Downloaded: ${grandDownloaded}  (${humanBytes(grandBytes)})`)
console.log(`  Skipped (already on disk): ${grandSkippedExisting}`)
console.log(`  Failed: ${grandFailed}`)

await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true })
await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2))
console.log(`\nReport → ${REPORT_PATH}`)
if (!APPLY) console.log(`\n[DRY RUN] Use --execute to download.`)
