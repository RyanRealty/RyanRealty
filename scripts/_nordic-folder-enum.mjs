#!/usr/bin/env node
/**
 * Enumerate the 3 Nordic folders + pull doc counts, current names, checklist state.
 * Output: per-folder summary + total scope estimate.
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const BASE = 'https://api-latest.skyslope.com'

const FOLDERS = [
  { guid: 'ce3c30de-7fbb-460b-9d80-bf66c87c1d22', label: 'Closed' },
  { guid: '6be4810f-eda4-433d-ad6f-f27b80a1c6e0', label: 'Canceled-A' },
  { guid: '0ec95d31-1fed-4519-a114-e967513eac33', label: 'Canceled-B' },
]

// Need to confirm the full ce3c30de GUID — let me re-list and find the full one
async function login() {
  const ts = new Date().toISOString()
  const env = process.env
  const hmac = crypto
    .createHmac('sha256', env.SKYSLOPE_ACCESS_SECRET.trim())
    .update(`${env.SKYSLOPE_CLIENT_ID.trim()}:${env.SKYSLOPE_CLIENT_SECRET.trim()}:${ts}`)
    .digest('base64')
  const r = await skyslopeFetchWithRetry(`${BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `ss ${env.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`,
      Timestamp: ts,
    },
    body: JSON.stringify({ ClientId: env.SKYSLOPE_CLIENT_ID.trim(), ClientSecret: env.SKYSLOPE_CLIENT_SECRET.trim() }),
  })
  return (await r.json()).Session
}

function apiHeaders(session) {
  return { 'Content-Type': 'application/json', Session: session, timestamp: new Date().toISOString(), Accept: 'application/json' }
}

const session = await login()

// First, resolve full saleGuids for Nordic by listing all sales
const ts0 = Math.floor(Date.UTC(2018, 0, 1) / 1000)
const ts1 = Math.floor(Date.UTC(2030, 0, 1) / 1000)
const allSales = []
for (let page = 1; page <= 100; page++) {
  const u = `${BASE}/api/files/sales?pageNumber=${page}&earliestDate=${ts0}&latestDate=${ts1}`
  const r = await skyslopeFetchWithRetry(u, { headers: apiHeaders(session) })
  if (!r.ok) break
  const body = await r.json()
  const rows = body.value?.sales || []
  if (rows.length === 0) break
  allSales.push(...rows)
  if (rows.length < 10) break
}
const nordic = allSales.filter((s) => (s.propertyAddress || '').includes('2680 NW Nordic'))
console.log(`Found ${nordic.length} Nordic folders:\n`)
for (const s of nordic) {
  console.log(`  ${s.saleGuid}  status=${s.status}  close=${s.escrowClosingDate?.slice(0, 10) || '—'}  addr=${s.propertyAddress}`)
}
console.log()

// Now enumerate docs in each
for (const s of nordic) {
  console.log(`---\n## ${s.saleGuid} (${s.status})\n`)
  const dr = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${s.saleGuid}/documents`, { headers: apiHeaders(session) })
  if (!dr.ok) {
    console.log(`  HTTP ${dr.status} on /documents — skipping`)
    continue
  }
  const body = await dr.json()
  const docs = body.value?.documents || body.value || []
  const realDocs = docs.filter((d) => d.fileSize !== -1 && d.fileSize !== '-1')
  console.log(`  Total docs returned: ${docs.length}`)
  console.log(`  Real (non-pseudo): ${realDocs.length}`)
  const totalPages = realDocs.reduce((sum, d) => sum + (d.pages || 0), 0)
  console.log(`  Total pages across real docs: ${totalPages}`)
  // List first 20 docs
  for (const d of realDocs.slice(0, 30)) {
    const id = d.docId || d.id || d.documentGuid
    console.log(`    ${(id || '').slice(0, 8)}  ${d.pages}p  ${(d.fileName || '').substring(0, 70)}`)
  }
  if (realDocs.length > 30) console.log(`    ... and ${realDocs.length - 30} more`)
  // Also fetch folder detail for checklist state
  const folder = await skyslopeFetchWithRetry(`${BASE}/api/files/sales/${s.saleGuid}`, { headers: apiHeaders(session) })
  if (folder.ok) {
    const folderBody = await folder.json()
    const checklist = folderBody.value?.sale?.checklist
    const activities = checklist?.activities || []
    const totalActivities = activities.reduce((sum, cat) => sum + (cat.activities?.length || 0), 0)
    const requiredEmpty = activities.flatMap(c => c.activities || []).filter(a => !a.checklistDocs?.length && a.status === 'Required').length
    console.log(`  Checklist type: ${folderBody.value?.sale?.checklistType}`)
    console.log(`  Total checklist activities: ${totalActivities}`)
    console.log(`  Required & empty: ${requiredEmpty}`)
  }
}

// Persist summary
await fs.mkdir('tmp/skyslope-checklist-audit-2026-05-21', { recursive: true })
await fs.writeFile('tmp/skyslope-checklist-audit-2026-05-21/nordic-folder-summary.json', JSON.stringify({ nordic, generatedAt: new Date().toISOString() }, null, 2))
console.log('\nSaved to tmp/skyslope-checklist-audit-2026-05-21/nordic-folder-summary.json')
