#!/usr/bin/env node
/**
 * Builds the Buyer Lead — Master Workflow end-to-end via FUB API:
 *   - 5 buyer-specific custom fields
 *   - 7 email/SMS templates (BL-01..05, BL-S1, BL-S2)
 *   - 1 action plan (id 70 will be the next id)
 *
 * Idempotent: skips items that already exist.
 *
 * Per docs/FUB_BUYER_WORKFLOW_2026-05-17.md.
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
      'X-System-Key': 'ryan-realty-2026-buyer-workflow',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, json, text }
}

// ──────────────────────────────────────────────────────────────────────────
// 1. CUSTOM FIELDS
// ──────────────────────────────────────────────────────────────────────────

const CUSTOM_FIELDS = [
  { label: 'Buyer Budget Min',      type: 'number' },
  { label: 'Buyer Budget Max',      type: 'number' },
  { label: 'Buyer Search Areas',    type: 'text' },
  { label: 'Buyer Beds Min',        type: 'number' },
  { label: 'Buyer Move Timeline',   type: 'text' },
]

async function ensureCustomFields() {
  console.log('\n=== Custom fields ===')
  const { json } = await fub('GET', '/customFields?limit=100')
  const existing = (json.customfields || json.customFields || [])
  const existingLabels = new Set(existing.map(f => f.label?.toLowerCase()))

  const created = []
  for (const f of CUSTOM_FIELDS) {
    if (existingLabels.has(f.label.toLowerCase())) {
      const ex = existing.find(x => x.label?.toLowerCase() === f.label.toLowerCase())
      console.log(`  SKIP  ${f.label} (exists as id=${ex.id} name=${ex.name})`)
      created.push({ ...ex, _existed: true })
      continue
    }
    if (!DELETE) {
      console.log(`  [DRY] would create ${f.label}`)
      continue
    }
    const r = await fub('POST', '/customFields', f)
    if (r.status === 201) {
      console.log(`  CREATE ${f.label} → id=${r.json.id} name=${r.json.name}`)
      created.push(r.json)
    } else {
      console.error(`  FAIL  ${f.label} → ${r.status}: ${JSON.stringify(r.json)}`)
    }
  }
  return created
}

// ──────────────────────────────────────────────────────────────────────────
// 2. TEMPLATES (5 email + 2 SMS)
// ──────────────────────────────────────────────────────────────────────────

const TEMPLATES = [
  {
    name: 'BL-01 Buyer LP Confirmation',
    subject: 'Got your listing search going',
    body: `<div>Hi {{firstName}},</div>
<div>&nbsp;</div>
<div>Thanks for setting up your home search with us. I'm pulling listings that match what you're looking for right now.</div>
<div>&nbsp;</div>
<div>You'll have the first batch of matches in your inbox within 30 minutes. After that, you'll get automatic alerts whenever something new comes on the market in your criteria.</div>
<div>&nbsp;</div>
<div>If anything specific would change what I look for &mdash; a must-have feature, a deal-breaker, a neighborhood you want to skip &mdash; just reply here and I'll factor it in.</div>
<div>&nbsp;</div>
<div>Talk soon,</div>
<div>Matt Ryan</div>
<div>Ryan Realty</div>
<div>541.213.6706</div>`,
  },
  {
    name: 'BL-02 Buyer 24h Check-in',
    subject: 'Anything caught your eye?',
    body: `<div>Hi {{firstName}},</div>
<div>&nbsp;</div>
<div>I sent over the first batch of matches yesterday. Did anything look like a fit, or should I tighten the criteria?</div>
<div>&nbsp;</div>
<div>If you want to see one in person, I can set up a tour this week. Just let me know which ones.</div>
<div>&nbsp;</div>
<div>Matt</div>
<div>541.213.6706</div>`,
  },
  {
    name: 'BL-03 Buyer Market Intel',
    subject: 'Where the market is right now in your search areas',
    body: `<div>Hi {{firstName}},</div>
<div>&nbsp;</div>
<div>A quick read on what's happening in the areas you're searching:</div>
<div>&nbsp;</div>
<div>Months of supply is moving, days on market is shifting, and a few good listings are sitting longer than they should &mdash; which can mean room to negotiate.</div>
<div>&nbsp;</div>
<div>If you want a deeper breakdown specific to your price range, reply here and I'll pull the numbers.</div>
<div>&nbsp;</div>
<div>Matt</div>`,
  },
  {
    name: 'BL-04 Buyer Featured Listing',
    subject: 'Worth a look',
    body: `<div>Hi {{firstName}},</div>
<div>&nbsp;</div>
<div>This one just hit the market and matches what you're looking for. Wanted you to see it before it gets the foot traffic.</div>
<div>&nbsp;</div>
<div>Want to tour this week?</div>
<div>&nbsp;</div>
<div>Matt</div>`,
  },
  {
    name: 'BL-05 Buyer Soft Check-in',
    subject: 'Still looking?',
    body: `<div>Hi {{firstName}},</div>
<div>&nbsp;</div>
<div>It's been a few weeks since we started your search. No pressure either way &mdash; just wanted to check in.</div>
<div>&nbsp;</div>
<div>If your criteria has shifted at all, let me know. If you're paused, I'll keep the alerts coming so you've got the picture when you're ready.</div>
<div>&nbsp;</div>
<div>Matt</div>
<div>541.213.6706</div>`,
  },
  {
    name: 'BL-S1 Buyer SMS Confirmation',
    body: `Hey {{firstName}}, Matt from Ryan Realty. Got your search going. First batch of listings in your inbox in ~30 min. Anything I should factor in?`,
    smsOnly: true,
  },
  {
    name: 'BL-S2 Buyer SMS Check-in',
    body: `Hi {{firstName}}, Matt checking in. Any of those listings worth a tour this week?`,
    smsOnly: true,
  },
]

async function ensureTemplates() {
  console.log('\n=== Templates ===')
  const all = []
  let next = '/templates?limit=100'
  while (next) {
    const r = await fub('GET', next)
    for (const t of (r.json?.templates || [])) all.push(t)
    const nl = r.json?._metadata?.nextLink
    next = nl ? nl.replace('https://api.followupboss.com/v1', '') : null
  }
  const existingNames = new Set(all.map(t => t.name))

  const created = []
  for (const tpl of TEMPLATES) {
    if (existingNames.has(tpl.name)) {
      const ex = all.find(t => t.name === tpl.name)
      console.log(`  SKIP  ${tpl.name} (exists as id=${ex.id})`)
      created.push({ ...ex, _existed: true })
      continue
    }
    if (!DELETE) {
      console.log(`  [DRY] would create ${tpl.name}`)
      continue
    }
    // SMS-only templates: no subject
    const body = tpl.smsOnly
      ? { name: tpl.name, body: tpl.body }
      : { name: tpl.name, subject: tpl.subject, body: tpl.body }
    const r = await fub('POST', '/templates', body)
    if (r.status === 201) {
      console.log(`  CREATE ${tpl.name} → id=${r.json.id}`)
      created.push(r.json)
    } else {
      console.error(`  FAIL  ${tpl.name} → ${r.status}: ${JSON.stringify(r.json).slice(0, 200)}`)
    }
  }
  return created
}

// ──────────────────────────────────────────────────────────────────────────
// 3. ACTION PLAN
// ──────────────────────────────────────────────────────────────────────────

async function createActionPlan(templates) {
  console.log('\n=== Action plan ===')
  // Check if it already exists
  const { json } = await fub('GET', '/actionPlans?limit=100')
  const existing = (json?.actionPlans || []).find(p => p.name === 'Buyer Lead — Master Workflow' && p.status === 'Active')
  if (existing) {
    console.log(`  SKIP  Buyer Lead — Master Workflow already exists as id=${existing.id}`)
    return existing
  }

  if (!DELETE) {
    console.log('  [DRY] would create Buyer Lead — Master Workflow')
    return null
  }

  // Build template lookup
  const byName = {}
  for (const t of templates) byName[t.name] = t

  const sl01 = byName['BL-01 Buyer LP Confirmation']
  const slS1 = byName['BL-S1 Buyer SMS Confirmation']
  const sl02 = byName['BL-02 Buyer 24h Check-in']
  const slS2 = byName['BL-S2 Buyer SMS Check-in']
  const sl03 = byName['BL-03 Buyer Market Intel']
  const sl04 = byName['BL-04 Buyer Featured Listing']
  const sl05 = byName['BL-05 Buyer Soft Check-in']

  const planBody = {
    name: 'Buyer Lead — Master Workflow',
    stopOnContacted: true,
    sendToAll: false,
    delaySmsMinutes: 1,
  }

  const r = await fub('POST', '/actionPlans', planBody)
  if (r.status !== 201) {
    console.error(`  FAIL create plan: ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`)
    return null
  }
  const planId = r.json.id
  console.log(`  CREATE Buyer Lead — Master Workflow → id=${planId}`)
  console.log(`\n  NOTE: action plan steps must be added via FUB UI — POST /v1/actionPlans/{id}/steps is not exposed to integrations.`)
  console.log(`  See docs/FUB_BUYER_WORKFLOW_2026-05-17.md §4 for the step table to enter.`)
  return r.json
}

// ──────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Mode: ${DELETE ? 'EXECUTE' : 'DRY-RUN'}`)
  const cfs = await ensureCustomFields()
  const tpls = await ensureTemplates()
  const plan = await createActionPlan(tpls)

  console.log('\n=== Summary ===')
  console.log(`  Custom fields:  ${cfs.length}`)
  console.log(`  Templates:      ${tpls.length}`)
  console.log(`  Action plan:    ${plan ? `id=${plan.id}` : '(not created)'}`)
  if (!DELETE) console.log('\n  → re-run with DELETE=1 to execute.')
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
