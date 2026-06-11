#!/usr/bin/env node
/**
 * Phase 9 for 15352 Bear St (2b9046c3): send the 3 already-generated
 * Broker Notes PDFs to BearSt15352@skyslope.com via Gmail DWD (matt@),
 * poll for ingest, PATCH ingested filenames to v5, then assign ONLY the
 * Hernandez closing-cycle BN to the Broker Notes activity.
 *
 * Per checklist purity rule: failed-cycle BNs (JB93024, 15352Bear24)
 * stay folder-only — NOT attached to the Broker Notes activity.
 *
 * Usage:
 *   node --env-file=.env.local scripts/_bear-st-phase9-broker-notes.mjs
 */
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import { google } from 'googleapis'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const BASE = 'https://api-latest.skyslope.com'
const SALE_GUID = '2b9046c3-25aa-4efd-b4b1-bd381d6f2a8d'
const OUT_DIR = 'tmp/bear-st-broker-notes'
const FROM_EMAIL = 'matt@ryan-realty.com'

const MANIFEST = [
  {
    saleNumber: 'Hernandez/15352 Bear St',
    pdfPath: `${OUT_DIR}/Hernandez-15352-Bear-St_X_Broker Notes - Transaction Summary.pdf`,
    baseName: 'Hernandez-15352-Bear-St_X_Broker Notes - Transaction Summary',
    isClosingCycle: true, isFailedCycle: false,
    label: 'Closing',
  },
  {
    saleNumber: 'JB93024',
    pdfPath: `${OUT_DIR}/JB93024_X_Broker Notes - Transaction Summary - Failed Cycle.pdf`,
    baseName: 'JB93024_X_Broker Notes - Transaction Summary - Failed Cycle',
    isClosingCycle: false, isFailedCycle: true,
    label: 'Failed Dallimore',
  },
  {
    saleNumber: '15352Bear24',
    pdfPath: `${OUT_DIR}/15352Bear24_X_Broker Notes - Transaction Summary - Failed Cycle.pdf`,
    baseName: '15352Bear24_X_Broker Notes - Transaction Summary - Failed Cycle',
    isClosingCycle: false, isFailedCycle: true,
    label: 'Failed Parks-Tavares',
  },
]

async function login() {
  const ts = new Date().toISOString()
  const e = process.env
  const hmac = crypto.createHmac('sha256', e.SKYSLOPE_ACCESS_SECRET.trim())
    .update(`${e.SKYSLOPE_CLIENT_ID.trim()}:${e.SKYSLOPE_CLIENT_SECRET.trim()}:${ts}`)
    .digest('base64')
  const r = await skyslopeFetchWithRetry(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `ss ${e.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`, Timestamp: ts },
    body: JSON.stringify({ ClientId: e.SKYSLOPE_CLIENT_ID.trim(), ClientSecret: e.SKYSLOPE_CLIENT_SECRET.trim() }),
  })
  return (await r.json()).Session
}
function apiHeaders(s) {
  return { 'Content-Type': 'application/json', Session: s, timestamp: new Date().toISOString(), Accept: 'application/json' }
}

const session = await login()
console.log('✓ Authenticated\n')

const fr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${SALE_GUID}`, { headers: apiHeaders(session) })
const sale = (await fr.json()).value?.sale
const portalEmail = sale.portalEmail
if (!portalEmail) throw new Error('No portalEmail on sale folder')
console.log(`portalEmail: ${portalEmail}`)

const activities = sale.checklist?.activities || []
const brokerNotesAct = activities.find((a) => /broker notes/i.test(a.activityName || ''))
if (!brokerNotesAct) throw new Error('No Broker Notes activity in checklist')
console.log(`Broker Notes activityId: ${brokerNotesAct.activityId}\n`)

// Gmail DWD impersonation
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
  console.log(`\n=== ${entry.label}: ${entry.baseName} ===`)
  const bin = await fs.readFile(entry.pdfPath)
  const b64 = bin.toString('base64').match(/.{1,76}/g).join('\r\n')
  const boundary = `----rr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const subject = `[15352 Bear St ${entry.isClosingCycle ? 'Closed' : 'Failed Cycle'} forward] Broker Notes - Transaction Summary (${entry.saleNumber})`
  const filename = `${entry.baseName}.pdf`
  const body = [
    `From: ${FROM_EMAIL}`,
    `To: ${portalEmail}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    `Broker Notes - Transaction Summary for 15352 Bear St (${entry.saleNumber}).\nGenerated 2026-05-26 audit pass via the skyslope-form-compliance skill.`,
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
  log.push({ ...entry, gmailMessageId: res.data.id, sentAt: new Date().toISOString() })
}

console.log(`\n→ All 3 PDFs sent. Polling SkySlope for ingest (up to 25 min)...`)
console.log(`  (Per skill: ingest can take 10-25 min for closed-status folders)\n`)

const remaining = new Map()
for (const entry of MANIFEST) remaining.set(entry.baseName, entry)

const start = Date.now()
const MAX_MS = 25 * 60_000
while (remaining.size > 0 && Date.now() - start < MAX_MS) {
  await new Promise((r) => setTimeout(r, 30_000))
  const dr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${SALE_GUID}/documents`, { headers: apiHeaders(session) })
  const docs = (await dr.json()).value?.documents || []
  for (const [baseName, entry] of [...remaining]) {
    // Flexible match — SkySlope replaces spaces with underscores and appends _NNN
    const stemNorm = baseName.split(/[\s_-]+/).filter(Boolean)
      .map((w) => w.replace(/[[\]{}()*+?.,\\^$|#]/g, '\\$&')).join('[\\s_-]+')
    const matchRe = new RegExp(`^${stemNorm}(_\\d{1,4})?\\.pdf$`, 'i')
    const candidates = docs.filter((d) => matchRe.test(d.fileName || ''))
      .sort((a, b) => (b.uploadDate || '').localeCompare(a.uploadDate || ''))
    if (!candidates.length) continue
    const winner = candidates[0]
    const newDocId = winner.docId || winner.id
    console.log(`\n[INGESTED] ${entry.label}: docId=${newDocId.substring(0, 8)} "${winner.fileName}" uploaded=${winner.uploadDate}`)
    // PATCH to canonical name
    const target = `${baseName}.pdf`
    if (winner.fileName !== target) {
      const pr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${SALE_GUID}/documents/${newDocId}`, {
        method: 'PATCH', headers: apiHeaders(session),
        body: JSON.stringify({ FileName: target }),
      })
      console.log(`  PATCH → "${target}" HTTP ${pr.status}`)
    }
    // Assign closing-cycle to Broker Notes activity
    if (entry.isClosingCycle) {
      const ar = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${SALE_GUID}/checklist-items/${brokerNotesAct.activityId}`, {
        method: 'POST', headers: apiHeaders(session),
        body: JSON.stringify({ documentGuid: newDocId }),
      })
      console.log(`  Assign to Broker Notes activity (${brokerNotesAct.activityId}) HTTP ${ar.status}`)
    } else {
      console.log(`  ↳ Failed-cycle BN — folder-only per checklist purity rule (not attached to activity)`)
    }
    log.push({ ...entry, ingestedDocId: newDocId, ingestedFileName: winner.fileName, finalFileName: target })
    remaining.delete(baseName)
  }
  if (remaining.size > 0) {
    console.log(`  Still waiting on ${remaining.size}: ${[...remaining.keys()].map((k) => k.substring(0, 30)).join(', ')}`)
  }
}

if (remaining.size > 0) {
  console.log(`\n⚠ Timeout. ${remaining.size} BN(s) not yet ingested:`)
  for (const baseName of remaining.keys()) console.log(`    - ${baseName}`)
  console.log(`  Re-run later to finish.`)
}

await fs.writeFile(`${OUT_DIR}/send-log.json`, JSON.stringify(log, null, 2))
console.log(`\nDone. Log → ${OUT_DIR}/send-log.json`)
