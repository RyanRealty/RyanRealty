#!/usr/bin/env node
/**
 * Subagent fabricated docIds (many ending in -0000-0000-0000-000000000001).
 * Match each entry's `short` field to the real full docId from documents.json
 * and rewrite v2-rename-plan.json + v2-checklist-plan.json with corrected IDs.
 */
import fs from 'node:fs/promises'

const ROOT = '/Users/matthewryan/RyanRealty'
const PHASE0 = `${ROOT}/tmp/ochoco-way-phase0`

const docsJson = JSON.parse(await fs.readFile(`${PHASE0}/documents.json`, 'utf8'))
const realDocs = docsJson.value?.documents || []
const shortToFullDocId = {}
const shortToFilename = {}
for (const d of realDocs) {
  const id = (d.id || d.docId || '').toLowerCase()
  if (!id) continue
  const short = id.substring(0, 8)
  if (shortToFullDocId[short]) {
    console.warn(`Collision: short=${short} maps to ${shortToFullDocId[short]} and ${id}`)
  }
  shortToFullDocId[short] = id
  shortToFilename[short] = d.fileName || d.documentName
}

console.log(`Real docs: ${Object.keys(shortToFullDocId).length}`)

// Fix rename plan
const rename = JSON.parse(await fs.readFile(`${PHASE0}/v2-rename-plan.json`, 'utf8'))
let renameFixed = 0
for (const r of rename) {
  const short = r.short || r.docId?.substring(0, 8)
  const realId = shortToFullDocId[short]
  if (realId && realId !== r.docId) {
    r.docId = realId
    renameFixed++
  }
  // Also ensure currentName is real
  if (shortToFilename[short]) r.currentName = shortToFilename[short]
}
await fs.writeFile(`${PHASE0}/v2-rename-plan.json`, JSON.stringify(rename, null, 2))
console.log(`v2-rename-plan: fixed ${renameFixed} docIds`)

// Fix checklist plan (both unassign + assign)
const cp = JSON.parse(await fs.readFile(`${PHASE0}/v2-checklist-plan.json`, 'utf8'))
let unassignFixed = 0, assignFixed = 0
for (const u of (cp.unassign || [])) {
  const short = u.docId?.substring(0, 8)
  const realId = shortToFullDocId[short]
  if (realId && realId !== u.docId) { u.docId = realId; unassignFixed++ }
}
for (const a of (cp.assign || [])) {
  const short = a.docId?.substring(0, 8)
  const realId = shortToFullDocId[short]
  if (realId && realId !== a.docId) { a.docId = realId; assignFixed++ }
}
await fs.writeFile(`${PHASE0}/v2-checklist-plan.json`, JSON.stringify(cp, null, 2))
console.log(`v2-checklist-plan: fixed ${unassignFixed} unassigns + ${assignFixed} assigns`)

// Validate — every entry now has a real docId?
let bad = 0
for (const r of rename) {
  if (!shortToFullDocId[r.short]) { console.log(`MISSING: short=${r.short} not in real docs`); bad++ }
}
console.log(`\nUnmatchable shorts: ${bad}`)
