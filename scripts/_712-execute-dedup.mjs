#!/usr/bin/env node
/**
 * Live execution of the 712 SW 1st dedup plan against SkySlope.
 * Follows the new skyslope-form-compliance skill's Phase 7 + 8a + 8c.
 * Phase 8b (UI archive-folder move) skipped — filename ARCHIVE- prefix is the audit-defensible grouping.
 *
 * Plan (verified in this session via dedup verification of 23 PDFs):
 *   - 9 archives: rename + unassign from current activity
 *   - 1 cross-link: 3a29b3c2 bundle → Sale Addendums activity (keeps existing EFA assignment)
 *
 * Usage:
 *   node scripts/_712-execute-dedup.mjs              # dry-run (print plan, no mutations)
 *   node scripts/_712-execute-dedup.mjs --execute    # live mutations
 */
import fs from 'node:fs/promises'
import crypto from 'node:crypto'

const ROOT = '/Users/matthewryan/RyanRealty'
const SALE_GUID = 'f50fe2a6-226c-4f81-8a59-9fc9a46ea5df'
const BASE = 'https://api-latest.skyslope.com'
const APPLY = process.argv.includes('--execute')
const OUT_DIR = `${ROOT}/tmp/712-execute-2026-05-27`

const PLAN = {
  archives: [
    {
      shortId: '30c8a6f2',
      newName: 'ARCHIVE - X_043_Advisory Regarding Electronic Funds - sellers-only intermediate (superseded by 3a29b3c2).pdf',
      reason: 'OREF 043 EFA sellers-only intermediate, superseded by 3a29b3c2 bundle (both sides + agents signed)',
    },
    {
      shortId: '5c3d1878',
      newName: 'ARCHIVE - X_043_Advisory Regarding Electronic Funds - Boynton failed cycle.pdf',
      reason: 'OREF 043 EFA from FAILED Boynton offer cycle 04042024MBEB (not the 04022024AB closing cycle)',
    },
    {
      shortId: 'b1e92cee',
      newName: 'ARCHIVE - Preliminary Title Report - abridged (superseded by abe92cee).pdf',
      reason: '13-page abridged Prelim Title, superseded by 57-page abe92cee full report with exhibits',
    },
    {
      shortId: 'b2e92cee',
      newName: 'ARCHIVE - X_Preliminary Title Report - abridged no cover (superseded by abe92cee).pdf',
      reason: '12-page abridged Prelim Title minus LiveLOOK cover, superseded by 57-page abe92cee',
    },
    {
      shortId: '20d1e3eb',
      newName: 'ARCHIVE - X_Receipt For Funds - duplicate of 2c52ee38.pdf',
      reason: 'Identical EMR (same $2,000 Caldwell/Mendoza check 105, same date) as 2c52ee38; older upload',
    },
    {
      shortId: '1f01b01f',
      newName: 'ARCHIVE - 04022024AB_X_002_Addendum to Real Estate Sale Agreement - duplicate of 2c7fdcdc.pdf',
      reason: 'OREF 002 wood-stove addendum, identical content to 2c7fdcdc (same DigiSign envelope a08b4211)',
    },
    {
      shortId: '1f0f0dd1',
      newName: 'ARCHIVE - 04022024AB_X_002_Residential Addendum - sellers-only intermediate (superseded by 720dbeb1).pdf',
      reason: 'OREF 002 Residential Addendum sellers-only intermediate, superseded by 720dbeb1 (all 4 parties signed)',
    },
    {
      shortId: '4c8f0c9b',
      newName: 'ARCHIVE - 04022024AB_X_025_Standard EIFS - sellers-only intermediate (superseded by b69dd220).pdf',
      reason: 'OREF 025 Standard EIFS sellers-only, superseded by b69dd220 Residential EIFS fully executed both sides + buyers agent',
    },
    {
      shortId: 'ef69fb6f',
      newName: 'ARCHIVE - 04022024AB_X_021_LBP - sellers-only intermediate (buyer cert in bundle 3a29b3c2).pdf',
      reason: 'OREF 021 LBP sellers-only intermediate; the fully-executed LBP buyer cert is on pages 2-3 of bundle 3a29b3c2 (envelope d10ffd9d)',
    },
  ],
  crossLinks: [
    {
      shortId: '3a29b3c2',
      targetActivityName: 'Sale Addendums',
      reason: 'Bundle contains OREF 021 LBP on pages 2-3 with fully-executed buyer cert; cross-link so the LBP-required activity sees the bundle (in addition to its primary Electronic Funds Advisory assignment)',
    },
  ],
}

async function loadEnv() {
  const txt = await fs.readFile(`${ROOT}/.env.local`, 'utf8')
  for (const raw of txt.split('\n')) {
    const m = raw.trim().match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    let val = m[2]
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
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
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `ss ${e.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`,
      Timestamp: ts,
    },
    body: JSON.stringify({
      ClientId: e.SKYSLOPE_CLIENT_ID.trim(),
      ClientSecret: e.SKYSLOPE_CLIENT_SECRET.trim(),
    }),
  })
  const j = await r.json()
  if (!j.Session) throw new Error('Auth failed: ' + JSON.stringify(j))
  return j.Session
}

function hdrs(session) {
  return {
    'Content-Type': 'application/json',
    Session: session,
    Accept: 'application/json',
  }
}

function sanitize(s) {
  const lastDot = s.lastIndexOf('.')
  return s
    .split('')
    .map((c, i) => (c === '.' && i !== lastDot ? '-' : c))
    .join('')
    .replace(/–|—/g, '-')
    .replace(/…/g, ' etc')
    .replace(/&/g, ' and ')
    .replace(/[<>:"|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

await loadEnv()
await fs.mkdir(OUT_DIR, { recursive: true })

console.log(`Mode: ${APPLY ? 'EXECUTE (live mutations)' : 'DRY-RUN (no mutations)'}`)
console.log(`Sale GUID: ${SALE_GUID}`)
console.log()

console.log('→ Authenticating...')
const session = await login()
console.log('  ✓ Session acquired')

console.log('→ Fetching fresh sale detail + documents...')
const saleRes = await fetch(`${BASE}/api/files/sales/${SALE_GUID}`, { headers: hdrs(session) })
const saleJson = await saleRes.json()
const activities = saleJson.value?.sale?.checklist?.activities || []
const docsRes = await fetch(`${BASE}/api/files/sales/${SALE_GUID}/documents`, { headers: hdrs(session) })
const docsJson = await docsRes.json()
const allDocs = docsJson.value?.documents || []
console.log(`  ✓ ${allDocs.length} docs, ${activities.length} activities`)

// Resolve activities by name (we don't trust the snapshot's activityIds)
function findActivityByName(name) {
  return activities.find((a) => a.activityName === name || a.activityName?.trim() === name)
}

// Build a docId-to-activityIds map for unassign lookups
const docToActivities = new Map()
for (const a of activities) {
  for (const d of a.checklistDocs || []) {
    const id = (d.id || '').toLowerCase()
    if (!docToActivities.has(id)) docToActivities.set(id, [])
    docToActivities.get(id).push({ id: a.activityId, name: a.activityName })
  }
}

// Resolve full docIds from short prefixes
function resolveDocId(shortId) {
  return allDocs.find((d) => (d.id || '').toLowerCase().startsWith(shortId.toLowerCase()))
}

console.log()
console.log('→ Resolving plan against fresh data...')
const resolved = { archives: [], crossLinks: [] }
let resolveErr = 0
for (const a of PLAN.archives) {
  const doc = resolveDocId(a.shortId)
  if (!doc) {
    console.log(`  ✗ ${a.shortId}: NOT FOUND in fresh documents.json`)
    resolveErr++
    continue
  }
  const docId = doc.id
  const currentName = doc.fileName || doc.documentName
  const acts = docToActivities.get(docId.toLowerCase()) || []
  resolved.archives.push({ shortId: a.shortId, docId, currentName, newName: sanitize(a.newName), reason: a.reason, activities: acts })
  console.log(`  ${a.shortId} | ${acts.map((x) => x.name).join(' / ') || 'unassigned'} | "${currentName.substring(0, 50)}"`)
}

for (const c of PLAN.crossLinks) {
  const doc = resolveDocId(c.shortId)
  const target = findActivityByName(c.targetActivityName)
  if (!doc || !target) {
    console.log(`  ✗ Cross-link ${c.shortId} → ${c.targetActivityName}: doc=${!!doc}, target=${!!target}`)
    resolveErr++
    continue
  }
  const currentActs = docToActivities.get(doc.id.toLowerCase()) || []
  const alreadyOnTarget = currentActs.some((a) => a.id === target.activityId)
  resolved.crossLinks.push({
    shortId: c.shortId,
    docId: doc.id,
    targetActivity: { id: target.activityId, name: target.activityName },
    currentActivities: currentActs,
    alreadyOnTarget,
    reason: c.reason,
  })
  console.log(`  ${c.shortId} → ${c.targetActivityName} (id ${target.activityId})  alreadyOnTarget=${alreadyOnTarget}`)
}

await fs.writeFile(`${OUT_DIR}/plan.json`, JSON.stringify(resolved, null, 2))
console.log()
console.log(`✓ Resolved plan written to ${OUT_DIR}/plan.json`)
console.log(`  ${resolved.archives.length}/9 archives, ${resolved.crossLinks.length}/1 cross-links resolved`)
console.log(`  ${resolveErr} resolution errors`)

if (resolveErr > 0) {
  console.log('✗ Resolution errors above. Halting before mutations.')
  process.exit(1)
}

if (!APPLY) {
  console.log()
  console.log('=== DRY-RUN — no live mutations performed ===')
  console.log('Re-run with --execute to apply.')
  process.exit(0)
}

console.log()
console.log('=== EXECUTING LIVE MUTATIONS ===')
const log = { auth: 'ok', phase7: [], phase8a: [], phase8c: [] }

// Phase 7: PATCH FileName
console.log('--- Phase 7: PATCH renames (9) ---')
for (const a of resolved.archives) {
  const url = `${BASE}/api/files/sales/${SALE_GUID}/documents/${a.docId}`
  const pr = await fetch(url, {
    method: 'PATCH',
    headers: hdrs(session),
    body: JSON.stringify({ FileName: a.newName }),
  })
  const body = await pr.text()
  log.phase7.push({ shortId: a.shortId, docId: a.docId, status: pr.status, from: a.currentName, to: a.newName, error: pr.ok ? null : body.substring(0, 300) })
  console.log(`  ${pr.ok ? '✓' : '✗'} PATCH ${a.shortId} (${pr.status}) → ${a.newName.substring(0, 70)}`)
  if (!pr.ok) console.log(`    Error: ${body.substring(0, 200)}`)
}

// Phase 8a: UNASSIGN each archive from each of its current activities
console.log()
console.log('--- Phase 8a: UNASSIGN ---')
for (const a of resolved.archives) {
  for (const act of a.activities) {
    const url = `${BASE}/api/files/sales/${SALE_GUID}/checklist-items/${act.id}/unassign`
    const pr = await fetch(url, {
      method: 'POST',
      headers: hdrs(session),
      body: JSON.stringify({ documentGuid: a.docId }),
    })
    const body = await pr.text()
    log.phase8a.push({ shortId: a.shortId, docId: a.docId, activityId: act.id, activityName: act.name, status: pr.status, error: pr.ok ? null : body.substring(0, 300) })
    console.log(`  ${pr.ok ? '✓' : '✗'} UNASSIGN ${a.shortId} off ${act.name} (${pr.status})`)
    if (!pr.ok) console.log(`    Error: ${body.substring(0, 200)}`)
  }
}

// Phase 8c: cross-link ASSIGN
console.log()
console.log('--- Phase 8c: cross-link ASSIGN ---')
for (const c of resolved.crossLinks) {
  if (c.alreadyOnTarget) {
    console.log(`  • ${c.shortId} already on ${c.targetActivity.name} — skipping`)
    log.phase8c.push({ shortId: c.shortId, docId: c.docId, status: 'skipped-already-on-target' })
    continue
  }
  const url = `${BASE}/api/files/sales/${SALE_GUID}/checklist-items/${c.targetActivity.id}`
  const pr = await fetch(url, {
    method: 'POST',
    headers: hdrs(session),
    body: JSON.stringify({ documentGuid: c.docId }),
  })
  const body = await pr.text()
  log.phase8c.push({ shortId: c.shortId, docId: c.docId, activityId: c.targetActivity.id, activityName: c.targetActivity.name, status: pr.status, error: pr.ok ? null : body.substring(0, 300) })
  console.log(`  ${pr.ok ? '✓' : '✗'} ASSIGN ${c.shortId} → ${c.targetActivity.name} (${pr.status})`)
  if (!pr.ok) console.log(`    Error: ${body.substring(0, 200)}`)
}

await fs.writeFile(`${OUT_DIR}/execution-log.json`, JSON.stringify(log, null, 2))
console.log()
const okP7 = log.phase7.filter((x) => x.status >= 200 && x.status < 300).length
const okP8a = log.phase8a.filter((x) => x.status >= 200 && x.status < 300).length
const okP8c = log.phase8c.filter((x) => x.status === 'skipped-already-on-target' || (x.status >= 200 && x.status < 300)).length
console.log(`Phase 7 PATCH:    ${okP7}/${log.phase7.length} OK`)
console.log(`Phase 8a UNASSIGN: ${okP8a}/${log.phase8a.length} OK`)
console.log(`Phase 8c ASSIGN:  ${okP8c}/${log.phase8c.length} OK`)
console.log(`Log: ${OUT_DIR}/execution-log.json`)
