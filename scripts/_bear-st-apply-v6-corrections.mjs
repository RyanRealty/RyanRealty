#!/usr/bin/env node
/**
 * Apply the v6 corrections to the v4 rename plan based on the in-session
 * signature-page validation of every closing-cycle doc and the contested
 * single_party vs mutual interpretations the subagent got wrong.
 *
 * The 8 surgical corrections:
 *
 * KEEP _X (subagent was wrong — single_party seller-side filled):
 *   1599bb8e — OREF 092 FIRPTA Advisory (listing seller copy)
 *   3bf26c65 — OREF 043 Electronic Funds Advisory (listing seller copy)
 *
 * STRIP _X + change to ARCHIVE (subagent was right — mutual instrument with missing buyer side):
 *   da5d26d6 — OREF 021 LBP (Hernandez closing — buyer cert BLANK = legal_gap per 42 USC 4852d, pre-1978 manufactured home)
 *   e6c77e72 — OREF 021 LBP (pre-listing copy — also buyer cert blank, duplicate)
 *   abd8e4e1 — OREF 020 SPD (listing draft — buyer ack blank; canonical Hernandez FE-SPD is 137742e6)
 *   8892c469 — OREF 025 EIFS (mutual structure — buyer ack blank = policy_gap)
 *   cf3c1e1f — OR REALTORS PSA Offer 1 copy C (buyer-only signed, no Detweiler seller sigs on this copy — duplicate)
 *
 * STRIP _X (subagent was right — informational, never executed):
 *   6bbcc8e2 — Bank of America Business Statement (proof of funds, not a signed instrument)
 */
import fs from 'node:fs/promises'

const ROOT = '/Users/matthewryan/RyanRealty'

const v4 = JSON.parse(await fs.readFile(`${ROOT}/tmp/bear-st-phase0/v4-rename-plan.json`, 'utf8'))
const cp4 = JSON.parse(await fs.readFile(`${ROOT}/tmp/bear-st-phase0/v4-checklist-plan.json`, 'utf8'))

const CORRECTIONS = {
  // Keep _X (subagent was wrong — single_party)
  '1599bb8e': { keepCurrent: true, note: 'OREF 092 single_party seller-side filled (Detweilers + Matt 09/04) — EXECUTED' },
  '3bf26c65': { keepCurrent: true, note: 'OREF 043 single_party seller-side filled (Detweilers + Matt 09/04) — EXECUTED' },

  // Strip _X + archive (mutual w/ missing buyer side)
  'da5d26d6': {
    newProposed: 'ARCHIVE - 021_Lead-Based Paint Disclosure Addendum - not_executed_legal_gap.pdf',
    cycle: 'listing-level', isCanonical: false, archiveReason: 'not_executed',
    note: 'OREF 021 mutual: sellers signed 10/01, buyer cert BLANK. LEGAL_GAP per 42 USC 4852d (pre-1978 manufactured home).',
    removeChecklist: true,
  },
  'e6c77e72': {
    newProposed: 'ARCHIVE - 021_Lead-Based Paint Disclosure Addendum - not_executed_pre_listing_duplicate.pdf',
    cycle: 'listing-level', isCanonical: false, archiveReason: 'duplicate',
    note: 'OREF 021 mutual: pre-listing seller-only copy, buyer cert blank. Duplicate of da5d26d6.',
    removeChecklist: true,
  },
  'abd8e4e1': {
    newProposed: 'ARCHIVE - 020_Sellers Property Disclosure - not_executed_pre_listing_duplicate.pdf',
    cycle: 'listing-level', isCanonical: false, archiveReason: 'duplicate',
    note: 'OREF 020 SPD mutual: seller side filled, buyer ack blank. Canonical FE-SPD is 137742e6 (Hernandez 10/03 ack).',
    removeChecklist: true,
  },
  '8892c469': {
    newProposed: 'ARCHIVE - 025_Exterior Siding-Stucco-EIFS Disclosure - not_executed_no_buyer_ack.pdf',
    cycle: 'listing-level', isCanonical: false, archiveReason: 'not_executed',
    note: 'OREF 025 EIFS: sellers signed 09/05+09/08, buyer ack blank. POLICY_GAP (manufactured home — recommend Hernandez retroactive ack).',
    removeChecklist: true,
  },
  'cf3c1e1f': {
    newProposed: 'ARCHIVE - 15352Bear24_OR REALTORS PSA Bundle - buyer_only_signed_duplicate.pdf',
    cycle: 'failed-parks-tavares', isCanonical: false, archiveReason: 'duplicate',
    note: 'Parks-Tavares offer 1 PSA — buyer-only copy without Detweiler seller sigs. Canonical fully-executed copies: 166e37d3, 559c5b16.',
    removeChecklist: false,  // wasn't on a checklist anyway
  },

  // Strip _X (bank statement is informational)
  '6bbcc8e2': {
    newProposed: 'Hernandez-15352-Bear-St_Proof of Funds - Bank of America Business Advantage Statement.pdf',
    cycle: 'closing', isCanonical: true, archiveReason: null,
    note: 'Bank statement — never executed; X mark not applicable. Stays on Pre Approval Letter or Proof of Funds activity.',
    removeChecklist: false,
  },
}

let changes = 0
for (const row of v4) {
  const correction = CORRECTIONS[row.shortId]
  if (!correction) continue
  if (correction.keepCurrent) {
    // No change to proposedName
    row.correctionNote = correction.note
    continue
  }
  row.previousProposedName = row.proposedName
  row.proposedName = correction.newProposed
  if (correction.cycle) row.cycle = correction.cycle
  if (correction.isCanonical !== undefined) row.isCanonical = correction.isCanonical
  if (correction.archiveReason !== undefined) row.archiveReason = correction.archiveReason
  row.correctionNote = correction.note
  changes++
}

// Update checklist plan
const cp6 = { assign: [], unassign: cp4.unassign || [] }
for (const a of cp4.assign) {
  const correction = CORRECTIONS[a.docId.substring(0, 8)]
  if (correction && correction.removeChecklist) continue
  // Update file name in checklist plan to match new rename
  const row = v4.find((r) => r.docId === a.docId)
  if (row) a.proposedFileName = row.proposedName
  cp6.assign.push(a)
}

await fs.writeFile(`${ROOT}/tmp/bear-st-phase0/v6-rename-plan.json`, JSON.stringify(v4, null, 2))
await fs.writeFile(`${ROOT}/tmp/bear-st-phase0/v6-checklist-plan.json`, JSON.stringify(cp6, null, 2))

console.log(`Applied ${changes} corrections + 2 kept-as-canonical confirmations`)
console.log(`v6-rename-plan.json: ${v4.length} entries`)
console.log(`v6-checklist-plan.json: ${cp6.assign.length} assigns (was ${cp4.assign.length} in v4)`)

// Summary
const byCycle = {}, byCanon = { canonical: 0, archive: 0 }
for (const r of v4) {
  byCycle[r.cycle] = (byCycle[r.cycle] || 0) + 1
  if (r.isCanonical) byCanon.canonical++
  else byCanon.archive++
}
console.log('Cycle distribution:', byCycle)
console.log('Disposition:', byCanon)
