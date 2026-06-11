#!/usr/bin/env node
/**
 * Phase 7 apply for the 712 SW 1st St folder (f50fe2a6).
 *
 * Reads the dry-run report and PATCHes every doc's filename per the
 * skill's v5 naming convention — with 2 exceptions per Matt's
 * 2026-05-25 directive:
 *
 *   - SKIP MLSCO Listing Contract (docId 11020384) — Matt re-signs later
 *   - SKIP Caldwell Letter 2 (docId 6c07c12d) — disregard the bad
 *     "Nagorski" sale# OCR misread; leave filename as-is
 *
 * Also clears the bad Nagorski saleNumber from the report so downstream
 * Phase 10 Broker Notes generation doesn't group on it.
 *
 * Usage:
 *   node --env-file=.env.local scripts/_712-apply-renames.mjs           # dry-run
 *   node --env-file=.env.local scripts/_712-apply-renames.mjs --execute # apply
 */
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const BASE = 'https://api-latest.skyslope.com'
const GUID = 'f50fe2a6-226c-4f81-8a59-9fc9a46ea5df'
const REPORT_PATH = 'tmp/skyslope-form-compliance-2026-05-25/f50fe2a6-report.jsonl'
const APPLY = process.argv.includes('--execute')

const SKIP_DOCIDS = new Set([
  '11020384-5ed8-4173-a584-4ceb7d90e3cb', // MLSCO Listing Contract (Matt re-signs later)
  '6c07c12d-67b8-411e-9995-62ebccb7175d', // Caldwell Letter 2 (Nagorski misread)
])

async function login() {
  const ts = new Date().toISOString()
  const env = process.env
  const hmac = crypto.createHmac('sha256', env.SKYSLOPE_ACCESS_SECRET.trim())
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

const raw = await fs.readFile(REPORT_PATH, 'utf8')
const recs = raw.split('\n').filter(Boolean).map((l) => JSON.parse(l))
console.log(`Report has ${recs.length} records. Apply=${APPLY}\n`)

const session = await login()

let patched = 0, skipped = 0, noop = 0, errors = 0
const updatedRecs = []

for (const rec of recs) {
  let updated = { ...rec }

  // Strip the bad Nagorski saleNumber from the report so downstream
  // Phase 10 grouping doesn't see it as a separate cycle.
  if (SKIP_DOCIDS.has(rec.docId) && rec.saleNumber === 'Nagorski') {
    updated.saleNumber = null
    updated._sale_number_review_needed = 'OCR misread "Nagorski" — likely from another transaction; not the 712 sale#'
  }

  // Skip the no-touch list
  if (SKIP_DOCIDS.has(rec.docId)) {
    console.log(`  SKIP ${rec.docId.slice(0,8)} "${(rec.currentName || '').slice(0,60)}"`)
    updated._skipped = true
    updated._skipReason = rec.docId === '11020384-5ed8-4173-a584-4ceb7d90e3cb'
      ? 'MLSCO listing contract — Matt re-signs later'
      : 'Nagorski OCR misread — leave filename unchanged'
    skipped++
    updatedRecs.push(updated)
    continue
  }

  // Noop if proposed name equals current
  if (!rec.proposedName || rec.proposedName === rec.currentName) {
    noop++
    updatedRecs.push(updated)
    continue
  }

  console.log(`  ${APPLY ? 'PATCH' : 'WOULD-PATCH'} ${rec.docId.slice(0,8)} "${(rec.currentName || '').slice(0,55)}" → "${rec.proposedName.slice(0,55)}"`)
  if (!APPLY) {
    updatedRecs.push(updated)
    continue
  }

  const r = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${GUID}/documents/${rec.docId}`, {
    method: 'PATCH',
    headers: apiHeaders(session),
    body: JSON.stringify({ FileName: rec.proposedName }),
  })
  const body = await r.text()
  updated.patchStatus = r.status
  if (r.ok) {
    patched++
  } else {
    errors++
    updated.patchError = body.slice(0, 200)
    console.log(`    HTTP ${r.status}: ${body.slice(0, 200)}`)
  }
  updatedRecs.push(updated)
}

// Write back the updated report
if (APPLY) {
  await fs.writeFile(REPORT_PATH, updatedRecs.map((r) => JSON.stringify(r)).join('\n') + '\n')
  console.log(`\nUpdated report → ${REPORT_PATH}`)
}

console.log(`\n=== SUMMARY ===`)
console.log(`  ${APPLY ? 'Patched' : 'Would-patch'}: ${APPLY ? patched : recs.length - skipped - noop}`)
console.log(`  Skipped (Matt's 2 exceptions): ${skipped}`)
console.log(`  Noop (already correct name): ${noop}`)
console.log(`  Errors: ${errors}`)
if (!APPLY) console.log(`\n[DRY] Use --execute to apply.`)
