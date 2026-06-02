#!/usr/bin/env node
/** Close the 2 contamination cleanup gaps the audit found:
 *  (A) Old Bend: archive the stray 3480 SW 45th SPD (d31d5764) + unassign.
 *  (B) Kwinnum: unassign all 24 already-"ARCHIVE-WRONG-PROPERTY"-named foreign docs from any activity. */
import crypto from 'node:crypto'; import fs from 'node:fs/promises'; import path from 'node:path'; import { fileURLToPath } from 'node:url'
import { skyslopeFetchWithRetry } from '../../../../scripts/skyslope-files-api.mjs'
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const BASE = 'https://api-latest.skyslope.com'
const EXECUTE = process.argv.includes('--execute')
async function loadEnv() { const txt = await fs.readFile(path.join(REPO, '.env.local'), 'utf8'); for (const raw of txt.split('\n')) { const m = raw.trim().match(/^([A-Z0-9_]+)=(.*)$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(m[1] in process.env)) process.env[m[1]] = v } }
async function login() { const ts = new Date().toISOString(); const e = process.env; const hmac = crypto.createHmac('sha256', e.SKYSLOPE_ACCESS_SECRET.trim()).update(`${e.SKYSLOPE_CLIENT_ID.trim()}:${e.SKYSLOPE_CLIENT_SECRET.trim()}:${ts}`).digest('base64'); const r = await skyslopeFetchWithRetry(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `ss ${e.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`, Timestamp: ts }, body: JSON.stringify({ ClientId: e.SKYSLOPE_CLIENT_ID.trim(), ClientSecret: e.SKYSLOPE_CLIENT_SECRET.trim() }) }); return (await r.json()).Session }
const H = (s) => ({ 'Content-Type': 'application/json', Session: s, timestamp: new Date().toISOString(), Accept: 'application/json' })
async function g(s, u) { const r = await skyslopeFetchWithRetry(u, { headers: H(s) }); return r.ok ? r.json() : { __e: r.status } }
const nm = (d) => d.name || d.fileName || ''
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
await loadEnv(); const s = await login(); console.log(EXECUTE ? 'EXECUTE\n' : 'DRY-RUN\n')

// (A) Old Bend — archive the stray 3480 SPD
const OB = '18380841-dce0-4db4-ad63-74c848020266'
{
  const sale = (await g(s, `${BASE}/api/files/sales/${OB}`))?.value?.sale ?? {}
  const docs = (await g(s, `${BASE}/api/files/sales/${OB}/documents`))?.value?.documents || []
  const d = docs.find(x => (x.id || '').toLowerCase().startsWith('d31d5764'))
  const acts = (sale.checklist?.activities || []).filter(a => (a.checklistDocs || []).some(c => (c.id || '').toLowerCase() === (d?.id || '').toLowerCase()))
  console.log(`(A) Old Bend stray SPD ${d ? d.id.slice(0, 8) : 'NOT FOUND'} "${nm(d || {}).slice(0, 40)}" — on ${acts.length} activities`)
  if (d && EXECUTE) {
    const newName = 'ARCHIVE - ' + nm(d).replace(/\.[a-z0-9]+$/i, '').slice(0, 60) + ' - wrong-property 3480 SW 45th SPD' + (nm(d).match(/\.[a-z0-9]+$/i)?.[0] || '.pdf')
    const pr = await fetch(`${BASE}/api/files/sales/${OB}/documents/${d.id}`, { method: 'PATCH', headers: H(s), body: JSON.stringify({ FileName: newName.replace(/[#,;%{}<>:"|?*]/g, '').replace(/[/\\]/g, '-') }) }); await sleep(400)
    console.log(`   rename -> ${pr.status}`)
    for (const a of acts) { const ur = await fetch(`${BASE}/api/files/sales/${OB}/checklist-items/${a.activityId}/unassign`, { method: 'POST', headers: H(s), body: JSON.stringify({ documentGuid: d.id }) }); await sleep(400); console.log(`   unassign off ${a.activityName} -> ${ur.status}`) }
  }
}

// (B) Kwinnum — unassign the 24 foreign docs from any activity
const KW = 'b3d7cb82-50c2-4d52-9dbe-31330121abcb'
{
  const contam = JSON.parse(await fs.readFile(path.join(REPO, 'tmp/_meta-audit/audit-contamination.json'), 'utf8'))
  const ids = (contam['Kwinnum']?.foreign || []).map(f => f.id.toLowerCase())
  const sale = (await g(s, `${BASE}/api/files/sales/${KW}`))?.value?.sale ?? {}
  const docs = (await g(s, `${BASE}/api/files/sales/${KW}/documents`))?.value?.documents || []
  const acts = sale.checklist?.activities || []
  const pairs = []
  for (const a of acts) for (const c of (a.checklistDocs || [])) { const full = (c.id || '').toLowerCase(); if (ids.some(p => full.startsWith(p))) pairs.push({ docId: c.id, name: nm(c), activityId: a.activityId, activityName: a.activityName }) }
  console.log(`\n(B) Kwinnum — ${pairs.length} foreign-doc/activity assignments to remove:`)
  for (const p of pairs) console.log(`   ${p.docId.slice(0, 8)} off "${p.activityName}"  (${p.name.slice(0, 45)})`)
  if (EXECUTE) { let ok = 0; for (const p of pairs) { const ur = await fetch(`${BASE}/api/files/sales/${KW}/checklist-items/${p.activityId}/unassign`, { method: 'POST', headers: H(s), body: JSON.stringify({ documentGuid: p.docId }) }); await sleep(400); if (ur.ok) ok++; else console.log(`   FAIL ${p.docId.slice(0, 8)}: ${ur.status}`) } console.log(`   unassigned ${ok}/${pairs.length}`) }
}
console.log(EXECUTE ? '\ndone' : '\n[dry-run] re-run with --execute')
