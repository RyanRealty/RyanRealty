#!/usr/bin/env node
/**
 * Delete the dead action plans from FUB so the picker is clean.
 *
 * Keep:
 *   - id 69  Seller Lead — Master Workflow (just created)
 *   - id 33  *KTS AP Nurture Buyer (4 live enrollments — keep until buyer rebuild)
 *   - id 34  *KTS AP Nurture Seller (1 live enrollment — keep until that lead exits)
 *
 * Delete EVERYTHING else (60+ plans). Confirmed safe because:
 *   - Only 5 plans have any contactsRunningCount > 0 (audit §4)
 *   - Of those 5, we're keeping 2 (33 and 34). The other 3 are KTS legacy
 *     with no real workflow:
 *       id 39 *KTS AP Recent Online Activity (7 enrollments — purely an
 *             "online activity" tracker, no business value)
 *       id 6  Web Inquiry Option 01 (1 enrollment — old web inquiry plan
 *             superseded by the new master workflow)
 *       id 38 *KTS AP Stale (1 enrollment — KTS "lead has gone stale"
 *             reminder, replaced by seller:long-nurture tag)
 *
 * Run: DRY=1 (default) or DRY=0 to execute.
 */

const FUB_KEY = process.env.FOLLOWUPBOSS_API_KEY?.trim()
const DRY = process.env.DRY !== '0'
if (!FUB_KEY) throw new Error('Missing FOLLOWUPBOSS_API_KEY')
const BASIC = Buffer.from(`${FUB_KEY}:`).toString('base64')

// Always keep: the new canonical workflow + any plan with live enrollments
// (auto-detected at run time below). Manual additions go here.
const ALWAYS_KEEP_IDS = new Set([
  69,  // Seller Lead — Master Workflow (the new canonical one)
])

async function fub(method, path) {
  const res = await fetch(`https://api.followupboss.com/v1${path}`, {
    method,
    headers: {
      'Authorization': `Basic ${BASIC}`,
      'Content-Type': 'application/json',
      'X-System': 'RyanRealty-Web',
      'X-System-Key': 'ryan-realty-2026-seller-workflow',
    },
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, json, text }
}

async function main() {
  console.log(`=== Delete Dead Action Plans ===`)
  console.log(`Mode: ${DRY ? 'DRY-RUN' : 'EXECUTE'}\n`)

  const { json } = await fub('GET', '/actionPlans?limit=100')
  const plans = json?.actionPlans || []
  console.log(`Found ${plans.length} action plans total\n`)

  // Compute the keep set: ALWAYS_KEEP + any plan with live enrollments.
  const KEEP_IDS = new Set(ALWAYS_KEEP_IDS)
  for (const p of plans) {
    if ((p.contactsRunningCount || 0) > 0) KEEP_IDS.add(p.id)
  }

  const toDelete = plans.filter(p => !KEEP_IDS.has(p.id))
  const toKeep = plans.filter(p => KEEP_IDS.has(p.id))

  console.log(`KEEPING (${toKeep.length}):`)
  for (const p of toKeep) {
    console.log(`  id=${p.id}  ${p.name}  (contactsRunning=${p.contactsRunningCount}, isUsed=${p.isUsed}, steps=${p.stepCount ?? '?'})`)
  }

  console.log(`\nDELETING (${toDelete.length}):`)
  for (const p of toDelete) {
    console.log(`  id=${p.id}  ${p.name}  (contactsRunning=${p.contactsRunningCount}, isUsed=${p.isUsed})`)
  }

  if (DRY) {
    console.log('\nDry run. Set DRY=0 to execute deletions.')
    return
  }

  console.log('\n--- Executing deletions ---')
  let ok = 0, failed = 0
  for (const p of toDelete) {
    const { status } = await fub('DELETE', `/actionPlans/${p.id}`)
    if (status >= 200 && status < 300) {
      console.log(`  DELETED  id=${p.id}  ${p.name}`)
      ok++
    } else {
      console.log(`  FAILED   id=${p.id}  ${p.name}  status=${status}`)
      failed++
    }
    // Be friendly to rate limits
    await new Promise(r => setTimeout(r, 80))
  }

  console.log(`\nDone. Deleted: ${ok}. Failed: ${failed}.`)

  const { json: postJson } = await fub('GET', '/actionPlans?limit=100')
  console.log(`Total action plans now: ${(postJson?.actionPlans || []).length}`)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
