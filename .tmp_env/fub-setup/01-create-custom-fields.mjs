#!/usr/bin/env node
/**
 * Create the 6 seller-workflow custom fields in FUB.
 * Idempotent — skips fields that already exist.
 *
 * Run: node --env-file=.env.local .tmp_env/fub-setup/01-create-custom-fields.mjs
 */

const FUB_KEY = process.env.FOLLOWUPBOSS_API_KEY?.trim()
if (!FUB_KEY) {
  console.error('Missing FOLLOWUPBOSS_API_KEY')
  process.exit(1)
}
const BASIC = Buffer.from(`${FUB_KEY}:`).toString('base64')
const BASE = 'https://api.followupboss.com/v1'

const FIELDS_TO_CREATE = [
  { label: 'Move Timeline',         type: 'text' },
  { label: 'Lead Tier',             type: 'text' },
  { label: 'Is Seller Curious',     type: 'text' },
  { label: 'Seller Property Address', type: 'text' },
  { label: 'CMA Delivered At',      type: 'date' },
  { label: 'CMA PDF URL',           type: 'text' },
]

async function fubRequest(method, path, body = null) {
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

async function listExistingFields() {
  const { status, json } = await fubRequest('GET', '/customFields?limit=100')
  if (status !== 200) throw new Error(`GET customFields failed: ${status}`)
  return json.customfields || json.customFields || []
}

async function main() {
  console.log('=== FUB Custom Field Setup — seller workflow ===\n')

  const existing = await listExistingFields()
  console.log(`Found ${existing.length} existing custom fields\n`)

  const existingLabels = new Set(existing.map(f => f.label?.toLowerCase()))

  const results = []
  for (const field of FIELDS_TO_CREATE) {
    const labelLower = field.label.toLowerCase()
    if (existingLabels.has(labelLower)) {
      const ex = existing.find(f => f.label?.toLowerCase() === labelLower)
      console.log(`  SKIP  ${field.label} (already exists as ${ex.name}, id=${ex.id})`)
      results.push({ label: field.label, status: 'exists', id: ex.id, name: ex.name })
      continue
    }
    const { status, json } = await fubRequest('POST', '/customFields', field)
    if (status === 201 && json?.id) {
      console.log(`  CREATE ${field.label} → id=${json.id}, name=${json.name}`)
      results.push({ label: field.label, status: 'created', id: json.id, name: json.name })
    } else {
      console.error(`  FAIL  ${field.label} → ${status}: ${JSON.stringify(json)}`)
      results.push({ label: field.label, status: 'failed', error: json })
    }
  }

  console.log('\n=== Summary ===')
  for (const r of results) {
    console.log(`  ${r.status.padEnd(8)} ${r.label.padEnd(30)} ${r.name ? `→ ${r.name}` : ''}`)
  }

  console.log('\n=== Final state — all custom fields ===')
  const final = await listExistingFields()
  for (const f of final.sort((a, b) => a.id - b.id)) {
    console.log(`  id=${String(f.id).padStart(3)}  ${(f.name || '').padEnd(35)}  ${f.label}  (${f.type})`)
  }
}

main().catch(err => { console.error('FATAL:', err); process.exit(1) })
