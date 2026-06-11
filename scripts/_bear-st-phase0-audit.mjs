#!/usr/bin/env node
/**
 * Phase 0 audit — capture 15352 Bear St folder state pre-fix.
 *
 * Pull GET /api/files/sales/{guid} + /documents to get:
 * - checklistType (template currently assigned)
 * - sale.sellerContact, sale.buyerContact, sale.escrowContact, etc.
 * - sale.agentGuid (resolves to listing broker on a listing folder)
 * - parties + addresses + dates + portalEmail + salePrice
 * - every doc with its docId + filename for cross-ref with checklist
 *
 * The skill: side-of-representation determines template. This folder
 * was confirmed by Matt as "one of our listings" (seller/listing
 * side) AND "rural" — so the template must be a listing/seller-side
 * rural variant. This script captures the current state for the
 * Phase 0 mismatch check.
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
const GUID = '2b9046c3-25aa-4efd-b4b1-bd381d6f2a8d'
const OUTDIR = path.join(REPO, 'tmp/bear-st-phase0')

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

console.log('='.repeat(70))
console.log('15352 BEAR ST - PHASE 0 AUDIT')
console.log('='.repeat(70))
console.log()
console.log('Sale GUID:', GUID)
console.log('Status:', sale.status || sale.transactionStatus || '?')
console.log('Checklist type:', checklist.checklistType || checklist.checklistTypeId || sale.checklistTypeId || '?')
console.log('Checklist type ID:', checklist.checklistTypeId || sale.checklistTypeId || '?')
console.log()
console.log('Property:')
const prop = sale.property || {}
console.log(`  Address: ${prop.streetNumber || ''} ${prop.streetName || ''} ${prop.streetType || ''}`.trim())
console.log(`  City: ${prop.city || '?'}, ${prop.state || '?'} ${prop.zipCode || ''}`)
console.log(`  County: ${prop.county || '?'}`)
console.log(`  MLS#: ${sale.mlsNumber || '?'}`)
console.log()
console.log('Parties:')
const sellers = sale.sellerContact || sale.sellers || []
const buyers = sale.buyerContact || sale.buyers || []
function dumpContacts(arr, label) {
  console.log(`  ${label}:`)
  for (const c of (Array.isArray(arr) ? arr : [arr])) {
    if (!c) continue
    const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.name || c.fullName || c.companyName || '?'
    const email = c.email || ''
    const phone = c.phone || c.phoneNumber || ''
    console.log(`    - ${name}${email ? ` <${email}>` : ''}${phone ? ` (${phone})` : ''}`)
  }
}
dumpContacts(sellers, 'Sellers')
dumpContacts(buyers, 'Buyers')
console.log()
console.log('Listing-side broker GUID (sale.agentGuid):', sale.agentGuid || '?')
console.log('CreatedBy GUID (sale.createdByGuid):', sale.createdByGuid || '?')
console.log()
console.log('Escrow:')
const escrow = sale.escrowContact || sale.escrow || {}
const escrowName = escrow.companyName || escrow.company || '?'
const officer = [escrow.firstName, escrow.lastName].filter(Boolean).join(' ')
console.log(`  Company: ${escrowName}`)
console.log(`  Officer: ${officer || '?'}`)
console.log(`  Email: ${escrow.email || '?'}`)
console.log(`  Escrow#: ${sale.escrowNumber || sale.escrowFile || '?'}`)
console.log()
console.log('Other side agent (sale.otherSideAgentContact):')
const osa = sale.otherSideAgentContact || sale.otherSideAgent || {}
const osaName = [osa.firstName, osa.lastName].filter(Boolean).join(' ') || osa.name || osa.fullName || '?'
console.log(`  Agent: ${osaName}`)
console.log(`  Firm: ${osa.companyName || osa.firmName || osa.firm || '?'}`)
console.log(`  Email: ${osa.email || '?'}`)
console.log()
console.log('Money:')
console.log(`  salePrice: $${sale.salePrice || 0}`)
console.log(`  listPrice: $${sale.listPrice || 0}`)
console.log(`  commission %: ${sale.commission?.saleCommissionPercent ?? sale.commission?.percent ?? '?'}`)
console.log()
console.log('Dates:')
console.log(`  acceptanceDate: ${sale.acceptanceDate || sale.contractDate || '?'}`)
console.log(`  closeDate (target): ${sale.targetCloseDate || sale.closeDate || '?'}`)
console.log(`  actualCloseDate: ${sale.actualCloseDate || '?'}`)
console.log()
console.log('Portal email:', sale.portalEmail || '?')
console.log()
console.log('='.repeat(70))
console.log(`CHECKLIST: ${activities.length} activities`)
console.log('='.repeat(70))
const requiredEmpty = []
const requiredFilled = []
const optional = []
for (const a of activities) {
  const name = a.name || a.activityName || '?'
  const status = a.status || '?'
  const type = a.typeName || a.type || '?'
  const cds = a.checklistDocs || []
  const summary = `  [${status}] ${name} (type: ${type}, docs: ${cds.length})`
  if (status === 'Required' && cds.length === 0) requiredEmpty.push({ name, type, summary, raw: a })
  else if (status === 'Required') requiredFilled.push({ name, type, docs: cds, summary })
  else optional.push({ name, type, summary })
}
console.log()
console.log(`Required + Empty (${requiredEmpty.length}):`)
for (const r of requiredEmpty) console.log(r.summary)
console.log()
console.log(`Required + Filled (${requiredFilled.length}):`)
for (const r of requiredFilled) {
  console.log(r.summary)
  for (const d of r.docs) {
    const docId = (d.id || d.docId || '').toLowerCase()
    const fileName = d.fileName || d.documentName || '?'
    console.log(`    - ${fileName} [docId=${docId}]`)
  }
}
console.log()
console.log(`Optional / In Review / Other (${optional.length}):`)
for (const r of optional) console.log(r.summary)

await fs.writeFile(
  path.join(OUTDIR, 'phase0-summary.json'),
  JSON.stringify(
    {
      saleGuid: GUID,
      status: sale.status,
      checklistType: checklist.checklistType,
      checklistTypeId: checklist.checklistTypeId || sale.checklistTypeId,
      property: prop,
      parties: { sellers, buyers },
      agentGuid: sale.agentGuid,
      createdByGuid: sale.createdByGuid,
      escrow,
      otherSideAgent: osa,
      money: { salePrice: sale.salePrice, listPrice: sale.listPrice },
      portalEmail: sale.portalEmail,
      activities: activities.map((a) => ({
        name: a.name || a.activityName,
        status: a.status,
        typeName: a.typeName,
        activityId: a.id || a.activityId,
        docs: (a.checklistDocs || []).map((d) => ({
          docId: (d.id || d.docId || '').toLowerCase(),
          fileName: d.fileName,
        })),
      })),
      documentsCount: documents.length,
    },
    null,
    2,
  ),
)
console.log()
console.log(`📁 Wrote: ${path.relative(REPO, OUTDIR)}/sale-detail.json + documents.json + phase0-summary.json`)
