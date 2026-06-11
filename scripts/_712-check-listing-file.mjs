#!/usr/bin/env node
/**
 * Check whether 712 SW 1st St has a SkySlope LISTING file (separate
 * from the SALE file). Also enumerate Listing-type checklist templates
 * available to Ryan Realty's office so we can recommend which one to
 * use when we create a backfill listing file.
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(__dirname, '..')
const BASE = 'https://api-latest.skyslope.com'

async function loadEnvLocal() {
  const txt = await fs.readFile(path.join(REPO, '.env.local'), 'utf8')
  for (const raw of txt.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    let val = m[2]
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1)
    if (!(m[1] in process.env)) process.env[m[1]] = val
  }
}

async function login() {
  const ts = new Date().toISOString()
  const e = process.env
  const hmac = crypto
    .createHmac('sha256', e.SKYSLOPE_ACCESS_SECRET.trim())
    .update(`${e.SKYSLOPE_CLIENT_ID.trim()}:${e.SKYSLOPE_CLIENT_SECRET.trim()}:${ts}`)
    .digest('base64')
  const r = await skyslopeFetchWithRetry(`${BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `ss ${e.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`,
      Timestamp: ts,
    },
    body: JSON.stringify({
      ClientId: e.SKYSLOPE_CLIENT_ID.trim(),
      ClientSecret: e.SKYSLOPE_CLIENT_SECRET.trim(),
    }),
  })
  return (await r.json()).Session
}

function H(session) {
  return {
    'Content-Type': 'application/json',
    Session: session,
    timestamp: new Date().toISOString(),
    Accept: 'application/json',
  }
}

await loadEnvLocal()
const session = await login()
console.log('✓ Auth\n')

// 1. Search listings by address. The /api/files/listings endpoint
//    pagination is 10/page; we'll scan all pages and filter on address.
const earliest = Math.floor(Date.UTC(2018, 0, 1) / 1000)
const latest = Math.floor(Date.now() / 1000)
let found = []
for (let page = 1; page <= 200; page++) {
  const url = `${BASE}/api/files/listings?pageNumber=${page}&earliestDate=${earliest}&latestDate=${latest}`
  const r = await skyslopeFetchWithRetry(url, { headers: H(session) })
  if (!r.ok) break
  const body = await r.json()
  const rows = body.value?.listings ?? body.listings ?? []
  if (rows.length === 0) break
  for (const row of rows) {
    const street = (row.streetAddress ?? row.address ?? '').toLowerCase()
    if (/712.*(1st|first)/.test(street) && /madras/i.test(row.city ?? '')) {
      found.push(row)
    }
  }
  if (rows.length < 10) break
}
console.log(`712 SW 1st St — LISTING file scan: ${found.length} match(es)`)
for (const row of found) {
  console.log(`  guid=${row.fileGuid ?? row.id} status=${row.status} mls=${row.mlsNumber ?? '(none)'} checklist=${row.checklistType ?? '(none)'}`)
}

// 2. Sample one Listing file to see its template name (so we know what
//    Listing-type templates exist).
const sampleUrl = `${BASE}/api/files/listings?pageNumber=1&earliestDate=${earliest}&latestDate=${latest}`
const sr = await skyslopeFetchWithRetry(sampleUrl, { headers: H(session) })
const sbody = await sr.json()
const sampleListings = sbody.value?.listings ?? sbody.listings ?? []
console.log(`\nSample Listing files (most-recent page): ${sampleListings.length}`)
const templateNames = new Set()
for (const row of sampleListings.slice(0, 5)) {
  console.log(`  ${(row.streetAddress ?? '').padEnd(40)} status=${row.status} checklist="${row.checklistType ?? '(none)'}"`)
  if (row.checklistType) templateNames.add(row.checklistType)
}

// 3. To get the FULL list of Listing templates names this office uses,
//    sample across multiple pages. Lift template name from each.
console.log(`\nScanning all Listing files for unique checklist template names...`)
const allTemplates = new Map() // name -> count
for (let page = 1; page <= 80; page++) {
  const url = `${BASE}/api/files/listings?pageNumber=${page}&earliestDate=${earliest}&latestDate=${latest}`
  const r = await skyslopeFetchWithRetry(url, { headers: H(session) })
  if (!r.ok) break
  const body = await r.json()
  const rows = body.value?.listings ?? body.listings ?? []
  if (rows.length === 0) break
  for (const row of rows) {
    const t = row.checklistType ?? '(none)'
    allTemplates.set(t, (allTemplates.get(t) ?? 0) + 1)
  }
  if (rows.length < 10) break
}
const sortedT = [...allTemplates.entries()].sort((a, b) => b[1] - a[1])
console.log(`Listing-side templates in use (across ${[...allTemplates.values()].reduce((a, b) => a + b, 0)} listing files):`)
for (const [name, count] of sortedT) console.log(`  ${count.toString().padStart(4)}  "${name}"`)

// 4. Same for Sales (transaction) files
console.log(`\nScanning all Sales files for unique checklist template names...`)
const salesTemplates = new Map()
for (let page = 1; page <= 80; page++) {
  const url = `${BASE}/api/files/sales?pageNumber=${page}&earliestDate=${earliest}&latestDate=${latest}`
  const r = await skyslopeFetchWithRetry(url, { headers: H(session) })
  if (!r.ok) break
  const body = await r.json()
  const rows = body.value?.sales ?? body.sales ?? []
  if (rows.length === 0) break
  for (const row of rows) {
    const t = row.checklistType ?? '(none)'
    salesTemplates.set(t, (salesTemplates.get(t) ?? 0) + 1)
  }
  if (rows.length < 10) break
}
const sortedS = [...salesTemplates.entries()].sort((a, b) => b[1] - a[1])
console.log(`Sales-side templates in use (across ${[...salesTemplates.values()].reduce((a, b) => a + b, 0)} sale files):`)
for (const [name, count] of sortedS) console.log(`  ${count.toString().padStart(4)}  "${name}"`)
