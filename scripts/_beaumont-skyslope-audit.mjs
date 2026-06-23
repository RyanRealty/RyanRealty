#!/usr/bin/env node
/**
 * Find the 20702 Beaumont Dr SkySlope SALE and dump everything relevant to
 * (a) when the HOA documents were sent/uploaded, and (b) any painting info.
 *
 * Run: node --env-file=.env.local scripts/_beaumont-skyslope-audit.mjs
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const BASE = 'https://api-latest.skyslope.com'
const env = process.env

async function login() {
  const ts = new Date().toISOString()
  const hmac = crypto.createHmac('sha256', env.SKYSLOPE_ACCESS_SECRET.trim())
    .update(`${env.SKYSLOPE_CLIENT_ID.trim()}:${env.SKYSLOPE_CLIENT_SECRET.trim()}:${ts}`)
    .digest('base64')
  const r = await skyslopeFetchWithRetry(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `ss ${env.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`, Timestamp: ts },
    body: JSON.stringify({ ClientId: env.SKYSLOPE_CLIENT_ID.trim(), ClientSecret: env.SKYSLOPE_CLIENT_SECRET.trim() }),
  })
  return (await r.json()).Session
}
const H = (s) => ({ 'Content-Type': 'application/json', Session: s, timestamp: new Date().toISOString(), Accept: 'application/json' })

const session = await login()

// 1) Find the Beaumont sale by paging the sales folder list
let target = null
for (let page = 1; page <= 60 && !target; page++) {
  const r = await skyslopeFetchWithRetry(`${BASE}/api/files/sales?pageNumber=${page}`, { headers: H(session) })
  const j = await r.json()
  const arr = j?.value?.sales || j?.value || j?.sales || []
  if (!Array.isArray(arr) || arr.length === 0) break
  for (const s of arr) {
    const blob = JSON.stringify(s).toLowerCase()
    if (blob.includes('beaumont')) { target = s; break }
  }
}
if (!target) { console.log('No Beaumont sale found in first 60 pages'); process.exit(0) }
const guid = target.guid || target.id || target.saleGuid || target.fileGuid
console.log('SALE FOUND')
console.log(JSON.stringify(target, null, 2).slice(0, 1500))
console.log('GUID =', guid)

async function getJson(path) {
  const r = await skyslopeFetchWithRetry(`${BASE}${path}`, { headers: H(session) })
  const txt = await r.text()
  try { return { status: r.status, json: JSON.parse(txt) } } catch { return { status: r.status, raw: txt.slice(0, 300) } }
}

// 2) Sale detail
const detail = await getJson(`/api/files/sales/${guid}`)
await fs.writeFile('tmp/beaumont-sale-detail.json', JSON.stringify(detail, null, 2))

// 3) Documents
const docsR = await getJson(`/api/files/sales/${guid}/documents`)
const docs = (docsR.json?.value?.documents || []).filter((d) => d && d.fileSize !== -1)
docs.sort((a, b) => String(a.uploadDate || '').localeCompare(String(b.uploadDate || '')))
console.log(`\n===== DOCUMENTS (${docs.length}) — chronological =====`)
for (const d of docs) {
  console.log(`  ${d.uploadDate || '?'}  ${(d.fileName || '').padEnd(55)}  ${d.checklistItemName || d.folderName || ''}`)
}
console.log('\n===== DOCS matching HOA / paint / association / color =====')
for (const d of docs) {
  const n = `${d.fileName || ''} ${d.checklistItemName || ''} ${d.folderName || ''}`.toLowerCase()
  if (/hoa|associat|cc&r|ccr|owner.?associ|paint|color|architect|northpointe|disclos/.test(n))
    console.log(`  ${d.uploadDate || '?'}  ${d.fileName}   [${d.checklistItemName || d.folderName || ''}]`)
}

// 4) Checklist + activity (try common subresources)
for (const sub of ['checklist', 'checklists', 'activity', 'activities', 'notes', 'history']) {
  const res = await getJson(`/api/files/sales/${guid}/${sub}`)
  if (res.status === 200 && res.json) {
    await fs.writeFile(`tmp/beaumont-${sub}.json`, JSON.stringify(res.json, null, 2))
    const blob = JSON.stringify(res.json).toLowerCase()
    const hoa = (blob.match(/hoa|associat|paint|color|architect/g) || []).length
    console.log(`\n[${sub}] status 200, saved -> tmp/beaumont-${sub}.json  (hoa/paint hits: ${hoa})`)
  } else {
    console.log(`\n[${sub}] status ${res.status}`)
  }
}
console.log('\nSaved sale detail -> tmp/beaumont-sale-detail.json')
