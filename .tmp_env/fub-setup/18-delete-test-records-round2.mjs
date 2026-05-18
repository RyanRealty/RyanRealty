#!/usr/bin/env node
/**
 * Delete the 14 test/junk records identified in the round-2 audit.
 * See docs/FUB_OPTIMIZATION_AUDIT_2026-05-17.md §14.
 */

const FUB_KEY = process.env.FOLLOWUPBOSS_API_KEY?.trim()
const DELETE = process.env.DELETE === '1'
if (!FUB_KEY) throw new Error('Missing FOLLOWUPBOSS_API_KEY')
const BASIC = Buffer.from(`${FUB_KEY}:`).toString('base64')

async function fub(method, path) {
  const res = await fetch(`https://api.followupboss.com/v1${path}`, {
    method,
    headers: { Authorization: `Basic ${BASIC}` },
  })
  return res.status
}

// From audit §14 — explicit ids of test/junk records
const TEST_IDS = [
  { id: 10561, why: 'No name (Zillow)' },
  { id: 10560, why: 'No name (Zillow)' },
  { id: 10606, why: 'KTS Test Contact' },
  { id: 10615, why: 'Testet Testete' },
  { id: 10618, why: 'Santiago AgentFire Test' },
  { id: 10619, why: 'Test Test' },
  { id: 10620, why: 'Sant Test' },
  { id: 10623, why: 'New Test Lead' },
  { id: 10625, why: 'Minel AgentFire Test' },
  { id: 15053, why: 'No name Name (Sphere)' },
  { id: 21456, why: 'No name Name (Import)' },
  { id: 21457, why: 'No name Name (Import)' },
  { id: 21823, why: 'Test2 Test2' },
  { id: 21950, why: 'No name Name (preview env)' },
]

console.log(`Mode: ${DELETE ? 'EXECUTE' : 'DRY-RUN'}`)
console.log(`Targets: ${TEST_IDS.length} test records\n`)

let ok = 0, fail = 0
for (const t of TEST_IDS) {
  if (!DELETE) { console.log(`  [DRY] would delete id=${t.id} — ${t.why}`); continue }
  const status = await fub('DELETE', `/people/${t.id}`)
  if (status >= 200 && status < 300) {
    console.log(`  DELETED id=${t.id} — ${t.why}`)
    ok++
  } else {
    console.log(`  FAIL    id=${t.id} status=${status} — ${t.why}`)
    fail++
  }
  await new Promise(r => setTimeout(r, 100))
}

if (DELETE) console.log(`\nDone. Deleted ${ok}, Failed ${fail}.`)
