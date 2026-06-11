#!/usr/bin/env node
/**
 * Wire Follow Up Boss smart lists via API (conditions.all + conditions.none).
 * Idempotent: PUTs filters onto existing list shells; POSTs new cross-cutting lists.
 *
 * Usage:
 *   node --env-file=.env.local scripts/westside-bend-fub-smart-lists.mjs --dry-run
 *   node --env-file=.env.local scripts/westside-bend-fub-smart-lists.mjs --apply
 */

const FUB_BASE = 'https://api.followupboss.com/v1'

const REALTOR_EXCLUDES = [
  'industry:realtor',
  'Realtor',
  'Real Estate',
  'compliance:hard-stop',
  'do_not_email',
  'Bounced',
  'Unsubscribed',
]

/** Existing neighborhood shells (id → tag slug) */
const NEIGHBORHOOD_LISTS = [
  { id: 106, name: 'Bend - Old Bend', tag: 'neighborhood:bend-old-bend' },
  { id: 107, name: 'Bend - Awbrey Butte', tag: 'neighborhood:bend-awbrey-butte' },
  { id: 108, name: 'Bend - Mountain View', tag: 'neighborhood:bend-mountain-view' },
  { id: 109, name: 'Bend - Old Farm District', tag: 'neighborhood:bend-old-farm-district' },
  { id: 110, name: 'Bend - Southwest Bend', tag: 'neighborhood:bend-southwest-bend' },
  { id: 111, name: 'Bend - Orchard District', tag: 'neighborhood:bend-orchard-district' },
  { id: 112, name: 'Bend - Larkspur', tag: 'neighborhood:bend-larkspur' },
  { id: 113, name: 'Bend - Century West', tag: 'neighborhood:bend-century-west' },
  { id: 114, name: 'Bend - Southeast Bend', tag: 'neighborhood:bend-southeast-bend' },
  { id: 115, name: 'Bend - Southern Crossing', tag: 'neighborhood:bend-southern-crossing' },
  { id: 116, name: 'Bend - Boyd Acres', tag: 'neighborhood:bend-boyd-acres' },
  { id: 104, name: 'Bend - River West', tag: 'neighborhood:bend-river-west' },
  { id: 105, name: 'Bend - Summit West', tag: 'neighborhood:bend-summit-west' },
  { id: 117, name: 'Eagle Crest', tag: 'neighborhood:eagle-crest' },
  { id: 118, name: 'Three Rivers', tag: 'neighborhood:three-rivers' },
  { id: 119, name: 'Brasada Ranch', tag: 'neighborhood:brasada-ranch' },
  { id: 120, name: 'Widgi Creek', tag: 'neighborhood:widgi-creek' },
  { id: 121, name: 'Broken Top', tag: 'neighborhood:broken-top' },
  { id: 122, name: 'Awbrey Glen', tag: 'neighborhood:awbrey-glen' },
]

/** New cross-cutting lists (POST if missing by name) */
const CROSS_LISTS = [
  { name: 'Homeowner DB — West Side All', includeTags: ['import:westside-2026-05'], excludeRealtors: true },
  { name: 'Likely Sellers — Hot', includeTags: ['seller-score:hot'], excludeRealtors: true },
  { name: 'Likely Sellers — Warm', includeTags: ['seller-score:warm'], excludeRealtors: true },
  { name: 'Out-of-State Owners', includeTags: ['geo:out-of-state'], excludeRealtors: true },
  { name: 'High Equity Owners', includeTags: ['equity:high'], excludeRealtors: true },
  { name: 'Industry Realtors — West Side', includeTags: ['industry:realtor', 'import:westside-2026-05'], excludeRealtors: false },
  { name: 'Broker Recruit Pool', includeTags: ['audience:broker-recruit'], excludeRealtors: false },
  { name: 'Needs Enrichment — West Side', includeTags: ['contact:needs-enrichment', 'import:westside-2026-05'], excludeRealtors: true },
  { name: 'Empty Nest Owners', includeTags: ['demo:empty-nest', 'import:westside-2026-05'], excludeRealtors: true },
  { name: 'Life Event — Recently Divorced', includeTags: ['life:recently-divorced', 'import:westside-2026-05'], excludeRealtors: true },
  { name: 'Life Event — Recently Moved', includeTags: ['life:recently-moved', 'import:westside-2026-05'], excludeRealtors: true },
  { name: 'Retirement Age Long-Term', includeTags: ['demo:age-55-plus', 'tenure:long-term', 'import:westside-2026-05'], excludeRealtors: true },
  { name: 'Rate Locked Owners', includeTags: ['lifecycle:rate-locked', 'import:westside-2026-05'], excludeRealtors: true },
  { name: 'Has Mobile Phone', includeTags: ['contact:mobile-phone', 'import:westside-2026-05'], excludeRealtors: true },
  { name: 'BatchData Enriched', includeTags: ['enrich:batchdata-matched', 'import:westside-2026-05'], excludeRealtors: true },
  { name: 'Likely Sellers — Cool', includeTags: ['seller-score:cool', 'import:westside-2026-05'], excludeRealtors: true },
]

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i]
    if (!t.startsWith('--')) continue
    out[t.slice(2)] = true
  }
  return out
}

function auth(apiKey) {
  return 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64')
}

function buildConditions(includeTags, excludeRealtors) {
  const all = includeTags.map((t) => ({ tags: { contains: t } }))
  const none = excludeRealtors
    ? REALTOR_EXCLUDES.map((t) => ({ tags: { contains: t } }))
    : []
  return { all, ...(none.length ? { none } : {}) }
}

async function fubJson(method, path, apiKey, body) {
  const res = await fetch(`${FUB_BASE}${path}`, {
    method,
    headers: {
      Authorization: auth(apiKey),
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-System': 'RyanRealty-Web',
      'X-System-Key': 'ryan-realty-westside-smartlists',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch {}
  return { ok: res.ok, status: res.status, data, text }
}

async function listSmartLists(apiKey) {
  const out = []
  let next = null
  do {
    const path = next ? `/smartLists?limit=100&next=${encodeURIComponent(next)}` : '/smartLists?limit=100'
    const { ok, data } = await fubJson('GET', path, apiKey)
    if (!ok) throw new Error('GET smartLists failed')
    out.push(...(data.smartlists || data.smartLists || []))
    next = data._metadata?.next || null
  } while (next)
  return out
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const apply = !!args.apply
  const apiKey = (process.env.FOLLOWUPBOSS_API_KEY || '').trim()
  if (!apiKey) {
    console.error('[smart-lists] Missing FOLLOWUPBOSS_API_KEY')
    process.exit(1)
  }

  const existing = await listSmartLists(apiKey)
  const byName = new Map(existing.map((l) => [l.name.toLowerCase(), l]))
  const actions = []

  for (const row of NEIGHBORHOOD_LISTS) {
    actions.push({
      action: 'update',
      id: row.id,
      name: row.name,
      conditions: buildConditions([row.tag], true),
    })
  }

  for (const row of CROSS_LISTS) {
    const hit = byName.get(row.name.toLowerCase())
    if (hit) {
      actions.push({
        action: 'update',
        id: hit.id,
        name: row.name,
        conditions: buildConditions(row.includeTags, row.excludeRealtors),
      })
    } else {
      actions.push({
        action: 'create',
        name: row.name,
        conditions: buildConditions(row.includeTags, row.excludeRealtors),
      })
    }
  }

  console.log(`[smart-lists] Planned ${actions.length} list updates/creates`)
  for (const a of actions) {
    console.log(`  ${a.action.padEnd(6)} ${a.name}${a.id ? ` (id ${a.id})` : ''}`)
  }

  if (!apply) {
    console.log('\n[smart-lists] Dry run. Re-run with --apply to execute.')
    return
  }

  for (const a of actions) {
    const body = { name: a.name, conditions: a.conditions }
    if (a.action === 'update') {
      const res = await fubJson('PUT', `/smartLists/${a.id}`, apiKey, body)
      console.log(res.ok ? `✓ updated ${a.name}` : `✗ update ${a.name}: ${res.status} ${res.text.slice(0, 120)}`)
    } else {
      const res = await fubJson('POST', '/smartLists', apiKey, body)
      console.log(res.ok ? `✓ created ${a.name} id=${res.data?.id}` : `✗ create ${a.name}: ${res.status} ${res.text.slice(0, 120)}`)
    }
    await new Promise((r) => setTimeout(r, 300))
  }
}

main().catch((err) => {
  console.error('[smart-lists] FATAL:', err.message)
  process.exit(1)
})
