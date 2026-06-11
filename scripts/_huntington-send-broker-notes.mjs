import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import { google } from 'googleapis'

const ROOT = '/Users/matthewryan/RyanRealty'
const BASE = 'https://api-latest.skyslope.com'
const FROM_EMAIL = 'matt@ryan-realty.com'
const SALE_GUID = '13e20213-81eb-4e8f-b7de-534f863af3a2'
const PDF_PATH = `${ROOT}/tmp/huntington-rd-2026-05-28/phase6/Huntington-Closing_X_Broker Notes - Transaction Summary.pdf`
const BASE_NAME = 'Huntington-Closing_X_Broker Notes - Transaction Summary'
const CANONICAL = 'Huntington-Closing_X_Broker Notes - Transaction Summary.pdf'
const SUBJECT = '[54474 Huntington Road] Broker Notes - Transaction Summary (Fess sellers, $583K)'

async function loadEnv() {
  const txt = await fs.readFile(`${ROOT}/.env.local`, 'utf8')
  for (const raw of txt.split('\n')) { const m = raw.trim().match(/^([A-Z0-9_]+)=(.*)$/); if (!m) continue; let v = m[2]; if (v.startsWith('"')&&v.endsWith('"')) v = v.slice(1,-1); if (!(m[1] in process.env)) process.env[m[1]] = v }
}
async function login() {
  const ts = new Date().toISOString(); const e = process.env
  const hmac = crypto.createHmac('sha256', e.SKYSLOPE_ACCESS_SECRET.trim()).update(`${e.SKYSLOPE_CLIENT_ID.trim()}:${e.SKYSLOPE_CLIENT_SECRET.trim()}:${ts}`).digest('base64')
  const r = await fetch(`${BASE}/auth/login`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`ss ${e.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`, Timestamp: ts }, body: JSON.stringify({ ClientId: e.SKYSLOPE_CLIENT_ID.trim(), ClientSecret: e.SKYSLOPE_CLIENT_SECRET.trim() }) })
  return (await r.json()).Session
}
const h = (s) => ({ 'Content-Type':'application/json', Session: s, Accept:'application/json' })
await loadEnv()
const session = await login()
const sale = (await (await fetch(`${BASE}/api/files/sales/${SALE_GUID}`, { headers: h(session) })).json()).value.sale
const portalEmail = sale.portalEmail
const bnAct = sale.checklist.activities.find((a) => /broker notes/i.test(a.activityName))
console.log('portalEmail:', portalEmail, 'BN activity:', bnAct.activityId, 'existing docs:', (bnAct.checklistDocs||[]).length)

const auth = new google.auth.JWT({ email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL.trim(), key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.trim().replace(/\\n/g,'\n'), scopes:['https://www.googleapis.com/auth/gmail.send'], subject: FROM_EMAIL })
await auth.authorize()
const gmail = google.gmail({ version:'v1', auth })

const bin = await fs.readFile(PDF_PATH)
const b64 = bin.toString('base64').match(/.{1,76}/g).join('\r\n')
const boundary = `----rr-${Date.now()}-${Math.random().toString(36).slice(2,8)}`
const filename = `${BASE_NAME}.pdf`
const body = [`From: ${FROM_EMAIL}`,`To: ${portalEmail}`,`Subject: ${SUBJECT}`,'MIME-Version: 1.0',`Content-Type: multipart/mixed; boundary="${boundary}"`,'',`--${boundary}`,'Content-Type: text/plain; charset=utf-8','','Huntington Road Broker Notes (v2 pass 2026-05-28).','',`--${boundary}`,`Content-Type: application/pdf; name="${filename}"`,`Content-Disposition: attachment; filename="${filename}"`,'Content-Transfer-Encoding: base64','',b64,'',`--${boundary}--`,''].join('\r\n')
const raw = Buffer.from(body).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
const res = await gmail.users.messages.send({ userId:'me', requestBody:{ raw } })
console.log(`✉ Gmail sent: ${res.data.id}`)

const stemNorm = BASE_NAME.split(/[\s_-]+/).filter(Boolean).map((w)=>w.replace(/[[\]{}()*+?.,\\^$|#]/g,'\\$&')).join('[\\s_-]+')
const matchRe = new RegExp(`^${stemNorm}(_\\d{1,4})?\\.pdf$`,'i')
const start = Date.now()
const existingIds = new Set((bnAct.checklistDocs||[]).map((d)=>d.id.toLowerCase()))
let newDocId = null
while (Date.now()-start < 25*60_000 && !newDocId) {
  await new Promise((r)=>setTimeout(r,30_000))
  const all = (await (await fetch(`${BASE}/api/files/sales/${SALE_GUID}/documents`, { headers: h(session) })).json()).value?.documents || []
  const cand = all.filter((d) => matchRe.test(d.fileName||'') && !existingIds.has((d.id||'').toLowerCase())).sort((a,b)=>(b.uploadDate||'').localeCompare(a.uploadDate||''))
  if (cand.length) { newDocId = cand[0].id; console.log(`[INGESTED] docId=${newDocId.substring(0,8)} "${cand[0].fileName}"`) }
  else console.log(`  ...waiting (${Math.round((Date.now()-start)/60000)} min)`)
}
if (!newDocId) { console.log('✗ Ingest timeout'); process.exit(1) }
const pr = await fetch(`${BASE}/api/files/sales/${SALE_GUID}/documents/${newDocId}`, { method:'PATCH', headers: h(session), body: JSON.stringify({ FileName: CANONICAL }) })
console.log(`PATCH rename HTTP ${pr.status}`)
const ar = await fetch(`${BASE}/api/files/sales/${SALE_GUID}/checklist-items/${bnAct.activityId}`, { method:'POST', headers: h(session), body: JSON.stringify({ documentGuid: newDocId }) })
console.log(`ASSIGN HTTP ${ar.status}`)
console.log('Done.')
