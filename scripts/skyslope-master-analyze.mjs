#!/usr/bin/env node
/**
 * Analyze the saved SkySlope master inventory (tmp/skyslope-master/) and build
 * the corrected per-deal records used for: completeness audit, broker-notes
 * review, master file, dashboard sync. Pure local read of detail.json +
 * documents.json — no API calls.
 *
 * Output: tmp/skyslope-master/analysis.json + console report.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = path.join(REPO, 'tmp/skyslope-master')
const LAST_FULL_PASS = '2026-06-02T23:59:59Z' // work-set re-run completion date

const partyNames = (arr) =>
  (arr || []).map((p) => [p.firstName, p.lastName].filter(Boolean).join(' ').trim()).filter(Boolean)

function summarize(kind, guid, detail, docs) {
  const detailOk = detail && !detail.__error
  const acts = (detail?.checklist?.activities || []).map((a) => ({
    order: a.order,
    activityId: a.activityId,
    activityName: a.activityName,
    typeName: a.typeName,
    status: a.status || null,
    docCount: (a.checklistDocs || []).length,
    docNames: (a.checklistDocs || []).map((d) => d.name),
  }))
  const statusHist = acts.reduce((h, a) => ((h[a.status || 'null'] = (h[a.status || 'null'] || 0) + 1), h), {})
  const emptyActs = acts.filter((a) => a.docCount === 0).map((a) => a.activityName)
  const filled = acts.filter((a) => a.docCount > 0)

  const seen = new Set()
  const unique = (docs || []).filter((d) => {
    if (!d || d.fileSize === -1) return false
    const id = (d.id || d.documentGuid || '').toLowerCase()
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })
  const named = (d) => d.fileName || d.name || ''
  const archived = unique.filter((d) => /^ARCHIVE/i.test(named(d)))
  const live = unique.filter((d) => !/^ARCHIVE/i.test(named(d)))
  const bnLive = live.filter((d) => /broker.?notes/i.test(named(d)))
  const bnArchived = archived.filter((d) => /broker.?notes/i.test(named(d)))
  const newDocs = unique.filter((d) => (d.uploadDate || '') > LAST_FULL_PASS)

  const assignedIds = new Set()
  for (const a of detail?.checklist?.activities || [])
    for (const cd of a.checklistDocs || []) assignedIds.add((cd.id || '').toLowerCase())
  const unassignedLive = live.filter((d) => !assignedIds.has((d.id || '').toLowerCase()))

  return {
    kind,
    guid,
    ok: detailOk,
    address: detail?.propertyAddress || detail?.property?.streetAddress
      ? `${detail?.property?.streetNumber ?? ''} ${detail?.property?.streetAddress ?? detail?.propertyAddress ?? ''}`.trim()
      : detail?.propertyAddress || null,
    fullAddress: detail?.property
      ? [
          [detail.property.streetNumber, detail.property.streetDirection, detail.property.streetAddress]
            .filter(Boolean)
            .join(' '),
          detail.property.city,
          detail.property.state,
          detail.property.zip,
        ]
          .filter(Boolean)
          .join(', ')
      : null,
    status: detail?.status ?? null,
    stage: detail?.stage ?? null,
    dealType: detail?.dealType ?? null,
    saleTypeId: detail?.saleTypeId ?? null,
    checklistType: detail?.checklistType ?? null,
    mlsNumber: detail?.mlsNumber ?? null,
    escrowNumber: detail?.escrowNumber ?? null,
    listingPrice: detail?.listingPrice ?? null,
    salePrice: detail?.salePrice ?? null,
    contractAcceptanceDate: detail?.contractAcceptanceDate ?? null,
    escrowClosingDate: detail?.escrowClosingDate ?? null,
    actualClosingDate: detail?.actualClosingDate ?? null,
    listingDate: detail?.listingDate ?? null,
    expirationDate: detail?.expirationDate ?? null,
    createdOn: detail?.createdOn ?? null,
    checklistModifiedOn: detail?.checklistModifiedOn ?? null,
    deadDate: detail?.deadDate ?? null,
    portalEmail: detail?.portalEmail ?? null,
    linkedListingGuid: detail?.listingGuid ?? null,
    agentGuid: detail?.agentGuid ?? null,
    sellers: partyNames(detail?.sellers),
    buyers: partyNames(detail?.buyers),
    commissionPercent: detail?.commission?.saleCommissionPercent ?? null,
    officeGross: detail?.commission?.officeGrossCommissionOnSale ?? null,
    earnestMoney: detail?.earnestMoneyDeposit ?? null,
    escrowCompany: detail?.escrowContact?.company ?? null,
    checklist: {
      activityCount: acts.length,
      filledCount: filled.length,
      emptyCount: emptyActs.length,
      statusHist,
      emptyActivities: emptyActs,
    },
    docs: {
      total: unique.length,
      live: live.length,
      archived: archived.length,
      brokerNotesLive: bnLive.map((d) => ({ id: d.id, name: named(d), uploadDate: d.uploadDate })),
      brokerNotesArchived: bnArchived.length,
      newSinceLastPass: newDocs.map((d) => ({ id: d.id, name: named(d), uploadDate: d.uploadDate })),
      unassignedLive: unassignedLive.map((d) => ({ id: d.id, name: named(d), uploadDate: d.uploadDate })),
      newestUpload: unique.reduce((m, d) => ((d.uploadDate || '') > m ? d.uploadDate : m), ''),
    },
  }
}

async function loadKind(kind) {
  const dir = path.join(ROOT, kind)
  let guids = []
  try {
    guids = (await fs.readdir(dir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name)
  } catch {
    return []
  }
  const out = []
  for (const guid of guids) {
    const detail = JSON.parse(await fs.readFile(path.join(dir, guid, 'detail.json'), 'utf8'))
    const docs = JSON.parse(await fs.readFile(path.join(dir, guid, 'documents.json'), 'utf8'))
    out.push(summarize(kind, guid, detail, docs))
  }
  return out
}

const sales = await loadKind('sales')
const listings = await loadKind('listings')
const analysis = { analyzedAt: new Date().toISOString(), lastFullPass: LAST_FULL_PASS, sales, listings }
await fs.writeFile(path.join(ROOT, 'analysis.json'), JSON.stringify(analysis, null, 2))

// ---- console report ----
const fmt = (v) => (v == null ? '—' : String(v))
const money = (v) => (v == null || v === 0 ? '—' : `$${Number(v).toLocaleString()}`)

console.log('=== CLOSED SALES (compliance state) ===')
for (const s of sales.filter((x) => x.status === 'Closed').sort((a, b) => (a.actualClosingDate || '').localeCompare(b.actualClosingDate || ''))) {
  const flags = []
  if (s.docs.newSinceLastPass.length) flags.push(`NEW-DOCS:${s.docs.newSinceLastPass.length}`)
  if (s.docs.unassignedLive.length) flags.push(`UNASSIGNED:${s.docs.unassignedLive.length}`)
  if (s.docs.brokerNotesLive.length === 0) flags.push('NO-BROKER-NOTES')
  if (s.docs.brokerNotesLive.length > 1) flags.push(`MULTI-BN:${s.docs.brokerNotesLive.length}`)
  if (!s.escrowNumber || s.escrowNumber === '0') flags.push('NO-ESCROW#')
  if (!s.salePrice) flags.push('NO-PRICE')
  if (!s.officeGross) flags.push('NO-COMMISSION')
  console.log(
    `${fmt(s.fullAddress || s.address).slice(0, 44).padEnd(44)} closed=${fmt(s.actualClosingDate).slice(0, 10)} ${money(s.salePrice).padStart(12)} gross=${money(s.officeGross).padStart(10)} ${flags.length ? '⚠ ' + flags.join(' | ') : '✓ clean'}`
  )
}

console.log('\n=== NON-CLOSED SALES (pipeline + canceled) ===')
for (const s of sales.filter((x) => x.status !== 'Closed').sort((a, b) => (a.status || '').localeCompare(b.status || ''))) {
  console.log(
    `${fmt(s.status).padEnd(14)} ${fmt(s.fullAddress || s.address).slice(0, 44).padEnd(44)} docs=${s.docs.total} (live ${s.docs.live}) checklist ${s.checklist.filledCount}/${s.checklist.activityCount} created=${fmt(s.createdOn).slice(0, 10)} dead=${fmt(s.deadDate).slice(0, 10)}`
  )
}

console.log('\n=== LISTINGS ===')
for (const l of listings.sort((a, b) => (a.status || '').localeCompare(b.status || ''))) {
  console.log(
    `${fmt(l.status).padEnd(14)} ${fmt(l.fullAddress || l.address).slice(0, 44).padEnd(44)} docs=${l.docs.total} checklist ${l.checklist.filledCount}/${l.checklist.activityCount} expires=${fmt(l.expirationDate).slice(0, 10)}`
  )
}

const newDocsTotal = sales.reduce((n, s) => n + s.docs.newSinceLastPass.length, 0)
console.log(`\nDocs uploaded after ${LAST_FULL_PASS.slice(0, 10)} across all sales: ${newDocsTotal}`)
console.log(`Analysis: ${path.join(ROOT, 'analysis.json')}`)
