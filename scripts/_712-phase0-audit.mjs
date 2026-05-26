#!/usr/bin/env node
/**
 * Phase 0 audit — capture 712 SW 1st St folder state pre-fix.
 *
 * - Auth via HMAC + login → Session
 * - GET /api/files/sales/{guid}: capture checklistType + full activity
 *   list + attached docs + folder metadata + parties + agentGuid.
 * - GET /api/files/sales/{guid}/documents: capture every doc with its
 *   docId for cross-reference with checklist assignments.
 * - Dump JSON to tmp/712-phase0/sale-detail.json + documents.json.
 * - Print human-readable summary: checklistType, parties, every
 *   activity with its currently-attached docs (filename + docId).
 *
 * Side-of-representation check: deduces seller-vs-buyer from
 * `sale.agentGuid` + agency forms in the folder.
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO = path.resolve(__dirname, '..')
const BASE = 'https://api-latest.skyslope.com'
const GUID = 'f50fe2a6-226c-4f81-8a59-9fc9a46ea5df'
const OUTDIR = path.join(REPO, 'tmp/712-phase0')

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
  const env = process.env
  const accessKey = env.SKYSLOPE_ACCESS_KEY.trim()
  const accessSecret = env.SKYSLOPE_ACCESS_SECRET.trim()
  const clientId = env.SKYSLOPE_CLIENT_ID.trim()
  const clientSecret = env.SKYSLOPE_CLIENT_SECRET.trim()
  const hmac = crypto
    .createHmac('sha256', accessSecret)
    .update(`${clientId}:${clientSecret}:${ts}`)
    .digest('base64')
  const r = await skyslopeFetchWithRetry(`${BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `ss ${accessKey}:${hmac}`,
      Timestamp: ts,
    },
    body: JSON.stringify({ ClientId: clientId, ClientSecret: clientSecret }),
  })
  if (!r.ok) {
    const txt = await r.text()
    throw new Error(`login HTTP ${r.status}: ${txt.substring(0, 200)}`)
  }
  const body = await r.json()
  return body.Session
}

function apiHeaders(session) {
  return {
    'Content-Type': 'application/json',
    Session: session,
    timestamp: new Date().toISOString(),
    Accept: 'application/json',
  }
}

await loadEnvLocal()
await fs.mkdir(OUTDIR, { recursive: true })

const session = await login()
console.log('✓ Authenticated\n')

const sr = await skyslopeFetchWithRetry(
  `${BASE}/api/files/sales/${GUID}`,
  { headers: apiHeaders(session) },
)
if (!sr.ok) {
  throw new Error(`sale fetch HTTP ${sr.status}`)
}
const saleBody = await sr.json()
await fs.writeFile(
  path.join(OUTDIR, 'sale-detail.json'),
  JSON.stringify(saleBody, null, 2),
)
const sale = saleBody.value?.sale ?? saleBody.value ?? saleBody.sale ?? {}

const dr = await skyslopeFetchWithRetry(
  `${BASE}/api/files/sales/${GUID}/documents`,
  { headers: apiHeaders(session) },
)
if (!dr.ok) throw new Error(`documents fetch HTTP ${dr.status}`)
const docsBody = await dr.json()
await fs.writeFile(
  path.join(OUTDIR, 'documents.json'),
  JSON.stringify(docsBody, null, 2),
)
const documents = docsBody.value?.documents ?? docsBody.documents ?? docsBody.value ?? []

const docById = new Map()
for (const d of documents) {
  const id = (d.docId || d.id || d.documentGuid || '').toLowerCase()
  if (id) docById.set(id, d)
}

const checklist = sale.checklist ?? {}
const activities = checklist.activities ?? []

console.log('═══════════════════════════════════════════════════════════════')
console.log('712 SW 1st St — Phase 0 audit')
console.log('═══════════════════════════════════════════════════════════════')
console.log(`Folder GUID:     ${GUID}`)
console.log(`Property:        ${sale.address ?? sale.streetAddress ?? '(no address)'}`)
console.log(`Status:          ${sale.status ?? '(no status)'}`)
console.log(`Checklist type:  ${sale.checklistType ?? '(none)'}`)
console.log(`Sale price:      ${sale.salePrice ?? '(none)'}`)
console.log(`Close date:      ${sale.closeDate ?? '(none)'}`)
console.log(`Agent GUID:      ${sale.agentGuid ?? '(none)'}`)
console.log(`Created-by GUID: ${sale.createdByGuid ?? '(none)'}`)

const parties = sale.parties ?? sale.contacts ?? []
const sellers = parties.filter((p) => /seller/i.test(p.role || p.partyType || ''))
const buyers = parties.filter((p) => /buyer/i.test(p.role || p.partyType || ''))
console.log(`Sellers:         ${sellers.map((p) => p.fullName || p.name).join(', ') || '(none in API)'}`)
console.log(`Buyers:          ${buyers.map((p) => p.fullName || p.name).join(', ') || '(none in API)'}`)

console.log(`\nDocuments in folder: ${documents.length}`)
console.log(`Activities on checklist: ${activities.length}`)

console.log('\n═══════════════════════════════════════════════════════════════')
console.log('Activity inventory')
console.log('═══════════════════════════════════════════════════════════════')

const byCategory = new Map()
for (const a of activities) {
  const cat = a.typeName || a.activityType || '(uncategorized)'
  if (!byCategory.has(cat)) byCategory.set(cat, [])
  byCategory.get(cat).push(a)
}

const lines = []
for (const [cat, acts] of [...byCategory.entries()].sort()) {
  lines.push(`\n--- ${cat} ---`)
  for (const a of acts) {
    const attached = (a.checklistDocs ?? []).map((cd) => {
      const id = (cd.id || cd.docId || '').toLowerCase()
      const doc = docById.get(id)
      return {
        id,
        fileName: doc?.fileName ?? cd.fileName ?? '(no name)',
      }
    })
    const marker = a.status === 'Required' ? '!' : a.status === 'Optional' ? '?' : '·'
    lines.push(
      `  [${marker} ${a.status}] activityId=${a.activityId} "${a.activityName}"`,
    )
    if (attached.length === 0) {
      lines.push(`      (empty)`)
    } else {
      for (const att of attached) {
        lines.push(`      → ${att.fileName} (${att.id.slice(0, 8)})`)
      }
    }
  }
}
console.log(lines.join('\n'))

// Side-of-representation deduction
console.log('\n═══════════════════════════════════════════════════════════════')
console.log('Side of representation (deduced from in-folder doc set)')
console.log('═══════════════════════════════════════════════════════════════')

const docNames = documents.map((d) => (d.fileName || '').toLowerCase())
const has = (substr) => docNames.some((n) => n.includes(substr))
const signals = []
if (has('disclosed limited agency') && has('seller')) signals.push('signed OREF 040 (DLA Sellers) in folder → SELLER side')
if (has('listing contract') || has('listing agreement')) signals.push('Listing contract present → SELLER side')
if (has('seller') && has('property disclosure')) signals.push('Sellers Property Disclosure present → SELLER side')
if (has('notice of real estate compensation')) signals.push('OREF 091 commission notice present → SELLER side (listing broker issues)')
if (has('buyer representation') || has('buyer rep agreement')) signals.push('Buyer Rep Agreement present → BUYER side')
if (signals.length === 0) signals.push('No agency signals detected in folder')

for (const s of signals) console.log(`  • ${s}`)

const buyerActivityNames = activities
  .filter((a) => /buyer/i.test(a.activityName || ''))
  .map((a) => a.activityName)
const sellerActivityNames = activities
  .filter((a) => /seller|listing|listing agreement/i.test(a.activityName || ''))
  .map((a) => a.activityName)
console.log(`  Buyer-side activities in template:  ${buyerActivityNames.join(', ') || '(none)'}`)
console.log(`  Seller-side activities in template: ${sellerActivityNames.join(', ') || '(none)'}`)

console.log('\n═══════════════════════════════════════════════════════════════')
console.log(`Output: ${path.relative(REPO, OUTDIR)}/sale-detail.json + documents.json`)
console.log('═══════════════════════════════════════════════════════════════')
