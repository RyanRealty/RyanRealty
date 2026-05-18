#!/usr/bin/env node
/**
 * KTS templates can't be deleted (isDeletable: false / 403 on DELETE) but
 * CAN be hidden by setting isShared:false via PUT. Once hidden, they don't
 * appear in Matt's template picker — verified via GET returning 404 after
 * the flip.
 *
 * Strategy: PUT every *KTS-prefixed template with:
 *   - name: "zzzArchived <original>" (in case it ever resurfaces)
 *   - subject: "archived"
 *   - body: "archived"
 *   - isShared: false  ← this is the actual hide flag
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
  if (method === 'GET') return await res.json()
  return res.status
}

console.log(`=== Hide KTS templates (isShared:false) ===`)
console.log(`Mode: ${DELETE ? 'EXECUTE' : 'DRY-RUN'}\n`)

const all = []
let next = '/templates?limit=100'
while (next) {
  const j = await fub('GET', next)
  for (const t of (j.templates || [])) all.push(t)
  const nl = j._metadata?.nextLink
  next = nl ? nl.replace('https://api.followupboss.com/v1', '') : null
}
console.log(`Total visible templates: ${all.length}`)

const kts = all.filter(t => (t.name || '').startsWith('*KTS'))
console.log(`*KTS templates to hide: ${kts.length}`)

if (!DELETE) {
  console.log('Dry run. Set DELETE=1 to hide.')
  process.exit(0)
}

let ok = 0, fail = 0
for (const t of kts) {
  const status = await fub('PUT', `/templates/${t.id}`, {
    name: `zzzArchived ${t.name}`,
    subject: 'archived',
    body: 'archived',
    isShared: false,
  })
  if (status >= 200 && status < 300) ok++
  else { fail++; console.log(`  FAIL id=${t.id} ${t.name?.slice(0,40)} status=${status}`) }
  if (ok > 0 && ok % 50 === 0) console.log(`  hidden ${ok}/${kts.length}…`)
  await new Promise(r => setTimeout(r, 100))
}
console.log(`\nDone. Hidden: ${ok}, Failed: ${fail}`)

// Verify the new total
const after = []
let n2 = '/templates?limit=100'
while (n2) {
  const j = await fub('GET', n2)
  for (const t of (j.templates || [])) after.push(t)
  const nl = j._metadata?.nextLink
  n2 = nl ? nl.replace('https://api.followupboss.com/v1', '') : null
}
console.log(`Templates visible after: ${after.length}`)
