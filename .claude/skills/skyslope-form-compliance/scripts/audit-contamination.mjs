#!/usr/bin/env node
/** Comprehensive cross-folder contamination extraction from the 17 analyzed plan.json.
 * Builds a sale#->property map, then flags every doc whose internal property/sale#
 * belongs to a DIFFERENT deal. Writes audit-contamination.json. */
import fs from 'node:fs/promises'
import path from 'node:path'
const ROOT = '/Users/matthewryan/RyanRealty/tmp/skyslope-pdfs'
const DEALS = [
  ['35th', 'a0d269e0-2324-492a-8f5f-dd2385d28bf7', '2129 SW 35th'],
  ['Kwinnum', 'b3d7cb82-50c2-4d52-9dbe-31330121abcb', '61271 Kwinnum'],
  ['Crowson', '1f4436e6-25b8-4b26-84f2-14f0d9e2b81c', '534 Crowson'],
  ['Ordway', 'f88642ff-22e6-4618-b9e1-40b168a439e1', '2732 Ordway'],
  ['Huntington', '13e20213-81eb-4e8f-b7de-534f863af3a2', '54474 Huntington'],
  ['Butler', '6ef1013a-3e17-47ce-b8bb-da0289930d17', '1050 Butler'],
  ['Cedar', '45549882-839b-4e36-af31-6078b344bcb5', '3235 Cedar'],
  ['Penhollow', 'e1892930-09c4-48f6-b327-f901251cae96', '20401 Penhollow'],
  ['Newport', '740abefb-b67f-4564-b139-3e9bda1ae29e', '1974 Newport'],
  ['School House', '32c42212-1097-4a16-ba5d-24ebae2acebb', '56111 School House'],
  ['Mayfield', '8b3033bd-59a8-4e67-9f31-b8566641fc07', '17130 Mayfield'],
  ['Simpson', 'f620aee8-2f1a-4025-be18-70a335beeb35', '19571 Simpson'],
  ['Drouillard', 'c9fcc145-311d-4a92-b23e-0ff6e61b126a', '2354 Drouillard'],
  ['Jacklight', '69b85dea-e733-4b81-80cc-bf46c0af17cf', '20473 Jacklight'],
  ['703 SW 7th', '487fb3bf-1a35-417c-84e1-b803be012aa0', '703 SW 7th'],
  ['Old Bend', '18380841-dce0-4db4-ad63-74c848020266', '64350 Old Bend'],
  ['3480 SW 45th', '59152e77-3d51-4b97-a06c-e9810c71689a', '3480 SW 45th'],
]
const recsOf = (p) => (p.documents || p.classifications || [])
const saleOf = (r) => r.sale_number || (r.constituent_forms || [])[0]?.sale_number || null
const reasonOf = (r) => [r.archive_reason, r.notes, r.selection_reason, JSON.stringify(r.constituent_forms || '')].filter(Boolean).join(' ')
const idOf = (r) => r.doc_id || r.docId || r.id || '?'

// Load all plans
const plans = {}
for (const [name, guid] of DEALS) { try { plans[name] = JSON.parse(await fs.readFile(path.join(ROOT, guid, 'plan.json'), 'utf8')) } catch { } }

// Build sale# -> {folder, count} map (which folder each sale# predominantly belongs to)
const saleMap = {}   // sale# -> {folder: count}
for (const [name] of DEALS) { const p = plans[name]; if (!p) continue; for (const r of recsOf(p)) { const s = saleOf(r); if (!s) continue; (saleMap[s] ||= {}); saleMap[s][name] = (saleMap[s][name] || 0) + 1 } }
const homeOf = {}   // sale# -> folder where it's most common
for (const [s, m] of Object.entries(saleMap)) homeOf[s] = Object.entries(m).sort((a, b) => b[1] - a[1])[0][0]

// Explicit wrong-property language (the subagent read the page and said so)
const WRONG = /wrong[ _-]?(propert|deal|folder)|different (propert|deal|address)|another (propert|deal|transaction)|belongs (to|in) (a )?(different|another)|not [A-Z][a-z]+ (Drive|Road|Rd|St|Street|Ave|Lane|Ln|Way)/i

const out = {}
for (const [name, guid, prop] of DEALS) {
  const p = plans[name]; if (!p) continue
  const ownSales = new Set(Object.entries(saleMap).filter(([s, m]) => homeOf[s] === name).map(([s]) => s))
  const foreign = []
  for (const r of recsOf(p)) {
    const reason = reasonOf(r), s = saleOf(r)
    const explicitWrong = WRONG.test(reason)
    // a sale# whose HOME is another folder = foreign (but only if that sale# also appears elsewhere as home)
    const saleForeign = s && homeOf[s] && homeOf[s] !== name && !ownSales.has(s)
    if (explicitWrong || saleForeign) {
      // capture the source property if named in the reason
      const srcM = reason.match(/\b(\d{2,5}\s+[NSEW]{0,2}\s*[A-Z][A-Za-z0-9 ]+?(?:St|Street|Ave|Avenue|Rd|Road|Lane|Ln|Way|Drive|Dr|Hwy))\b/) || reason.match(/(King \w+|Brown \w+|Hakkila|Boynton|Panther|Dority)/i)
      foreign.push({ id: idOf(r).slice(0, 8), sale: s, archived: /^ARCHIVE/i.test(r.name || ''), source: srcM ? srcM[1] || srcM[0] : (s && homeOf[s] !== name ? homeOf[s] : '(see reason)'), reason: reason.slice(0, 110) })
    }
  }
  if (foreign.length) out[name] = { guid: guid.slice(0, 8), property: prop, count: foreign.length, archived: foreign.filter(f => f.archived).length, live: foreign.filter(f => !f.archived).length, foreign }
}
await fs.writeFile('/Users/matthewryan/RyanRealty/tmp/_meta-audit/audit-contamination.json', JSON.stringify(out, null, 2))
console.log('=== CONTAMINATION (17 analyzed folders) ===\n')
for (const [name, d] of Object.entries(out)) {
  const srcs = [...new Set(d.foreign.map(f => f.source))].join(', ')
  console.log(`${name} (${d.property}) — ${d.count} foreign docs (${d.archived} archived, ${d.live} LIVE) — from: ${srcs}`)
}
console.log(`\n${Object.keys(out).length} of 17 analyzed folders have foreign docs.`)
const liveTotal = Object.values(out).reduce((n, d) => n + d.live, 0)
console.log(`LIVE (unarchived) foreign docs still in a folder: ${liveTotal}`)
