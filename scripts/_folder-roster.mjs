#!/usr/bin/env node
/**
 * Full SkySlope folder roster — sales + listings. Cross-references
 * against tmp/skyslope-pdfs/ to identify which have been through the
 * skyslope-form-compliance pipeline vs which are pending.
 *
 * Output: markdown table per kind, suitable for Matt's review.
 *
 * Usage: node --env-file=.env.local scripts/_folder-roster.mjs
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const BASE = 'https://api-latest.skyslope.com'

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

async function listAll(kind, session) {
  const ts0 = Math.floor(Date.UTC(2018, 0, 1) / 1000)
  const ts1 = Math.floor(Date.UTC(2030, 0, 1) / 1000)
  const all = []
  for (let page = 1; page <= 100; page++) {
    const u = `${BASE}/api/files/${kind}?pageNumber=${page}&earliestDate=${ts0}&latestDate=${ts1}`
    const r = await skyslopeFetchWithRetry(u, { headers: apiHeaders(session) })
    if (!r.ok) break
    const body = await r.json()
    const rows = body.value?.[kind] || []
    if (rows.length === 0) break
    all.push(...rows)
    if (rows.length < 10) break
  }
  return all
}

const session = await login()

// Local audit artifacts
const localAudits = await fs.readdir('tmp/skyslope-pdfs/').catch(() => [])
const auditedSet = new Set(localAudits)

const sales = await listAll('sales', session)
const listings = await listAll('listings', session)

console.log(`# SkySlope folder roster\n`)
console.log(`Pulled ${new Date().toISOString()} via /api/files/{sales,listings}.\n`)
console.log(`**Sales folders:** ${sales.length}`)
console.log(`**Listing folders:** ${listings.length}`)
console.log(`**Local audit artifacts (tmp/skyslope-pdfs/):** ${auditedSet.size}\n`)

// Sales table
console.log(`## Sales folders (${sales.length})\n`)
console.log(`| Status | Address | saleGuid (short) | Closing | Local audit |\n|---|---|---|---|---|`)
const statusOrder = { 'Pending': 0, 'Active': 1, 'Pre-Contract': 2, 'Incomplete': 3, 'Closed': 4, 'Canceled/App': 5 }
sales.sort((a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99) || (a.propertyAddress || '').localeCompare(b.propertyAddress || ''))
for (const s of sales) {
  const audited = auditedSet.has(s.saleGuid) ? '✓ full audit' : '—'
  const short = s.saleGuid.slice(0, 8)
  const close = s.escrowClosingDate ? s.escrowClosingDate.slice(0, 10) : '—'
  console.log(`| ${s.status} | ${s.propertyAddress || '(blank)'} | \`${short}\` | ${close} | ${audited} |`)
}

console.log(`\n## Listings folders (${listings.length})\n`)
console.log(`| Status | Address | listingGuid (short) | Local audit |\n|---|---|---|---|`)
listings.sort((a, b) => (a.listingStatus || '').localeCompare(b.listingStatus || '') || (a.propertyAddress || '').localeCompare(b.propertyAddress || ''))
for (const l of listings) {
  const guid = l.listingGuid || l.id
  const audited = auditedSet.has(guid) ? '✓ full audit' : '—'
  const short = (guid || '').slice(0, 8)
  console.log(`| ${l.listingStatus || l.status || '?'} | ${l.propertyAddress || '(blank)'} | \`${short}\` | ${audited} |`)
}

console.log(`\n---\n\n## Locally audited (full skyslope-form-compliance pass)\n`)
for (const guid of auditedSet) {
  console.log(`- \`${guid}\``)
}
