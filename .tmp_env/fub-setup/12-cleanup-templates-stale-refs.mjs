#!/usr/bin/env node
/**
 * Second pass on email templates: delete templates whose only "linkage" is
 * to action plans that are themselves DELETED.
 *
 * Script 06 kept anything referencing an action plan. After 64+ action plans
 * were deleted (status: 'Deleted' in FUB), those template references became
 * stale. This script:
 *
 *   1. Fetches all action plans with their status (Active vs Deleted).
 *   2. Builds a set of currently-active action plan ids.
 *   3. For each template, treats "linkage" as referencing at least one
 *      ACTIVE plan or active automation.
 *   4. Deletes templates that link only to deleted plans (and meet other
 *      deletion criteria below).
 *
 * KEEP if:
 *   - id in EXPLICIT_KEEP_IDS (SL-01..05 + Matt's recent custom templates)
 *   - name starts with "Ryan Realty"
 *   - name starts with "Rebecca"
 *   - name starts with "SL-"
 *   - linked to an ACTIVE action plan
 *   - linked to an ACTIVE automation
 *   - updated within last 90 days AND name not starting with "*KTS"
 *
 * DELETE if none of the keep rules apply.
 *
 * Run: DELETE=1 to execute; otherwise dry-run.
 */

const FUB_KEY = process.env.FOLLOWUPBOSS_API_KEY?.trim()
const DELETE = process.env.DELETE === '1'
if (!FUB_KEY) throw new Error('Missing FOLLOWUPBOSS_API_KEY')
const BASIC = Buffer.from(`${FUB_KEY}:`).toString('base64')
const BASE = 'https://api.followupboss.com/v1'

const EXPLICIT_KEEP_IDS = new Set([
  672, 673, 674, 675, 676,  // SL-01..05
  670,  // Tumalo Reservoir Rd Open House
  666,  // Sunstone Loop Caldera Springs Owners
  637, 634, 631, 630,  // Recent Matt-authored expired pitches
])

const NINETY_DAYS_AGO = Date.now() - 90 * 24 * 60 * 60 * 1000

async function fub(method, p, body = null) {
  const res = await fetch(`${BASE}${p}`, {
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

async function fubWithRetry(method, p, body = null) {
  let r = await fub(method, p, body)
  if (r.status === 429) {
    await new Promise(r => setTimeout(r, 2000))
    r = await fub(method, p, body)
  }
  return r
}

async function listActiveActionPlanIds() {
  const ids = new Set()
  const { json } = await fub('GET', '/actionPlans?limit=100')
  for (const p of json?.actionPlans || []) {
    if (p.status === 'Active') ids.add(p.id)
  }
  return ids
}

async function listAllTemplates() {
  const all = []
  let next = '/templates?limit=100'
  while (next) {
    const { json } = await fub('GET', next)
    const items = json?.templates || []
    all.push(...items)
    const nextLink = json._metadata?.nextLink
    next = nextLink ? nextLink.replace('https://api.followupboss.com/v1', '') : null
    await new Promise(r => setTimeout(r, 100))
  }
  return all
}

function decide(t, activePlanIds) {
  if (EXPLICIT_KEEP_IDS.has(t.id)) return { keep: true, reason: 'explicit-keep' }

  const name = t.name || ''
  if (name.startsWith('Ryan Realty')) return { keep: true, reason: 'name-Ryan-Realty' }
  if (name.startsWith('Rebecca')) return { keep: true, reason: 'name-Rebecca' }
  if (name.startsWith('SL-')) return { keep: true, reason: 'name-SL-' }

  // Active-only plan linkage
  const planRefs = (t.actionPlans || []).map(p => p.id)
  const activePlanLinks = planRefs.filter(id => activePlanIds.has(id))
  if (activePlanLinks.length > 0) {
    return { keep: true, reason: `linked-active-plan(${activePlanLinks.join(',')})` }
  }
  const deadPlanLinks = planRefs.filter(id => !activePlanIds.has(id))

  // Automation linkage — keep if any
  const autos = (t.automations || []).map(a => a.id)
  if (autos.length > 0) {
    return { keep: true, reason: `linked-automation(${autos.join(',')})` }
  }

  // Recent template not from KTS
  const updatedMs = Date.parse(t.updated)
  if (Number.isFinite(updatedMs) && updatedMs >= NINETY_DAYS_AGO && !name.startsWith('*KTS')) {
    return { keep: true, reason: 'recent-non-kts' }
  }

  return {
    keep: false,
    reason: deadPlanLinks.length
      ? `stale-plan-refs(${deadPlanLinks.join(',')})`
      : 'no-linkage',
  }
}

async function main() {
  console.log(`=== Templates stale-ref cleanup ===`)
  console.log(`Mode: ${DELETE ? 'EXECUTE' : 'DRY-RUN'}\n`)

  const activePlanIds = await listActiveActionPlanIds()
  console.log(`Active action plans: [${[...activePlanIds].join(', ')}]`)

  const templates = await listAllTemplates()
  console.log(`Templates total: ${templates.length}\n`)

  const toDelete = []
  const toKeep = []
  for (const t of templates) {
    const d = decide(t, activePlanIds)
    if (d.keep) toKeep.push({ ...t, _reason: d.reason })
    else toDelete.push({ ...t, _reason: d.reason })
  }

  console.log(`KEEPING: ${toKeep.length}`)
  console.log(`DELETING: ${toDelete.length}\n`)

  // Sample
  console.log('First 30 to delete:')
  for (const t of toDelete.slice(0, 30)) {
    console.log(`  id=${String(t.id).padStart(4)} ${(t.name || '').padEnd(50)} [${t._reason}]`)
  }
  console.log('...')
  console.log('\nKeep reason histogram:')
  const reasonCount = {}
  for (const t of toKeep) reasonCount[t._reason.split('(')[0]] = (reasonCount[t._reason.split('(')[0]] || 0) + 1
  for (const [r, c] of Object.entries(reasonCount).sort((a,b) => b[1] - a[1])) {
    console.log(`  ${String(c).padStart(4)} ${r}`)
  }

  if (!DELETE) {
    console.log('\nDry run. Set DELETE=1 to execute.')
    return
  }

  console.log('\n--- Executing deletions ---')
  let ok = 0, failed = 0
  for (const t of toDelete) {
    // Guard: never delete an explicit-keep id, even if logic above said so
    if (EXPLICIT_KEEP_IDS.has(t.id)) continue
    const { status } = await fubWithRetry('DELETE', `/templates/${t.id}`)
    if (status >= 200 && status < 300) ok++
    else { failed++; console.log(`  FAIL id=${t.id} status=${status}`) }
    if (ok % 50 === 0 && ok > 0) console.log(`  deleted ${ok}…`)
    await new Promise(r => setTimeout(r, 100))
  }
  console.log(`\nDone. Deleted: ${ok}. Failed: ${failed}.`)

  // Verify
  const after = await listAllTemplates()
  console.log(`Templates remaining: ${after.length}`)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
