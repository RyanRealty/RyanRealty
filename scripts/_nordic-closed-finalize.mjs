#!/usr/bin/env node
/**
 * Closed Nordic finalize:
 *  1. Forward the updated transaction-summary PDF to the SkySlope mailbox
 *     (the old one stays in the folder as a superseded version)
 *  2. After ingest, PATCH new doc to v5 name + assign to Broker Notes
 *  3. Mark the old transaction-summary doc as ARCHIVE - superseded
 *  4. Unassign every ARCHIVE-prefixed doc from non-Misc-Doc checklist activities
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { google } from 'googleapis'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const BASE = 'https://api-latest.skyslope.com'
const FOLDER = 'ce3c30de-1b10-4946-bf06-6dbad8e1d53d'
const FROM = 'matt@ryan-realty.com'
const TO = 'NWNordicAvenue26801@skyslope.com'
const PDF = 'tmp/skyslope-pdfs/ce3c30de-1b10-4946-bf06-6dbad8e1d53d/gap-pulls/transaction-summary.pdf'
const BROKER_NOTES_ACT = 989410541
const NEW_NAME = 'RP08242025_X_Broker Notes - Transaction Summary.pdf'
const OLD_DOC_ID = '1ba6e7e3' // prefix — will resolve full

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
function apiHeaders(session) { return { 'Content-Type': 'application/json', Session: session, timestamp: new Date().toISOString(), Accept: 'application/json' } }

async function sendForward(gmail, attachmentPath) {
  const filename = path.basename(attachmentPath)
  const bin = await fs.readFile(attachmentPath)
  const b64 = bin.toString('base64').match(/.{1,76}/g).join('\r\n')
  const boundary = `----rr-${Date.now()}`
  const message = [
    `From: ${FROM}`,
    `To: ${TO}`,
    `Subject: [Nordic 2680 Closed forward] Broker Notes - Transaction Summary (v5 audit, revised with escrow + listing data)`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    'Revised transaction summary for 2680 NW Nordic Avenue (Closed folder). Filled in escrow info (Sabrina Norton, file #7061-4304106), listing price ($1,395k final, $1,649,900 original), buyer agent (Rebecca Peterson), close price reconciliation (MLS $1,350k vs SkySlope $1,320k = $30k seller credit), Valhalla Heights subdivision details, and the closing sale agreement (RP08242025) explained against the prior failed RRP04212025 cycle.',
    '',
    `--${boundary}`,
    `Content-Type: application/pdf; name="${filename}"`,
    `Content-Disposition: attachment; filename="${filename}"`,
    'Content-Transfer-Encoding: base64',
    '',
    b64,
    '',
    `--${boundary}--`,
    '',
  ].join('\r\n')
  const raw = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
  return res.data
}

const APPLY = process.argv.includes('--execute')

const session = await login()
console.log(`Auth ok. Apply mode = ${APPLY}\n`)

// PHASE 1: Forward revised PDF
const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL.trim(),
  key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.trim().replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/gmail.send'],
  subject: FROM,
})
const gmail = google.gmail({ version: 'v1', auth })
await auth.authorize()

if (APPLY) {
  console.log('[1] Forwarding revised PDF...')
  const result = await sendForward(gmail, PDF)
  console.log(`    sent gmail msg ${result.id}`)
} else {
  console.log('[1] Would forward revised PDF (dry-run)')
}

// PHASE 2: Mark old Broker Notes as superseded
console.log('\n[2] Marking OLD Broker Notes PDF as ARCHIVE - superseded')
const dr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${FOLDER}/documents`, { headers: apiHeaders(session) })
const docs = (await dr.json()).value?.documents || []
const oldBn = docs.find((d) => (d.docId || d.id || '').startsWith(OLD_DOC_ID))
if (oldBn) {
  const oldId = oldBn.docId || oldBn.id
  console.log(`    found old doc ${oldId.slice(0,8)} "${oldBn.fileName}"`)
  const newOldName = `ARCHIVE - RP08242025_Broker Notes - Transaction Summary - superseded.pdf`
  console.log(`    -> rename to "${newOldName}"`)
  if (APPLY) {
    const pr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${FOLDER}/documents/${oldId}`, {
      method: 'PATCH', headers: apiHeaders(session), body: JSON.stringify({ FileName: newOldName }),
    })
    console.log(`    HTTP ${pr.status}`)
    // Unassign from Broker Notes activity
    const ur = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${FOLDER}/checklist-items/${BROKER_NOTES_ACT}/unassign`, {
      method: 'POST', headers: apiHeaders(session), body: JSON.stringify({ documentGuid: oldId }),
    })
    console.log(`    unassign from Broker Notes: HTTP ${ur.status}`)
  }
} else {
  console.log(`    OLD doc with prefix ${OLD_DOC_ID} not found in folder`)
}

// PHASE 3: Unassign ALL ARCHIVE-prefixed docs from checklist activities
console.log('\n[3] Unassigning ARCHIVE-prefixed docs from checklist activities')
const fr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${FOLDER}`, { headers: apiHeaders(session) })
const activities = (await fr.json()).value?.sale?.checklist?.activities || []
let unassigned = 0
let unassignFails = 0
for (const a of activities) {
  const attached = a.checklistDocs || []
  for (const d of attached) {
    const fn = d.fileName || d.docName || ''
    const docId = d.id || d.docId || d.documentGuid
    if (!docId || !fn.startsWith('ARCHIVE')) continue
    console.log(`    unassign ${docId.slice(0,8)} "${fn.substring(0, 70)}" from act ${a.activityId} "${(a.activityName||'').trim()}"`)
    if (APPLY) {
      const r = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${FOLDER}/checklist-items/${a.activityId}/unassign`, {
        method: 'POST', headers: apiHeaders(session), body: JSON.stringify({ documentGuid: docId }),
      })
      if (r.ok) unassigned++
      else { unassignFails++; console.log(`      HTTP ${r.status}: ${(await r.text()).substring(0, 150)}`) }
    } else {
      unassigned++
    }
  }
}

console.log(`\n=== SUMMARY ===`)
console.log(`Unassigned: ${unassigned}`)
console.log(`Failed: ${unassignFails}`)
console.log(APPLY ? '\nALL EXECUTED' : '\n[DRY RUN] Use --execute to apply.')
