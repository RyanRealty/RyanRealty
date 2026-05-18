#!/usr/bin/env node
/**
 * Per Matt's directive: "make sure that all the other action plans and
 * everything else is cleaned up. We want this very simplified, just using
 * stuff that we've built."
 *
 * Hides every template that isn't one of our 14 canonical SL/BL templates.
 * Uses the isShared:false trick (FUB allows it; templates vanish from
 * picker). Renames to "zzzArchived <orig>" for traceability if anyone
 * ever needs to find them.
 *
 * Run: DELETE=1 to execute (default dry-run).
 */

const FUB_KEY = process.env.FOLLOWUPBOSS_API_KEY?.trim()
const DELETE = process.env.DELETE === '1'
if (!FUB_KEY) throw new Error('Missing FOLLOWUPBOSS_API_KEY')
const BASIC = Buffer.from(`${FUB_KEY}:`).toString('base64')

// Our 14 canonical templates — keep these
const KEEP_NAMES = new Set([
  'SL-01 Seller LP Confirmation',
  'SL-02 Seller CMA Check-in',
  'SL-03 Seller Market Update',
  'SL-04 Seller Case Study',
  'SL-05 Seller Soft Check-in',
  'SL-S1 Seller SMS Confirmation',
  'SL-S2 Seller SMS Check-in',
  'BL-01 Buyer LP Confirmation',
  'BL-02 Buyer 24h Check-in',
  'BL-03 Buyer Market Intel',
  'BL-04 Buyer Featured Listing',
  'BL-05 Buyer Soft Check-in',
  'BL-S1 Buyer SMS Confirmation',
  'BL-S2 Buyer SMS Check-in',
])

async function fub(method, path, body = null) {
  const res = await fetch(`https://api.followupboss.com/v1${path}`, {
    method,
    headers: { Authorization: `Basic ${BASIC}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (method === 'GET') return await res.json()
  return res.status
}

async function main() {
  console.log(`Mode: ${DELETE ? 'EXECUTE' : 'DRY-RUN'}\n`)

  const all = []
  let next = '/templates?limit=100'
  while (next) {
    const j = await fub('GET', next)
    for (const t of (j?.templates || [])) all.push(t)
    const nl = j?._metadata?.nextLink
    next = nl ? nl.replace('https://api.followupboss.com/v1', '') : null
  }
  console.log(`Total visible templates: ${all.length}`)

  const toHide = all.filter(t => !KEEP_NAMES.has(t.name) && !t.name?.startsWith('zzzArchived'))
  console.log(`Templates to hide: ${toHide.length}`)
  console.log(`Templates kept: ${KEEP_NAMES.size}\n`)

  if (!DELETE) {
    console.log('First 20 candidates:')
    for (const t of toHide.slice(0, 20)) console.log(`  id=${t.id} ${t.name}`)
    console.log(`\nDry-run. Set DELETE=1 to hide.`)
    return
  }

  let ok = 0, fail = 0
  for (const t of toHide) {
    const status = await fub('PUT', `/templates/${t.id}`, {
      name: `zzzArchived ${t.name}`,
      subject: 'archived',
      body: 'archived',
      isShared: false,
    })
    if (status >= 200 && status < 300) {
      ok++
      if (ok % 25 === 0) console.log(`  hidden ${ok}/${toHide.length}…`)
    } else {
      fail++
      console.log(`  FAIL id=${t.id} ${t.name} status=${status}`)
    }
    await new Promise(r => setTimeout(r, 80))
  }
  console.log(`\nDone. Hidden ${ok}, failed ${fail}.`)

  // Verify
  const after = []
  let n2 = '/templates?limit=100'
  while (n2) {
    const j = await fub('GET', n2)
    for (const t of (j?.templates || [])) after.push(t)
    const nl = j?._metadata?.nextLink
    n2 = nl ? nl.replace('https://api.followupboss.com/v1', '') : null
  }
  console.log(`Templates visible after: ${after.length}`)
  console.log('Visible names:')
  for (const t of after.sort((a, b) => (a.name || '').localeCompare(b.name || ''))) {
    console.log(`  id=${String(t.id).padStart(4)} ${t.name}`)
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
