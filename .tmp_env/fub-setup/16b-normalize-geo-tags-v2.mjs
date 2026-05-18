#!/usr/bin/env node
/**
 * V2 of geo-tag normalization — retries on transient errors and verifies
 * completeness at the end.
 *
 * Bug in v1: any 429 (rate limit) or transient 5xx during the GET pagination
 * caused the script to silently break out of the loop and skip the entire
 * legacy tag. Found post-hoc: Sisters, Sunriver, La Pine, Madras, Prineville,
 * and Black Butte Ranch had ZERO canonical tags after v1 "finished".
 *
 * v2 fixes:
 *   - All GET + PUT calls go through fubWithRetry() with exponential backoff
 *     on 429 and 5xx (up to 5 attempts)
 *   - Post-write validation: for each legacy tag with N people, verify the
 *     canonical equivalent now has >= N people. Report gaps explicitly.
 *   - Idempotent: re-running adds only missing canonicals; no double-tag.
 *
 * Run: DELETE=1 to mutate (default dry-run).
 */

const FUB_KEY = process.env.FOLLOWUPBOSS_API_KEY?.trim()
const DELETE = process.env.DELETE === '1'
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '0', 10) || Infinity
if (!FUB_KEY) throw new Error('Missing FOLLOWUPBOSS_API_KEY')
const BASIC = Buffer.from(`${FUB_KEY}:`).toString('base64')

async function fubRaw(method, path, body = null) {
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
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, json }
}

async function fubWithRetry(method, path, body = null, maxAttempts = 5) {
  let lastErr = null
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const r = await fubRaw(method, path, body)
      // Success
      if (r.status >= 200 && r.status < 300) return { ok: true, ...r }
      // Retry on rate limit / transient server errors
      if (r.status === 429 || (r.status >= 500 && r.status < 600)) {
        const wait = Math.min(1000 * Math.pow(2, attempt - 1), 15_000)
        console.warn(`  [retry ${attempt}/${maxAttempts}] ${method} ${path} got ${r.status}, waiting ${wait}ms`)
        await new Promise(r => setTimeout(r, wait))
        lastErr = r
        continue
      }
      // 4xx — don't retry
      return { ok: false, ...r }
    } catch (e) {
      const wait = Math.min(1000 * Math.pow(2, attempt - 1), 15_000)
      console.warn(`  [retry ${attempt}/${maxAttempts}] ${method} ${path} threw: ${e.message}, waiting ${wait}ms`)
      await new Promise(r => setTimeout(r, wait))
      lastErr = { status: 0, error: e.message }
    }
  }
  return { ok: false, ...lastErr }
}

const TAG_MAP = {
  'Bend':                  ['city:bend'],
  'Redmond':               ['city:redmond'],
  'Sisters':               ['city:sisters'],
  'Sunriver':              ['city:sunriver', 'neighborhood:sunriver'],
  'La Pine':               ['city:la-pine'],
  'Madras':                ['city:madras'],
  'Prineville':            ['city:prineville'],
  'Tumalo':                ['city:bend'],
  'NWX':                   ['neighborhood:northwest-crossing', 'city:bend'],
  'RiverWest':             ['neighborhood:bend-river-west', 'city:bend'],
  'Crosswater':            ['neighborhood:crosswater'],
  'crosswater':            ['neighborhood:crosswater'],
  'Black Butte Ranch':     ['neighborhood:black-butte-ranch'],
  'Tetherow':              ['neighborhood:tetherow', 'city:bend'],
  'Old Bend':              ['neighborhood:bend-old-bend', 'city:bend'],
  'crosswater-ph-3':       ['subdivision:crosswater-ph-3', 'neighborhood:crosswater'],
  'oregon-water-wonderland': ['subdivision:oregon-water-wonderland'],
  'canoe-camp':            ['subdivision:canoe-camp'],
  'osprey-pointe-condo':   ['subdivision:osprey-pointe-condo'],
  'osprey-pointe-condo-amd':   ['subdivision:osprey-pointe-condo'],
  'osprey-pointe-condo-amd-2': ['subdivision:osprey-pointe-condo'],
  'absentee':              ['owner:absentee'],
  'owner-occupied':        ['owner:occupied'],
  'out-of-state':          ['geo:out-of-state'],
  'in-state-out-of-area':  ['geo:out-of-area'],
  'high-equity':           ['equity:high'],
  'recent-purchase':       ['tenure:recent'],
  'long-term':             ['tenure:long-term'],
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
  const seen = new Set()
  for (const legacy of Object.keys(TAG_MAP)) {
    let next = `/people?tags=${encodeURIComponent(legacy)}&limit=100&sort=id&fields=id,name,tags`
    let pages = 0
    while (next && pages < 500) {
      const r = await fubWithRetry('GET', next)
      if (!r.ok) {
        console.error(`  ❌ GET ${next} FAILED after retries: ${r.status}. Skipping rest of "${legacy}" pool.`)
        break
      }
      const j = r.json
      const people = j?.people || []
      if (!people.length) break
      for (const p of people) {
        if (seen.has(p.id)) continue
        seen.add(p.id)
        yield p
        if (seen.size >= LIMIT) return
      }
      const nl = j?._metadata?.nextLink
      next = nl ? nl.replace('https://api.followupboss.com/v1', '') : null
      pages++
      await new Promise(r => setTimeout(r, 80))  // be nice to FUB
    }
  }
}

async function main() {
  console.log(`=== FUB Geo/Owner Tag Normalization v2 ===`)
  console.log(`Mode: ${DELETE ? 'EXECUTE' : 'DRY-RUN'}`)
  console.log(`Retry: yes (exp backoff, up to 5 attempts on 429/5xx)`)
  console.log(`Limit: ${LIMIT === Infinity ? 'all matching' : LIMIT}\n`)

  const stats = { scanned: 0, matched: 0, written: 0, errors: 0, tagsAdded: 0 }

  for await (const person of iterateMatchingLeads()) {
    stats.scanned++
    if (stats.scanned % 200 === 0) console.log(`  scanned ${stats.scanned} (matched ${stats.matched}, written ${stats.written}, errors ${stats.errors})`)

    const newTags = tagsToAdd(person)
    if (newTags.length === 0) continue
    stats.matched++

    if (!DELETE) {
      stats.tagsAdded += newTags.length
      continue
    }

    const r = await fubWithRetry('PUT', `/people/${person.id}?mergeTags=true`, { tags: newTags })
    if (r.ok) { stats.written++; stats.tagsAdded += newTags.length }
    else { stats.errors++; console.warn(`  ❌ PUT person/${person.id} failed: ${r.status}`) }
    await new Promise(r => setTimeout(r, 80))
  }

  console.log('\n=== Summary ===')
  for (const [k, v] of Object.entries(stats)) console.log(`  ${k.padEnd(12)} ${v}`)

  // Post-write validation — verify completeness
  console.log('\n=== Completeness audit ===')
  console.log('Comparing legacy count vs canonical count for each pair.')
  let allGood = true
  for (const [legacy, canonicals] of Object.entries(TAG_MAP)) {
    const lr = await fubWithRetry('GET', `/people?tags=${encodeURIComponent(legacy)}&limit=1`)
    const lN = lr.json?._metadata?.total ?? 0
    if (lN === 0) continue
    for (const c of canonicals) {
      const cr = await fubWithRetry('GET', `/people?tags=${encodeURIComponent(c)}&limit=1`)
      const cN = cr.json?._metadata?.total ?? 0
      const gap = lN - cN
      // Canonical may be > legacy if multiple legacies map to it (e.g., 'crosswater'+'Crosswater'→neighborhood:crosswater)
      const ok = cN >= lN || gap <= 0
      if (!ok) {
        allGood = false
        console.log(`  ❌ ${legacy} (${lN}) → ${c} (${cN}) — gap ${gap}`)
      } else {
        console.log(`  ✅ ${legacy} (${lN}) → ${c} (${cN})`)
      }
    }
  }
  console.log(`\n${allGood ? '✅ ALL CANONICAL TAGS COMPLETE' : '❌ GAPS REMAIN — re-run to catch them'}`)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
