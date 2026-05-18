#!/usr/bin/env node
/**
 * Delete the remaining 5 KTS-era action plans with live enrollments.
 *
 * State after script 05 (the last cleanup pass) left 6 active plans:
 *   - id 69 — Seller Lead — Master Workflow (KEEP, our canonical)
 *   - id 39 — *KTS AP Recent Online Activity (7 running, 2 paused — KTS legacy)
 *   - id 38 — *KTS AP Stale (1 running, 1 paused — KTS legacy)
 *   - id 34 — *KTS AP Nurture Seller (1 running, 1 paused — KTS legacy)
 *   - id 33 — *KTS AP Nurture Buyer (4 running, 1 paused — KTS legacy)
 *   - id 6  — Web Inquiry Option 01 (1 completed enrollment — pre-FUB legacy)
 *
 * Empirically verified (probe to /actionPlans/33): DELETE /actionPlans/{id} on a
 * plan with live enrollments returns 200 and transitions plan.status to
 * 'Deleted'. The historical actionPlansPeople rows persist for audit, but no
 * further steps fire. Enrolled leads remain intact (tags, assignment, custom
 * fields all preserved — verified person 21460 post-delete).
 *
 * Matt's directive: "We got to keep all of our leads." → confirmed: leads are
 * NEVER touched; only the plan record is marked deleted.
 *
 * Idempotent: re-running is safe (DELETE on already-deleted plan still 2xx).
 *
 * Run: DRY=1 (default) or DELETE=1 to execute.
 */

const FUB_KEY = process.env.FOLLOWUPBOSS_API_KEY?.trim()
const DELETE = process.env.DELETE === '1'
if (!FUB_KEY) throw new Error('Missing FOLLOWUPBOSS_API_KEY')
const BASIC = Buffer.from(`${FUB_KEY}:`).toString('base64')
const BASE = 'https://api.followupboss.com/v1'

// Hard keep — the canonical seller workflow.
const ALWAYS_KEEP_IDS = new Set([69])

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

async function listEnrollments(planId) {
  const all = []
  let nextUrl = `/actionPlansPeople?actionPlanId=${planId}&limit=100`
  while (nextUrl) {
    const { status, json } = await fubWithRetry('GET', nextUrl)
    if (status !== 200) return all
    all.push(...(json?.actionPlansPeople || []))
    const next = json?._metadata?.nextLink
    nextUrl = next ? next.replace('https://api.followupboss.com/v1', '') : null
    await new Promise(r => setTimeout(r, 100))
  }
  return all
}

async function main() {
  console.log(`=== Cleanup KTS Action Plans (remaining 5) ===`)
  console.log(`Mode: ${DELETE ? 'EXECUTE' : 'DRY-RUN (set DELETE=1 to write)'}\n`)

  const { json } = await fubWithRetry('GET', '/actionPlans?limit=100')
  const plans = (json?.actionPlans || []).filter(p => p.status === 'Active')
  console.log(`Found ${plans.length} Active action plans\n`)

  const toKeep = plans.filter(p => ALWAYS_KEEP_IDS.has(p.id))
  const toDelete = plans.filter(p => !ALWAYS_KEEP_IDS.has(p.id))

  console.log(`KEEPING (${toKeep.length}):`)
  for (const p of toKeep) {
    console.log(`  id=${p.id}  ${p.name}  contactsRunning=${p.contactsRunningCount}`)
  }

  console.log(`\nDELETING (${toDelete.length}):`)
  for (const p of toDelete) {
    const enrollments = await listEnrollments(p.id)
    const running = enrollments.filter(e => e.status === 'Running').length
    const paused = enrollments.filter(e => e.status === 'Paused').length
    const completed = enrollments.filter(e => e.status === 'Completed').length
    console.log(`  id=${p.id}  ${p.name}`)
    console.log(`    enrollments: running=${running}, paused=${paused}, completed=${completed}, total=${enrollments.length}`)
    console.log(`    person ids: [${enrollments.slice(0, 8).map(e => e.personId).join(', ')}${enrollments.length > 8 ? ', ...' : ''}]`)
  }

  if (!DELETE) {
    console.log('\nDry run. Set DELETE=1 to execute.')
    console.log('Note: leads remain intact (tags + assignment + custom fields preserved).')
    console.log('Only the plan record transitions to status=Deleted.')
    return
  }

  console.log('\n--- Executing deletions ---')
  let ok = 0, failed = 0
  for (const p of toDelete) {
    const { status, text } = await fubWithRetry('DELETE', `/actionPlans/${p.id}`)
    if (status >= 200 && status < 300) {
      console.log(`  DELETED  id=${p.id}  ${p.name}`)
      ok++
    } else {
      console.log(`  FAILED   id=${p.id}  ${p.name}  status=${status}  body=${text.slice(0, 200)}`)
      failed++
    }
    await new Promise(r => setTimeout(r, 100))
  }

  console.log(`\nDone. Deleted: ${ok}. Failed: ${failed}.`)

  // Confirm final state
  const { json: postJson } = await fubWithRetry('GET', '/actionPlans?limit=100')
  const remaining = (postJson?.actionPlans || []).filter(p => p.status === 'Active')
  console.log(`\nActive action plans remaining: ${remaining.length}`)
  for (const p of remaining) {
    console.log(`  id=${p.id}  ${p.name}  contactsRunning=${p.contactsRunningCount}`)
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
