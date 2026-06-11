#!/usr/bin/env node
/**
 * Phase 9 BN send + ingest + attach for Ochoco Way.
 * 2 BN PDFs: Stradford closing-cycle (attach), Henry failed (folder-only).
 */
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import { google } from 'googleapis'

const ROOT = '/Users/matthewryan/RyanRealty'
const GUID = 'a0d269e0-2324-492a-8f5f-dd2385d28bf7'
const BASE = 'https://api-latest.skyslope.com'
const OUT_DIR = `${ROOT}/tmp/35th-redmond-broker-notes`
const FROM_EMAIL = 'matt@ryan-realty.com'

const MANIFEST = [
  {
    saleNumber: 'CE242100',
    pdfPath: `${OUT_DIR}/CE242100_X_Broker Notes - Transaction Summary.pdf`,
    baseName: 'CE242100_X_Broker Notes - Transaction Summary',
    isClosingCycle: true,
    label: 'Closing Moyers',
  },
]

async function login() {
  const ts = new Date().toISOString(); const e = process.env
  const hmac = crypto.createHmac('sha256', e.SKYSLOPE_ACCESS_SECRET.trim()).update(`${e.SKYSLOPE_CLIENT_ID.trim()}:${e.SKYSLOPE_CLIENT_SECRET.trim()}:${ts}`).digest('base64')
  const r = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `ss ${e.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`, Timestamp: ts }, body: JSON.stringify({ ClientId: e.SKYSLOPE_CLIENT_ID.trim(), ClientSecret: e.SKYSLOPE_CLIENT_SECRET.trim() }) })
  return (await r.json()).Session
}
function hdrs(s) { return { 'Content-Type': 'application/json', Session: s, Accept: 'application/json' } }

const session = await login()
console.log('✓ Authenticated')

const fr = await fetch(`${BASE}/api/files/sales/${GUID}`, { headers: hdrs(session) })
const sale = (await fr.json()).value.sale
const portalEmail = sale.portalEmail
console.log('portalEmail:', portalEmail)
const acts = sale.checklist?.activities || []
const bnAct = acts.find((a) => /broker notes/i.test(a.activityName || ''))
if (!bnAct) throw new Error('No Broker Notes activity')
console.log('Broker Notes activityId:', bnAct.activityId, '\n')

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
  const subject = `[2129 SW 35th Street, Redmond ${entry.isClosingCycle ? 'Closed' : 'Failed Cycle'} forward] Broker Notes - Transaction Summary (${entry.saleNumber})`
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
    '',
    `Broker Notes - Transaction Summary for 2129 SW 35th Street, Redmond (${entry.saleNumber}).\nGenerated 2026-05-27 audit pass via the skyslope-form-compliance skill.`,
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
  log.push({ ...entry, gmailMessageId: res.data.id })
}

console.log('\n→ Polling SkySlope for ingest (up to 25 min)...\n')
const remaining = new Map()
for (const m of MANIFEST) remaining.set(m.baseName, m)
const start = Date.now()
while (remaining.size > 0 && Date.now() - start < 25 * 60_000) {
  await new Promise((r) => setTimeout(r, 30_000))
  const dr = await fetch(`${BASE}/api/files/sales/${GUID}/documents`, { headers: hdrs(session) })
  const docs = (await dr.json()).value?.documents || []
  for (const [baseName, entry] of [...remaining]) {
    const stemNorm = baseName.split(/[\s_-]+/).filter(Boolean).map((w) => w.replace(/[[\]{}()*+?.,\\^$|#]/g, '\\$&')).join('[\\s_-]+')
    const matchRe = new RegExp(`^${stemNorm}(_\\d{1,4})?\\.pdf$`, 'i')
    const candidates = docs.filter((d) => matchRe.test(d.fileName || '')).sort((a, b) => (b.uploadDate || '').localeCompare(a.uploadDate || ''))
    if (!candidates.length) continue
    const winner = candidates[0]
    const newId = winner.docId || winner.id
    console.log(`[INGESTED] ${entry.label}: docId=${newId.substring(0, 8)} "${winner.fileName}"`)
    const target = `${baseName}.pdf`
    if (winner.fileName !== target) {
      const pr = await fetch(`${BASE}/api/files/sales/${GUID}/documents/${newId}`, { method: 'PATCH', headers: hdrs(session), body: JSON.stringify({ FileName: target }) })
      console.log(`  PATCH → "${target}" HTTP ${pr.status}`)
    }
    if (entry.isClosingCycle) {
      const ar = await fetch(`${BASE}/api/files/sales/${GUID}/checklist-items/${bnAct.activityId}`, { method: 'POST', headers: hdrs(session), body: JSON.stringify({ documentGuid: newId }) })
      console.log(`  Assign to Broker Notes activity HTTP ${ar.status}`)
    } else {
      console.log(`  ↳ Failed-cycle — folder-only`)
    }
    remaining.delete(baseName)
  }
  if (remaining.size > 0) console.log(`  Waiting on ${remaining.size}...`)
}
if (remaining.size > 0) console.log(`⚠ Timeout. Re-run later.`)
console.log('\nDone.')
