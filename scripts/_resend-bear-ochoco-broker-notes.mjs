#!/usr/bin/env node
/**
 * Resend regenerated Bear St + Ochoco Broker Notes:
 *   1. Find currently-attached BN docs on the Broker Notes activity
 *   2. Gmail-send new PDF to sale.portalEmail
 *   3. Poll SkySlope ingest (up to 25 min per send)
 *   4. PATCH ingested doc to canonical name
 *   5. ASSIGN new doc to Broker Notes activity
 *   6. UNASSIGN old BN from Broker Notes activity
 *   7. PATCH old BN to ARCHIVE - <name> - v1 superseded by v2 rerun 2026-05-27.pdf
 */
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import { google } from 'googleapis'

const ROOT = '/Users/matthewryan/RyanRealty'
const BASE = 'https://api-latest.skyslope.com'
const FROM_EMAIL = 'matt@ryan-realty.com'

const MANIFEST = [
  {
    label: 'Bear St',
    saleGuid: '2b9046c3-25aa-4efd-b4b1-bd381d6f2a8d',
    pdfPath: `${ROOT}/tmp/bear-st-broker-notes/Hernandez-15352-Bear-St_X_Broker Notes - Transaction Summary.pdf`,
    baseName: 'Hernandez-15352-Bear-St_X_Broker Notes - Transaction Summary',
    canonicalName: 'Hernandez-15352-Bear-St_X_Broker Notes - Transaction Summary.pdf',
    subject: '[15352 Bear St v2 rerun] Broker Notes - Transaction Summary (Hernandez)',
  },
  {
    label: 'Ochoco',
    saleGuid: 'eb9a24d6-f766-4fb7-bfca-a9c7e5b83cf5',
    pdfPath: `${ROOT}/tmp/ochoco-way-broker-notes/MB-KS09202024_X_Broker Notes - Transaction Summary.pdf`,
    baseName: 'MB-KS09202024_X_Broker Notes - Transaction Summary',
    canonicalName: 'MB-KS09202024_X_Broker Notes - Transaction Summary.pdf',
    subject: '[29500 SE Ochoco Way v2 rerun] Broker Notes - Transaction Summary (Stradford)',
  },
]

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

// Gmail auth (shared across both sends)
const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL.trim(),
  key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.trim().replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/gmail.send'],
  subject: FROM_EMAIL,
})
await auth.authorize()
const gmail = google.gmail({ version: 'v1', auth })

const log = []

for (const entry of MANIFEST) {
  console.log(`\n=== ${entry.label} ===`)

  // 1. Fetch fresh sale state
  const saleResp = await fetch(`${BASE}/api/files/sales/${entry.saleGuid}`, { headers: hdrs(session) })
  const sale = (await saleResp.json()).value.sale
  const portalEmail = sale.portalEmail
  const acts = sale.checklist.activities
  const bnActivity = acts.find((a) => /broker notes/i.test(a.activityName))
  if (!bnActivity) { console.log('  ✗ No Broker Notes activity'); continue }
  console.log(`  Broker Notes activity ${bnActivity.activityId}, ${(bnActivity.checklistDocs||[]).length} existing docs`)
  console.log(`  Existing BN docs:`)
  const existingBnDocs = (bnActivity.checklistDocs || []).filter((d) => /broker notes/i.test(d.name || ''))
  for (const d of existingBnDocs) console.log(`    - ${d.id.substring(0,8)} ${d.name.substring(0,80)}`)

  // 2. Gmail send
  const bin = await fs.readFile(entry.pdfPath)
  const b64 = bin.toString('base64').match(/.{1,76}/g).join('\r\n')
  const boundary = `----rr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const filename = `${entry.baseName}.pdf`
  const body = [
    `From: ${FROM_EMAIL}`,
    `To: ${portalEmail}`,
    `Subject: ${entry.subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    `${entry.label} regenerated Broker Notes (v2 rerun 2026-05-27).`,
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
  console.log(`  ✉ Gmail sent: ${res.data.id}`)

  // 3. Poll for ingest (up to 25 min)
  const stemNorm = entry.baseName.split(/[\s_-]+/).filter(Boolean).map((w) => w.replace(/[[\]{}()*+?.,\\^$|#]/g, '\\$&')).join('[\\s_-]+')
  const matchRe = new RegExp(`^${stemNorm}(_\\d{1,4})?\\.pdf$`, 'i')
  const start = Date.now()
  let newDocId = null
  while (Date.now() - start < 25 * 60_000 && !newDocId) {
    await new Promise((r) => setTimeout(r, 30_000))
    const docsResp = await fetch(`${BASE}/api/files/sales/${entry.saleGuid}/documents`, { headers: hdrs(session) })
    const allDocs = (await docsResp.json()).value?.documents || []
    // Find a doc matching the BN filename pattern that's NOT one of the existing BN docs we noted earlier
    const existingIds = new Set(existingBnDocs.map((d) => d.id.toLowerCase()))
    const candidates = allDocs.filter((d) => matchRe.test(d.fileName || '') && !existingIds.has((d.id || '').toLowerCase())).sort((a, b) => (b.uploadDate || '').localeCompare(a.uploadDate || ''))
    if (candidates.length) {
      newDocId = candidates[0].id
      console.log(`  [INGESTED] docId=${newDocId.substring(0,8)} "${candidates[0].fileName}"`)
    } else {
      console.log(`  ...waiting (${Math.round((Date.now()-start)/60000)} min elapsed)`)
    }
  }

  if (!newDocId) { console.log(`  ✗ Ingest timeout for ${entry.label}`); continue }

  // 4. PATCH rename to canonical
  const renameUrl = `${BASE}/api/files/sales/${entry.saleGuid}/documents/${newDocId}`
  const pr = await fetch(renameUrl, { method: 'PATCH', headers: hdrs(session), body: JSON.stringify({ FileName: entry.canonicalName }) })
  console.log(`  PATCH rename → "${entry.canonicalName}" HTTP ${pr.status}`)

  // 5. ASSIGN to Broker Notes activity
  const assignUrl = `${BASE}/api/files/sales/${entry.saleGuid}/checklist-items/${bnActivity.activityId}`
  const ar = await fetch(assignUrl, { method: 'POST', headers: hdrs(session), body: JSON.stringify({ documentGuid: newDocId }) })
  console.log(`  ASSIGN new BN → Broker Notes activity HTTP ${ar.status}`)

  // 6. UNASSIGN old BN docs from Broker Notes activity + 7. PATCH them to ARCHIVE prefix
  for (const old of existingBnDocs) {
    const oldId = old.id
    const oldName = old.name || ''
    const ur = await fetch(`${BASE}/api/files/sales/${entry.saleGuid}/checklist-items/${bnActivity.activityId}/unassign`, { method: 'POST', headers: hdrs(session), body: JSON.stringify({ documentGuid: oldId }) })
    console.log(`  UNASSIGN old ${oldId.substring(0,8)} HTTP ${ur.status}`)
    const archiveName = `ARCHIVE - ${oldName.replace(/\.pdf$/i, '')} - v1 superseded by v2 rerun 2026-05-27.pdf`
    const apr = await fetch(`${BASE}/api/files/sales/${entry.saleGuid}/documents/${oldId}`, { method: 'PATCH', headers: hdrs(session), body: JSON.stringify({ FileName: archiveName }) })
    console.log(`  PATCH old → "${archiveName.substring(0,80)}" HTTP ${apr.status}`)
  }

  log.push({ label: entry.label, newDocId, archivedOldIds: existingBnDocs.map((d) => d.id), gmailMessageId: res.data.id })
}

await fs.writeFile(`${ROOT}/tmp/bear-ochoco-broker-notes-resend-log.json`, JSON.stringify(log, null, 2))
console.log('\nDone.')
console.log(`Log: ${ROOT}/tmp/bear-ochoco-broker-notes-resend-log.json`)
