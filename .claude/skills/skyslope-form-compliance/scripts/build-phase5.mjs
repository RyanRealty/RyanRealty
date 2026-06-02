#!/usr/bin/env node
/** Canonical, schema-tolerant Phase-5 plan builder. Subagents drift on field
 * names, so normalize variants:
 *   docId:   doc_id | docId | id
 *   name:    name | skyslope_name | fileName
 *   action:  /archive/i => archive ; else keep
 *   dedup:   canonical|canonical_docId , archives|archive_docIds
 *   misasg:  doc_id|docId , correct_activity_id , correct_activity_name
 * Archive set = union(documents.action=archive, dedup archives, archive_artifacts,
 *   misassignments flagged archive). Infers bundle cross-links from archive reasons.
 * Emits the skill's phase5-plan.json {renames,unassigns,assigns,cross_links}.
 * Usage: node build-phase5.mjs <saleGuid> <label> [property] */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const GUID = process.argv[2], LABEL = process.argv[3], PROPERTY = process.argv[4] || ''
if (!GUID || !LABEL) { console.error('usage: build-phase5.mjs <saleGuid> <label> [property] [--incremental]'); process.exit(1) }
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const DIR = path.join(REPO, 'tmp/skyslope-pdfs', GUID)   // per-deal working dir (fetch output + context + plan.json)
const WS = DIR                                            // phase5-plan.json lands next to plan.json — one folder per deal
const p = JSON.parse(await fs.readFile(`${DIR}/plan.json`, 'utf8'))
const checklist = JSON.parse(await fs.readFile(`${DIR}/checklist.json`, 'utf8'))
const docsLive = JSON.parse(await fs.readFile(`${DIR}/documents.json`, 'utf8'))
const validId = new Set(docsLive.map(d => d.id.toLowerCase()))
const fullOf = (idOrPfx) => { const x = (idOrPfx || '').toLowerCase(); if (validId.has(x)) return docsLive.find(d => d.id.toLowerCase() === x).id; const m = docsLive.find(d => d.id.toLowerCase().startsWith(x)); return m ? m.id : null }

const curActs = {}
for (const a of checklist.activities) for (const id of a.assignedDocIds) (curActs[id.toLowerCase()] ||= []).push({ activityId: a.activityId, activityName: a.activityName })
const short8 = (id) => (id || '').slice(0, 8)
// real extension per doc from the fetch manifest (SkySlope name field often drops the ext)
let extById = {}
try { const manifest = JSON.parse(await fs.readFile(`${DIR}/manifest.json`, 'utf8')); for (const e of (manifest.documents || manifest.files || manifest.items || [])) { const id = (e.docId || e.id || '').toLowerCase(); const ext = (e.fileName || e.name || '').match(/\.[a-z0-9]+$/i)?.[0]; if (id && ext) extById[id] = ext } } catch {}
const extOf = (fn) => (fn || '').match(/\.[a-z0-9]+$/i)?.[0] || '.pdf'
const realExt = (d) => extById[d.id.toLowerCase()] || extOf(d.name)
const clean = (s) => (s || '').replace(/[;,]/g, '').replace(/\s+/g, ' ').trim()

// ---- normalize documents (tolerant of all observed subagent schemas) ----
const N = (d) => ({
  id: d.doc_id || d.docId || d.id,
  name: d.name || d.skyslope_name || d.fileName || '',
  oref: d.oref_number || d.oref || null,
  sale: d.sale_number || null,
  signer: d.signer_status || '',
  action: d.action || d.disposition || d.verdict || '',
  reason: d.archive_reason || d.archiveReason || d.notes || null,
  docType: (d.doc_type || d.form_class || '') + '',
  role: (d.form_role || '') + '',
  isBundle: !!(d.is_bundle || d.bundle),
})
const isArtifact = (d) => /artifact|outlook_attachment|email.?signature/i.test(d.docType) || /^(att\d|image\d|att0000|ole)/i.test(d.name)
const norm = (p.documents || p.classifications || []).map(N).filter(d => d.id && validId.has(d.id.toLowerCase()))

// mislabeled corrected names (variant field names)
const mislabeled = {}
for (const m of (p.mislabeled_filenames || [])) { const id = (m.doc_id || m.docId || '').toLowerCase(); const nm = (m.correct_form || m.correctForm || m.actual_content || '').replace(/^OREF\s*\d+[A-Z]?\s*/i, '').trim(); if (id && nm) mislabeled[id] = nm }

// archive set: UNION of every signal (action, artifact, dedup archive(s), explicit artifacts, archive-misassignments)
const archiveIds = new Set()
const archiveReason = {}
const addArch = (id, reason) => { const f = fullOf(id); if (!f) return; archiveIds.add(f.toLowerCase()); if (reason && !archiveReason[f.toLowerCase()]) archiveReason[f.toLowerCase()] = reason }
for (const d of norm) { if (/archive/i.test(d.action)) addArch(d.id, d.reason); else if (isArtifact(d)) addArch(d.id, 'Outlook email artifact - not a transaction document') }
for (const g of (p.dedup_groups || [])) { const losers = g.archive || g.archives || g.archive_docIds || []; const reason = g.archive_reason || g.selection_reason || g.canonical_reason || g.rule_applied || 'superseded duplicate'; for (const x of (Array.isArray(losers) ? losers : [losers])) addArch(x, reason) }
for (const a of (p.archive_artifacts || [])) addArch(a.doc_id || a.docId, 'not a transaction document')
for (const m of (p.misassignments || [])) if (/archive/i.test((m.action || '') + ' ' + (m.reason || ''))) addArch(m.doc_id || m.docId, 'duplicate (per misassignment)')
// Protect dedup canonicals: a doc named as a group canonical stays KEPT unless its
// own per-doc action explicitly says archive (the wrong-cycle case, where even the
// best copy of an out-of-folder group is archived).
const actionById = Object.fromEntries(norm.map(d => [d.id.toLowerCase(), d.action]))
for (const g of (p.dedup_groups || [])) { const c = fullOf(g.canonical || g.canonical_docId); if (c && archiveIds.has(c.toLowerCase()) && !/archive/i.test(actionById[c.toLowerCase()] || '')) archiveIds.delete(c.toLowerCase()) }

function formName(d) {
  if (mislabeled[d.id.toLowerCase()]) return mislabeled[d.id.toLowerCase()]
  let s = (d.name || '').replace(/\.[a-z0-9]+$/i, '').replace(/^ARCHIVE\s*-\s*/i, '')
  if (d.sale) s = s.replace(new RegExp('^' + d.sale.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[_ ]+'), '')
  s = s.replace(/^[A-Za-z]{2}\d{8}[_ ]+/, '').replace(/^X[_ ]+/, '').replace(/[_ ]+X$/, '')
  if (d.oref) s = s.replace(new RegExp('^0*' + d.oref + '[_ ]+'), '')
  s = s.replace(/^\d{3}[A-Z]?[_ ]+/, '')
  return s.trim() || (d.name || '').replace(/\.[a-z0-9]+$/i, '')
}
function v5base(d) {
  const parts = []
  if (d.sale) parts.push(d.sale)
  if (/fully_executed/i.test(d.signer)) parts.push('X')
  if (d.oref) parts.push(d.oref)
  parts.push(formName(d))
  return parts.join('_')
}

// --incremental: for already-processed folders, apply ONLY net-new changes.
// Don't re-derive v5 names (a re-run subagent invents worse names: a bogus sale#
// prefix, a misnumbered form). Archive net-new dupes by prefixing their EXISTING
// name; skip docs the prior pass already archived; only rename genuine mislabels.
const INCR = process.argv.includes('--incremental')
const archToken = (name) => /(^|[_\s-])ARCHIVE([_\s-]|$)/i.test(name || '')
const stemOf = (name) => (name || '').replace(/\.[a-z0-9]+$/i, '').replace(/^ARCHIVE\s*-\s*/i, '')
const renames = [], unassigns = [], assigns = [], cross_links = []
let skipped = 0
for (const d of norm) {
  const idl = d.id.toLowerCase(), ext = realExt(d)
  const correctForm = mislabeled[idl]
  const isMislabeled = !!correctForm && !new RegExp(correctForm.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(d.name || '')
  if (archiveIds.has(idl)) {
    if (INCR && archToken(d.name)) { skipped++; continue }   // already archived by a prior pass — leave it
    const head = (`ARCHIVE - ${INCR ? stemOf(d.name) : v5base(d)}`).slice(0, 78)
    const budget = Math.max(6, 92 - head.length - 3 - ext.length)
    const reason = clean(archiveReason[idl] || 'superseded duplicate').slice(0, budget)
    renames.push({ docId: d.id, short8: short8(d.id), currentName: d.name, newName: `${head} - ${reason}${ext}`, action: 'archive' })
    for (const act of (curActs[idl] || [])) unassigns.push({ docId: d.id, short8: short8(d.id), activityId: act.activityId, activityName: act.activityName })
  } else {
    if (INCR && !isMislabeled) { skipped++; continue }   // INCR: leave already-named canonicals; fix only genuine mislabels
    renames.push({ docId: d.id, short8: short8(d.id), currentName: d.name, newName: `${v5base(d)}${ext}`, action: isMislabeled ? 'mislabel-fix' : 'v5-rename' })
  }
}
// reassignments (non-archive misassignments)
for (const m of (p.misassignments || [])) {
  if (/archive/i.test(m.action || '')) continue
  const f = fullOf(m.doc_id || m.docId); if (!f || archiveIds.has(f.toLowerCase())) continue
  const target = m.correct_activity_id || m.correctActivityId || m.targetActivityId || (String(m.correct_activity_name || m.correct_activity || '').match(/\b(\d{6,})\b/) || [])[1]
  const targetName = (m.correct_activity_name || m.correct_activity || m.targetActivityName || '').replace(/\s*\(activity\s*\d+.*$/i, '').trim()
  if (!target) continue
  for (const act of (curActs[f.toLowerCase()] || [])) { if (String(act.activityId) === String(target)) continue; unassigns.push({ docId: f, short8: short8(f), activityId: act.activityId, activityName: act.activityName }) }
  assigns.push({ docId: f, short8: short8(f), targetActivityId: target, targetActivityName: targetName })
}
// explicit cross_links from subagent (parse "Name (activityId)" strings in also_assign_to)
const parseActRef = (s) => { const m = String(s).match(/^(.*?)\s*\((\d+)\)\s*$/); return m ? { name: m[1].trim(), id: m[2] } : null }
for (const c of (p.cross_links || [])) {
  const f = fullOf(c.doc_id || c.docId); if (!f) continue
  const targets = []
  if (Array.isArray(c.also_assign_to)) for (const t of c.also_assign_to) { const r = parseActRef(t); if (r) targets.push(r) }
  if (c.targetActivityId) targets.push({ id: c.targetActivityId, name: c.targetActivityName || '' })
  for (const t of targets) cross_links.push({ docId: f, short8: short8(f), targetActivityId: t.id, targetActivityName: t.name })
}
// inferred bundle cross-links: archived constituent vacates an activity -> kept bundle must cover it
const keptBundles = new Set(norm.filter(d => !archiveIds.has(d.id.toLowerCase()) && d.isBundle).map(d => d.id.toLowerCase()))
const xseen = new Set(cross_links.map(c => (c.docId || '').toLowerCase() + '|' + c.targetActivityId))
for (const idl of archiveIds) {
  const prefixes = (archiveReason[idl] || '').match(/[0-9a-f]{6,}/ig) || []
  let bundleId = null
  for (const pfx of prefixes) { const f = fullOf(pfx); if (f && keptBundles.has(f.toLowerCase())) { bundleId = f; break } }
  if (!bundleId) continue
  const bundleActs = new Set((curActs[bundleId.toLowerCase()] || []).map(a => String(a.activityId)))
  for (const act of (curActs[idl] || [])) {
    if (bundleActs.has(String(act.activityId))) continue
    const k = bundleId.toLowerCase() + '|' + act.activityId; if (xseen.has(k)) continue; xseen.add(k)
    cross_links.push({ docId: bundleId, short8: short8(bundleId), targetActivityId: act.activityId, targetActivityName: act.activityName, inferred: true })
  }
}

// Safety net: never EMPTY an activity. If every doc in an activity is being archived,
// assign that dedup-group's kept canonical (via group or "same content as <id>" reason).
const groupCanonOf = {}
for (const g of (p.dedup_groups || [])) { const canon = fullOf(g.canonical || g.canonical_docId); if (!canon || archiveIds.has(canon.toLowerCase())) continue; for (const x of (g.archives || g.archive_docIds || [])) { const f = fullOf(x); if (f) groupCanonOf[f.toLowerCase()] = canon } }
const assignSeen = new Set([...assigns, ...cross_links].map(a => (a.docId || '').toLowerCase() + '|' + a.targetActivityId))
for (const a of checklist.activities) {
  const ass = a.assignedDocIds || []
  if (!ass.length || !ass.every(id => archiveIds.has(id.toLowerCase()))) continue   // not fully emptied
  let fill = null
  for (const id of ass) {
    fill = groupCanonOf[id.toLowerCase()]
    if (!fill) for (const pfx of ((archiveReason[id.toLowerCase()] || '').match(/[0-9a-f]{6,}/ig) || [])) { const f = fullOf(pfx); if (f && !archiveIds.has(f.toLowerCase())) { fill = f; break } }
    if (fill) break
  }
  if (!fill) continue   // artifact-only activity (e.g. a meme) correctly stays empty
  const already = new Set((curActs[fill.toLowerCase()] || []).map(x => String(x.activityId)))
  if (already.has(String(a.activityId))) continue
  const k = fill.toLowerCase() + '|' + a.activityId; if (assignSeen.has(k)) continue; assignSeen.add(k)
  assigns.push({ docId: fill, short8: short8(fill), targetActivityId: a.activityId, targetActivityName: a.activityName, fill: true })
}

const out = {
  saleGuid: GUID, property: PROPERTY || p.meta?.address || LABEL,
  summary: `${LABEL}: ${renames.filter(r => r.action === 'archive').length} archives, ${renames.filter(r => r.action === 'v5-rename').length} v5 renames, ${unassigns.length} unassigns, ${assigns.length} reassigns, ${cross_links.length} cross-links`,
  renames, unassigns, assigns, cross_links,
}
await fs.mkdir(WS, { recursive: true })
await fs.writeFile(`${WS}/phase5-plan.json`, JSON.stringify(out, null, 2))
console.log(out.summary)
console.log(`\nArchives:`); for (const r of renames.filter(r => r.action === 'archive')) console.log(`  ${r.short8}  ${r.newName.slice(0, 95)}`)
if (assigns.length) { console.log(`\nReassignments:`); for (const a of assigns) console.log(`  ${a.short8} -> ${a.targetActivityName}`) }
if (cross_links.length) { console.log(`\nCross-links:`); for (const a of cross_links) console.log(`  ${a.short8} -> ${a.targetActivityName}${a.inferred ? ' (inferred)' : ''}`) }
console.log(`\nwrote ${WS}/phase5-plan.json`)
