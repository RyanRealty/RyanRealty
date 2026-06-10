#!/usr/bin/env node
/**
 * SkySlope MASTER INVENTORY — every folder (sales + listings), all statuses,
 * max date range, all brokers. Read-only: zero mutations.
 *
 * Per folder it pulls:
 *   - detail (sale/listing record incl. checklist activities + assignments)
 *   - documents list
 * and computes a completeness summary row.
 *
 * Output:
 *   tmp/skyslope-master/inventory.json            — summary rows, both kinds
 *   tmp/skyslope-master/sales/<guid>/detail.json
 *   tmp/skyslope-master/sales/<guid>/documents.json
 *   tmp/skyslope-master/listings/<guid>/detail.json
 *   tmp/skyslope-master/listings/<guid>/documents.json
 *
 * Usage: node --env-file=.env.local scripts/skyslope-master-inventory.mjs [--kind=sales|listings|both]
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { skyslopeFetchWithRetry, fetchSkyslopeFileFolderRows } from './skyslope-files-api.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = 'https://api-latest.skyslope.com'
const OUT = path.join(REPO, 'tmp/skyslope-master')
const KIND = (process.argv.find((a) => a.startsWith('--kind=')) || '--kind=both').split('=')[1]

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
    body: JSON.stringify({ ClientId: e.SKYSLOPE_CLIENT_ID.trim(), ClientSecret: e.SKYSLOPE_CLIENT_SECRET.trim() }),
  })
  const j = await r.json()
  if (!j.Session) throw new Error(`login failed: ${JSON.stringify(j).slice(0, 300)}`)
  return j.Session
}

const H = (s) => ({ 'Content-Type': 'application/json', Session: s, timestamp: new Date().toISOString(), Accept: 'application/json' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function g(session, url) {
  const r = await skyslopeFetchWithRetry(url, { headers: H(session) })
  if (!r.ok) return { __error: r.status }
  return r.json()
}

function summarizeChecklist(detail) {
  const activities = (detail?.checklist?.activities || []).map((a) => ({
    activityId: a.activityId,
    activityName: a.activityName,
    required: a.required ?? null,
    assignedDocIds: (a.checklistDocs || []).map((d) => d.id),
  }))
  const required = activities.filter((a) => a.required === true)
  const emptyRequired = required.filter((a) => a.assignedDocIds.length === 0)
  const emptyAll = activities.filter((a) => a.assignedDocIds.length === 0)
  return {
    checklistType: detail?.checklistType ?? null,
    activityCount: activities.length,
    requiredCount: required.length,
    emptyRequired: emptyRequired.map((a) => a.activityName),
    emptyAllCount: emptyAll.length,
    filledCount: activities.length - emptyAll.length,
    activities,
  }
}

function summarizeDocs(docs) {
  const real = docs.filter((d) => d && d.fileSize !== -1)
  const seen = new Set()
  const unique = real.filter((d) => {
    const id = (d.id || d.documentGuid || '').toLowerCase()
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })
  const archived = unique.filter((d) => /^ARCHIVE/i.test(d.fileName || d.name || ''))
  const brokerNotes = unique.filter((d) => /broker.?notes/i.test(d.fileName || d.name || ''))
  return {
    docCountRaw: docs.length,
    docCount: unique.length,
    archivedCount: archived.length,
    liveCount: unique.length - archived.length,
    brokerNotesDocs: brokerNotes.map((d) => ({ id: d.id, name: d.fileName || d.name, uploadDate: d.uploadDate })),
    newestUpload: unique.reduce((m, d) => (d.uploadDate && d.uploadDate > m ? d.uploadDate : m), ''),
  }
}

function partyNames(arr) {
  return (arr || [])
    .map((p) => [p.firstName, p.lastName].filter(Boolean).join(' ').trim())
    .filter(Boolean)
}

async function processKind(session, kind) {
  const detailKey = kind === 'listings' ? 'listing' : 'sale'
  console.log(`\n=== Enumerating ${kind} (all statuses incl. archived) ===`)
  const rows = await fetchSkyslopeFileFolderRows(session, BASE, kind, () => H(session), true)
  console.log(`${kind}: ${rows.length} folders`)
  const out = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const guid = kind === 'listings' ? row.listingGuid : row.saleGuid
    const dir = path.join(OUT, kind, guid)
    await fs.mkdir(dir, { recursive: true })

    const detailJ = await g(session, `${BASE}/api/files/${kind}/${guid}`)
    const detail = detailJ?.value?.[detailKey] ?? { __error: detailJ?.__error }
    const docsJ = await g(session, `${BASE}/api/files/${kind}/${guid}/documents`)
    const docs = docsJ?.value?.documents || []

    await fs.writeFile(path.join(dir, 'detail.json'), JSON.stringify(detail, null, 2))
    await fs.writeFile(path.join(dir, 'documents.json'), JSON.stringify(docs, null, 2))

    const checklist = summarizeChecklist(detail)
    const docsSum = summarizeDocs(docs)
    const summary = {
      kind,
      guid,
      address: detail.propertyAddress || detail.address || row.propertyAddress || row.address || null,
      status: detail.status ?? row.status ?? null,
      archivedRow: row.isArchived === true || row.archived === true || false,
      dealType: detail.dealType ?? null,
      saleType: detail.saleType ?? detail.saleTypeId ?? null,
      agent: detail.agent
        ? [detail.agent.firstName, detail.agent.lastName].filter(Boolean).join(' ')
        : row.agentName || null,
      sellers: partyNames(detail.sellers),
      buyers: partyNames(detail.buyers),
      salePrice: detail.salePrice ?? null,
      listingPrice: detail.listingPrice ?? null,
      closeDate: detail.closeDate ?? null,
      acceptanceDate: detail.acceptanceDate ?? detail.contractDate ?? null,
      expirationDate: detail.expirationDate ?? null,
      listingDate: detail.listingDate ?? null,
      escrowNumber: detail.escrowNumber ?? null,
      mlsNumber: detail.mlsNumber ?? detail.mlsNum ?? null,
      commissionPercent: detail.commission?.saleCommissionPercent ?? null,
      officeGross: detail.commission?.officeGrossCommissionOnSale ?? null,
      portalEmail: detail.portalEmail ?? null,
      linkedListingGuid: detail.listingGuid ?? null,
      createdDate: detail.createdDate ?? row.createdDate ?? null,
      modifiedDate: detail.modifiedDate ?? row.modifiedDate ?? null,
      checklist: { ...checklist, activities: undefined },
      docs: docsSum,
    }
    out.push(summary)
    console.log(
      `  [${i + 1}/${rows.length}] ${String(summary.address || guid).slice(0, 48).padEnd(48)} status=${String(summary.status).padEnd(10)} docs=${docsSum.docCount} (live ${docsSum.liveCount}/arch ${docsSum.archivedCount}) checklist ${checklist.filledCount}/${checklist.activityCount}${checklist.emptyRequired.length ? ' EMPTY-REQ:' + checklist.emptyRequired.length : ''} BN=${docsSum.brokerNotesDocs.length}`
    )
    await sleep(200)
  }
  return out
}

async function main() {
  await fs.mkdir(OUT, { recursive: true })
  const session = await login()
  const inventory = { fetchedAt: new Date().toISOString(), sales: [], listings: [] }
  if (KIND === 'sales' || KIND === 'both') inventory.sales = await processKind(session, 'sales')
  if (KIND === 'listings' || KIND === 'both') inventory.listings = await processKind(session, 'listings')
  await fs.writeFile(path.join(OUT, 'inventory.json'), JSON.stringify(inventory, null, 2))
  console.log(`\nWrote ${path.join(OUT, 'inventory.json')}`)
  console.log(`Sales: ${inventory.sales.length} | Listings: ${inventory.listings.length}`)
}

main().catch((e) => {
  console.error('Fatal:', e?.message || e)
  process.exit(1)
})
