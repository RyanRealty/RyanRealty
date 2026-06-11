#!/usr/bin/env node
/**
 * 712 SW 1st — execute v2 skill rerun delta (16 actions including BN regen).
 *
 * Phase 7-8 actions (this script):
 *   5 renames (3 _X strips + 2 archive-prefix REMOVALS on closing docs)
 *   4 ASSIGNs (MLSCO ODS, Closing Disclosure, Settlement Statement, failed-cycle BN)
 *   3 cross-link ASSIGNs (301ce46e → Wood Stove, 3a29b3c2 → LBP, 9210cc08 → Broker Commission Demand)
 *
 * Phase 6+9 (separate step): regenerate Broker Notes with corrected $275K sale price,
 * send via Gmail, ingest, attach, archive old BN.
 *
 * Usage:
 *   node scripts/_712-execute-v2-delta.mjs             # dry-run
 *   node scripts/_712-execute-v2-delta.mjs --execute   # live
 */
import fs from 'node:fs/promises'
import crypto from 'node:crypto'

const ROOT = '/Users/matthewryan/RyanRealty'
const BASE = 'https://api-latest.skyslope.com'
const SALE_GUID = 'f50fe2a6-226c-4f81-8a59-9fc9a46ea5df'
const APPLY = process.argv.includes('--execute')

async function loadEnv() {
  const txt = await fs.readFile(`${ROOT}/.env.local`, 'utf8')
  for (const raw of txt.split('\n')) {
    const m = raw.trim().match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    let val = m[2]; if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
    if (!(m[1] in process.env)) process.env[m[1]] = val
  }
}
async function login() {
  const ts = new Date().toISOString(); const e = process.env
  const hmac = crypto.createHmac('sha256', e.SKYSLOPE_ACCESS_SECRET.trim()).update(`${e.SKYSLOPE_CLIENT_ID.trim()}:${e.SKYSLOPE_CLIENT_SECRET.trim()}:${ts}`).digest('base64')
  const r = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `ss ${e.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`, Timestamp: ts }, body: JSON.stringify({ ClientId: e.SKYSLOPE_CLIENT_ID.trim(), ClientSecret: e.SKYSLOPE_CLIENT_SECRET.trim() }) })
  return (await r.json()).Session
}
const h = (s) => ({ 'Content-Type': 'application/json', Session: s, Accept: 'application/json' })

function sanitize(s) {
  const lastDot = s.lastIndexOf('.')
  return s.split('').map((c, i) => c === '.' && i !== lastDot ? '-' : c).join('')
    .replace(/–|—/g, '-').replace(/…/g, ' etc').replace(/&/g, ' and ')
    .replace(/[<>:"|?*]/g, '').replace(/\s+/g, ' ').trim()
}

await loadEnv()
const session = await login()
const docs = (await (await fetch(`${BASE}/api/files/sales/${SALE_GUID}/documents`, { headers: h(session) })).json()).value.documents
const sale = (await (await fetch(`${BASE}/api/files/sales/${SALE_GUID}`, { headers: h(session) })).json()).value.sale
const activities = sale.checklist.activities

const docToActs = new Map()
for (const a of activities) {
  for (const d of a.checklistDocs || []) {
    const id = (d.id || '').toLowerCase()
    if (!docToActs.has(id)) docToActs.set(id, [])
    docToActs.get(id).push({ id: a.activityId, name: a.activityName })
  }
}

const findDoc = (short) => docs.find((d) => d.id.toLowerCase().startsWith(short.toLowerCase()))
const findAct = (re) => activities.find((a) => re.test(a.activityName || ''))

// === RENAMES ===
const RENAMES = [
  // 1. b5242029 — strip _X (OREF 059 sellers-only, requires buyer)
  { short: 'b5242029', newName: '04022024AB_059_Receipt of Reports Removal of Contingencies Addendum.pdf' },
  // 2. 11020384 — strip _X (MLSCO unsigned by broker)
  { short: '11020384', newName: 'MLSCO Listing Contract ODS.pdf' },
  // 3. 2c7fdcdc — ARCHIVE prefix + strip _X (wood-stove sellers-only, covered by 301ce46e bundle p12)
  { short: '2c7fdcdc', newName: 'ARCHIVE - 04022024AB_002_Addendum to Real Estate Sale Agreement - wood-stove sellers-only superseded by OREF 046 in RSA bundle 301ce46e p12.pdf' },
  // 4. 04caeb44 — REMOVE ARCHIVE prefix (Closing Disclosure, wrongly archived as not_executed)
  { short: '04caeb44', newName: 'Closing Disclosure.pdf' },
  // 5. 03caeb44 — REMOVE ARCHIVE prefix (Estimated Seller's Statement, wrongly archived)
  { short: '03caeb44', newName: 'Estimated Settlement Statement.pdf' },
]

// === ASSIGNs (primary assignment) ===
const ASSIGNS = [
  // 11020384 MLSCO → MLSCO Listing Contract activity
  { short: '11020384', activityRe: /^MLSCO Listing Contract$|MLSCO.*Listing.*Contract/i },
  // 04caeb44 Closing Disclosure → Final HUD
  { short: '04caeb44', activityRe: /^Final HUD$/i },
  // 03caeb44 Estimated Settlement → Final HUD
  { short: '03caeb44', activityRe: /^Final HUD$/i },
  // 9120405e failed-cycle Broker Notes → Broker Notes activity (cross-link with existing closing BN)
  { short: '9120405e', activityRe: /^Broker Notes$/i },
]

// === Cross-link ASSIGNs ===
const CROSS_LINKS = [
  // 301ce46e RSA bundle → Wood Stove Fireplace Insert Addendum
  { short: '301ce46e', activityRe: /Wood Stove.*Fireplace|Wood.?Stove.*Insert/i },
  // 3a29b3c2 EFA+LBP bundle → Lead Based Paint Disclosure
  { short: '3a29b3c2', activityRe: /Lead.?Based.?Paint.?Disclosure|^LBP Disclosure$/i },
  // 9210cc08 091 Comp Notice → Broker Commission Demand from Title
  { short: '9210cc08', activityRe: /Broker Commission Demand.*Title/i },
]

console.log(`Mode: ${APPLY ? 'EXECUTE' : 'DRY-RUN'}`)
console.log()

// Resolve all docs + activities
const errors = []
const resolved = { renames: [], assigns: [], crossLinks: [] }
for (const r of RENAMES) {
  const doc = findDoc(r.short)
  if (!doc) { errors.push(`rename ${r.short}: docId not found`); continue }
  resolved.renames.push({ docId: doc.id, currentName: doc.fileName, newName: sanitize(r.newName), short: r.short })
}
for (const a of ASSIGNS) {
  const doc = findDoc(a.short)
  const act = findAct(a.activityRe)
  if (!doc) { errors.push(`assign ${a.short}: docId not found`); continue }
  if (!act) { errors.push(`assign ${a.short}: activity matching ${a.activityRe} not found`); continue }
  const already = (docToActs.get(doc.id.toLowerCase()) || []).some((x) => x.id === act.activityId)
  resolved.assigns.push({ docId: doc.id, short: a.short, activityId: act.activityId, activityName: act.activityName, alreadyAssigned: already })
}
for (const c of CROSS_LINKS) {
  const doc = findDoc(c.short)
  const act = findAct(c.activityRe)
  if (!doc) { errors.push(`cross-link ${c.short}: docId not found`); continue }
  if (!act) { errors.push(`cross-link ${c.short}: activity matching ${c.activityRe} not found`); continue }
  const already = (docToActs.get(doc.id.toLowerCase()) || []).some((x) => x.id === act.activityId)
  resolved.crossLinks.push({ docId: doc.id, short: c.short, activityId: act.activityId, activityName: act.activityName, alreadyAssigned: already })
}

if (errors.length) {
  console.log('✗ Resolution errors:')
  for (const e of errors) console.log(`  ${e}`)
  process.exit(1)
}
console.log(`✓ Resolved: ${resolved.renames.length} renames, ${resolved.assigns.length} assigns, ${resolved.crossLinks.length} cross-links`)

if (!APPLY) {
  console.log()
  for (const r of resolved.renames) console.log(`  rename ${r.short} | "${(r.currentName||'').substring(0,50)}" → "${r.newName.substring(0,70)}"`)
  for (const a of resolved.assigns) console.log(`  assign ${a.short} → ${a.activityName}${a.alreadyAssigned ? ' (already)' : ''}`)
  for (const c of resolved.crossLinks) console.log(`  cross-link ${c.short} → ${c.activityName}${c.alreadyAssigned ? ' (already)' : ''}`)
  console.log('\n=== DRY-RUN — re-run with --execute ===')
  process.exit(0)
}

const log = { renames: [], assigns: [], crossLinks: [] }

console.log('\n--- Phase 7 PATCH renames ---')
for (const r of resolved.renames) {
  const pr = await fetch(`${BASE}/api/files/sales/${SALE_GUID}/documents/${r.docId}`, { method: 'PATCH', headers: h(session), body: JSON.stringify({ FileName: r.newName }) })
  const body = pr.ok ? '' : await pr.text()
  log.renames.push({ docId: r.docId, status: pr.status, to: r.newName, error: body.substring(0, 200) })
  console.log(`  ${pr.ok ? '✓' : '✗'} ${r.short} (${pr.status}) → ${r.newName.substring(0,75)}`)
  if (!pr.ok) console.log(`    ${body.substring(0,150)}`)
}

console.log('\n--- Phase 8c ASSIGN (primary) ---')
for (const a of resolved.assigns) {
  if (a.alreadyAssigned) {
    log.assigns.push({ docId: a.docId, activityId: a.activityId, status: 'noop-already-assigned' })
    console.log(`  • ${a.short} already on ${a.activityName} — skip`)
    continue
  }
  const pr = await fetch(`${BASE}/api/files/sales/${SALE_GUID}/checklist-items/${a.activityId}`, { method: 'POST', headers: h(session), body: JSON.stringify({ documentGuid: a.docId }) })
  const body = pr.ok ? '' : await pr.text()
  log.assigns.push({ docId: a.docId, activityId: a.activityId, status: pr.status, error: body.substring(0, 200) })
  console.log(`  ${pr.ok ? '✓' : '✗'} ASSIGN ${a.short} → ${a.activityName} (${pr.status})`)
  if (!pr.ok) console.log(`    ${body.substring(0,150)}`)
}

console.log('\n--- Phase 8c cross-link ASSIGN ---')
for (const c of resolved.crossLinks) {
  if (c.alreadyAssigned) {
    log.crossLinks.push({ docId: c.docId, activityId: c.activityId, status: 'noop-already-assigned' })
    console.log(`  • ${c.short} already on ${c.activityName} — skip`)
    continue
  }
  const pr = await fetch(`${BASE}/api/files/sales/${SALE_GUID}/checklist-items/${c.activityId}`, { method: 'POST', headers: h(session), body: JSON.stringify({ documentGuid: c.docId }) })
  const body = pr.ok ? '' : await pr.text()
  log.crossLinks.push({ docId: c.docId, activityId: c.activityId, status: pr.status, error: body.substring(0, 200) })
  console.log(`  ${pr.ok ? '✓' : '✗'} CROSS-LINK ${c.short} → ${c.activityName} (${pr.status})`)
  if (!pr.ok) console.log(`    ${body.substring(0,150)}`)
}

await fs.writeFile(`${ROOT}/tmp/712-2026-05-27-rerun/execution-log.json`, JSON.stringify(log, null, 2))
const okR = log.renames.filter((x) => x.status >= 200 && x.status < 300).length
const okA = log.assigns.filter((x) => x.status === 'noop-already-assigned' || (x.status >= 200 && x.status < 300)).length
const okC = log.crossLinks.filter((x) => x.status === 'noop-already-assigned' || (x.status >= 200 && x.status < 300)).length
console.log(`\nResult: renames ${okR}/${log.renames.length} · assigns ${okA}/${log.assigns.length} · cross-links ${okC}/${log.crossLinks.length}`)
console.log(`Log: ${ROOT}/tmp/712-2026-05-27-rerun/execution-log.json`)
