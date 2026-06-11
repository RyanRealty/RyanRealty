#!/usr/bin/env node
/**
 * Provision the FollowUp Boss account for the west-side Bend homeowner
 * import: ensure the "Seller Prospect" stage exists and create every custom
 * field the import CSV references. Idempotent — safe to re-run.
 *
 * Reuses Matt's existing seller-side fields where they match
 * (customSellerPropertyAddress, customLeadTier). Creates the rest.
 *
 * Field naming: FUB camelCases the API name from the display name
 * automatically when created via the API. E.g. display "Purchase Price"
 * becomes API name `customPurchasePrice`. Our CSV import column "Custom
 * Purchase Price" maps onto the same field.
 *
 * Usage:
 *   node --env-file=.env.local scripts/westside-bend-fub-provision.mjs --dry-run
 *   node --env-file=.env.local scripts/westside-bend-fub-provision.mjs --apply
 */

const FUB_BASE = 'https://api.followupboss.com/v1'

const DESIRED_STAGES = [
  { name: 'Seller Prospect', description: 'Cold homeowner database — west-side Bend campaign and future farm imports' },
]

// Display name → field type. The FUB API will store these as
// `custom<PascalCaseOfName>`. Order in this array is the order they will
// appear in the FUB UI.
const DESIRED_CUSTOM_FIELDS = [
  // Reused / already exist (we check first, only create if missing).
  // Seller Property Address already exists as customSellerPropertyAddress.

  // Owner / property
  { name: 'Purchase Price', type: 'number' },
  { name: 'Purchase Year', type: 'number' },
  { name: 'Estimated Market Value', type: 'number' },
  { name: 'Equity Pct', type: 'number' },
  { name: 'Years Owned', type: 'number' },
  { name: 'Last Purchase Date', type: 'date' },
  { name: 'APN', type: 'text' },
  { name: 'Subdivision', type: 'text' },
  { name: 'Neighborhood', type: 'text' },
  { name: 'Planned Community', type: 'text' },
  { name: 'Bedrooms', type: 'number' },
  { name: 'Baths', type: 'number' },
  { name: 'Building Sqft', type: 'number' },
  { name: 'Lot Acres', type: 'number' },
  { name: 'Year Built', type: 'number' },

  // Score
  { name: 'Seller Score', type: 'number' },
  { name: 'Seller Score Band', type: 'text' },
  { name: 'Classification', type: 'text' },

  // Realtor / brokerage
  { name: 'Brokerage', type: 'text' },
  { name: 'Realtor License', type: 'text' },
  { name: 'Realtor License Type', type: 'text' },

  // FB-CAS routing (internal CRM flag — not Meta export)
  { name: 'Include In FB CAS', type: 'text' },

  // BatchData demographics (empty until skip trace runs)
  { name: 'Owner Age', type: 'number' },
  { name: 'Owner Age Range', type: 'text' },
  { name: 'Birthday', type: 'date' },
  { name: 'Gender', type: 'text' },
  { name: 'Marital Status', type: 'text' },
  { name: 'Household Size', type: 'number' },
  { name: 'Has Children', type: 'text' },
  { name: 'Occupation', type: 'text' },
  { name: 'Income Range', type: 'text' },
  { name: 'Net Worth Range', type: 'text' },
  { name: 'Phone Type', type: 'text' },
  { name: 'Enrichment Provider', type: 'text' },
  { name: 'Recently Moved', type: 'text' },
  { name: 'Recently Divorced', type: 'text' },

  // Property address (separate from FUB primary Address which holds the
  // mailing address). Reuses existing customSellerPropertyAddress if
  // present.
  { name: 'Seller Property Address', type: 'text' },
]

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i]
    if (!t.startsWith('--')) continue
    const eq = t.indexOf('=')
    if (eq > -1) { out[t.slice(2, eq)] = t.slice(eq + 1); continue }
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) { out[t.slice(2)] = next; i += 1 }
    else { out[t.slice(2)] = true }
  }
  return out
}

function fubAuth(apiKey) {
  return 'Basic ' + Buffer.from(apiKey + ':').toString('base64')
}

async function fubGet(path, apiKey) {
  const res = await fetch(`${FUB_BASE}${path}`, { headers: { Authorization: fubAuth(apiKey), Accept: 'application/json' } })
  if (!res.ok) throw new Error(`GET ${path} → HTTP ${res.status}`)
  return res.json()
}

async function fubPost(path, apiKey, body) {
  const res = await fetch(`${FUB_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: fubAuth(apiKey),
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-System': 'RyanRealty-Web',
      'X-System-Key': 'ryan-realty-westside-provision',
    },
    body: JSON.stringify(body),
  })
  const text = await res.text().catch(() => '')
  let data = null
  try { data = JSON.parse(text) } catch {}
  return { ok: res.ok, status: res.status, data, text }
}

function camelCustomName(display) {
  // FUB convention: "Purchase Price" → "customPurchasePrice"
  const pascal = display
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')
  return 'custom' + pascal
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const apply = !!args.apply
  if (!apply && !args['dry-run']) {
    console.log('[provision] No --apply or --dry-run flag passed. Defaulting to --dry-run.')
  }

  const apiKey = (process.env.FOLLOWUPBOSS_API_KEY || '').trim()
  if (!apiKey) {
    console.error('[provision] Missing FOLLOWUPBOSS_API_KEY')
    process.exit(1)
  }

  // ---- Stages ----
  const stagesPayload = await fubGet('/stages', apiKey)
  const existingStages = new Map((stagesPayload.stages || []).map((s) => [s.name.toLowerCase(), s]))
  console.log(`[provision] Existing FUB stages: ${existingStages.size}`)

  const stageActions = []
  for (const stage of DESIRED_STAGES) {
    if (existingStages.has(stage.name.toLowerCase())) {
      stageActions.push({ stage: stage.name, action: 'skip-exists' })
    } else {
      stageActions.push({ stage: stage.name, action: 'create' })
    }
  }

  // ---- Custom fields ----
  const cfPayload = await fubGet('/customFields?limit=100', apiKey)
  const allFields = [...(cfPayload.customfields || cfPayload.customFields || [])]
  let next = cfPayload._metadata?.next
  while (next) {
    const page = await fubGet(`/customFields?limit=100&next=${encodeURIComponent(next)}`, apiKey)
    allFields.push(...(page.customfields || page.customFields || []))
    next = page._metadata?.next
  }
  const existingFields = new Map(allFields.map((f) => [String(f.label || f.name || '').toLowerCase(), f]))
  console.log(`[provision] Existing FUB custom fields: ${allFields.length}`)

  const fieldActions = []
  for (const f of DESIRED_CUSTOM_FIELDS) {
    const apiName = camelCustomName(f.name)
    if (existingFields.has(f.name.toLowerCase()) || existingFields.has(apiName.toLowerCase())) {
      fieldActions.push({ display: f.name, apiName, type: f.type, action: 'skip-exists' })
    } else {
      fieldActions.push({ display: f.name, apiName, type: f.type, action: 'create' })
    }
  }

  console.log(`\n[provision] === Plan ===`)
  console.log(`Stages to create:`)
  for (const a of stageActions) console.log(`  [${a.action.padEnd(13)}] ${a.stage}`)
  console.log(`Custom fields to create:`)
  for (const a of fieldActions) console.log(`  [${a.action.padEnd(13)}] ${a.display.padEnd(28)} (${a.apiName}, type=${a.type})`)

  if (!apply) {
    console.log(`\n[provision] Dry run only. Re-run with --apply to execute.`)
    return
  }

  // ---- Apply ----
  console.log(`\n[provision] Applying...`)
  for (const a of stageActions) {
    if (a.action === 'skip-exists') { console.log(`  ✓ stage ${a.stage} already exists`); continue }
    const result = await fubPost('/stages', apiKey, { name: a.stage })
    if (result.ok) console.log(`  ✓ created stage ${a.stage} (status ${result.status})`)
    else console.warn(`  ✗ create stage ${a.stage} failed: HTTP ${result.status} ${result.text.slice(0, 200)}`)
  }
  for (const a of fieldActions) {
    if (a.action === 'skip-exists') { console.log(`  ✓ field ${a.display} already exists`); continue }
    const result = await fubPost('/customFields', apiKey, { label: a.display, type: a.type })
    if (result.ok) console.log(`  ✓ created field "${a.display}" → ${result.data?.name || a.apiName} (status ${result.status})`)
    else console.warn(`  ✗ create field "${a.display}" failed: HTTP ${result.status} ${result.text.slice(0, 200)}`)
    await new Promise((r) => setTimeout(r, 250))
  }

  // Re-fetch and report current state
  const newStages = await fubGet('/stages', apiKey)
  const newFields = await fubGet('/customFields', apiKey)
  console.log(`\n[provision] Post-apply: ${(newStages.stages || []).length} stages, ${(newFields.customfields || newFields.customFields || []).length} custom fields`)
}

main().catch((err) => {
  console.error('[provision] FATAL:', err.message)
  process.exit(1)
})
