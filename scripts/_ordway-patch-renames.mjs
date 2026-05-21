#!/usr/bin/env node
/**
 * PATCH all 46 Ordway docs to their v5 filenames.
 *
 * Reads the current manifest, applies the rename-plan-v2 mapping,
 * sends each PATCH, logs result to patch-log.json.
 *
 * Usage: node --env-file=.env.local scripts/_ordway-patch-renames.mjs [--dry-run]
 */
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const FOLDER = 'f88642ff-22e6-4618-b9e1-40b168a439e1'
const KIND = 'sales'
const BASE = 'https://api-latest.skyslope.com'
const MANIFEST = JSON.parse(await fs.readFile(`tmp/skyslope-pdfs/${FOLDER}/manifest.json`, 'utf8'))
const DRY = process.argv.includes('--dry-run')

// Map docId -> new v5 filename. Pulled directly from rename-plan-v2.json
// + reconciled to the live manifest's actual docIds.
const RENAMES = {
  // ===== MR05072025 - MAIN folder =====
  '6f3d53cb-09d7-47b6-970f-35a6d2759a78': 'MR05072025_X_001_Residential Real Estate Sale Agreement.pdf',
  '9f689f19-11c0-4878-bf8f-cad6a73d4726': 'MR05072025_X_002_Addendum to Sale Agreement - Prorations and Escrow.pdf',
  '3921564f-5a83-4fa3-9930-65944666a607': 'MR05072025_X_002_Addendum to Sale Agreement - EM Deposit Deadline Extension.pdf',
  '67ca4757-c1d7-43cd-a9ba-b6711359da27': 'MR05072025_X_002_Addendum to Sale Agreement - Zip Code Correction.pdf',
  'bc971610-2283-4da0-bf51-50790ec5417b': 'MR05072025_X_002_Addendum to Sale Agreement - Buyer Name Reconciliation.pdf',
  '03d3afae-b8d3-4342-8416-6913ded75144': 'MR05072025_X_Oregon REALTORS Form 2.2 General Addendum.pdf',
  '5bb51ac0-1c7e-4c24-8fe2-547074f297ad': 'MR05072025_X_022A_Buyers Repair Addendum 1.pdf',
  'f2c08efd-a042-4e2b-9725-5fde5dfaf7b5': 'MR05072025_X_022B_Sellers Repair Addendum.pdf',
  '24954815-ed52-4002-ad05-d9d92eed7a4b': 'MR05072025_X_054_Agreement to Occupy After Closing.pdf',
  '805066bf-693f-44cb-9304-746d2f1e4928': 'MR05072025_X_031_Advisory to Buyer Regarding Owner Associations.pdf',
  'd195958c-1326-40e9-a2e7-10bc3c6d2028': 'MR05072025_X_Pre-Approval Letter - loanDepot.pdf',
  '4bbf9e5b': 'MR05072025_X_020_Seller Property Disclosure Statement.pdf', // placeholder; resolved below

  // ===== MR05042025 - MAIN folder (fully-executed ratifications) =====
  '717433c2-2b69-43a6-a718-247a5e7b4e6e': 'MR05042025_X_003_Sellers Counteroffer.pdf',
  '86c93642-f4ee-4703-84a7-ea2f205224a2': 'MR05042025_X_002_Addendum to Sale Agreement - Late Acceptance Ratification.pdf',
  '28e0b4f7-5b9d-4c45-b7e5-5f4e3e9436a9': 'MR05042025_X_002_Addendum to Sale Agreement - Seller Name Change.pdf',

  // ===== Forwarded P1 docs - MAIN folder =====
  // docIds resolved at runtime from manifest by current-filename match
  // (the 9 docs ingested with auto-suffixed names)

  // ===== ARCHIVE =====
  'd2463c20-1f44-4087-8de7-779dd97a011a': 'ARCHIVE - MR04262025_001_Residential Real Estate Sale Agreement - not_executed.pdf',
  '23db633c-ab63-46b0-94fa-d147ecffcf0b': 'ARCHIVE - MR05042025_001_Residential Real Estate Sale Agreement - not_executed.pdf',
  '4f0cb4a9-e970-4b9f-90b9-7b4f62f5bb9f': 'ARCHIVE - MR05042025_004_Buyer Counteroffer - not_executed.pdf',
  '75b3a021-438e-490e-9e34-e591d966a98a': 'ARCHIVE - MR05072025_060_Contingency Removal Addendum 1 (buyer-only draft) - superseded.pdf',
  '9fd378d1-a856-48e8-8376-27643b53344a': 'ARCHIVE - MR05072025_060_Contingency Removal Addendum 2 (buyer-only draft) - superseded.pdf',
  '68f8d4d8-4d8e-4837-a143-024bd109b2ff': 'ARCHIVE - MR05072025_022A_Buyers Repair Addendum 2 (buyer-only draft) - superseded.pdf',
  '05766a76-fa01-4cff-8c78-8c9da28bcb0a': 'ARCHIVE - MR05072025_024_Owner Association Addendum (buyer-only draft) - superseded.pdf',
  '7a081090-aed0-4065-8670-20c9b4b3b739': 'ARCHIVE - MR04262025_024_Owner Association Addendum - superseded.pdf',
  'b398431e-e93f-416e-99a6-f139f94b1c1d': 'ARCHIVE - MR05072025_091_Notice of Real Estate Compensation - duplicate.pdf',
  '773a6f21': 'ARCHIVE - MR05072025_Final Buyer Statement (title-internal unsigned) - superseded.pdf', // resolved below
}

// Image files (resolved by filename match in manifest)
const IMAGE_RENAMES = {
  // Group by md5: each group has one "email_artifact" + the others "duplicate"
  '82061297': 'ARCHIVE - Email Artifact - Listing Side Headshot - email_artifact.jpg',
  'bddcd072': 'ARCHIVE - Email Artifact - Listing Side Headshot - duplicate.jpg',
  '84061297': 'ARCHIVE - Email Artifact - Blank Email Spacer - email_artifact.png',
  'bfdcd072': 'ARCHIVE - Email Artifact - Blank Email Spacer - duplicate.png',
  'a1f6b560': 'ARCHIVE - Email Artifact - Harcourts Garner Group Lockup - email_artifact.png',
  'a2f6b560': 'ARCHIVE - Email Artifact - Lisa Smith Outlook Signature Block - email_artifact.png',
  'b3d0984e': 'ARCHIVE - Email Artifact - Lisa Smith Outlook Signature Block - duplicate.png',
  'bb061297': 'ARCHIVE - Email Artifact - Western Title Wire Fraud Warning - email_artifact.png',
  'c2dcd072': 'ARCHIVE - Email Artifact - Western Title Wire Fraud Warning - duplicate.png',
}

// Non-OREF docs in MAIN (resolved by filename prefix match in manifest)
const FILENAME_PREFIX_RENAMES = [
  { match: 'FINAL_-_BuyerBorrower_Statement_-_IHSA_712.pdf', newName: 'ARCHIVE - MR05072025_Final Buyer Statement (title-internal unsigned) - superseded.pdf' },
  { match: 'Statement_of_SA_Acting_as_Qualified_Sub_117.pdf', newName: 'MR05072025_X_Statement of Escrow Agent Acting as Qualified Substitute.pdf' },
  { match: 'Earnest_Money_IH_263.pdf', newName: 'MR05072025_X_Earnest Money Receipt - Western Title.pdf' },
  { match: 'Notice_of_Real_Estate_Compensation_-_091_OREF_904.pdf', newName: 'MR05072025_X_091_Notice of Real Estate Compensation.pdf' },
  { match: 'Property Disclosure Statement.pdf', newName: 'MR05072025_X_020_Seller Property Disclosure Statement.pdf' },
  // Forwarded docs (use stem match — SkySlope appends _NNN suffix)
  { match: 'P1_CRITICAL_Deed_', newName: 'MR05072025_X_Statutory Warranty Deed - Recorded.pdf' },
  { match: 'P1_CRITICAL_BuyerBorrower_Statement_signed_', newName: 'MR05072025_X_Final Buyer Statement (buyer-signed).pdf' },
  { match: 'P1_CRITICAL_Nic_-_DPOA_', newName: 'MR05072025_X_Durable Power of Attorney - Nicola Murray.pdf' },
  { match: 'P1_CRITICAL_PRELIMINARY_REPORT-LINKED-titleLOOK_', newName: 'MR05072025_X_Preliminary Title Report - Western Title.pdf' },
  { match: 'P2_INVESTIGATE_Owner_Association_Addendum_-_to__be_signed_', newName: 'MR05072025_X_024_Owner Association Addendum.pdf' },
  { match: 'P2_INVESTIGATE_Contingency_Removal_Addendum__without_financing_', newName: 'MR05072025_X_060_Contingency Removal Addendum 1.pdf' },
  { match: 'P2_INVESTIGATE_Contingency_Removal_Addendum_2_-_060_OREF_', newName: 'MR05072025_X_060_Contingency Removal Addendum 2.pdf' },
  { match: 'P2_INVESTIGATE_Buyers_Repair_Addendum_-_2_', newName: 'MR05072025_X_022A_Buyers Repair Addendum 2.pdf' },
  { match: 'Buyer_Cash_To_Close_Confirmation_-_5-28-25_', newName: 'MR05072025_X_Buyer Cash To Close Confirmation - Capital One.pdf' },
]

// === Build final plan ===
const plan = []
for (const doc of MANIFEST.documents) {
  const fid = doc.docId
  const fidPfx = fid.split('-')[0]
  let newName = null

  // Match by full docId first
  if (RENAMES[fid]) {
    newName = RENAMES[fid]
  } else if (IMAGE_RENAMES[fidPfx]) {
    // Match by 8-char docId prefix for images
    newName = IMAGE_RENAMES[fidPfx]
  } else {
    // Match by filename prefix
    for (const { match, newName: nn } of FILENAME_PREFIX_RENAMES) {
      if (doc.fileName === match || doc.fileName.startsWith(match)) {
        newName = nn
        break
      }
    }
  }

  if (!newName) {
    plan.push({ docId: fid, current: doc.fileName, status: 'UNMAPPED' })
  } else if (newName === doc.fileName) {
    plan.push({ docId: fid, current: doc.fileName, newName, status: 'NO_CHANGE' })
  } else {
    plan.push({ docId: fid, current: doc.fileName, newName, status: 'PATCH' })
  }
}

console.log(`Plan size: ${plan.length}`)
console.log(`To PATCH:    ${plan.filter((p) => p.status === 'PATCH').length}`)
console.log(`No change:   ${plan.filter((p) => p.status === 'NO_CHANGE').length}`)
console.log(`UNMAPPED:    ${plan.filter((p) => p.status === 'UNMAPPED').length}`)

const unmapped = plan.filter((p) => p.status === 'UNMAPPED')
if (unmapped.length) {
  console.log('\nUNMAPPED docs (will not be touched):')
  for (const u of unmapped) console.log(`  ${u.docId.slice(0, 8)}  ${u.current}`)
}

console.log('\nPATCH plan (first 15):')
for (const p of plan.filter((p) => p.status === 'PATCH').slice(0, 15)) {
  console.log(`  ${p.docId.slice(0, 8)}  ${p.current.slice(0, 50)}`)
  console.log(`           -> ${p.newName}`)
}
if (plan.filter((p) => p.status === 'PATCH').length > 15) {
  console.log(`  ... and ${plan.filter((p) => p.status === 'PATCH').length - 15} more`)
}

if (DRY) {
  await fs.writeFile(`tmp/skyslope-pdfs/${FOLDER}/patch-plan.json`, JSON.stringify(plan, null, 2))
  console.log(`\n[DRY RUN] Wrote tmp/skyslope-pdfs/${FOLDER}/patch-plan.json`)
  process.exit(0)
}

// === Execute PATCHes ===
async function login() {
  const ts = new Date().toISOString()
  const env = process.env
  const hmac = crypto
    .createHmac('sha256', env.SKYSLOPE_ACCESS_SECRET.trim())
    .update(`${env.SKYSLOPE_CLIENT_ID.trim()}:${env.SKYSLOPE_CLIENT_SECRET.trim()}:${ts}`)
    .digest('base64')
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

const session = await login()
console.log('\n=== Executing PATCHes ===')
const log = []
for (const p of plan.filter((p) => p.status === 'PATCH')) {
  const url = `${BASE}/api/files/${KIND}/${encodeURIComponent(FOLDER)}/documents/${encodeURIComponent(p.docId)}`
  try {
    const r = await skyslopeFetchWithRetry(url, {
      method: 'PATCH',
      headers: apiHeaders(session),
      body: JSON.stringify({ FileName: p.newName }),
    })
    const ok = r.ok
    const status = r.status
    const text = await r.text()
    log.push({ docId: p.docId, current: p.current, newName: p.newName, ok, status, response: text.slice(0, 200) })
    console.log(`  ${ok ? 'OK' : 'FAIL'} [${status}] ${p.docId.slice(0, 8)}  ${p.newName.slice(0, 70)}`)
    // Brief throttle
    await new Promise((r) => setTimeout(r, 250))
  } catch (e) {
    log.push({ docId: p.docId, current: p.current, newName: p.newName, ok: false, error: e.message })
    console.log(`  ERR ${p.docId.slice(0, 8)}: ${e.message}`)
  }
}

await fs.writeFile(`tmp/skyslope-pdfs/${FOLDER}/patch-log.json`, JSON.stringify(log, null, 2))
console.log(`\nWrote tmp/skyslope-pdfs/${FOLDER}/patch-log.json`)
console.log(`PATCH OK:   ${log.filter((l) => l.ok).length}`)
console.log(`PATCH FAIL: ${log.filter((l) => !l.ok).length}`)
