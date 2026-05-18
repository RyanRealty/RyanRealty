#!/usr/bin/env node
/**
 * Normalize existing FUB geo / owner tags into the canonical namespace schema.
 *
 * The original KTS import dropped tags like `NWX`, `RiverWest`, `Bend`,
 * `out-of-state`, `absentee`, `crosswater-ph-3` etc. These aren't filterable
 * cleanly because they mix conventions. This script:
 *
 *   1. Walks every lead with one or more of the mapped legacy tags
 *   2. Adds the canonical equivalent (`neighborhood:northwest-crossing`,
 *      `city:bend`, `geo:out-of-state`, `owner:absentee`, etc.)
 *   3. Leaves the original tag in place for one-pass safety (a follow-up
 *      can strip later)
 *
 * Canonical schema:
 *   city:<slug>           — bend, redmond, sisters, sunriver, la-pine, madras, prineville
 *   neighborhood:<slug>   — northwest-crossing, bend-river-west, sunriver, etc.
 *                           (matches public.boundaries geo_slug)
 *   subdivision:<slug>    — crosswater-ph-3, oregon-water-wonderland, osprey-pointe-condo, etc.
 *   geo:<scope>           — local, out-of-area, out-of-state
 *   owner:<type>          — absentee (owns in area, lives elsewhere), occupied (lives in property)
 *   equity:<bucket>       — high (>= 50%), low (< 50%)
 *   tenure:<bucket>       — recent (< 2yr), long-term (>= 5yr)
 *
 * Run: DELETE=1 to execute; otherwise dry-run.
 */

const FUB_KEY = process.env.FOLLOWUPBOSS_API_KEY?.trim()
const DELETE = process.env.DELETE === '1'
if (!FUB_KEY) throw new Error('Missing FOLLOWUPBOSS_API_KEY')
const BASIC = Buffer.from(`${FUB_KEY}:`).toString('base64')

async function fub(method, path, body = null) {
  const res = await fetch(`https://api.followupboss.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${BASIC}`,
      'Content-Type': 'application/json',
      'X-System': 'RyanRealty-Web',
      'X-System-Key': 'ryan-realty-2026-seller-workflow',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.status === 200 ? await res.json() : { status: res.status, _err: true }
}

// Mapping: legacy tag → array of canonical tags to ADD (does not remove the legacy)
const TAG_MAP = {
  // City tags (Title Case → city:<slug>)
  'Bend':            ['city:bend'],
  'Redmond':         ['city:redmond'],
  'Sisters':         ['city:sisters'],
  'Sunriver':        ['city:sunriver', 'neighborhood:sunriver'],
  'La Pine':         ['city:la-pine'],
  'Madras':          ['city:madras'],
  'Prineville':      ['city:prineville'],
  'Tumalo':          ['city:bend'],  // Tumalo is in Bend zip but unincorporated; tag both

  // Bend neighborhood tags (existing → canonical neighborhood:<slug>)
  'NWX':             ['neighborhood:northwest-crossing', 'city:bend'],
  'RiverWest':       ['neighborhood:bend-river-west', 'city:bend'],
  'Crosswater':      ['neighborhood:crosswater'],
  'crosswater':      ['neighborhood:crosswater'],
  'Black Butte Ranch': ['neighborhood:black-butte-ranch'],
  'Tetherow':        ['neighborhood:tetherow', 'city:bend'],
  'Old Bend':        ['neighborhood:bend-old-bend', 'city:bend'],

  // Subdivision tags (kebab → subdivision:<slug> + parent neighborhood)
  'crosswater-ph-3':              ['subdivision:crosswater-ph-3', 'neighborhood:crosswater'],
  'oregon-water-wonderland':      ['subdivision:oregon-water-wonderland'],
  'canoe-camp':                   ['subdivision:canoe-camp'],
  'osprey-pointe-condo':          ['subdivision:osprey-pointe-condo'],
  'osprey-pointe-condo-amd':      ['subdivision:osprey-pointe-condo'],
  'osprey-pointe-condo-amd-2':    ['subdivision:osprey-pointe-condo'],

  // Ownership / geo intent tags
  'absentee':            ['owner:absentee'],
  'owner-occupied':      ['owner:occupied'],
  'out-of-state':        ['geo:out-of-state'],
  'in-state-out-of-area':['geo:out-of-area'],

  // Equity + tenure intent tags
  'high-equity':         ['equity:high'],
  'recent-purchase':     ['tenure:recent'],
  'long-term':           ['tenure:long-term'],

  // Score tags — leave as-is (already useful for prioritization)
}

function tagsToAdd(person) {
  const existing = new Set((person.tags || []).map(t => t.toLowerCase()))
  const out = new Set()
  for (const [legacy, canonicals] of Object.entries(TAG_MAP)) {
    if (existing.has(legacy.toLowerCase())) {
      for (const c of canonicals) {
        if (!existing.has(c.toLowerCase())) out.add(c)
      }
    }
  }
  return Array.from(out)
}

async function* iterateMatchingLeads() {
  // Iterate every legacy tag we map, dedupe by id
  const seen = new Set()
  for (const legacy of Object.keys(TAG_MAP)) {
    let next = `/people?tags=${encodeURIComponent(legacy)}&limit=100&sort=id&fields=id,name,tags`
    let pages = 0
    while (next && pages < 200) {  // safety cap
      const j = await fub('GET', next)
      if (j._err) break
      const people = j.people || []
      if (!people.length) break
      for (const p of people) {
        if (seen.has(p.id)) continue
        seen.add(p.id)
        yield p
      }
      const nl = j._metadata?.nextLink
      next = nl ? nl.replace('https://api.followupboss.com/v1', '') : null
      pages++
      await new Promise(r => setTimeout(r, 100))
    }
  }
}

async function main() {
  console.log(`=== FUB Geo/Owner Tag Normalization ===`)
  console.log(`Mode: ${DELETE ? 'EXECUTE' : 'DRY-RUN'}`)
  console.log(`Mapping ${Object.keys(TAG_MAP).length} legacy tags to canonical schema\n`)

  const stats = { scanned: 0, matched: 0, written: 0, errors: 0, tagsAdded: 0 }
  const samples = []

  for await (const person of iterateMatchingLeads()) {
    stats.scanned++
    if (stats.scanned % 500 === 0) console.log(`  scanned ${stats.scanned}…`)

    const newTags = tagsToAdd(person)
    if (newTags.length === 0) continue
    stats.matched++

    if (samples.length < 8) {
      samples.push({
        id: person.id,
        name: person.name,
        existing: (person.tags || []).filter(t => Object.keys(TAG_MAP).includes(t)),
        adding: newTags,
      })
    }

    if (!DELETE) {
      stats.tagsAdded += newTags.length
      continue
    }

    const r = await fub('PUT', `/people/${person.id}?mergeTags=true`, { tags: newTags })
    if (r._err) stats.errors++
    else { stats.written++; stats.tagsAdded += newTags.length }
    await new Promise(r => setTimeout(r, 100))
  }

  console.log('\n=== Sample matches ===')
  for (const s of samples) {
    console.log(`  id=${s.id} ${s.name}`)
    console.log(`    legacy:   ${s.existing.join(', ')}`)
    console.log(`    adding:   ${s.adding.join(', ')}`)
  }

  console.log('\n=== Summary ===')
  console.log(`  scanned:    ${stats.scanned}`)
  console.log(`  matched:    ${stats.matched}`)
  console.log(`  written:    ${stats.written}`)
  console.log(`  tags added: ${stats.tagsAdded}`)
  console.log(`  errors:     ${stats.errors}`)
  if (!DELETE) console.log('\n  → re-run with DELETE=1 to execute.')
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
