#!/usr/bin/env node
import fs from 'node:fs/promises'

const FUB_KEY = (process.env.FOLLOWUPBOSS_API_KEY || '').trim()
const AUTH = `Basic ${Buffer.from(`${FUB_KEY}:`).toString('base64')}`

const text = await fs.readFile('/tmp/all_lists.txt', 'utf8')
const all = text.split('\n').filter(Boolean).map((l) => {
  const [id, ...rest] = l.split('|')
  return { id: +id, name: rest.join('|') }
})

// Normalize by stripping "Bend -" / "Bend " prefix
const normalized = all.map((l) => ({
  id: l.id,
  name: l.name,
  normalized: l.name.replace(/^Bend\s*-\s*/i, '').replace(/^Bend\s+/i, '').trim().toLowerCase(),
}))

// Group by normalized name
const groups = {}
for (const l of normalized) {
  groups[l.normalized] = groups[l.normalized] || []
  groups[l.normalized].push(l)
}

console.log('=== Literal duplicates (same name after stripping Bend prefix) ===')
const dupes = Object.entries(groups).filter(([_, v]) => v.length > 1)
if (dupes.length === 0) console.log('  NONE FOUND — no Bend-X overlaps with standalone neighborhood lists')
else dupes.forEach(([k, v]) => {
  console.log(`  "${k}":`)
  v.forEach((l) => console.log(`    id=${l.id} | ${l.name}`))
})

console.log('\n=== All neighborhood-keyword lists (alphabetical) ===')
const keywords = /^(awbrey|tetherow|sunriver|pronghorn|black butte|northwest|vandevert|crosswater|caldera|sunstone|eagle|three rivers|brasada|widgi|broken|river west|summit west|century west|southern crossing|old bend|boyd acres|mountain view|old farm|southwest bend|orchard|larkspur|southeast bend)/i
const nlist = normalized.filter((l) => keywords.test(l.normalized))
nlist.sort((a, b) => a.normalized.localeCompare(b.normalized))
nlist.forEach((l) => console.log(`  id=${l.id} | ${l.name}`))
