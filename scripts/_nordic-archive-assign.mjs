#!/usr/bin/env node
/**
 * Bulk-assigns every ARCHIVE-prefixed document in the three Nordic
 * folders to that folder's "Archive" activity (Miscellaneous
 * Documentation). Pure JSON API — no browser needed.
 *
 * Prerequisite: the "Archive" activity has been added to the two
 * checklist templates (1639421 + 1635390) via _skyslope-template-add-archive.mjs
 * (or manually in the SkySlope UI), AND the activity has propagated to
 * each of the three snapshotted Closed/Canceled folders.
 *
 * Usage:
 *   node scripts/_nordic-archive-assign.mjs              # dry-run
 *   node scripts/_nordic-archive-assign.mjs --execute    # apply
 *
 * Behaviour:
 *   - For each Nordic folder:
 *     1. GET /api/files/sales/{guid} -> find checklist.activities
 *     2. Locate the activity whose activityName trims to "Archive" or "Archive *"
 *     3. GET /api/files/sales/{guid}/documents -> find every doc whose
 *        fileName begins with "ARCHIVE" (case-sensitive — that is the
 *        convention written by v5-namer.mjs)
 *     4. For each such doc not already in the Archive activity,
 *        POST /api/files/sales/{guid}/checklist-items/{archiveActivityId}
 *           body: { documentGuid: <docId> }
 *   - Reports counts and writes tmp/nordic-archive-assign-report.json
 *
 * Expected counts (from Nordic finalize lessons): Closed 74 + Canceled-A
 * 34 + Canceled-B 14 = 122 ARCHIVE-prefixed docs.
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const BASE = 'https://api-latest.skyslope.com'
const REPORT_PATH = 'tmp/nordic-archive-assign-report.json'
const FOLDERS = [
  { guid: 'ce3c30de-1b10-4946-bf06-6dbad8e1d53d', label: 'Closed' },
  { guid: '6be4810f-eda4-433d-ad6f-f27b80a1c6e0', label: 'Canceled-A' },
  { guid: '0ec95d31-1fed-4519-a114-e967513eac33', label: 'Canceled-B' },
]
const APPLY = process.argv.includes('--execute')

// .env.local loader (same pattern as other scripts in this repo)
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
  if (!name) return false
  // v5-namer convention writes "ARCHIVE - <original>" or "ARCHIVE_<original>"
  // Accept both for safety.
  return /^ARCHIVE[\s_-]/i.test(name) || name.toUpperCase().startsWith('ARCHIVE')
}

function findArchiveActivity(activities) {
  for (const a of activities) {
    const n = (a.activityName || '').trim()
    if (n === 'Archive' || n === 'Archive *') return a
  }
  // Looser match — sometimes activities carry the asterisk inline or have
  // trailing whitespace
  for (const a of activities) {
    const n = (a.activityName || '').trim().replace(/\*$/, '').trim()
    if (n.toLowerCase() === 'archive') return a
  }
  return null
}

await loadEnvLocal()
const session = await login()
console.log(`Auth ok. Apply mode = ${APPLY}\n`)

const report = { mode: APPLY ? 'execute' : 'dry-run', generatedAt: new Date().toISOString(), folders: {} }
let grandTotal = 0
let grandAssigned = 0
let grandAlreadyAssigned = 0
let grandFailed = 0
let grandMissingActivity = 0

for (const folder of FOLDERS) {
  console.log(`=== ${folder.label} (${folder.guid.slice(0, 8)}) ===`)
  const folderReport = { label: folder.label, guid: folder.guid, archiveActivityId: null, archiveCheckedDocs: [], errors: [] }

  const fr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${folder.guid}`, { headers: apiHeaders(session) })
  if (!fr.ok) {
    console.log(`  ! folder GET failed HTTP ${fr.status}`)
    folderReport.errors.push(`folder GET ${fr.status}`)
    report.folders[folder.label] = folderReport
    continue
  }
  const fbody = await fr.json()
  const activities = fbody.value?.sale?.checklist?.activities || []
  console.log(`  Checklist: "${fbody.value?.sale?.checklistType}" (${activities.length} activities)`)

  const archiveAct = findArchiveActivity(activities)
  if (!archiveAct) {
    console.log(`  ! No "Archive" activity in this folder's checklist. Skipping. (Add the activity to the source template first.)`)
    folderReport.errors.push('archive activity not present in folder')
    report.folders[folder.label] = folderReport
    grandMissingActivity++
    continue
  }
  console.log(`  Archive activity: id=${archiveAct.activityId} name="${(archiveAct.activityName || '').trim()}"`)
  folderReport.archiveActivityId = archiveAct.activityId

  const alreadyAttached = new Set(
    (archiveAct.checklistDocs || []).map((d) => d.id || d.docId || d.documentGuid).filter(Boolean),
  )

  // Pull the document list (flat documents endpoint — same as
  // _nordic-closed-finalize.mjs uses)
  const dr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${folder.guid}/documents`, { headers: apiHeaders(session) })
  if (!dr.ok) {
    console.log(`  ! documents GET failed HTTP ${dr.status}`)
    folderReport.errors.push(`documents GET ${dr.status}`)
    report.folders[folder.label] = folderReport
    continue
  }
  const dbody = await dr.json()
  const docs = dbody.value?.documents || dbody.value || []
  const archiveDocs = docs.filter((d) => isArchiveName(d.fileName || d.docName || ''))
  console.log(`  Documents total=${docs.length}, ARCHIVE-prefixed=${archiveDocs.length}`)

  let folderAssigned = 0
  let folderAlready = 0
  let folderFailed = 0

  for (const d of archiveDocs) {
    const docId = d.docId || d.id
    const fn = d.fileName || d.docName || ''
    if (!docId) {
      folderFailed++
      grandFailed++
      console.log(`    ! doc with no id: "${fn.substring(0, 60)}"`)
      continue
    }
    if (alreadyAttached.has(docId)) {
      folderAlready++
      grandAlreadyAssigned++
      continue
    }
    grandTotal++
    console.log(`    ASSIGN ${docId.slice(0, 8)} "${fn.substring(0, 60)}"`)
    folderReport.archiveCheckedDocs.push({ docId, fileName: fn, action: APPLY ? 'assigned' : 'would-assign' })
    if (!APPLY) {
      folderAssigned++
      continue
    }
    const r = await skyslopeFetchWithRetry(
      `${BASE}/api/files/sales/${folder.guid}/checklist-items/${archiveAct.activityId}`,
      {
        method: 'POST',
        headers: apiHeaders(session),
        body: JSON.stringify({ documentGuid: docId }),
      },
    )
    if (r.ok) {
      folderAssigned++
      grandAssigned++
    } else {
      folderFailed++
      grandFailed++
      const txt = (await r.text()).substring(0, 200)
      console.log(`      HTTP ${r.status}: ${txt}`)
      folderReport.errors.push(`assign ${docId.slice(0, 8)} HTTP ${r.status}: ${txt}`)
    }
  }

  console.log(`  Folder summary: assigned=${folderAssigned}, already=${folderAlready}, failed=${folderFailed}`)
  Object.assign(folderReport, { totals: { assigned: folderAssigned, already: folderAlready, failed: folderFailed, archiveDocs: archiveDocs.length } })
  report.folders[folder.label] = folderReport
}

console.log(`\n=== TOTALS ===`)
console.log(`  Folders missing Archive activity: ${grandMissingActivity}`)
console.log(`  Would-assign / Attempted: ${grandTotal}`)
console.log(`  OK: ${grandAssigned}`)
console.log(`  Already attached: ${grandAlreadyAssigned}`)
console.log(`  Failed: ${grandFailed}`)

await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true })
await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2))
console.log(`\nReport written → ${REPORT_PATH}`)
if (!APPLY) console.log(`\n[DRY RUN] Use --execute to apply.`)
