#!/usr/bin/env node
/**
 * Generic Phase 7-8 executor for the skyslope-form-compliance skill.
 *
 * Reads a phase5-plan.json from a workspace directory and applies:
 *   - Phase 7: PATCH renames (archive + v5 + corrective)
 *   - Phase 8a: UNASSIGN docs from wrong/superseded activities
 *   - Phase 8c: ASSIGN canonical docs to correct activities (incl. cross-links)
 *
 * Phase 8b (UI archive folder move) is intentionally skipped — the filename
 * ARCHIVE- prefix is the audit-defensible visual grouping; the SkySlope UI
 * archive move via Playwright has a known lock-store bug (see
 * references/archive-and-trash-workflows.md).
 *
 * Phase 6 + 9 (Broker Notes generation + Gmail send + ingest + attach) is a
 * SEPARATE script: scripts/execute-broker-notes.mjs.
 *
 * Usage:
 *   node .claude/skills/skyslope-form-compliance/scripts/execute-plan.mjs <workspace-dir>             # dry-run
 *   node .claude/skills/skyslope-form-compliance/scripts/execute-plan.mjs <workspace-dir> --execute   # live
 *
 * Example:
 *   node .claude/skills/skyslope-form-compliance/scripts/execute-plan.mjs tmp/35th-redmond-2026-05-27 --execute
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const ROOT = '/Users/matthewryan/RyanRealty'
const BASE = 'https://api-latest.skyslope.com'

const args = process.argv.slice(2)
const APPLY = args.includes('--execute')
const RESUME = args.includes('--resume')
const workspaceDir = args.find((a) => !a.startsWith('--'))
if (!workspaceDir) {
  console.error('usage: execute-plan.mjs <workspace-dir> [--execute] [--resume]')
  process.exit(1)
}
const WORKSPACE = path.isAbsolute(workspaceDir) ? workspaceDir : path.join(ROOT, workspaceDir)

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
    headers: { 'Content-Type': 'application/json', Authorization: `ss ${e.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`, Timestamp: ts },
    body: JSON.stringify({ ClientId: e.SKYSLOPE_CLIENT_ID.trim(), ClientSecret: e.SKYSLOPE_CLIENT_SECRET.trim() }),
  })
  const j = await r.json()
  if (!j.Session) throw new Error('Auth failed: ' + JSON.stringify(j))
  return j.Session
}

const hdrs = (s) => ({ 'Content-Type': 'application/json', Session: s, Accept: 'application/json' })

const THROTTLE_MS = 400
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// Wrap every mutating call: throttle to stay under SkySlope's ~99-rapid-call limit,
// retry on 429 with exponential backoff. See conversation log: Cedar tripped 429 unthrottled.
async function mutate(url, opts) {
  let attempt = 0
  while (true) {
    const res = await fetch(url, opts)
    if (res.status !== 429) {
      await sleep(THROTTLE_MS)
      return res
    }
    attempt++
    if (attempt > 5) {
      await sleep(THROTTLE_MS)
      return res
    }
    const backoff = 1500 * Math.pow(2, attempt - 1)
    console.log(`    …429 backoff ${backoff}ms (attempt ${attempt})`)
    await sleep(backoff)
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
    .replace(/#/g, 'No ')
    .replace(/[/\\]/g, '-')
    .replace(/[<>:"|?*,;%{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

await loadEnv()

const plan = JSON.parse(await fs.readFile(`${WORKSPACE}/phase5-plan.json`, 'utf8'))
const saleGuid = plan.saleGuid
if (!saleGuid) throw new Error('phase5-plan.json missing saleGuid')

console.log(`Mode: ${APPLY ? 'EXECUTE (live mutations)' : 'DRY-RUN (no mutations)'}`)
console.log(`Workspace: ${WORKSPACE}`)
console.log(`Property: ${plan.property || '(unknown)'}`)
console.log(`Sale GUID: ${saleGuid}`)
console.log(`Summary:`, plan.summary)
console.log()

console.log('→ Authenticating + fetching fresh state...')
const session = await login()
console.log('  ✓ Session acquired')

const docsRes = await fetch(`${BASE}/api/files/sales/${saleGuid}/documents`, { headers: hdrs(session) })
const docsJson = await docsRes.json()
const allDocs = docsJson.value?.documents || []
const knownDocIds = new Set(allDocs.map((d) => (d.id || '').toLowerCase()))
const liveNameById = new Map(allDocs.map((d) => [(d.id || '').toLowerCase(), d.fileName || d.name || '']))
console.log(`  ✓ ${allDocs.length} docs in current state`)

// Validate every docId in the plan exists in the live SkySlope state
const renames = plan.renames || []
const unassigns = plan.unassigns || []
const assigns = plan.assigns || []
const crossLinks = plan.cross_links || []

const missing = []
for (const r of [...renames, ...unassigns, ...assigns, ...crossLinks]) {
  if (!r.docId) {
    missing.push({ source: 'no-docId', value: r })
    continue
  }
  if (!knownDocIds.has(r.docId.toLowerCase())) {
    missing.push({ source: 'unknown-docId', value: r.docId })
  }
}
if (missing.length > 0) {
  console.log(`✗ ${missing.length} plan actions reference docIds not in current SkySlope state:`)
  for (const m of missing.slice(0, 10)) console.log('  ', JSON.stringify(m).substring(0, 150))
  console.log('Refusing to mutate. Re-run Phase 0 to refresh state, or correct the plan.')
  process.exit(1)
}

console.log(`  ✓ All ${renames.length + unassigns.length + assigns.length + crossLinks.length} plan actions reference valid docIds`)
console.log()

if (!APPLY) {
  console.log('=== DRY-RUN — no mutations performed ===')
  console.log(`Would execute: ${renames.length} renames, ${unassigns.length} unassigns, ${assigns.length} assigns, ${crossLinks.length} cross-links`)
  console.log('Re-run with --execute to apply.')
  process.exit(0)
}

console.log('=== EXECUTING LIVE MUTATIONS ===')
const log = { auth: 'ok', phase7: [], phase8a: [], phase8c: [] }

// --resume: skip actions that already landed (2xx) in a prior execution-log.json,
// and carry their successful entries forward so the summary reflects total progress.
const doneSet = new Set()
if (RESUME) {
  try {
    const prior = JSON.parse(await fs.readFile(`${WORKSPACE}/execution-log.json`, 'utf8'))
    for (const x of prior.phase7 || []) {
      if (x.status >= 200 && x.status < 300) { doneSet.add(`r:${x.docId}`); log.phase7.push(x) }
    }
    for (const x of prior.phase8a || []) {
      if (x.status >= 200 && x.status < 300) { doneSet.add(`u:${x.docId}:${x.activityId}`); log.phase8a.push(x) }
    }
    for (const x of prior.phase8c || []) {
      if (x.status >= 200 && x.status < 300) { doneSet.add(`${x.kind === 'cross-link' ? 'x' : 'a'}:${x.docId}:${x.activityId}`); log.phase8c.push(x) }
    }
    console.log(`  ↻ RESUME: ${doneSet.size} prior-successful actions will be skipped`)
  } catch {
    console.log(`  ↻ RESUME requested but no readable prior execution-log.json — running all`)
  }
}

// Phase 7: PATCH renames
console.log(`--- Phase 7: PATCH renames (${renames.length}) ---`)
for (const r of renames) {
  const newName = sanitize(r.newName)
  if (RESUME && doneSet.has(`r:${r.docId}`)) {
    console.log(`  ↻ skip PATCH ${r.short8 || r.docId.substring(0, 8)} (already done)`)
    continue
  }
  // idempotent: if the live filename already equals the sanitized target, no call needed
  if (liveNameById.get(r.docId.toLowerCase()) === newName) {
    log.phase7.push({ docId: r.docId, short8: r.short8, status: 200, from: r.currentName, to: newName, action: r.action, error: null, note: 'already-named' })
    console.log(`  ✓ PATCH ${r.short8 || r.docId.substring(0, 8)} (skip, already named) → ${newName.substring(0, 60)}`)
    continue
  }
  const url = `${BASE}/api/files/sales/${saleGuid}/documents/${r.docId}`
  const pr = await mutate(url, { method: 'PATCH', headers: hdrs(session), body: JSON.stringify({ FileName: newName }) })
  const body = await pr.text()
  log.phase7.push({ docId: r.docId, short8: r.short8, status: pr.status, from: r.currentName, to: newName, action: r.action, error: pr.ok ? null : body.substring(0, 300) })
  console.log(`  ${pr.ok ? '✓' : '✗'} PATCH ${r.short8 || r.docId.substring(0, 8)} (${pr.status}) [${r.action}] → ${newName.substring(0, 60)}`)
  if (!pr.ok) console.log(`    Error: ${body.substring(0, 200)}`)
}

// Phase 8a: UNASSIGN
console.log()
console.log(`--- Phase 8a: UNASSIGN (${unassigns.length}) ---`)
for (const u of unassigns) {
  if (RESUME && doneSet.has(`u:${u.docId}:${u.activityId}`)) {
    console.log(`  ↻ skip UNASSIGN ${u.short8 || u.docId.substring(0, 8)} off ${u.activityName} (already done)`)
    continue
  }
  const url = `${BASE}/api/files/sales/${saleGuid}/checklist-items/${u.activityId}/unassign`
  const pr = await mutate(url, { method: 'POST', headers: hdrs(session), body: JSON.stringify({ documentGuid: u.docId }) })
  const body = await pr.text()
  log.phase8a.push({ docId: u.docId, short8: u.short8, activityId: u.activityId, activityName: u.activityName, status: pr.status, error: pr.ok ? null : body.substring(0, 300) })
  console.log(`  ${pr.ok ? '✓' : '✗'} UNASSIGN ${u.short8 || u.docId.substring(0, 8)} off ${u.activityName} (${pr.status})`)
  if (!pr.ok) console.log(`    Error: ${body.substring(0, 200)}`)
}

// Phase 8c: ASSIGN (correct activity placement)
console.log()
console.log(`--- Phase 8c: ASSIGN (${assigns.length}) ---`)
for (const a of assigns) {
  if (RESUME && doneSet.has(`a:${a.docId}:${a.targetActivityId}`)) {
    console.log(`  ↻ skip ASSIGN ${a.short8 || a.docId.substring(0, 8)} → ${a.targetActivityName} (already done)`)
    continue
  }
  const url = `${BASE}/api/files/sales/${saleGuid}/checklist-items/${a.targetActivityId}`
  const pr = await mutate(url, { method: 'POST', headers: hdrs(session), body: JSON.stringify({ documentGuid: a.docId }) })
  const body = await pr.text()
  log.phase8c.push({ kind: 'assign', docId: a.docId, short8: a.short8, activityId: a.targetActivityId, activityName: a.targetActivityName, status: pr.status, error: pr.ok ? null : body.substring(0, 300) })
  console.log(`  ${pr.ok ? '✓' : '✗'} ASSIGN ${a.short8 || a.docId.substring(0, 8)} → ${a.targetActivityName} (${pr.status})`)
  if (!pr.ok) console.log(`    Error: ${body.substring(0, 200)}`)
}

// Phase 8c: cross-link ASSIGN (bundle attach to additional activities)
console.log()
console.log(`--- Phase 8c: cross-link ASSIGN (${crossLinks.length}) ---`)
for (const c of crossLinks) {
  if (RESUME && doneSet.has(`x:${c.docId}:${c.targetActivityId}`)) {
    console.log(`  ↻ skip CROSS-LINK ${c.short8 || c.docId.substring(0, 8)} → ${c.targetActivityName} (already done)`)
    continue
  }
  const url = `${BASE}/api/files/sales/${saleGuid}/checklist-items/${c.targetActivityId}`
  const pr = await mutate(url, { method: 'POST', headers: hdrs(session), body: JSON.stringify({ documentGuid: c.docId }) })
  const body = await pr.text()
  log.phase8c.push({ kind: 'cross-link', docId: c.docId, short8: c.short8, activityId: c.targetActivityId, activityName: c.targetActivityName, status: pr.status, error: pr.ok ? null : body.substring(0, 300) })
  console.log(`  ${pr.ok ? '✓' : '✗'} CROSS-LINK ${c.short8 || c.docId.substring(0, 8)} → ${c.targetActivityName} (${pr.status})`)
  if (!pr.ok) console.log(`    Error: ${body.substring(0, 200)}`)
}

await fs.writeFile(`${WORKSPACE}/execution-log.json`, JSON.stringify(log, null, 2))

const okP7 = log.phase7.filter((x) => x.status >= 200 && x.status < 300).length
const okP8a = log.phase8a.filter((x) => x.status >= 200 && x.status < 300).length
const okP8c = log.phase8c.filter((x) => x.status >= 200 && x.status < 300).length
console.log()
console.log(`Phase 7 PATCH:     ${okP7}/${log.phase7.length} OK`)
console.log(`Phase 8a UNASSIGN: ${okP8a}/${log.phase8a.length} OK`)
console.log(`Phase 8c ASSIGN:   ${okP8c}/${log.phase8c.length} OK`)
console.log()
console.log(`Log: ${WORKSPACE}/execution-log.json`)

const totalErrors = log.phase7.length + log.phase8a.length + log.phase8c.length - okP7 - okP8a - okP8c
if (totalErrors > 0) {
  console.log(`⚠ ${totalErrors} errors — inspect execution-log.json`)
  process.exit(1)
}
