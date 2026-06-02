#!/usr/bin/env node
/** Dump live documents + checklist-activity assignments for a sale folder, so a
 * Phase 2-5 subagent has docId discipline + current assignment state.
 * Usage: node dump-classify-context.mjs <saleGuid> */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { skyslopeFetchWithRetry } from '../../../../scripts/skyslope-files-api.mjs'
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const BASE = 'https://api-latest.skyslope.com'
const GUID = process.argv[2]
if (!GUID) { console.error('usage: dump-classify-context.mjs <saleGuid>'); process.exit(1) }
async function loadEnvLocal() { const txt = await fs.readFile(path.join(REPO, '.env.local'), 'utf8'); for (const raw of txt.split('\n')) { const l = raw.trim(); if (!l || l.startsWith('#')) continue; const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(m[1] in process.env)) process.env[m[1]] = v } }
async function login() { const ts = new Date().toISOString(); const e = process.env; const hmac = crypto.createHmac('sha256', e.SKYSLOPE_ACCESS_SECRET.trim()).update(`${e.SKYSLOPE_CLIENT_ID.trim()}:${e.SKYSLOPE_CLIENT_SECRET.trim()}:${ts}`).digest('base64'); const r = await skyslopeFetchWithRetry(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `ss ${e.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`, Timestamp: ts }, body: JSON.stringify({ ClientId: e.SKYSLOPE_CLIENT_ID.trim(), ClientSecret: e.SKYSLOPE_CLIENT_SECRET.trim() }) }); return (await r.json()).Session }
const H = (s) => ({ 'Content-Type': 'application/json', Session: s, timestamp: new Date().toISOString(), Accept: 'application/json' })
async function g(s, u) { const r = await skyslopeFetchWithRetry(u, { headers: H(s) }); return r.ok ? r.json() : { __e: r.status } }
await loadEnvLocal(); const s = await login()
const sale = (await g(s, `${BASE}/api/files/sales/${GUID}`))?.value?.sale ?? {}
const docs = (await g(s, `${BASE}/api/files/sales/${GUID}/documents`))?.value?.documents || []
const documents = docs.map(d => ({ id: d.id, name: d.name || d.fileName || '' }))
// doc -> activities it is assigned to
const docToActs = {}
const activities = (sale.checklist?.activities || []).map(a => ({
  activityId: a.activityId,
  activityName: a.activityName,
  required: a.required ?? null,
  assignedDocIds: (a.checklistDocs || []).map(d => d.id),
}))
for (const a of activities) for (const id of a.assignedDocIds) (docToActs[id] ||= []).push(a.activityName)
const OUT = path.join(REPO, 'tmp/skyslope-pdfs', GUID)
await fs.mkdir(OUT, { recursive: true })
await fs.writeFile(path.join(OUT, 'documents.json'), JSON.stringify(documents, null, 2))
await fs.writeFile(path.join(OUT, 'checklist.json'), JSON.stringify({ checklistType: sale.checklistType, dealType: sale.dealType, salePrice: sale.salePrice, activities, docToActs }, null, 2))
console.log(`wrote documents.json (${documents.length} docs) + checklist.json (${activities.length} activities, ${activities.filter(a => a.assignedDocIds.length >= 2).length} with 2+ docs) to ${OUT}`)
