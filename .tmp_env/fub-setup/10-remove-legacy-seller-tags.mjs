#!/usr/bin/env node
/**
 * Remove legacy seller tags from leads that already carry the canonical
 * audience:seller + seller:* equivalents.
 *
 * GATING: this script only runs the destructive pass when the bulk
 * migration is essentially done — i.e. audience:seller count ≥ MIN_AUDIENCE
 * (default 3400). If not, dry-run prints the gate failure and exits.
 *
 * Verified pre-state (2026-05-17): audience:seller = 2,858; legacy Seller =
 * 3,481. The migration (script 03) is still in flight — Matt should rerun
 * script 03 (DELETE=1) until audience:seller count plateaus around 3,481
 * before running this script live.
 *
 * Idempotent: a person without the legacy tag is silently skipped.
 *
 * Legacy → canonical mapping (must match script 03 exactly):
 *
 *   Seller          → audience:seller + seller:nurture   (3,481 affected)
 *   Seller Lead     → audience:seller + seller:warm
 *   Seller Intent   → audience:seller + seller:warm
 *   Nurture Seller  → audience:seller + seller:long-nurture
 *   hot-seller      → audience:seller + seller:hot
 *   LP-Home-Value   → source:seller-lp
 *
 * Also strip (per task brief):
 *   auto:seller-seq:new   → no longer needed (brain automation tag)
 *   auto:seller-seq:warm  → no longer needed
 *   auto:seller-seq:watch → no longer needed (already done in script 09)
 *
 * KEEP (explicitly):
 *   auto:brand-voice:plain-honest — still used by brand voice skill
 *
 * Run: DRY=1 (default). DELETE=1 to execute. FORCE=1 to skip the gate check.
 */

const FUB_KEY = process.env.FOLLOWUPBOSS_API_KEY?.trim()
const DELETE = process.env.DELETE === '1'
const FORCE = process.env.FORCE === '1'
const MIN_AUDIENCE = parseInt(process.env.MIN_AUDIENCE || '3400', 10)
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '0', 10) || Infinity
if (!FUB_KEY) throw new Error('Missing FOLLOWUPBOSS_API_KEY')
const BASIC = Buffer.from(`${FUB_KEY}:`).toString('base64')
const BASE = 'https://api.followupboss.com/v1'

// A legacy tag is safe to strip when the lead carries the canonical
// equivalent. If the lead has the legacy but not the canonical, we skip and
// log (means the migration didn't get there yet — re-run script 03 first).
const LEGACY_TO_CANONICAL = {
  'Seller':         ['audience:seller', 'seller:nurture'],
  'Seller Lead':    ['audience:seller', 'seller:warm'],
  'Seller Intent':  ['audience:seller', 'seller:warm'],
  'Nurture Seller': ['audience:seller', 'seller:long-nurture'],
  'hot-seller':     ['audience:seller', 'seller:hot'],
  'LP-Home-Value':  ['source:seller-lp'],
}

// Unconditional strips (no canonical required) — these are tags that have
// no canonical equivalent and just need to go.
const UNCONDITIONAL_STRIPS = [
  'auto:seller-seq:new',
  'auto:seller-seq:warm',
  // 'auto:seller-seq:watch' already handled by script 09 (count was 1)
]

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

async function fubWithRetry(method, path, body = null) {
  let r = await fub(method, path, body)
  if (r.status === 429) {
    await new Promise(rr => setTimeout(rr, 2000))
    r = await fub(method, path, body)
  }
  return r
}

async function* iteratePeopleByTag(tagName) {
  let nextUrl = `/people?tags=${encodeURIComponent(tagName)}&limit=100&sort=id&fields=id,name,tags`
  let seen = 0
  while (nextUrl) {
    const { status, json } = await fubWithRetry('GET', nextUrl)
    if (status !== 200) return
    for (const p of (json?.people || [])) {
      yield p
      seen++
      if (seen >= LIMIT) return
    }
    const next = json?._metadata?.nextLink
    nextUrl = next ? next.replace(BASE, '') : null
    await new Promise(r => setTimeout(r, 100))
  }
}

async function getAudienceSellerCount() {
  const { status, json } = await fubWithRetry('GET', '/people?tags=audience:seller&limit=1')
  if (status !== 200) return -1
  return json?._metadata?.total ?? 0
}

async function main() {
  console.log('=== FUB Legacy Seller-Tag Removal ===')
  console.log(`Mode: ${DELETE ? 'EXECUTE' : 'DRY-RUN (set DELETE=1 to write)'}`)
  console.log(`Limit: ${LIMIT === Infinity ? 'no cap' : LIMIT}`)
  console.log(`Migration gate (MIN_AUDIENCE): ${MIN_AUDIENCE} ${FORCE ? '(FORCED OFF)' : ''}\n`)

  // GATE: confirm migration completed.
  const audienceCount = await getAudienceSellerCount()
  console.log(`Live audience:seller count: ${audienceCount}`)
  console.log(`Required: ≥ ${MIN_AUDIENCE}`)
  if (!FORCE && audienceCount < MIN_AUDIENCE) {
    console.log()
    console.log(`!! GATE FAILED. Migration is not complete (${audienceCount} < ${MIN_AUDIENCE}).`)
    console.log(`!! Run script 03 first:`)
    console.log(`!!   DELETE=1 node --env-file=.env.local .tmp_env/fub-setup/03-bulk-tag-migration.mjs`)
    console.log(`!! Then re-run this script.`)
    console.log(`!! Override the gate with FORCE=1 (do not do this unless you know).`)
    process.exit(2)
  }
  console.log(`Gate passed. ${audienceCount} leads carry audience:seller.\n`)

  // Build the work list: for each legacy tag, fetch carriers, and verify each
  // has the corresponding canonical tags before stripping.
  console.log('=== Per-tag verification ===\n')

  const allWork = []  // {personId, name, currentTags, stripTag, reason}
  for (const [legacyTag, canonicals] of Object.entries(LEGACY_TO_CANONICAL)) {
    const carriers = []
    for await (const p of iteratePeopleByTag(legacyTag)) carriers.push(p)
    const lowerCanons = canonicals.map(t => t.toLowerCase())
    let withCanonical = 0
    let withoutCanonical = 0
    for (const p of carriers) {
      const lowerTags = (p.tags || []).map(t => t.toLowerCase())
      const hasAllCanonical = lowerCanons.every(c => lowerTags.includes(c))
      if (hasAllCanonical) {
        allWork.push({
          personId: p.id,
          name: p.name,
          currentTags: p.tags || [],
          stripTag: legacyTag,
          reason: `legacy → canonical (${canonicals.join('+')}) verified`,
        })
        withCanonical++
      } else {
        withoutCanonical++
      }
    }
    console.log(`  ${legacyTag.padEnd(20)} carriers=${carriers.length}  ready=${withCanonical}  missing-canonical=${withoutCanonical}`)
  }

  for (const tag of UNCONDITIONAL_STRIPS) {
    const carriers = []
    for await (const p of iteratePeopleByTag(tag)) carriers.push(p)
    for (const p of carriers) {
      allWork.push({
        personId: p.id,
        name: p.name,
        currentTags: p.tags || [],
        stripTag: tag,
        reason: 'unconditional strip',
      })
    }
    console.log(`  ${tag.padEnd(20)} carriers=${carriers.length}  ready=${carriers.length}  (unconditional)`)
  }

  console.log(`\nTotal strips queued: ${allWork.length}`)
  if (allWork.length > 0) {
    console.log('\nFirst 5 samples:')
    for (const w of allWork.slice(0, 5)) {
      console.log(`  id=${w.personId} ${w.name}`)
      console.log(`    strip:    ${w.stripTag}`)
      console.log(`    reason:   ${w.reason}`)
      console.log(`    current:  ${w.currentTags.join(', ')}`)
    }
  }

  if (!DELETE) {
    console.log('\nDry run. Set DELETE=1 to execute strips.')
    return
  }

  if (allWork.length === 0) {
    console.log('\nNothing to do.')
    return
  }

  console.log('\n--- Executing strips ---')
  let ok = 0, failed = 0
  let done = 0
  for (const w of allWork) {
    const newTags = w.currentTags.filter(t => t.toLowerCase() !== w.stripTag.toLowerCase())
    if (newTags.length === w.currentTags.length) {
      // Tag is already gone (race condition or stale list). Skip.
      done++
      continue
    }
    const { status, text } = await fubWithRetry('PUT', `/people/${w.personId}`, { tags: newTags })
    if (status >= 200 && status < 300) {
      ok++
    } else {
      failed++
      console.log(`  FAILED  id=${w.personId}  strip="${w.stripTag}"  status=${status}  body=${text.slice(0, 200)}`)
    }
    done++
    if (done % 100 === 0) console.log(`  progress: ${done}/${allWork.length}`)
    await new Promise(r => setTimeout(r, 100))
  }

  console.log(`\nDone. Stripped: ${ok}. Failed: ${failed}.`)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
