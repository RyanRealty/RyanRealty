#!/usr/bin/env node
/**
 * 712 SW 1st — resend regenerated v2 Broker Notes (corrected $275K).
 *   1. Find currently-attached BN docs on Broker Notes activity
 *   2. Identify the OLD closing-cycle BN (matches `04022024AB_X_Broker Notes` pattern)
 *      — leave the failed-cycle BN alone (it's a separate doc)
 *   3. Gmail-send new PDF to sale.portalEmail
 *   4. Poll SkySlope ingest (up to 25 min)
 *   5. PATCH ingested → canonical name
 *   6. ASSIGN new doc → Broker Notes activity
 *   7. UNASSIGN old closing-cycle BN from Broker Notes activity
 *   8. PATCH old → ARCHIVE - <name> - v1 superseded by v2 rerun 2026-05-27.pdf
 */
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import { google } from 'googleapis'

const ROOT = '/Users/matthewryan/RyanRealty'
const BASE = 'https://api-latest.skyslope.com'
const FROM_EMAIL = 'matt@ryan-realty.com'
const SALE_GUID = 'f50fe2a6-226c-4f81-8a59-9fc9a46ea5df'
const PDF_PATH = `${ROOT}/tmp/712-broker-notes/04022024AB_X_Broker Notes - Transaction Summary.pdf`
const BASE_NAME = '04022024AB_X_Broker Notes - Transaction Summary'
const CANONICAL_NAME = '04022024AB_X_Broker Notes - Transaction Summary.pdf'
const SUBJECT = '[712 SW 1st St v2 rerun] Broker Notes - Transaction Summary (Caldwell/Mendoza closing)'

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
const hdrs = (s) => ({ 'Content-Type': 'application/json', Session: s, Accept: 'application/json' })

await loadEnv()
const session = await login()
console.log('✓ Authenticated\n')

// Fetch fresh state
const saleResp = await fetch(`${BASE}/api/files/sales/${SALE_GUID}`, { headers: hdrs(session) })
const sale = (await saleResp.json()).value.sale
const portalEmail = sale.portalEmail
const acts = sale.checklist.activities
const bnActivity = acts.find((a) => /broker notes/i.test(a.activityName))
console.log(`Broker Notes activity ${bnActivity.activityId}, ${(bnActivity.checklistDocs || []).length} existing docs:`)
for (const d of (bnActivity.checklistDocs || [])) console.log(`  - ${d.id.substring(0, 8)} ${d.name.substring(0, 90)}`)

// Identify OLD closing-cycle BN (NOT the failed-cycle one)
const closingBnDocs = (bnActivity.checklistDocs || []).filter((d) => /04022024AB.*Broker Notes/i.test(d.name || ''))
console.log(`\nOld closing-cycle BN doc(s) to be archived after new ingest:`)
for (const d of closingBnDocs) console.log(`  - ${d.id.substring(0, 8)} ${d.name.substring(0, 90)}`)

// Gmail auth
const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL.trim(),
  key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.trim().replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/gmail.send'],
  subject: FROM_EMAIL,
})
await auth.authorize()
const gmail = google.gmail({ version: 'v1', auth })

// Gmail send
const bin = await fs.readFile(PDF_PATH)
const b64 = bin.toString('base64').match(/.{1,76}/g).join('\r\n')
const boundary = `----rr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const filename = `${BASE_NAME}.pdf`
const body = [
  `From: ${FROM_EMAIL}`,
  `To: ${portalEmail}`,
  `Subject: ${SUBJECT}`,
  'MIME-Version: 1.0',
  `Content-Type: multipart/mixed; boundary="${boundary}"`,
  '',
  `--${boundary}`,
  'Content-Type: text/plain; charset=utf-8',
  '',
  `712 SW 1st regenerated Broker Notes (v2 rerun 2026-05-27). Corrected sale price $275K + $500 seller credit.`,
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
const raw = Buffer.from(body).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
console.log(`\n✉ Gmail sent: ${res.data.id}`)

// Poll for ingest
const stemNorm = BASE_NAME.split(/[\s_-]+/).filter(Boolean).map((w) => w.replace(/[[\]{}()*+?.,\\^$|#]/g, '\\$&')).join('[\\s_-]+')
const matchRe = new RegExp(`^${stemNorm}(_\\d{1,4})?\\.pdf$`, 'i')
const start = Date.now()
const existingIds = new Set(closingBnDocs.map((d) => d.id.toLowerCase()))
let newDocId = null
while (Date.now() - start < 25 * 60_000 && !newDocId) {
  await new Promise((r) => setTimeout(r, 30_000))
  const docsResp = await fetch(`${BASE}/api/files/sales/${SALE_GUID}/documents`, { headers: hdrs(session) })
  const allDocs = (await docsResp.json()).value?.documents || []
  const candidates = allDocs.filter((d) => matchRe.test(d.fileName || '') && !existingIds.has((d.id || '').toLowerCase())).sort((a, b) => (b.uploadDate || '').localeCompare(a.uploadDate || ''))
  if (candidates.length) {
    newDocId = candidates[0].id
    console.log(`\n[INGESTED] docId=${newDocId.substring(0, 8)} "${candidates[0].fileName}"`)
  } else {
    console.log(`  ...waiting (${Math.round((Date.now() - start) / 60000)} min)`)
  }
}
if (!newDocId) { console.log('✗ Ingest timeout'); process.exit(1) }

// PATCH rename
const pr = await fetch(`${BASE}/api/files/sales/${SALE_GUID}/documents/${newDocId}`, { method: 'PATCH', headers: hdrs(session), body: JSON.stringify({ FileName: CANONICAL_NAME }) })
console.log(`PATCH rename → "${CANONICAL_NAME}" HTTP ${pr.status}`)

// ASSIGN to Broker Notes
const ar = await fetch(`${BASE}/api/files/sales/${SALE_GUID}/checklist-items/${bnActivity.activityId}`, { method: 'POST', headers: hdrs(session), body: JSON.stringify({ documentGuid: newDocId }) })
console.log(`ASSIGN new BN → Broker Notes HTTP ${ar.status}`)

// Archive old closing BN(s)
for (const old of closingBnDocs) {
  const ur = await fetch(`${BASE}/api/files/sales/${SALE_GUID}/checklist-items/${bnActivity.activityId}/unassign`, { method: 'POST', headers: hdrs(session), body: JSON.stringify({ documentGuid: old.id }) })
  console.log(`UNASSIGN old ${old.id.substring(0, 8)} HTTP ${ur.status}`)
  const archiveName = `ARCHIVE - ${old.name.replace(/\.pdf$/i, '')} - v1 superseded by v2 rerun 2026-05-27 (wrong $305K corrected to $275K).pdf`
  const apr = await fetch(`${BASE}/api/files/sales/${SALE_GUID}/documents/${old.id}`, { method: 'PATCH', headers: hdrs(session), body: JSON.stringify({ FileName: archiveName }) })
  console.log(`PATCH old → "${archiveName.substring(0, 90)}" HTTP ${apr.status}`)
}

console.log('\nDone.')
