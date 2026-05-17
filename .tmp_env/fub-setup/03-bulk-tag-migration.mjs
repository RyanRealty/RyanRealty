#!/usr/bin/env node
/**
 * Bulk-migrate legacy seller tags to the canonical kebab-case namespaced
 * schema per docs/FUB_SELLER_WORKFLOW_2026-05-17.md §4.
 *
 * Adds canonical tags WITHOUT removing legacy ones (verify-first strategy).
 * Legacy removal happens in a second pass after 7 days of verification.
 *
 * Migration map:
 *   Seller (Title Case, 3,481 people)        → +audience:seller +seller:nurture
 *   Seller Lead (Title Case, 2)              → +audience:seller +seller:warm
 *   Seller Intent (Title Case, 2)            → +audience:seller +seller:warm
 *   Nurture Seller (Title Case, 17)          → +audience:seller +seller:long-nurture
 *   hot-seller (kebab, 1)                    → +audience:seller +seller:hot
 *   LP-Home-Value (kebab, 2)                 → +source:seller-lp
 *
 * Run: DELETE=1 to actually mutate; otherwise dry-run.
 * Run with --limit N to cap how many people get touched (for staged rollout).
 */

const FUB_KEY = process.env.FOLLOWUPBOSS_API_KEY?.trim()
const DELETE = process.env.DELETE === '1'
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '0', 10) || Infinity
if (!FUB_KEY) throw new Error('Missing FOLLOWUPBOSS_API_KEY')
const BASIC = Buffer.from(`${FUB_KEY}:`).toString('base64')
const BASE = 'https://api.followupboss.com/v1'

async function fub(method, path, body = null) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Basic ${BASIC}`,
      'Content-Type': 'application/json',
      'X-System': 'RyanRealty-Web',
      'X-System-Key': 'ryan-realty-2026-seller-workflow',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, json, text }
}

const TAG_RULES = [
  { match: 'Seller',         add: ['audience:seller', 'seller:nurture'] },
  { match: 'Seller Lead',    add: ['audience:seller', 'seller:warm'] },
  { match: 'Seller Intent',  add: ['audience:seller', 'seller:warm'] },
  { match: 'Nurture Seller', add: ['audience:seller', 'seller:long-nurture'] },
  { match: 'hot-seller',     add: ['audience:seller', 'seller:hot'] },
  { match: 'LP-Home-Value',  add: ['source:seller-lp'] },
]

function tagsToAdd(person) {
  const personTags = (person.tags || []).map(t => t.toLowerCase())
  const toAdd = new Set()
  for (const rule of TAG_RULES) {
    if (personTags.includes(rule.match.toLowerCase())) {
      for (const t of rule.add) {
        if (!personTags.includes(t.toLowerCase())) toAdd.add(t)
      }
    }
  }
  return Array.from(toAdd)
}

async function* iteratePeopleWithSellerTags() {
  // FUB doesn't have a top-level tags endpoint, so we paginate all people
  // and filter client-side. 13k people / 100 page = ~130 pages.
  let offset = 0
  const PAGE = 100
  let seen = 0
  while (true) {
    const { status, json } = await fub('GET', `/people?limit=${PAGE}&offset=${offset}&fields=id,name,tags`)
    if (status !== 200) {
      console.error(`Page failed at offset ${offset}: status ${status}`)
      return
    }
    const people = json?.people || []
    if (!people.length) return
    for (const p of people) {
      yield p
      seen++
      if (seen >= LIMIT) return
    }
    if (people.length < PAGE) return
    offset += PAGE
    // Be friendly to FUB rate limits.
    await new Promise(r => setTimeout(r, 100))
  }
}

async function main() {
  console.log(`=== FUB Bulk Tag Migration — seller workflow ===`)
  console.log(`Mode: ${DELETE ? 'EXECUTE (writes will happen)' : 'DRY-RUN (set DELETE=1 to write)'}`)
  console.log(`Limit: ${LIMIT === Infinity ? 'all matching' : LIMIT}`)
  console.log()

  const stats = {
    scanned: 0,
    matched: 0,
    tagsAdded: 0,
    errors: 0,
  }
  const samples = []

  for await (const person of iteratePeopleWithSellerTags()) {
    stats.scanned++
    if (stats.scanned % 500 === 0) {
      console.log(`  scanned ${stats.scanned}…`)
    }
    const newTags = tagsToAdd(person)
    if (newTags.length === 0) continue

    stats.matched++
    if (samples.length < 5) {
      samples.push({ id: person.id, name: person.name, existing: person.tags, adding: newTags })
    }

    if (!DELETE) {
      stats.tagsAdded += newTags.length
      continue
    }

    const { status } = await fub('PUT', `/people/${person.id}?mergeTags=true`, { tags: newTags })
    if (status >= 200 && status < 300) {
      stats.tagsAdded += newTags.length
    } else {
      stats.errors++
      console.error(`  ERROR id=${person.id} status=${status}`)
    }

    // Rate limit cushion: 100ms between writes.
    await new Promise(r => setTimeout(r, 100))
  }

  console.log()
  console.log('=== Sample matches ===')
  for (const s of samples) {
    console.log(`  id=${s.id} ${s.name}`)
    console.log(`    existing: ${s.existing.join(', ')}`)
    console.log(`    adding:   ${s.adding.join(', ')}`)
  }

  console.log()
  console.log('=== Summary ===')
  console.log(`  scanned:    ${stats.scanned}`)
  console.log(`  matched:    ${stats.matched}`)
  console.log(`  tags added: ${stats.tagsAdded}`)
  console.log(`  errors:     ${stats.errors}`)

  if (!DELETE) {
    console.log()
    console.log('  → re-run with DELETE=1 to execute.')
    console.log('  → re-run with --limit=10 first to verify on a small batch.')
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
