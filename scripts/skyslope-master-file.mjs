#!/usr/bin/env node
/**
 * MASTER TRANSACTION FILE generator.
 * Merges tmp/skyslope-master/analysis.json + broker-notes-review.json into a
 * property-centric master record: one entry per PROPERTY, with every SkySlope
 * folder (sale cycles + listing) grouped under it, verified financials,
 * compliance state, document-gap findings, and open flags.
 *
 * Output:
 *   tmp/skyslope-master/master.json                 — machine-readable (dashboard sync source)
 *   tmp/skyslope-master/MASTER_TRANSACTIONS.md      — human-readable master file (draft)
 *
 * Pure local. No API calls. No mutations.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = path.join(REPO, 'tmp/skyslope-master')

const BROKERS = {
  '41c18058': 'Matt Ryan',
  '512ee312': 'Rebecca Peterson',
  '1f5cb058': 'Paul Stevenson',
}

/** Document-completeness findings from the 2026-06-09 audit (this session).
 *  Verified by listing every live doc on the folder and matching against
 *  settlement/EM/title name patterns + checklist activity assignment. */
const DOC_GAPS = {
  '13e20213': [
    { gap: 'No settlement statement (Final HUD/ALTA) in folder', cls: 'retention_gap', fix: 'Pull from Gmail/title co and ingest' },
    { gap: 'No live Earnest Money Receipt for closing cycle (only archived failed-cycle EMRs)', cls: 'retention_gap', fix: 'Pull from escrow/Gmail' },
    { gap: 'No Preliminary Title Report', cls: 'retention_gap', fix: 'Pull from title co/Gmail' },
  ],
  '1f4436e6': [
    { gap: 'No settlement statement (Final HUD/ALTA) in folder', cls: 'retention_gap', fix: 'Pull from Gmail (commission was verified vs certified settlement 2026-05-29 — copy exists outside SkySlope)' },
    { gap: "Unidentified doc 'noname_743'", cls: 'review', fix: 'Open + classify or archive' },
  ],
  a0d269e0: [{ gap: 'No settlement statement (Final HUD/ALTA) in folder', cls: 'retention_gap', fix: 'Pull from Gmail/title co' }],
  e1892930: [{ gap: 'No settlement statement (Final HUD/ALTA) in folder', cls: 'retention_gap', fix: 'Pull from Gmail/title co (091 verified $14,377.50)' }],
  '6ef1013a': [
    { gap: 'No Earnest Money Receipt in folder', cls: 'retention_gap', fix: 'Pull from escrow/Gmail' },
    { gap: "Unidentified doc 'noname_303'", cls: 'review', fix: 'Open + classify or archive' },
  ],
}

/** Process/system observations from this audit. */
const SYSTEM_FINDINGS = [
  'Dead Beaumont folder f9e68a69 (Canceled/Pend) is still receiving uploads — 8 of the 11 docs added to the live Pending folder since 06-04 also landed in the dead folder. Ingest source should be repointed; dead-folder copies need archive treatment.',
  'Simpson Pre-Contract folder b25e525e is a zombie duplicate (deal closed 2026-03-16 in f620aee8) holding 24 docs incl. a Final HUD set. Should be canceled/merged so the pipeline view stays truthful.',
  'Saghali (Canceled/Pend, died 2026-05-31, 100 docs) has Termination Agreement ✓ but no failed-cycle Broker Notes (precedent: Bear St/712/Nordic failed cycles have one).',
  'Beaumont Canceled/Pend (3/31 cycle) has Termination ✓ but no failed-cycle Broker Notes.',
  '122 SW 10th (canceled, Hakkila/Chester) holds RSAs + counters but no termination instrument — verify whether mutual acceptance occurred; if so an OREF 057/release belongs in the folder.',
  "Two junk folders pollute the workspace: '1234 test street' listing + a blank-address sale folder (f261f38e). Candidates for SkySlope archive/deletion.",
  "SkySlope-template noise: 'Transaction Timeline' + 'Skyslope Cover Sheet / Deal Memo' sit Required-open on most files; 712/Bear checklists carry template-surgery artifacts (32/22 Required-open walls). Consider marking these activities Optional in the office template.",
]

const norm = (addr) =>
  (addr || '')
    .toLowerCase()
    .replace(/\b(nw|ne|sw|se|n|s|e|w)\b/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
const propKey = (addr) => {
  const n = norm(addr)
  if (!n) return null
  const parts = n.split(' ')
  return `${parts[0]}-${parts[1] || ''}`
}

const money = (v) => (v == null || v === 0 ? null : Math.round(Number(v) * 100) / 100)
const fmtMoney = (v) => (v == null ? '—' : `$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`)
const d10 = (v) => (v && !String(v).startsWith('0001') ? String(v).slice(0, 10) : null)

const analysis = JSON.parse(await fs.readFile(path.join(ROOT, 'analysis.json'), 'utf8'))
// BN review is a curated audit artifact — lives in the repo (data/), not tmp/,
// so the chain survives tmp cleanups. See memory: always-retain-memory.
const bnReview = JSON.parse(
  await fs.readFile(path.join(REPO, 'data/skyslope-audit/broker-notes-review.json'), 'utf8')
)

const folders = [...analysis.sales, ...analysis.listings]
const props = new Map()
for (const f of folders) {
  const key = propKey(f.fullAddress || f.address) || `guid-${f.guid.slice(0, 8)}`
  if (!props.has(key)) props.set(key, { key, address: f.fullAddress || f.address || '(blank)', folders: [] })
  const p = props.get(key)
  if ((f.fullAddress || '').length > (p.address || '').length) p.address = f.fullAddress
  p.folders.push(f)
}

function folderRecord(f) {
  const det = f
  const guid8 = f.guid.slice(0, 8)
  const bnRegen = bnReview.needsRegeneration.find((x) => x.guid8 === guid8)
  const bnRefresh = bnReview.worthRefreshing.find((x) => x.guid8 === guid8)
  const flags = bnReview.carriedComplianceFlags.filter((x) => x.guid8 === guid8)
  const gaps = DOC_GAPS[guid8] || []
  return {
    kind: f.kind,
    guid: f.guid,
    guid8,
    status: f.status,
    broker: BROKERS[(f.agentGuid || '').slice(0, 8)] || null,
    mlsNumber: f.mlsNumber || null,
    salePrice: money(f.salePrice),
    listingPrice: money(f.listingPrice),
    officeGross: money(f.officeGross),
    commissionPercent: f.commissionPercent,
    escrowNumber: f.escrowNumber && f.escrowNumber !== '0' ? f.escrowNumber : null,
    escrowCompany: f.escrowCompany || null,
    sellers: f.sellers,
    buyers: f.buyers,
    contractAcceptanceDate: d10(f.contractAcceptanceDate),
    escrowClosingDate: d10(f.escrowClosingDate),
    actualClosingDate: d10(f.actualClosingDate),
    expirationDate: d10(f.expirationDate),
    createdOn: d10(f.createdOn),
    deadDate: d10(f.deadDate),
    checklist: f.checklist,
    requiredOpen: null, // filled below from detail re-read
    docs: {
      total: f.docs.total,
      live: f.docs.live,
      archived: f.docs.archived,
      brokerNotes: f.docs.brokerNotesLive.map((b) => b.name),
      unassignedLive: f.docs.unassignedLive.length,
    },
    brokerNotesState: f.docs.brokerNotesLive.length === 0 ? (f.status === 'Closed' ? 'MISSING' : 'none') : bnRegen ? 'needs_regeneration' : bnRefresh ? 'refresh_suggested' : 'ok',
    bnIssues: bnRegen?.reasons || bnRefresh?.reasons || [],
    complianceFlags: flags.map((x) => ({ flag: x.flag, severity: x.severity })),
    docGaps: gaps,
  }
}

// requiredOpen + slim activity list need the full detail
async function activityDetail(f) {
  const det = JSON.parse(await fs.readFile(path.join(ROOT, f.kind, f.guid, 'detail.json'), 'utf8'))
  const slim = (det.checklist?.activities || []).map((a) => ({
    name: a.activityName.trim(),
    status: a.status || null,
    docCount: (a.checklistDocs || []).length,
  }))
  return {
    requiredOpen: slim.filter((a) => a.status === 'Required' && a.docCount === 0).map((a) => a.name),
    activities: slim,
  }
}

const properties = []
for (const p of props.values()) {
  const recs = []
  for (const f of p.folders) {
    const r = folderRecord(f)
    const ad = await activityDetail(f)
    r.requiredOpen = ad.requiredOpen
    r.checklist = { ...r.checklist, activities: ad.activities }
    recs.push(r)
  }
  // order: closed first, then pending/pre-contract, then canceled; listings last
  const rank = (r) =>
    r.kind === 'listings' ? 90 : r.status === 'Closed' ? 0 : r.status === 'Pending' ? 1 : r.status === 'Pre-Contract' ? 2 : 50
  recs.sort((a, b) => rank(a) - rank(b))

  const sales = recs.filter((r) => r.kind === 'sales')
  const listing = recs.find((r) => r.kind === 'listings')
  const closed = sales.find((r) => r.status === 'Closed')
  const pending = sales.find((r) => r.status === 'Pending')
  const preContract = sales.find((r) => r.status === 'Pre-Contract')
  const activeListing = listing && listing.status === 'Active' ? listing : null

  let stage, stageDetail
  if (pending) {
    stage = 'pending'
    stageDetail = `Under contract — closes ${pending.escrowClosingDate || '?'}`
  } else if (activeListing) {
    stage = 'active_listing'
    stageDetail = `On market — listing expires ${activeListing.expirationDate || '?'}`
  } else if (closed) {
    stage = 'closed'
    stageDetail = `Closed ${closed.actualClosingDate || '?'}`
  } else if (preContract) {
    stage = 'pre_contract'
    stageDetail = 'Pre-contract'
  } else {
    stage = 'dead'
    stageDetail = 'All cycles canceled'
  }

  const zombie = preContract && closed ? `Pre-Contract folder ${preContract.guid8} is a zombie duplicate (deal already closed)` : null
  const openFlags = recs.flatMap((r) => r.complianceFlags.map((x) => ({ ...x, guid8: r.guid8 })))
  const openGaps = recs.flatMap((r) => r.docGaps.map((x) => ({ ...x, guid8: r.guid8 })))
  const bnActions = recs.filter((r) => ['needs_regeneration', 'refresh_suggested', 'MISSING'].includes(r.brokerNotesState))

  properties.push({
    key: p.key,
    address: p.address,
    broker: recs.map((r) => r.broker).find(Boolean) || null,
    stage,
    stageDetail,
    zombie,
    headline: closed || pending || activeListing || preContract || recs[0],
    cycles: recs,
    rollup: {
      folderCount: recs.length,
      openFlagCount: openFlags.length,
      docGapCount: openGaps.length,
      bnActionCount: bnActions.length,
      complianceState: openFlags.some((f) => f.severity === 'legal_gap')
        ? 'legal_flag'
        : openGaps.length || openFlags.length || bnActions.length
          ? 'action_needed'
          : 'clean',
    },
  })
}

const stageRank = { pending: 0, active_listing: 1, pre_contract: 2, closed: 3, dead: 4 }
properties.sort(
  (a, b) =>
    stageRank[a.stage] - stageRank[b.stage] ||
    (b.headline.actualClosingDate || b.headline.createdOn || '').localeCompare(a.headline.actualClosingDate || a.headline.createdOn || '')
)

// rollups
const closedSales = properties.flatMap((p) => p.cycles.filter((c) => c.kind === 'sales' && c.status === 'Closed'))
const byYear = {}
for (const c of closedSales) {
  const y = (c.actualClosingDate || '').slice(0, 4) || '?'
  byYear[y] = byYear[y] || { count: 0, volume: 0, gross: 0 }
  byYear[y].count++
  byYear[y].volume += c.salePrice || 0
  byYear[y].gross += c.officeGross || 0
}

const master = {
  generatedAt: new Date().toISOString(),
  source: 'SkySlope Files API full inventory 2026-06-09 (tmp/skyslope-master/) — settlement-verified metadata per HANDOFF_SKYSLOPE_AUDIT_2026-05-29.md',
  brokerMap: BROKERS,
  totals: {
    properties: properties.length,
    saleFolders: analysis.sales.length,
    listingFolders: analysis.listings.length,
    closedDeals: closedSales.length,
    byYear,
  },
  brokerNotesReview: bnReview.totals,
  systemFindings: SYSTEM_FINDINGS,
  properties,
}
await fs.writeFile(path.join(ROOT, 'master.json'), JSON.stringify(master, null, 2))

// ---------- Markdown ----------
const L = []
L.push('# Ryan Realty — Master Transaction File')
L.push('')
L.push(`Generated ${master.generatedAt.slice(0, 10)} from a full SkySlope inventory (${analysis.sales.length} sale folders + ${analysis.listings.length} listing folders, all statuses, all brokers). Metadata previously settlement-verified (2026-05-29 / 06-01 audits). Broker Notes review: ${bnReview.totals.total} notes read — ${bnReview.totals.clean} clean, ${bnReview.totals.minor} minor, ${bnReview.totals.needsCorrection} need regeneration.`)
L.push('')
L.push('## Company rollup')
L.push('')
L.push('| Year | Closed deals | Volume | Office gross |')
L.push('|---|---|---|---|')
for (const y of Object.keys(byYear).sort()) {
  L.push(`| ${y} | ${byYear[y].count} | ${fmtMoney(byYear[y].volume)} | ${fmtMoney(Math.round(byYear[y].gross))} |`)
}
L.push(`| **Total** | **${closedSales.length}** | **${fmtMoney(closedSales.reduce((s, c) => s + (c.salePrice || 0), 0))}** | **${fmtMoney(Math.round(closedSales.reduce((s, c) => s + (c.officeGross || 0), 0)))}** |`)
L.push('')

const stageTitle = {
  pending: '🔶 Under contract (live pipeline)',
  active_listing: '🟢 Active listings',
  pre_contract: '🟡 Pre-contract',
  closed: '✅ Closed transactions',
  dead: '⚫ Canceled / dead files',
}
let lastStage = null
for (const p of properties) {
  if (p.stage !== lastStage) {
    L.push(`\n## ${stageTitle[p.stage]}\n`)
    lastStage = p.stage
  }
  const h = p.headline
  L.push(`### ${p.address}${p.broker ? ` — ${p.broker}` : ''}`)
  L.push('')
  L.push(`- **Stage:** ${p.stageDetail}${p.zombie ? `  ⚠ ${p.zombie}` : ''}`)
  if (h.kind === 'sales') {
    const bits = []
    if (h.salePrice) bits.push(`sale ${fmtMoney(h.salePrice)}`)
    if (h.officeGross) bits.push(`office gross ${fmtMoney(h.officeGross)}`)
    if (h.escrowNumber) bits.push(`escrow ${h.escrowNumber}`)
    if (h.mlsNumber) bits.push(`MLS ${h.mlsNumber}`)
    if (bits.length) L.push(`- **Money:** ${bits.join(' · ')}`)
    if (h.sellers?.length || h.buyers?.length)
      L.push(`- **Parties:** ${h.sellers?.length ? 'sellers ' + h.sellers.join(', ') : ''}${h.sellers?.length && h.buyers?.length ? ' / ' : ''}${h.buyers?.length ? 'buyers ' + h.buyers.join(', ') : ''}`)
  }
  L.push(`- **Folders (${p.cycles.length}):**`)
  for (const c of p.cycles) {
    const bn = c.docs.brokerNotes.length ? `BN ${c.brokerNotesState}` : c.status === 'Closed' ? 'BN MISSING' : 'no BN'
    L.push(
      `  - \`${c.guid8}\` ${c.kind === 'listings' ? 'LISTING' : 'sale'} **${c.status}** — docs ${c.docs.live} live / ${c.docs.archived} archived · checklist ${c.checklist.filledCount}/${c.checklist.activityCount} filled · ${bn}${c.deadDate ? ` · dead ${c.deadDate}` : ''}${c.actualClosingDate ? ` · closed ${c.actualClosingDate}` : ''}`
    )
  }
  const todo = []
  for (const c of p.cycles) {
    for (const g of c.docGaps) todo.push(`[${g.cls}] ${g.gap} → ${g.fix} (${c.guid8})`)
    for (const f of c.complianceFlags) todo.push(`[${f.severity}] ${f.flag} (${c.guid8})`)
    if (c.brokerNotesState === 'needs_regeneration') todo.push(`[bn] Regenerate Broker Notes — ${c.bnIssues[0] || 'stale vs verified metadata'} (${c.guid8})`)
    if (c.brokerNotesState === 'refresh_suggested') todo.push(`[bn] Refresh Broker Notes — ${c.bnIssues[0] || ''} (${c.guid8})`)
    if (c.status === 'Pending' && c.requiredOpen.length) todo.push(`[open] Required items: ${c.requiredOpen.join(', ')} (${c.guid8})`)
    if (c.kind === 'listings' && c.status === 'Active' && c.requiredOpen.length) todo.push(`[open] Required items: ${c.requiredOpen.join(', ')} (${c.guid8})`)
  }
  if (todo.length) {
    L.push(`- **Action items:**`)
    for (const t of todo) L.push(`  - ${t}`)
  } else {
    L.push(`- **Action items:** none — clean ✓`)
  }
  L.push('')
}

L.push('\n## System findings (cross-folder)\n')
for (const s of SYSTEM_FINDINGS) L.push(`- ${s}`)
L.push('')
L.push('## Source + verification trace\n')
L.push('- Inventory: `GET /api/files/sales` + `/api/files/listings` (full 1990–2037 window, archived included), 2026-06-09. Per-folder `detail.json` + `documents.json` snapshots under `tmp/skyslope-master/`.')
L.push('- Financials: SkySlope metadata previously verified against certified title-company settlements + OREF 091/050 (sessions 2026-05-29, 06-01, 06-02 — `docs/HANDOFF_SKYSLOPE_AUDIT_2026-05-29.md`).')
L.push('- Broker Notes: all 25 live BN PDFs downloaded + full-text reviewed 2026-06-09 (`tmp/skyslope-master/broker-notes/`).')
L.push('- This file regenerates via `node scripts/skyslope-master-file.mjs` after `skyslope-master-inventory.mjs` + `skyslope-master-analyze.mjs`.')

await fs.writeFile(path.join(ROOT, 'MASTER_TRANSACTIONS.md'), L.join('\n'))
console.log(`master.json: ${properties.length} properties, ${closedSales.length} closed deals`)
console.log(`MASTER_TRANSACTIONS.md written (${L.length} lines)`)
