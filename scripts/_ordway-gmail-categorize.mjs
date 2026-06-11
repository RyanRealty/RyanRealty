#!/usr/bin/env node
/**
 * Triage gmail-triage findings into actionable buckets:
 *   - P1 CRITICAL: closing docs / signed mutual instruments / legal records
 *     that a compliance auditor would absolutely expect in the folder
 *   - P2 INVESTIGATE: unknowns that could be the seller-signed RSA we were
 *     hunting for (scanner-named files, "contingency removal w/o financing",
 *     "Property_Disclosures__2_") — needs visual inspection
 *   - P3 SUPPORTING: invoices, photos, HOA docs supplied during OREF 024
 *     fulfillment, repair-cycle backup
 *   - P4 NOISE: drafts, unsigned copies of forms we already have signed
 *     versions of
 */
import fs from 'node:fs/promises'

const FOLDER = 'f88642ff-22e6-4618-b9e1-40b168a439e1'
const HUNT = JSON.parse(await fs.readFile(`tmp/skyslope-pdfs/${FOLDER}/gmail-hunt.json`, 'utf8'))

// Flatten attachments
const all = []
for (const t of HUNT.threadsWithAttachments) {
  for (const a of t.attachments) {
    all.push({ ...a, threadId: t.threadId, subject: t.subject, date: t.date, threadFrom: t.from, layers: t.layers })
  }
}
// Dedup
const seen = new Set()
const dedup = []
for (const a of all) {
  const k = `${a.inbox}|${a.msgId}|${a.filename}`
  if (seen.has(k)) continue
  seen.add(k)
  dedup.push(a)
}

// Filter to non-images + non-wrong-escrow
const NOISY = /(image\d{3}|Outlook\s-|HomesLockup)/i
const WRONG_ESCROW = /WT0(?!274211)\d+/
const NON_ORDWAY = /(3235 NW Cedar|Cedar Ave|2129 SW 35th|20702 Beaumont|2680 Nordic|Halpin|Crowson|Kwinnum)/i
const interesting = dedup.filter((a) => {
  if (NOISY.test(a.filename)) return false
  if (/\.(png|jpg|jpeg|gif|tif|tiff)$/i.test(a.filename)) return false
  const s = a.subject || ''
  if (WRONG_ESCROW.test(s) || NON_ORDWAY.test(s)) return false
  return true
})

// Categorize
const buckets = { P1_CRITICAL: [], P2_INVESTIGATE: [], P3_SUPPORTING: [], P4_NOISE: [] }

const CRITICAL_FN = [
  /^Deed/i,                     // recorded deed
  /preliminary report/i,        // prelim title report
  /BuyerBorrower.*signed/i,     // SIGNED buyer/borrower statement
  /Wire Transfer Receipt/i,     // wire transfer for closing
  /DPOA/i,                      // power of attorney
  /Notice.of.Real.Estate.Compensation/i,
  /Final.*Statement/i,
  /Recorded/i,
]
const INVESTIGATE_FN = [
  /^SKM_C\d+i\d+\.pdf$/i,                  // scanner output - unknown content
  /Contingency_Removal_Addendum/i,          // possible seller-signed copies
  /Sellers_Repair_Addendum/i,
  /Buyers.Repair.Addendum/i,
  /Property_Disclosures__\d+_/i,            // numbered SPD = revised version
  /Owner_Association_Addendum/i,            // OAA variants
  /revision of ratified/i,
  /Ratified|Fully.Executed/i,
]
const SUPPORTING_FN = [
  /Invoice/i, /Estimate/i, /\.heic$/i, /\.mov$/i, /\.zip$/i,
  /Budget/i, /Balance Sheet/i, /Meeting Minutes/i, /Comfort Club/i,
  /HVAC/i, /heating/i, /gutters/i, /Mitigation/i,
  /HOA additional/i, /Repair Request/i, /Approved Budget/i,
  /Wire Fraud Scam Alert Flyer/i, // safety advisory not transaction record
  /Letter.*Confirmation.*Order/i,
  /Escrow Process/i, /INSTRUCTIONS FOR DEPOSITING/i,
  /Vesting Information/i, /WireSafe/i,
  /Area Guide Video/i, /Neighborhoods/i, /Subdivisions/i, /Timeline/i,
  /Ordway Down Spout/i, /dryer vent/i, /OrdwayAve_PreApproval/i,
]

for (const a of interesting) {
  const fn = a.filename
  if (CRITICAL_FN.some((r) => r.test(fn))) {
    buckets.P1_CRITICAL.push(a)
  } else if (INVESTIGATE_FN.some((r) => r.test(fn))) {
    buckets.P2_INVESTIGATE.push(a)
  } else if (SUPPORTING_FN.some((r) => r.test(fn))) {
    buckets.P3_SUPPORTING.push(a)
  } else {
    buckets.P4_NOISE.push(a)
  }
}

// Within each bucket, dedupe by filename + size (cross-inbox copies)
function dedupByFilenameSize(arr) {
  const m = new Map()
  for (const a of arr) {
    const k = `${a.filename}|${a.size}`
    if (!m.has(k)) m.set(k, { ...a, copies: [] })
    m.get(k).copies.push({ inbox: a.inbox, msgId: a.msgId, date: a.date, from: a.threadFrom, subject: a.subject, layers: a.layers })
  }
  return [...m.values()].sort((x, y) => String(x.date).localeCompare(String(y.date)))
}

const dedupBuckets = {
  P1_CRITICAL: dedupByFilenameSize(buckets.P1_CRITICAL),
  P2_INVESTIGATE: dedupByFilenameSize(buckets.P2_INVESTIGATE),
  P3_SUPPORTING: dedupByFilenameSize(buckets.P3_SUPPORTING),
  P4_NOISE: dedupByFilenameSize(buckets.P4_NOISE),
}

let md = `# Ordway Gmail finds — by priority bucket\n\n`
md += `**Source:** gmail-hunt.json (3 broker inboxes, 5/4–6/16 window)\n\n`
md += `**Bucket counts (deduped by filename+size):**\n`
md += `- P1 CRITICAL: ${dedupBuckets.P1_CRITICAL.length}\n`
md += `- P2 INVESTIGATE: ${dedupBuckets.P2_INVESTIGATE.length}\n`
md += `- P3 SUPPORTING: ${dedupBuckets.P3_SUPPORTING.length}\n`
md += `- P4 NOISE: ${dedupBuckets.P4_NOISE.length}\n\n`

for (const bucket of ['P1_CRITICAL', 'P2_INVESTIGATE', 'P3_SUPPORTING', 'P4_NOISE']) {
  md += `## ${bucket.replace('_', ' — ')} (${dedupBuckets[bucket].length})\n\n`
  for (const a of dedupBuckets[bucket]) {
    md += `### \`${a.filename}\` _(${a.size}b)_\n`
    md += `- **Date:** ${a.date}\n`
    md += `- **From:** ${a.threadFrom || a.from}\n`
    md += `- **Subject:** ${a.subject}\n`
    md += `- **Copies (inbox · msg):** ${a.copies.map((c) => `${c.inbox.split('@')[0]}:${c.msgId.slice(-6)}`).join(', ')}\n`
    md += `- **Forward target:**  (TBD per Matt — pending review)\n\n`
  }
}

const OUT = `tmp/skyslope-pdfs/${FOLDER}/gmail-categorized.md`
await fs.writeFile(OUT, md)

// Also write a JSON catalog for downstream use
const catalogPath = `tmp/skyslope-pdfs/${FOLDER}/gmail-catalog.json`
await fs.writeFile(catalogPath, JSON.stringify(dedupBuckets, null, 2))

console.log(`Wrote ${OUT}`)
console.log(`Wrote ${catalogPath}`)
console.log(`\nBucket counts (unique by filename+size):`)
for (const b of ['P1_CRITICAL', 'P2_INVESTIGATE', 'P3_SUPPORTING', 'P4_NOISE']) {
  console.log(`  ${b}: ${dedupBuckets[b].length}`)
}
