#!/usr/bin/env node
/**
 * Phase 8: Checklist assignment for the 3 Nordic folders.
 *
 * For each folder:
 *   1. Pull live checklist activities (id + name + typeName)
 *   2. Read dry-run report.jsonl for formId per doc
 *   3. Map formId -> activityName via FORM_TO_ACTIVITY
 *   4. POST /api/files/sales/{guid}/checklist-items/{activityId} { documentGuid }
 *
 * Run with --execute to actually POST.
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const BASE = 'https://api-latest.skyslope.com'
const FOLDERS = [
  { guid: 'ce3c30de-1b10-4946-bf06-6dbad8e1d53d', label: 'Closed', reportPath: 'tmp/skyslope-form-compliance-2026-05-23/ce3c30de-report.jsonl' },
  { guid: '6be4810f-eda4-433d-ad6f-f27b80a1c6e0', label: 'Canceled-A', reportPath: 'tmp/skyslope-form-compliance-2026-05-23/6be4810f-report.jsonl' },
  { guid: '0ec95d31-1fed-4519-a114-e967513eac33', label: 'Canceled-B', reportPath: 'tmp/skyslope-form-compliance-2026-05-23/0ec95d31-report.jsonl' },
]
const DRY = !process.argv.includes('--execute')

// formId → activityName mapping. Use lowercase variants for matching.
// The activityName may differ slightly across checklist types — the
// matcher uses substring contains to find the best match.
const FORM_TO_ACTIVITY = {
  // Sale Documentation
  'oref-001-rsa': ['Residential Sale Agreement', 'Residential Purchase Agreement'],
  'oref-002-addendum': ['Sale Addendums'],
  'oref-003-counter': ['Counter Offers'],
  'oref-003-counter-offer': ['Counter Offers'],
  'oref-003-counteroffer': ['Counter Offers'],
  'oref-003-seller-counteroffer': ['Counter Offers'],
  'oref-004-buyer-counteroffer': ['Counter Offers'],
  'oref-022a-buyers-repair-addendum': ['Repair Addendums', 'Repair Addendum'],
  'oref-c527-sellers-repair-addendum': ['Repair Addendums', 'Repair Addendum'],
  'oref-060-contingency-removal': ['Contingency Removal Addendum', 'Contingency Removal'],
  'oref-083-contingent-purchase-addendum': ['Contingent Right To Purchase'],
  'oref-083-buyers-contingent-right-to-purchase-addendum': ['Contingent Right To Purchase'],
  'oref-083-buyer-contingent-addendum': ['Contingent Right To Purchase'],
  'oref-083a-contingent-notice': ['Contingent Right To Purchase'],
  'oref-024-oaa': ['Owner Association Addendum'],
  'oref-053-occupy-before-closing': ['Agreement to Occupy'],
  'oref-057-termination': ['Termination of Contract'],
  'oref-097-vafha': ['VA/FHA'],
  'oref-091-notice-compensation': ['Notice of Real Estate Compensation', 'Notice to Buyer'],
  'oref-091-compensation-notice': ['Notice of Real Estate Compensation', 'Notice to Buyer'],
  'oref-098-compensation-notice': ['Notice of Real Estate Compensation', 'Notice to Buyer'],
  'oref-109-buyer-notice': ['Notice to Buyer'],
  'oref-109-notice-buyer-to-seller': ['Notice to Buyer'],
  // Disclosures
  'oref-020-spd': ['Sellers Property Disclosures'],
  'oref-028-spd-addendum': ['Sellers Property Disclosures'],
  'oref-042-pamphlet': ['Initial Agency Disclosure'],
  'oref-042-agency-pamphlet': ['Initial Agency Disclosure'],
  'oref-042-initial-agency-disclosure': ['Initial Agency Disclosure'],
  // Advisories (all in Disclosures category)
  'oref-043-electronic-funds': ['Electronic Funds Advisory'],
  'oref-043-electronic-funds-advisory': ['Electronic Funds Advisory'],
  'oref-047-compensation-advisory': ['Real Estate Compensation Advisory'],
  'oref-080-smoke-co-advisory': ['Smoke Alarms Advisory'],
  'oref-092-firpta-advisory': ['FIRPTA Advisory'],
  'oref-092-firpta': ['FIRPTA Advisory'],
  'oref-103-forms-advisory': ['Real Estate Forms Advisory'],
  'oref-108-forms-advisory': ['Real Estate Forms Advisory'],
  // Reports
  'home-inspection-report': ['Home Inspection'],
  'radon-inspection-report': ['Home Inspection'],
  // Closing Documents
  'em-receipt': ['Earnest Money Receipt'],
  'preliminary-title-report': ['Preliminary Title Report'],
  'final-settlement-statement': ['Closing Statement', 'Final HUD'],
  'closing-disclosure': ['Closing Statement', 'Final HUD'],
  // Buyer Agreement Documentation
  // OREF 050 is the actual Residential Buyer Representation Agreement
  // (Exclusive). OREF 040 is the Disclosed Limited Agency Agreement for
  // SELLERS — NOT a buyer rep. Do not conflate. See
  // .claude/skills/skyslope-form-compliance/references/oref-form-library.md
  // and the 2026-05-26 "Checklist activity purity" rule in SKILL.md.
  'oref-050-buyer-rep': ['Buyers Rep Agreement'],
  'oref-050-buyer-rep-exclusive': ['Buyers Rep Agreement'],
  'oref-050-residential-buyer-representation-agreement': ['Buyers Rep Agreement'],
  // OREF 041 is Disclosed Limited Agency Agreement for Buyers (buyer-side).
  'oref-041-disclosed-limited-agency': ['Disclosed Limited Agency'],
  'oref-041-disclosed-limited-agency-buyers': ['Disclosed Limited Agency'],
  // OREF 040 is Disclosed Limited Agency Agreement for SELLERS (seller-side).
  // It does NOT belong on Buyers Rep Agreement. Map to the seller-side
  // disclosed-agency activity name used by the checklist template.
  'oref-040-disclosed-limited-agency-sellers': ['Disclosed Limited Agency Agreement for Sellers', 'Disclosed Limited Agency Sellers', 'Disclosed Limited Agency'],
  'oref-040-disclosed-limited-agency': ['Disclosed Limited Agency Agreement for Sellers', 'Disclosed Limited Agency Sellers', 'Disclosed Limited Agency'],
  // Retained for backward compat with any pre-2026-05-26 report.jsonl
  // files that emitted the old (wrong) formId. Routes to seller-side now.
  'oref-040-buyer-rep': ['Disclosed Limited Agency Agreement for Sellers', 'Disclosed Limited Agency Sellers', 'Disclosed Limited Agency'],
  'pre-approval-letter': ['Pre Approval Letter or Proof of Funds', 'Pre Approval Letters'],
  // Notices (form-class purity — 109 is buyer→seller, 110 is seller→buyer)
  'oref-110-notice-seller-to-buyer': ['Notice to Buyer | Seller', 'Notice to Buyer'],
  'oref-110-seller-notice': ['Notice to Buyer | Seller', 'Notice to Buyer'],
  // OREF 059 = Receipt of Reports / Removal of Contingencies Addendum.
  // Distinct form from OREF 060 but routes to the same activity class.
  // Never assign to Termination of Contract.
  'oref-059-receipt-reports-removal-contingencies': ['Contingency Removal Addendum', 'Contingency Removal'],
  'oref-059-receipt-reports': ['Contingency Removal Addendum', 'Contingency Removal'],
}

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

function matchActivity(activities, candidateNames) {
  for (const cn of candidateNames) {
    const cnLower = cn.toLowerCase()
    for (const a of activities) {
      const aName = (a.activityName || '').toLowerCase()
      if (aName === cnLower) return a
    }
    for (const a of activities) {
      const aName = (a.activityName || '').toLowerCase()
      if (aName.includes(cnLower) || cnLower.includes(aName.split(' (')[0])) return a
    }
  }
  return null
}

const session = await login()
let total = 0, ok = 0, fail = 0, noMatch = 0, alreadyAssigned = 0

for (const folder of FOLDERS) {
  console.log(`\n=== ${folder.label} (${folder.guid.slice(0, 8)}) ===`)
  const fr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${folder.guid}`, { headers: apiHeaders(session) })
  const fbody = await fr.json()
  const checklist = fbody.value?.sale?.checklist
  const activities = checklist?.activities || []
  console.log(`Checklist: "${fbody.value?.sale?.checklistType}" (${activities.length} activities)`)
  // Map of activityId -> already-assigned docGuids
  const existing = new Map()
  for (const a of activities) {
    const docs = (a.checklistDocs || []).map((d) => d.id || d.docId || d.documentGuid).filter(Boolean)
    existing.set(a.activityId, new Set(docs))
  }
  // Read report.jsonl for canonical docs
  const lines = (await fs.readFile(folder.reportPath, 'utf8')).split('\n').filter(Boolean)
  let folderAssigned = 0, folderSkipped = 0, folderNoMatch = 0, folderAlreadyAssigned = 0
  for (const line of lines) {
    let entry
    try { entry = JSON.parse(line) } catch { continue }
    if (!entry.isCanonical) continue // skip archived
    if (!entry.docId || !entry.formId) { folderSkipped++; continue }
    const candidates = FORM_TO_ACTIVITY[entry.formId]
    if (!candidates) { folderNoMatch++; noMatch++; console.log(`  ? no mapping for ${entry.formId} (${entry.proposedName?.substring(0, 60)})`); continue }
    const act = matchActivity(activities, candidates)
    if (!act) { folderNoMatch++; noMatch++; console.log(`  ? no matching activity for ${entry.formId} candidates=[${candidates.join(', ')}]`); continue }
    if (existing.get(act.activityId)?.has(entry.docId)) { folderAlreadyAssigned++; alreadyAssigned++; continue }
    total++
    console.log(`  ASSIGN ${entry.docId.slice(0, 8)} → act ${act.activityId} "${act.activityName}" (form ${entry.formId})`)
    if (DRY) continue
    const r = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${folder.guid}/checklist-items/${act.activityId}`, {
      method: 'POST',
      headers: apiHeaders(session),
      body: JSON.stringify({ documentGuid: entry.docId }),
    })
    if (r.ok) { ok++; folderAssigned++ } else {
      fail++
      const txt = await r.text()
      console.log(`    HTTP ${r.status}: ${txt.substring(0, 200)}`)
    }
  }
  console.log(`  Folder summary: assigned=${folderAssigned}, already=${folderAlreadyAssigned}, no-match=${folderNoMatch}, skipped=${folderSkipped}`)
}

console.log(`\n=== TOTALS ===`)
console.log(`  Attempted: ${total}`)
console.log(`  OK: ${ok}`)
console.log(`  Failed: ${fail}`)
console.log(`  No mapping match: ${noMatch}`)
console.log(`  Already assigned: ${alreadyAssigned}`)
if (DRY) console.log(`\n[DRY RUN] Use --execute to apply.`)
