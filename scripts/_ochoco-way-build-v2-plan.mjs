#!/usr/bin/env node
/**
 * Convert subagent v1 plans to canonical v5 format.
 *
 * v5 spec (Bear St precedent):
 *   {Sale#}_{X}_{Form#}_{FormName}.pdf  (canonical)
 *   ARCHIVE - {Sale#}_{X}_{Form#}_{FormName} - {reason}.pdf  (archive)
 *
 * Reads:
 *   tmp/ochoco-way-phase0/v1-validated.jsonl       (per-doc classification)
 *   tmp/ochoco-way-phase0/v1-checklist-plan.json   (action confirm/move/assign)
 *   tmp/ochoco-way-phase0/v1-unassign-plan.json    (unassign list)
 *
 * Writes:
 *   tmp/ochoco-way-phase0/v2-rename-plan.json
 *   tmp/ochoco-way-phase0/v2-checklist-plan.json   ({ assign, unassign })
 *   tmp/ochoco-way-phase0/v2-summary.md
 */
import fs from 'node:fs/promises'

const ROOT = '/Users/matthewryan/RyanRealty'
const PHASE0 = `${ROOT}/tmp/ochoco-way-phase0`

const validated = (await fs.readFile(`${PHASE0}/v1-validated.jsonl`, 'utf8'))
  .trim().split('\n').map((l) => JSON.parse(l))
const v1Checklist = JSON.parse(await fs.readFile(`${PHASE0}/v1-checklist-plan.json`, 'utf8'))
const v1Unassign = JSON.parse(await fs.readFile(`${PHASE0}/v1-unassign-plan.json`, 'utf8'))
const docsJson = JSON.parse(await fs.readFile(`${PHASE0}/documents.json`, 'utf8'))

const docIdToCurrent = {}
for (const d of (docsJson.value?.documents || [])) {
  const id = (d.id || d.docId || '').toLowerCase()
  if (id) docIdToCurrent[id] = d.fileName || d.documentName
}

const CANONICAL_FORM_NAME = {
  '001': 'Residential Real Estate Sale Agreement',
  '002': 'Sale Addendum',
  '003': "Seller's Counteroffer",
  '009': 'Back-Up Offer Addendum',
  '015': 'Listing Agreement',
  '018': 'Advisory to Seller Regarding Lead-Based Paint',
  '020': "Seller's Property Disclosure",
  '021': 'Lead-Based Paint Disclosure Addendum',
  '022A': "Buyer's Repair Addendum",
  '022B': "Seller's Repair Addendum",
  '025': 'Exterior Siding-Stucco-EIFS Disclosure',
  '040': 'Disclosed Limited Agency Agreement for Sellers',
  '041': 'Disclosed Limited Agency Agreement for Buyers',
  '042': 'Initial Agency Disclosure',
  '043': 'Advisory Regarding Electronic Funds',
  '046': 'Woodstove or Wood-Burning Fireplace Insert Addendum',
  '047': 'Real Estate Compensation Advisory',
  '048': 'Seller Contributions Addendum',
  '050': 'Residential Buyer Representation Agreement - Exclusive',
  '057': 'Residential Termination Agreement',
  '059': 'Receipt of Reports - Removal of Contingencies',
  '080': 'Smoke Alarms and Carbon Monoxide Advisory',
  '081': 'Septic - Onsite Sewage System Addendum',
  '082': 'Private Well Addendum',
  '091': 'Notice of Real Estate Compensation',
  '092': 'FIRPTA Advisory',
  '097': 'VA-FHA Amendatory Clause',
  '104': 'Fair Housing Advisory',
  '105': 'Solar Panel System Addendum',
  '108': 'Real Estate Forms Advisory',
}

// Non-OREF descriptive form names that the subagent identified
const NON_OREF_NAMES = {
  'oregon datashare mobile home property data form': 'Oregon DataShare Mobile Home Data Form',
  'mlsco listing contract': 'MLSCO Listing Contract',
  'wire fraud advisory': 'Wire Fraud Advisory',
  'pre-approval letter': 'Pre-Approval Letter',
  'home inspection report': 'Home Inspection Report',
  'repairs completion doc': 'Repairs Completion',
  'final seller\'s settlement statement': "Final Seller's Statement",
  'firpta qualified sub': 'FIRPTA Statement of Qualified Substitute',
  'additional em receipt': 'Earnest Money Receipt - Additional',
  'initial em receipt': 'Earnest Money Receipt - Initial',
  'preliminary title report': 'Preliminary Title Report',
  'greenbar excavation invoice': 'Greenbar Excavation Invoice',
  'final repair addendums bundle': 'Final Repair Addendums Bundle',
  'extension to closing date': 'Extension to Closing Date Addendum',
  'facebook logo icon (outlook signature embed)': 'Email Artifact - Facebook Icon',
  'reverse one team email banner (outlook signature embed)': 'Email Artifact - Reverse One Banner',
}

function sanitizeSaleNumber(s) {
  if (!s || s === 'None') return null
  return s.replace(/\//g, '-').replace(/\s+/g, '-').replace(/[^\w\-]/g, '')
}

function sanitizeFilename(s) {
  if (!s) return ''
  return s.replace(/\//g, '-').replace(/–/g, '-').replace(/—/g, '-')
    .replace(/…/g, ' etc').replace(/&/g, ' and ')
    .replace(/[<>:"|?*]/g, '').replace(/\s+/g, ' ').trim()
}

function canonicalFormName(entry) {
  const num = entry.oref_number
  if (num) {
    const key = String(num).toUpperCase().replace(/^OREF\s*/i, '')
    if (CANONICAL_FORM_NAME[key]) return { number: key, name: CANONICAL_FORM_NAME[key] }
  }
  const form = (entry.form_identified || '').toLowerCase().trim()
  for (const [k, v] of Object.entries(NON_OREF_NAMES)) {
    if (form.includes(k)) return { number: null, name: v }
  }
  // OREF NNN matcher in the form_identified
  const m = (entry.form_identified || '').match(/OREF\s*(\d{3,4}[ab]?)/i)
  if (m) {
    const key = m[1].toUpperCase()
    if (CANONICAL_FORM_NAME[key]) return { number: key, name: CANONICAL_FORM_NAME[key] }
    return { number: key, name: sanitizeFilename(entry.form_identified) }
  }
  return { number: null, name: sanitizeFilename(entry.form_identified || entry.original_filename || '') }
}

function buildName(entry) {
  const isCanonical = entry.canonical_or_archive === 'canonical'
  const saleSafe = sanitizeSaleNumber(entry.sale_agreement_number)
  const { number, name } = canonicalFormName(entry)

  const parts = []
  if (saleSafe) parts.push(saleSafe)
  if (entry.executed) parts.push('X')
  if (number) parts.push(number)
  if (name) parts.push(name)
  const stem = parts.join('_')

  const ext = (entry.original_filename || '').match(/\.[a-z0-9]{2,4}$/i)?.[0] || '.pdf'

  if (isCanonical) return `${stem}${ext}`

  // Archive with reason inferred from cycle + notes + form_identified
  const notes = (entry.notes || '').toLowerCase()
  const form = (entry.form_identified || '').toLowerCase()
  let reason
  if (entry.cycle === 'artifact' || form.includes('email signature') || form.includes('signature embed') || form.includes('outlook signature')) {
    reason = 'email_artifact'
  } else if (entry.cycle === 'henry') {
    reason = 'failed cycle'
  } else if (notes.includes('byte-identical') || notes.includes('byte identical') || notes.includes('duplicate of')) {
    reason = 'duplicate'
  } else if (notes.includes('superseded by') || form.includes('superseded')) {
    reason = 'superseded'
  } else if (entry.executed === false || form.includes('not executed') || form.includes('sellers-only') || form.includes('buyer-only')) {
    reason = 'not_executed'
  } else if (notes.includes('intermediate') || notes.includes('earlier version')) {
    reason = 'superseded'
  } else {
    reason = 'archive'
  }
  return `ARCHIVE - ${stem} - ${reason}${ext}`
}

// === Build v2 rename plan ===
const renamePlan = []
const proposedSeen = new Map()
let canonicalCount = 0, archiveCount = 0
const cycleHist = {}
for (const e of validated) {
  cycleHist[e.cycle] = (cycleHist[e.cycle] || 0) + 1
  const isCanon = e.canonical_or_archive === 'canonical'
  if (isCanon) canonicalCount++; else archiveCount++

  let proposed = buildName(e)
  if (proposedSeen.has(proposed)) {
    const n = proposedSeen.get(proposed) + 1
    proposedSeen.set(proposed, n)
    proposed = proposed.replace(/\.pdf$/i, ` ${String.fromCharCode(64 + n)}.pdf`)
  } else {
    proposedSeen.set(proposed, 1)
  }
  renamePlan.push({
    docId: e.docId,
    short: e.short,
    currentName: docIdToCurrent[e.docId.toLowerCase()] || e.original_filename,
    proposedName: proposed,
    formNumber: e.oref_number,
    formName: e.form_identified,
    saleNumber: e.sale_agreement_number,
    cycle: e.cycle,
    isCanonical: isCanon,
    executed: e.executed,
    disposition: e.disposition,
    notes: e.notes || '',
  })
}

await fs.writeFile(`${PHASE0}/v2-rename-plan.json`, JSON.stringify(renamePlan, null, 2))

// === Build v2 checklist plan from v1 (preserve subagent's action decisions) ===
// v1Checklist has 'confirm' (no action), 'move' (unassign + reassign), 'assign' (just assign)
// v1Unassign has unassigns only (no reassign — archive/duplicates)

const docIdToProposed = {}
for (const r of renamePlan) docIdToProposed[r.docId.toLowerCase()] = r.proposedName

const unassignActions = []
const assignActions = []

// From v1-unassign-plan
for (const u of v1Unassign) {
  unassignActions.push({
    docId: u.docId, activityId: u.from_activityId || u.activityId,
    activityName: u.from_activityName || u.activityName,
    reason: u.reason || u.notes || 'archive/duplicate — should not be on checklist activity',
  })
}

// From v1-checklist-plan
for (const c of v1Checklist) {
  if (c.action === 'move') {
    if (c.from_activityId) {
      unassignActions.push({
        docId: c.docId, activityId: c.from_activityId, activityName: c.from_activityName,
        reason: `move to ${c.to_activityName}`,
      })
    }
    if (c.to_activityId) {
      assignActions.push({
        docId: c.docId, activityId: c.to_activityId, activityName: c.to_activityName,
        proposedFileName: docIdToProposed[c.docId.toLowerCase()] || c.proposed_name,
      })
    }
  } else if (c.action === 'assign') {
    assignActions.push({
      docId: c.docId, activityId: c.to_activityId, activityName: c.to_activityName,
      proposedFileName: docIdToProposed[c.docId.toLowerCase()] || c.proposed_name,
    })
  }
  // 'confirm' = no action needed
}

await fs.writeFile(`${PHASE0}/v2-checklist-plan.json`, JSON.stringify({ unassign: unassignActions, assign: assignActions }, null, 2))

// === Summary ===
const md = []
md.push('# Ochoco Way v2 Plan (canonical v5 format)')
md.push('')
md.push(`**Total docs**: ${renamePlan.length}`)
md.push(`**Canonical**: ${canonicalCount} · **Archive**: ${archiveCount}`)
md.push('')
md.push(`**Unassign**: ${unassignActions.length}`)
md.push(`**Assign**: ${assignActions.length}`)
md.push('')
md.push('## Cycle distribution')
for (const [k, v] of Object.entries(cycleHist)) md.push(`- ${k}: ${v}`)
md.push('')
md.push('## Sample renames')
for (const r of renamePlan.slice(0, 15)) {
  md.push(`- \`${(r.currentName || '').slice(0, 50)}\` → **\`${r.proposedName}\`**`)
}
md.push('')
md.push('## All renames')
md.push('')
for (const r of renamePlan) {
  const flag = r.isCanonical ? '' : ' [ARCHIVE]'
  md.push(`- ${r.short}${flag}: \`${r.currentName}\` → \`${r.proposedName}\``)
}
await fs.writeFile(`${PHASE0}/v2-summary.md`, md.join('\n'))

console.log(`Wrote v2-rename-plan.json (${renamePlan.length} renames)`)
console.log(`Wrote v2-checklist-plan.json (unassign=${unassignActions.length}, assign=${assignActions.length})`)
console.log()
console.log('Cycle:', cycleHist)
console.log(`Canonical=${canonicalCount} Archive=${archiveCount}`)
