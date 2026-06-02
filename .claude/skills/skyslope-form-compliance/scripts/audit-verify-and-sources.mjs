#!/usr/bin/env node
/** (1) Verify foreign docs in the 4 contaminated folders are now archived+unassigned (live).
 *  (2) Look up the source deals in our SkySlope inventory. */
import crypto from 'node:crypto'; import fs from 'node:fs/promises'; import path from 'node:path'; import { fileURLToPath } from 'node:url'
import { skyslopeFetchWithRetry } from '../../../../scripts/skyslope-files-api.mjs'
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const BASE = 'https://api-latest.skyslope.com'
async function loadEnv() { const txt = await fs.readFile(path.join(REPO, '.env.local'), 'utf8'); for (const raw of txt.split('\n')) { const m = raw.trim().match(/^([A-Z0-9_]+)=(.*)$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(m[1] in process.env)) process.env[m[1]] = v } }
async function login() { const ts = new Date().toISOString(); const e = process.env; const hmac = crypto.createHmac('sha256', e.SKYSLOPE_ACCESS_SECRET.trim()).update(`${e.SKYSLOPE_CLIENT_ID.trim()}:${e.SKYSLOPE_CLIENT_SECRET.trim()}:${ts}`).digest('base64'); const r = await skyslopeFetchWithRetry(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `ss ${e.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`, Timestamp: ts }, body: JSON.stringify({ ClientId: e.SKYSLOPE_CLIENT_ID.trim(), ClientSecret: e.SKYSLOPE_CLIENT_SECRET.trim() }) }); return (await r.json()).Session }
const H = (s) => ({ 'Content-Type': 'application/json', Session: s, timestamp: new Date().toISOString(), Accept: 'application/json' })
async function g(s, u) { const r = await skyslopeFetchWithRetry(u, { headers: H(s) }); return r.ok ? r.json() : { __e: r.status } }
const nm = (d) => d.name || d.fileName || ''

// foreign doc prefixes per contaminated folder
const CONTAM = {
  'Huntington': { guid: '13e20213-81eb-4e8f-b7de-534f863af3a2', ids: ['965f4637', 'fd2828cd', '1bd6b2b8', '34c9a893', '4d643c4d', '87ce8ff5'] },
  '703 SW 7th': { guid: '487fb3bf-1a35-417c-84e1-b803be012aa0', ids: null },   // null = derive from plan.json
  'Old Bend': { guid: '18380841-dce0-4db4-ad63-74c848020266', ids: ['d31d5764'] },
  'Kwinnum': { guid: 'b3d7cb82-50c2-4d52-9dbe-31330121abcb', ids: null },
}
const contam = JSON.parse(await fs.readFile(path.join(REPO, 'tmp/_meta-audit/audit-contamination.json'), 'utf8'))
for (const [name, c] of Object.entries(CONTAM)) if (!c.ids && contam[name]) c.ids = contam[name].foreign.map(f => f.id)

await loadEnv(); const s = await login()
console.log('=== (1) LIVE STATE of foreign docs in contaminated folders ===\n')
for (const [name, c] of Object.entries(CONTAM)) {
  const docs = (await g(s, `${BASE}/api/files/sales/${c.guid}/documents`))?.value?.documents || []
  const sale = (await g(s, `${BASE}/api/files/sales/${c.guid}`))?.value?.sale ?? {}
  const acts = sale.checklist?.activities || []
  const assignedIds = new Set(acts.flatMap(a => (a.checklistDocs || []).map(d => (d.id || '').toLowerCase())))
  let archived = 0, live = 0, assigned = 0
  for (const pfx of (c.ids || [])) {
    const d = docs.find(x => (x.id || '').toLowerCase().startsWith(pfx.toLowerCase()))
    if (!d) continue
    const isArch = /^ARCHIVE/i.test(nm(d))
    if (isArch) archived++; else live++
    if (assignedIds.has((d.id || '').toLowerCase())) assigned++
  }
  console.log(`${name}: ${c.ids.length} foreign docs — ${archived} ARCHIVE-named, ${live} not-archived, ${assigned} still ON an activity`)
}

console.log('\n=== (2) SOURCE deals in our SkySlope inventory ===\n')
const allSales = JSON.parse(await fs.readFile(path.join(REPO, 'tmp/_meta-audit/all-sales.json'), 'utf8'))
const find = (re) => allSales.filter(x => re.test((x.propertyAddress || '') + ' ' + (x.sellers || '') + ' ' + (x.buyers || '')))
for (const [label, re] of [['122 SW 10th', /122 SW 10th/i], ['712 SW 1st', /712 SW 1st/i], ['3480 SW 45th', /3480 SW 45th/i], ['King (Hezekiah/Saul)', /\bKing\b/i], ['Brown/Revere', /Brown|Revere/i], ['Hakkila', /Hakkila/i], ['Dority', /Dority/i]]) {
  const hits = find(re)
  console.log(`${label}: ${hits.length ? hits.map(h => h.saleGuid.slice(0, 8) + ' [' + h.status + '] ' + (h.propertyAddress || '')).join(' | ') : 'NOT in our inventory'}`)
}
console.log('\n(inventory =', allSales.length, 'sales in all-sales.json)')
