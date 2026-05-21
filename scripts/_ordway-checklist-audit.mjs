#!/usr/bin/env node
/**
 * Audit the Ordway sale folder's checklist:
 *  - Pull all activities + their currently-attached docs
 *  - Map each attached doc to its CURRENT v5 name (post-rename)
 *  - Flag activities where:
 *      (a) the attached doc is now ARCHIVE-tagged (should unassign)
 *      (b) the attached doc is for a non-closing sale# (should swap)
 *      (c) the activity is Required and has 0 attached docs (gap)
 *  - Recommend reassignment to the right MR05072025 MAIN doc
 *
 * Read-only — produces tmp/skyslope-pdfs/<guid>/checklist-audit.json
 * and checklist-audit.md. No mutations.
 *
 * Usage: node --env-file=.env.local scripts/_ordway-checklist-audit.mjs
 */
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import { skyslopeFetchWithRetry } from './skyslope-files-api.mjs'

const BASE = 'https://api-latest.skyslope.com'
const FOLDER = 'f88642ff-22e6-4618-b9e1-40b168a439e1'
const KIND = 'sales'
const CLOSING_SALE = 'MR05072025'

async function login() {
  const ts = new Date().toISOString()
  const env = process.env
  const hmac = crypto
    .createHmac('sha256', env.SKYSLOPE_ACCESS_SECRET.trim())
    .update(`${env.SKYSLOPE_CLIENT_ID.trim()}:${env.SKYSLOPE_CLIENT_SECRET.trim()}:${ts}`)
    .digest('base64')
  const r = await skyslopeFetchWithRetry(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `ss ${env.SKYSLOPE_ACCESS_KEY.trim()}:${hmac}`, Timestamp: ts },
    body: JSON.stringify({ ClientId: env.SKYSLOPE_CLIENT_ID.trim(), ClientSecret: env.SKYSLOPE_CLIENT_SECRET.trim() }),
  })
  return (await r.json()).Session
}
function apiHeaders(session) {
  return { 'Content-Type': 'application/json', Session: session, timestamp: new Date().toISOString(), Accept: 'application/json' }
}

const session = await login()

// Pull folder detail with checklist
const detailRes = await skyslopeFetchWithRetry(
  `${BASE}/api/files/${KIND}/${FOLDER}`,
  { headers: apiHeaders(session) }
)
const detail = (await detailRes.json())?.value?.sale
const activities = detail?.checklist?.activities || []
console.log(`Folder has ${activities.length} checklist activities`)

// Pull live docs (post-rename — so fileName reflects v5 names)
const docsRes = await skyslopeFetchWithRetry(
  `${BASE}/api/files/${KIND}/${FOLDER}/documents`,
  { headers: apiHeaders(session) }
)
const allDocs = (await docsRes.json())?.value?.documents || []
const docById = new Map()
for (const d of allDocs) {
  if (d && d.docId) docById.set(d.docId, d)
}
console.log(`Folder has ${allDocs.length} docs`)

// Classify each doc by disposition
function disposition(filename) {
  if (!filename) return 'unknown'
  if (filename.startsWith('ARCHIVE - ')) return 'ARCHIVE'
  return 'MAIN'
}
function extractSaleNumber(filename) {
  const m = String(filename || '').match(/MR\d{8}/)
  return m ? m[0] : null
}
function isClosingSale(filename) {
  return extractSaleNumber(filename) === CLOSING_SALE
}

const audit = {
  folderGuid: FOLDER,
  closingSaleNumber: CLOSING_SALE,
  totalActivities: activities.length,
  activities: [],
}

for (const a of activities) {
  const aRec = {
    activityId: a.activityId,
    activityName: a.activityName,
    typeName: a.typeName,
    status: a.status,                       // 'Required' | 'Optional' | etc.
    attachedDocs: [],
    flags: [],
    recommendation: null,
  }
  for (const cd of a.checklistDocs || []) {
    const live = docById.get(cd.id) || {}
    const fn = live.fileName || cd.fileName
    aRec.attachedDocs.push({
      docId: cd.id,
      fileName: fn,
      disposition: disposition(fn),
      saleNumber: extractSaleNumber(fn),
      isClosingSale: isClosingSale(fn),
    })
  }

  // Flag analysis
  const archived = aRec.attachedDocs.filter((d) => d.disposition === 'ARCHIVE')
  const wrongSale = aRec.attachedDocs.filter(
    (d) => d.disposition === 'MAIN' && d.saleNumber && d.saleNumber !== CLOSING_SALE
  )
  const mainClosing = aRec.attachedDocs.filter((d) => d.disposition === 'MAIN' && d.isClosingSale)

  if (archived.length > 0) aRec.flags.push(`${archived.length}_attached_now_ARCHIVE`)
  if (wrongSale.length > 0) aRec.flags.push(`${wrongSale.length}_attached_for_non_closing_sale`)
  if (aRec.status === 'Required' && aRec.attachedDocs.length === 0) aRec.flags.push('required_but_empty')
  if (aRec.status === 'Required' && mainClosing.length === 0 && (archived.length > 0 || wrongSale.length > 0)) {
    aRec.flags.push('no_valid_closing_sale_doc_attached')
  }

  audit.activities.push(aRec)
}

// Summary
const flagged = audit.activities.filter((a) => a.flags.length > 0)
const requiredEmpty = audit.activities.filter((a) => a.status === 'Required' && a.attachedDocs.length === 0)
const wrongSaleAttached = audit.activities.filter((a) => a.flags.includes('1_attached_for_non_closing_sale') || a.flags.includes('2_attached_for_non_closing_sale'))
const archivedAttached = audit.activities.filter((a) => a.flags.some((f) => f.endsWith('attached_now_ARCHIVE')))

let md = `# Ordway checklist audit (post-rename)\n\n`
md += `**Folder:** ${FOLDER}\n`
md += `**Closing sale#:** ${CLOSING_SALE}\n`
md += `**Activities:** ${audit.totalActivities}\n\n`
md += `**Flag counts:**\n`
md += `- Required + 0 docs attached:    ${requiredEmpty.length}\n`
md += `- Attached doc now ARCHIVE:       ${archivedAttached.length}\n`
md += `- Attached for non-closing sale#: ${wrongSaleAttached.length}\n\n`

md += `## Activities flagged (${flagged.length})\n\n`
for (const a of flagged) {
  md += `### ${a.activityName}  _(${a.typeName} · ${a.status})_\n`
  md += `- **activityId:** ${a.activityId}\n`
  md += `- **Flags:** ${a.flags.join(', ')}\n`
  if (a.attachedDocs.length) {
    md += `- **Attached docs:**\n`
    for (const d of a.attachedDocs) {
      const tag = d.disposition === 'ARCHIVE' ? '🗄️ ARCHIVE' : (d.isClosingSale ? '✅ MAIN closing' : '⚠️ MAIN wrong-sale#')
      md += `  - ${tag} \`${d.fileName}\`\n`
    }
  } else {
    md += `- **Attached docs:** (none)\n`
  }
  md += `\n`
}

md += `## Activities OK (${audit.totalActivities - flagged.length})\n\n`
for (const a of audit.activities.filter((a) => a.flags.length === 0)) {
  md += `- ${a.activityName} · ${a.status}`
  if (a.attachedDocs.length) {
    md += ` · ${a.attachedDocs.length} doc(s) attached`
  } else {
    md += ` · empty (optional)`
  }
  md += `\n`
}

const OUT_MD = `tmp/skyslope-pdfs/${FOLDER}/checklist-audit.md`
const OUT_JSON = `tmp/skyslope-pdfs/${FOLDER}/checklist-audit.json`
await fs.writeFile(OUT_MD, md)
await fs.writeFile(OUT_JSON, JSON.stringify(audit, null, 2))
console.log(`\nWrote ${OUT_MD}`)
console.log(`Wrote ${OUT_JSON}`)
console.log(`\nFlagged activities: ${flagged.length}/${audit.totalActivities}`)
console.log(`  Required + empty:           ${requiredEmpty.length}`)
console.log(`  Attached doc now ARCHIVE:    ${archivedAttached.length}`)
console.log(`  Attached for wrong sale#:    ${wrongSaleAttached.length}`)
