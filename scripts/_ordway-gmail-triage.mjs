#!/usr/bin/env node
/**
 * Triage gmail-hunt.json output for Ordway:
 *   - Build a flat list of every attachment found in any inbox/layer
 *   - Compare against the 37 docs in the SkySlope folder
 *   - Surface any PDF/email-only attachment we don't already have
 *   - Output a markdown summary
 */
import fs from 'node:fs/promises'

const FOLDER = 'f88642ff-22e6-4618-b9e1-40b168a439e1'
const HUNT_PATH = `tmp/skyslope-pdfs/${FOLDER}/gmail-hunt.json`
const MANIFEST_PATH = `tmp/skyslope-pdfs/${FOLDER}/manifest.json`
const OUT_PATH = `tmp/skyslope-pdfs/${FOLDER}/gmail-triage.md`

const hunt = JSON.parse(await fs.readFile(HUNT_PATH, 'utf8'))
const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8'))

// Build the SkySlope-side set: normalize filename -> set
function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/_x\.pdf$/, '.pdf')
    .replace(/[^a-z0-9.]/g, '')
}

const skyslopeSet = new Set(manifest.documents.map((d) => norm(d.fileName)))
const skyslopeNames = manifest.documents.map((d) => d.fileName)

// Walk all unique threads, flatten attachments
const attachmentsAcrossInboxes = []
for (const tid in [...new Set(hunt.threadsWithAttachments.map((t) => t.threadId))]) {}
for (const t of hunt.threadsWithAttachments) {
  for (const a of t.attachments) {
    attachmentsAcrossInboxes.push({
      threadId: t.threadId,
      subject: t.subject,
      from: t.from,
      date: t.date,
      filename: a.filename,
      mimeType: a.mimeType,
      size: a.size,
      inbox: a.inbox,
      msgId: a.msgId,
      attachmentId: a.attachmentId,
      layers: t.layers,
    })
  }
}

// Dedup attachments by (inbox, msgId, filename) since one msg can show up in
// multiple layers
const seen = new Set()
const dedupedAttachments = []
for (const a of attachmentsAcrossInboxes) {
  const k = `${a.inbox}|${a.msgId}|${a.filename}`
  if (seen.has(k)) continue
  seen.add(k)
  dedupedAttachments.push(a)
}

// Filter to interesting ones (PDFs, signed forms, etc.) — drop image/png and
// the email-signature artifacts we already know are noise
const NOISY = /(image\d{3}|Outlook\s-|HomesLockup)/i
// Drop hits where the subject references a different escrow# or property
// (Diane Ingersoll-attachments layer is the worst offender — she handles
//  many escrows so non-Ordway threads end up here)
const WRONG_ESCROW = /WT0(?!274211)\d+/
// Property tells: "2732 NW Ordway" / "Ordway" wins; anything else loses
const NON_ORDWAY_PROPERTY = /(3235 NW Cedar|2129 SW 35th|20702 Beaumont|2680 Nordic|Cedar Ave|Redmond OR|Beaumont|Nordic)/i

function looksLikeWrongTransaction(a) {
  const s = a.subject || ''
  if (WRONG_ESCROW.test(s)) return true
  if (NON_ORDWAY_PROPERTY.test(s)) return true
  return false
}

const interesting = dedupedAttachments.filter((a) => {
  if (NOISY.test(a.filename)) return false
  if (/\.(png|jpg|jpeg|gif|tif|tiff)$/i.test(a.filename)) return false
  if (looksLikeWrongTransaction(a)) return false
  return true
})

// Sort by date
interesting.sort((a, b) => String(a.date).localeCompare(String(b.date)))

// Cross-check each against SkySlope set
for (const a of interesting) {
  a.inSkyslope = skyslopeSet.has(norm(a.filename))
  if (!a.inSkyslope) {
    // Try a softer match — just the form name without the X suffix
    const stem = norm(a.filename).replace(/\.pdf$/, '')
    a.softMatch = skyslopeNames.find((n) => {
      const ns = norm(n).replace(/\.pdf$/, '')
      return ns.includes(stem) || stem.includes(ns)
    }) || null
  }
}

// Group: candidates in SkySlope vs missing
const missing = interesting.filter((a) => !a.inSkyslope && !a.softMatch)
const softMatch = interesting.filter((a) => !a.inSkyslope && a.softMatch)
const present = interesting.filter((a) => a.inSkyslope)

// Build markdown
let md = `# Ordway Gmail attachment triage\n\n`
md += `**Folder:** ${FOLDER}\n`
md += `**Inboxes searched:** ${hunt.brokerInboxes.join(', ')}\n`
md += `**Date window:** ${hunt.dateWindow.after} to ${hunt.dateWindow.before}\n`
md += `**Total threads with attachments:** ${hunt.threadsWithAttachments.length}\n`
md += `**Total attachments (deduped):** ${dedupedAttachments.length}\n`
md += `**Non-image attachments:** ${interesting.length}\n`
md += `**In SkySlope (exact match):** ${present.length}\n`
md += `**Soft match (likely already in SkySlope under different name):** ${softMatch.length}\n`
md += `**MISSING from SkySlope:** ${missing.length}\n\n`

if (missing.length) {
  md += `## 🚨 MISSING from SkySlope (${missing.length})\n\n`
  md += `These attachments were found in our broker email but DO NOT appear\n`
  md += `to exist in the Ordway SkySlope folder. Each one is a candidate to\n`
  md += `forward to the folder via the SkySlope inbound mailbox.\n\n`
  for (const a of missing) {
    md += `### \`${a.filename}\`\n`
    md += `- **Inbox:** ${a.inbox}\n`
    md += `- **Date:** ${a.date}\n`
    md += `- **From:** ${a.from}\n`
    md += `- **Subject:** ${a.subject}\n`
    md += `- **Size:** ${a.size} bytes (${a.mimeType})\n`
    md += `- **Layers triggered:** ${a.layers.join(', ')}\n`
    md += `- **Msg ID:** ${a.msgId}  ·  **Attachment ID:** ${a.attachmentId.slice(0, 30)}...\n\n`
  }
}

if (softMatch.length) {
  md += `## 🟡 Soft match — likely already in SkySlope (${softMatch.length})\n\n`
  md += `These attachments were found in email AND seem to match something\n`
  md += `already in SkySlope by name stem (but not by exact filename). Worth\n`
  md += `a visual check to confirm they're the same doc.\n\n`
  for (const a of softMatch) {
    md += `- \`${a.filename}\`  ↔  SkySlope: \`${a.softMatch}\`  (${a.inbox}, ${a.date?.slice(0, 25) || ''}, ${a.size}b)\n`
  }
  md += `\n`
}

if (present.length) {
  md += `## ✅ In SkySlope already (${present.length})\n\n`
  md += `Exact-name matches between email attachments and SkySlope docs.\n\n`
  for (const a of present) {
    md += `- \`${a.filename}\`  (${a.inbox}, ${a.date?.slice(0, 25) || ''})\n`
  }
}

await fs.writeFile(OUT_PATH, md)
console.log(`Wrote ${OUT_PATH}`)
console.log(`\nSummary:`)
console.log(`  Threads with attachments:     ${hunt.threadsWithAttachments.length}`)
console.log(`  Total attachments (deduped):  ${dedupedAttachments.length}`)
console.log(`  Non-image attachments:        ${interesting.length}`)
console.log(`  In SkySlope (exact):          ${present.length}`)
console.log(`  Soft match:                   ${softMatch.length}`)
console.log(`  MISSING from SkySlope:        ${missing.length}`)
