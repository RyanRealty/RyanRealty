#!/usr/bin/env node
/**
 * Cleanup orphan / KTS-era email templates.
 *
 * Audit (2026-05-17) shows 674 templates total. ~530 are *KTS legacy imports
 * that supported the 63 dead action plans we just deleted. Another ~58 are
 * orphaned (not linked to any action plan or automation). Total deletable
 * surface: ~588.
 *
 * Rule (in order of precedence — most permissive wins):
 *
 *   KEEP if:
 *     1. id is in EXPLICIT_KEEP_IDS (manual allowlist — the new SL-* set, Matt's
 *        recent Mar-Apr 2026 customs, plus belt-and-suspenders for anything
 *        Matt names)
 *     2. name starts with "Ryan Realty" (27 Matt-authored)
 *     3. name starts with "Rebecca" (Rebecca-authored)
 *     4. linked to ≥1 active action plan (template.actionPlans.length > 0)
 *     5. linked to ≥1 active automation (template.automations.length > 0)
 *     6. recent (updated within last 90 days) AND not a KTS template
 *
 *   DELETE if:
 *     - name starts with "*KTS"  (KTS Kunversion migration artifacts)
 *     - OR no plan/automation linkage AND not in keep-list AND name does
 *       not match the keep-name patterns
 *
 * Hard guard: the deletion list is filtered AGAIN at write time against the
 * EXPLICIT_KEEP_IDS set — even if logic above would mark a kept template
 * deletable, the write step refuses.
 *
 * Run: DRY=1 (default) or DELETE=1 to execute.
 */

const FUB_KEY = process.env.FOLLOWUPBOSS_API_KEY?.trim()
const DELETE = process.env.DELETE === '1'
if (!FUB_KEY) throw new Error('Missing FOLLOWUPBOSS_API_KEY')
const BASIC = Buffer.from(`${FUB_KEY}:`).toString('base64')
const BASE = 'https://api.followupboss.com/v1'

// Hard keep set. Even if the logic below tries to delete one of these, the
// write step bails.
const EXPLICIT_KEEP_IDS = new Set([
  // New SL-* canonical seller workflow (ids 672-676)
  672, 673, 674, 675, 676,
  // Matt's recent custom templates (Mar-Apr 2026)
  670, // Tumalo Reservoir Rd Open House
  666, // Sunstone Loop Caldera Springs Owners
  637, // Expired 5
  634, // Expired 2
  631, // Rebecca - Expired Listing
  630, // Expired Listing - Initial Email
])

// Recent-update window: any template touched in the last 90 days that is
// not a KTS artifact stays for review (this avoids deleting Matt's
// in-flight drafts).
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000
const RECENT_CUTOFF = new Date(Date.now() - NINETY_DAYS_MS).toISOString()

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
  let { status, json, text } = await fub(method, path, body)
  if (status === 429) {
    await new Promise(r => setTimeout(r, 2000))
    ;({ status, json, text } = await fub(method, path, body))
  }
  return { status, json, text }
}

async function fetchAllTemplates() {
  const all = []
  let nextUrl = '/templates?limit=100'
  while (nextUrl) {
    const { status, json } = await fubWithRetry('GET', nextUrl)
    if (status !== 200) {
      throw new Error(`Failed to fetch templates: status=${status}`)
    }
    all.push(...(json?.templates || []))
    const next = json?._metadata?.nextLink
    nextUrl = next ? next.replace('https://api.followupboss.com/v1', '') : null
    await new Promise(r => setTimeout(r, 100))
  }
  return all
}

function classify(t) {
  // Returns { keep: boolean, reason: string }
  const name = t.name || ''
  const lowerName = name.toLowerCase()

  // Hard keep
  if (EXPLICIT_KEEP_IDS.has(t.id)) return { keep: true, reason: 'explicit-keep-id' }

  // Linked to ≥1 plan or automation
  if ((t.actionPlans || []).length > 0) {
    return { keep: true, reason: `linked-to-plan(${t.actionPlans.map(p => p.id).join(',')})` }
  }
  if ((t.automations || []).length > 0) {
    return { keep: true, reason: `linked-to-automation(${t.automations.map(a => a.id).join(',')})` }
  }

  // KTS = always delete (assuming not linked, checked above)
  if (lowerName.startsWith('*kts') || lowerName.startsWith('kts')) {
    return { keep: false, reason: 'kts-legacy' }
  }

  // Author-pattern keep
  if (name.startsWith('Ryan Realty')) return { keep: true, reason: 'ryan-realty-authored' }
  if (name.startsWith('Rebecca')) return { keep: true, reason: 'rebecca-authored' }

  // Recently updated non-KTS = keep (Matt's drafts in flight)
  if (t.updated && t.updated >= RECENT_CUTOFF) {
    return { keep: true, reason: 'recently-updated' }
  }

  // Default = orphan, deletable
  return { keep: false, reason: 'orphan-no-linkage' }
}

async function main() {
  console.log('=== FUB Template Cleanup ===')
  console.log(`Mode: ${DELETE ? 'EXECUTE (writes will happen)' : 'DRY-RUN (set DELETE=1 to write)'}\n`)

  console.log('Fetching all templates (paginated)...')
  const templates = await fetchAllTemplates()
  console.log(`Found ${templates.length} templates total.\n`)

  const decisions = templates.map(t => ({ template: t, ...classify(t) }))

  const toKeep = decisions.filter(d => d.keep)
  const toDelete = decisions.filter(d => !d.keep)

  // Breakdown
  const ktsCount = toDelete.filter(d => d.reason === 'kts-legacy').length
  const orphanCount = toDelete.filter(d => d.reason === 'orphan-no-linkage').length

  console.log(`=== Summary ===`)
  console.log(`  KEEP:   ${toKeep.length}`)
  console.log(`  DELETE: ${toDelete.length}`)
  console.log(`    KTS legacy:        ${ktsCount}`)
  console.log(`    Orphan (no link):  ${orphanCount}`)
  console.log()

  // Reasons breakdown for keepers (sanity check)
  const keepByReason = {}
  for (const d of toKeep) keepByReason[d.reason] = (keepByReason[d.reason] || 0) + 1
  console.log('=== Keep reasons ===')
  for (const [r, n] of Object.entries(keepByReason).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${r}`)
  }
  console.log()

  console.log(`=== First 30 to KEEP (sample) ===`)
  for (const d of toKeep.slice(0, 30)) {
    console.log(`  id=${String(d.template.id).padStart(4)}  ${(d.template.name || '').slice(0, 65).padEnd(65)}  [${d.reason}]`)
  }
  console.log()

  console.log(`=== First 30 to DELETE (sample) ===`)
  for (const d of toDelete.slice(0, 30)) {
    console.log(`  id=${String(d.template.id).padStart(4)}  ${(d.template.name || '').slice(0, 65).padEnd(65)}  [${d.reason}]`)
  }
  console.log()

  if (!DELETE) {
    console.log('Dry run. Set DELETE=1 to execute.')
    console.log(`Would delete ${toDelete.length} templates, keep ${toKeep.length}.`)
    return
  }

  console.log('--- Executing deletions ---')
  let ok = 0, failed = 0, refused = 0
  for (const d of toDelete) {
    // Belt and suspenders: refuse to delete an explicit-keep id even if
    // logic above flagged it (shouldn't happen, but cheap insurance).
    if (EXPLICIT_KEEP_IDS.has(d.template.id)) {
      console.log(`  REFUSED  id=${d.template.id}  ${d.template.name}  (explicit-keep-id collision)`)
      refused++
      continue
    }
    const { status, json } = await fubWithRetry('DELETE', `/templates/${d.template.id}`)
    if (status >= 200 && status < 300) {
      ok++
      if (ok % 25 === 0) console.log(`  progress: ${ok}/${toDelete.length}`)
    } else {
      console.log(`  FAILED  id=${d.template.id}  status=${status}  body=${JSON.stringify(json).slice(0, 200)}`)
      failed++
    }
    await new Promise(r => setTimeout(r, 100))
  }

  console.log()
  console.log(`Done. Deleted: ${ok}. Failed: ${failed}. Refused: ${refused}.`)

  // Verify post-state
  const { json: postJson } = await fubWithRetry('GET', '/templates?limit=1')
  console.log(`Templates remaining: ${postJson?._metadata?.total ?? '?'}`)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
