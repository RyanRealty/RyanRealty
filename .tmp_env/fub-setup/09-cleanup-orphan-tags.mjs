#!/usr/bin/env node
/**
 * Remove orphan / one-off / junk tags from every lead that carries them.
 *
 * Strategy: FUB has no bulk-tag-remove endpoint. We:
 *   1. Build a tag inventory by scanning all 13K+ people (sort=id).
 *   2. For each tag in DELETE_TAGS, iterate every person carrying it and PUT
 *      the person with the tag removed.
 *
 * The DELETE_TAGS list is an EXPLICIT allowlist of tags to strip. Anything
 * not on the list is preserved (conservative — protects subdivisions, low-
 * count operational tags, and anything I might have missed).
 *
 * Per Matt's brief, KEEP despite low count:
 *   - do_not_text, do_not_email, unsubscribed (compliance)
 *   - subdivision tags even if low-count (RiverWest, Sunriver, NWX, Tetherow,
 *     CalderaSprings, Black Butte Ranch, OldBend, etc.)
 *   - Bounced, Wrong Number, unresponsive (data quality)
 *   - Source: chatgpt.com (useful attribution signal)
 *
 * Stray source/medium tags (src:direct, medium:none, Source:ig, Source-FB-Ad,
 * segment:my-leads) and Title-Case duplicates of canonical tags get scrubbed
 * in script 11 — this script focuses on clearly-orphan operational/test tags.
 *
 * Run: DRY=1 (default) or DELETE=1 to execute.
 * Optional: --limit=N caps how many leads get touched (staged rollout).
 */

const FUB_KEY = process.env.FOLLOWUPBOSS_API_KEY?.trim()
const DELETE = process.env.DELETE === '1'
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '0', 10) || Infinity
if (!FUB_KEY) throw new Error('Missing FOLLOWUPBOSS_API_KEY')
const BASIC = Buffer.from(`${FUB_KEY}:`).toString('base64')
const BASE = 'https://api.followupboss.com/v1'

// Tags to STRIP from every lead carrying them. Verified against live inventory
// 2026-05-17 (scan-all-people). Each tag below is either a one-off junk, KTS-
// era misnomer, or a duplicate of a canonical schema entry.
//
// NOTE: subdivision tags (Black Butte Ranch, OldBend, CalderaSprings, NWX,
// RiverWest, Sunriver, WestHills, La Pine, LaPine, Terrebonne, Madras,
// Prineville, Sisters, Redmond, Bend) are explicitly NOT in this list.
const DELETE_TAGS = [
  // KTS / kunversion legacy categorization
  'Buyer Intent',          // 1 — replaced by audience:buyer (not yet built; placeholder)
  'Nurture Buyer',         // 3 — KTS action plan name as a tag; the plan is gone
  'Lead Form',             // 1 — generic, no signal
  'Contact',               // 2 — generic, no signal
  'Registration',          // 3 — generic, no signal
  'Open House',            // 1 — too generic; subdivision tags carry better signal
  'Home Valuation',        // 3 — pre-LP era; replaced by source:seller-lp
  'Home Valuation + Notes',// 1 — same
  'VIP Home Finder',       // 1 — KTS legacy buyer-saved-search artifact
  'Property Search',       // 1 — KTS legacy
  'ScheduleaTour',         // 1 — KTS form-name artifact

  // User name as tag (data entry error)
  'Paul Stevenson',        // 2 — should be broker:paul; remove the freeform string
  'Rebecca Peterson',      // 2 — should be broker:rebecca

  // Property-type tags that don't map to our schema and aren't used for filter
  'Townhouse',             // 1 — single lead; remove
  'Vacant Land',           // 2 — same
  'Residential Lots',      // 1 — same
  'Manufactured On Land',  // 1 — same

  // Source attribution with bad casing / namespace mismatches
  'Source:ig',             // 1 — should be source:instagram-organic if useful
  'src:direct',            // 1 — abandoned naming experiment
  'medium:none',           // 1 — abandoned
  // 'Source: chatgpt.com'  KEEP — useful attribution signal

  // Geo tag at city level when we don't actually need filtering on this exact one
  'Bellevue realtor',      // 1 — agent-elsewhere noise

  // Brokerage-name tags (we're the brokerage; redundant)
  'Ryan Realty Bend',      // 3 — Title-Case marketing string

  // Pipeline scoring artifacts
  'score-2',               // 3 — old scoring scheme; not used
  'Zillow Not Ready',      // 2 — KTS Zillow status; pre-FUB

  // OSP osprey-pointe-condo* legacy doc tagging (5 variants, all misspellings)
  'osprey-pointe-condos',                            // 1
  'osprey-pointe-condo-supplemental-a-reclassific',  // 2
  'osprey-pointe-condo-supplemental-a-reclassificat',// 2
  'osprey-pointe-condo-supplemental-reclassificatio',// 2
  'osprey-pointe-condo-amd-2',                       // 3
  'osprey-pointe-condo-supplemental-reclassificat',  // 3

  // Brain automation tags — no longer used by the brain (replaced by canonical
  // seller:* tier tags). Safe to strip.
  'auto:seller-seq:watch',  // 1
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
  // sort=id is critical because PUT bumps lastActivity and would cause the
  // default lastActivity-desc cursor to revisit leads.
  let nextUrl = `/people?tags=${encodeURIComponent(tagName)}&limit=100&sort=id&fields=id,name,tags`
  while (nextUrl) {
    const { status, json } = await fubWithRetry('GET', nextUrl)
    if (status !== 200) {
      console.error(`Page failed for tag "${tagName}": status=${status}`)
      return
    }
    for (const p of (json?.people || [])) yield p
    const next = json?._metadata?.nextLink
    nextUrl = next ? next.replace(BASE, '') : null
    await new Promise(r => setTimeout(r, 100))
  }
}

async function main() {
  console.log('=== FUB Orphan Tag Cleanup ===')
  console.log(`Mode: ${DELETE ? 'EXECUTE' : 'DRY-RUN (set DELETE=1 to write)'}`)
  console.log(`Limit: ${LIMIT === Infinity ? 'no cap' : LIMIT}`)
  console.log(`Tags to strip: ${DELETE_TAGS.length}\n`)

  console.log('=== Per-tag impact (counted live, not from cached inventory) ===\n')
  const impact = {}
  let totalTouches = 0
  for (const tag of DELETE_TAGS) {
    const people = []
    for await (const p of iteratePeopleByTag(tag)) {
      people.push(p)
      if (people.length >= LIMIT) break
    }
    impact[tag] = people
    totalTouches += people.length
    console.log(`  ${String(people.length).padStart(4)}  ${tag}`)
  }

  console.log(`\nTotal lead touches: ${totalTouches}`)
  console.log(`(A lead carrying N delete-list tags gets N writes, by design — keeps the merge logic simple.)\n`)

  if (totalTouches === 0) {
    console.log('Nothing to do. All target tags are empty.')
    return
  }

  if (!DELETE) {
    console.log('Dry run. Set DELETE=1 to execute removals.')
    console.log('Each affected lead will be PUT with the targeted tag removed; all')
    console.log('other tags preserved.')
    return
  }

  console.log('--- Executing tag removals ---')
  let ok = 0, failed = 0
  let touchesDone = 0
  for (const tag of DELETE_TAGS) {
    for (const p of impact[tag]) {
      const currentTags = p.tags || []
      const newTags = currentTags.filter(t => t.toLowerCase() !== tag.toLowerCase())
      if (newTags.length === currentTags.length) {
        // The tag is gone from this person already (race condition or stale list). Skip.
        continue
      }
      const { status, text } = await fubWithRetry('PUT', `/people/${p.id}`, { tags: newTags })
      if (status >= 200 && status < 300) {
        ok++
      } else {
        failed++
        console.log(`  FAILED  id=${p.id}  tag="${tag}"  status=${status}  body=${text.slice(0, 200)}`)
      }
      touchesDone++
      if (touchesDone % 50 === 0) console.log(`  progress: ${touchesDone}/${totalTouches}`)
      await new Promise(r => setTimeout(r, 100))
    }
  }

  console.log(`\nDone. Removed: ${ok}. Failed: ${failed}.`)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
