#!/usr/bin/env node
/** Coverage check: which of the 21 closed deals have a full per-doc plan.json analysis. */
import fs from 'node:fs/promises'
import path from 'node:path'
const ROOT = '/Users/matthewryan/RyanRealty/tmp/skyslope-pdfs'
const DEALS = [
  ['#1 712 SW 1st', 'f50fe2a6-226c-4f81-8a59-9fc9a46ea5df'],
  ['#2 Bear St', '2b9046c3-25aa-4efd-b4b1-bd381d6f2a8d'],
  ['#3 Ochoco Way', 'eb9a24d6-f766-4fb7-bfca-a9c7e5b83cf5'],
  ['#4 35th', 'a0d269e0-2324-492a-8f5f-dd2385d28bf7'],
  ['#5 Kwinnum', 'b3d7cb82-50c2-4d52-9dbe-31330121abcb'],
  ['#6 Crowson', '1f4436e6-25b8-4b26-84f2-14f0d9e2b81c'],
  ['#7 Ordway', 'f88642ff-22e6-4618-b9e1-40b168a439e1'],
  ['#8 Huntington', '13e20213-81eb-4e8f-b7de-534f863af3a2'],
  ['#9 Butler', '6ef1013a-3e17-47ce-b8bb-da0289930d17'],
  ['#10 Cedar', '45549882-839b-4e36-af31-6078b344bcb5'],
  ['#11 Penhollow', 'e1892930-09c4-48f6-b327-f901251cae96'],
  ['#12 Newport', '740abefb-b67f-4564-b139-3e9bda1ae29e'],
  ['#13 School House', '32c42212-1097-4a16-ba5d-24ebae2acebb'],
  ['#14 Mayfield', '8b3033bd-59a8-4e67-9f31-b8566641fc07'],
  ['#15 Simpson', 'f620aee8-2f1a-4025-be18-70a335beeb35'],
  ['#16 Drouillard', 'c9fcc145-311d-4a92-b23e-0ff6e61b126a'],
  ['#17 Jacklight', '69b85dea-e733-4b81-80cc-bf46c0af17cf'],
  ['#18 Nordic', 'ce3c30de-1b10-4946-bf06-6dbad8e1d53d'],
  ['#19 703 SW 7th', '487fb3bf-1a35-417c-84e1-b803be012aa0'],
  ['#20 Old Bend', '18380841-dce0-4db4-ad63-74c848020266'],
  ['#21 3480 SW 45th', '59152e77-3d51-4b97-a06c-e9810c71689a'],
]
let analyzed = 0, missing = []
for (const [label, guid] of DEALS) {
  const pj = path.join(ROOT, guid, 'plan.json')
  let recs = 0, manifestDocs = 0
  try { const p = JSON.parse(await fs.readFile(pj, 'utf8')); recs = (p.documents || p.classifications || []).length } catch {}
  try { const m = JSON.parse(await fs.readFile(path.join(ROOT, guid, 'manifest.json'), 'utf8')); manifestDocs = (m.documents || m.files || []).length } catch {}
  const has = recs > 0
  if (has) analyzed++; else missing.push(label)
  console.log(`${label.padEnd(18)} plan.json=${has ? 'YES (' + recs + ' docs)' : 'NO '}  manifest=${manifestDocs || '-'}`)
}
console.log(`\nAnalyzed: ${analyzed}/21${missing.length ? '  | MISSING per-doc analysis: ' + missing.join(', ') : ''}`)
