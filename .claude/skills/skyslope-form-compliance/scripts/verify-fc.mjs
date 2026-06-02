#!/usr/bin/env node
/** Post-execute verify for a form-compliance deal. Usage: node verify-fc.mjs <saleGuid> <label> */
import crypto from 'node:crypto'; import fs from 'node:fs/promises'; import path from 'node:path'; import { fileURLToPath } from 'node:url'
import { skyslopeFetchWithRetry } from '../../../../scripts/skyslope-files-api.mjs'
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const BASE = 'https://api-latest.skyslope.com'
const GUID = process.argv[2], LABEL = process.argv[3] || GUID
async function loadEnv() { const txt = await fs.readFile(path.join(REPO, '.env.local'), 'utf8'); for (const raw of txt.split('\n')) { const m = raw.trim().match(/^([A-Z0-9_]+)=(.*)$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(m[1] in process.env)) process.env[m[1]] = v } }
async function login() { const ts = new Date().toISOString(); const e = process.env; const hmac = crypto.createHmac('sha256', e.SKYSLOPE_ACCESS_SECRET.trim()).update(`${e.SKYSLOPE_CLIENT_ID.trim()}:${e.SKYSLOPE_CLIENT_SECRET.trim()}:${ts}`).digest('base64'); const r = await skyslopeFetchWithRetry(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `ss ${e.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`, Timestamp: ts }, body: JSON.stringify({ ClientId: e.SKYSLOPE_CLIENT_ID.trim(), ClientSecret: e.SKYSLOPE_CLIENT_SECRET.trim() }) }); return (await r.json()).Session }
const H = (s) => ({ 'Content-Type': 'application/json', Session: s, timestamp: new Date().toISOString(), Accept: 'application/json' })
await loadEnv(); const s = await login()
const sale = (await (await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${GUID}`, { headers: H(s) })).json()).value.sale
const docs = (await (await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${GUID}/documents`, { headers: H(s) })).json()).value.documents
const nm = (d) => d.name || d.fileName || ''
const isA = (n) => /^ARCHIVE/i.test(n)
const arch = docs.filter(d => isA(nm(d)))
const fabricated = docs.filter(d => /-0000-0000-0000-000000000001$/.test(d.id || ''))
const acts = sale.checklist.activities
const multi = acts.filter(a => (a.checklistDocs || []).length >= 2)
const empty = acts.filter(a => (a.required === true || /required/i.test(JSON.stringify(a.required || ''))) && (a.checklistDocs || []).length === 0)
console.log(`${LABEL}: total ${docs.length} | live ${docs.length - arch.length} | ARCHIVE ${arch.length} | activities w/ 2+ docs: ${multi.length} | fabricated docIds: ${fabricated.length}`)
console.log('  multi-doc activities (verify legit sequences, not dupes):')
for (const a of multi) console.log(`    ${a.activityName} (${a.checklistDocs.length}): ${a.checklistDocs.map(d => nm(d).slice(0, 34)).join(' | ')}`)
