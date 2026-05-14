#!/usr/bin/env node
/**
 * End-to-end smoke test for the auto-CMA pipeline.
 *
 * Simulates a real submit of the seller LP form via the production server
 * action shape: inserts a `cma_deliveries` row directly (mimicking what
 * `submitSellerLPForm` does), pings the worker at `/api/cma-delivery`,
 * polls the row through `pending → in_production → ready`, then signs the
 * broker preview token and calls `/api/cma-drafts/<id>/send` to ship the
 * actual CMA email to the lead.
 *
 * Usage:
 *   node scripts/smoke-test-cma-pipeline.mjs \
 *     --address "19496 Tumalo Reservoir Rd, Bend, OR 97703" \
 *     --lead-email "mattmryan2@gmail.com" \
 *     --lead-name "Matt Ryan (test)" \
 *     --lead-phone "5412136706" \
 *     --auto-send
 *
 * Flags:
 *   --auto-send  After the row hits 'ready', programmatically POST the
 *                Send endpoint with the signed token. Without this, we
 *                stop at 'ready' so a human broker can review.
 *   --base-url   Override the production base URL (defaults to
 *                https://seller.ryan-realty.com).
 */

import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'

// ── env from .env.local ────────────────────────────────────────────────────
const envText = readFileSync('.env.local', 'utf8')
const env = Object.fromEntries(
  envText
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')]
    }),
)

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const TOKEN_SECRET =
  env.CMA_PREVIEW_SECRET?.trim() ||
  (env.SUPABASE_SERVICE_ROLE_KEY ? `dev-fallback:${env.SUPABASE_SERVICE_ROLE_KEY}` : '')

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!TOKEN_SECRET) {
  console.error('missing CMA_PREVIEW_SECRET (and no fallback)')
  process.exit(1)
}

// ── args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
function arg(name, dflt = null) {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : dflt
}
const RAW_ADDRESS = arg('address', '19496 Tumalo Reservoir Rd, Bend, OR 97703')
const LEAD_EMAIL = arg('lead-email', 'mattmryan2@gmail.com')
const LEAD_NAME = arg('lead-name', 'Matt Ryan (smoke test)')
const LEAD_PHONE = arg('lead-phone', '5412136706')
const BASE_URL = (
  arg('base-url', 'https://seller.ryan-realty.com')
).replace(/\/$/, '')
const AUTO_SEND = argv.includes('--auto-send')

// ── helpers ────────────────────────────────────────────────────────────────

function parseAddress(raw) {
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
  const street = parts[0] ?? null
  const city = parts[1] ?? null
  const stateZip = parts[2] ?? ''
  const m = /^([A-Za-z]{2})\s*(\d{5}(?:-\d{4})?)?\s*$/.exec(stateZip)
  const state = m?.[1] ?? null
  const postal = m?.[2] ?? null
  return { street, city, state, postal }
}

async function sb(path, init = {}) {
  // Retry transient PostgREST 503 / 504 / 502 errors with backoff. The
  // schema cache occasionally takes a few seconds to reload on Supabase's
  // side, and we'd rather block here than blow up the smoke test.
  let lastErr = null
  for (let attempt = 0; attempt < 6; attempt++) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...(init.headers ?? {}),
      },
    })
    const text = await r.text()
    if (r.ok) return text ? JSON.parse(text) : null
    const transient = r.status === 502 || r.status === 503 || r.status === 504
    if (!transient) {
      throw new Error(`Supabase ${path} ${r.status}: ${text.slice(0, 200)}`)
    }
    lastErr = `${r.status}: ${text.slice(0, 200)}`
    const backoff = 1500 * Math.pow(1.5, attempt)
    console.error(`      ⏳ Supabase ${path} ${r.status} — retry ${attempt + 1}/6 in ${Math.round(backoff)}ms`)
    await new Promise((res) => setTimeout(res, backoff))
  }
  throw new Error(`Supabase ${path} gave up after 6 retries — last: ${lastErr}`)
}

function base64Url(buf) {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function signToken(deliveryId, ttlMs = 14 * 24 * 60 * 60 * 1000) {
  const expiry = Date.now() + ttlMs
  const mac = createHmac('sha256', TOKEN_SECRET)
    .update(`${deliveryId}:${expiry}`)
    .digest()
  return `${expiry}.${base64Url(mac)}`
}

// ── main ────────────────────────────────────────────────────────────────────

console.log('=== AUTO-CMA SMOKE TEST ===')
console.log(`Lead:      ${LEAD_NAME} <${LEAD_EMAIL}>`)
console.log(`Address:   ${RAW_ADDRESS}`)
console.log(`Base URL:  ${BASE_URL}`)
console.log(`Auto-send: ${AUTO_SEND ? 'YES' : 'NO (stop at ready)'}`)
console.log()

const parsed = parseAddress(RAW_ADDRESS)
console.log(`Parsed: street=${parsed.street} city=${parsed.city} state=${parsed.state} zip=${parsed.postal}`)
console.log()

// 1. Insert the cma_deliveries row (mimics what submitSellerLPForm does)
console.log('[1/5] Inserting cma_deliveries row…')
const inserted = await sb('cma_deliveries', {
  method: 'POST',
  body: JSON.stringify({
    raw_address: RAW_ADDRESS,
    parsed_street: parsed.street,
    parsed_city: parsed.city,
    parsed_state: parsed.state,
    parsed_postal_code: parsed.postal,
    lead_email: LEAD_EMAIL,
    lead_name: LEAD_NAME,
    lead_phone: LEAD_PHONE,
    lead_timeline: 'ready-now',
    lead_classification: 'hot',
    status: 'pending',
  }),
})
const deliveryId = inserted[0].id
console.log(`      → delivery_id: ${deliveryId}`)
console.log()

// 2. Fire the worker
console.log('[2/5] Firing /api/cma-delivery worker…')
const workerStart = Date.now()
const workerRes = await fetch(`${BASE_URL}/api/cma-delivery`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ delivery_id: deliveryId }),
})
const workerDuration = ((Date.now() - workerStart) / 1000).toFixed(1)
const workerText = await workerRes.text()
console.log(`      → ${workerRes.status} in ${workerDuration}s: ${workerText.slice(0, 200)}`)
console.log()

// 3. Poll status until terminal
console.log('[3/5] Polling cma_deliveries row…')
let last = 'pending'
let attempts = 0
let finalRow = null
while (attempts < 30) {
  const rows = await sb(`cma_deliveries?id=eq.${deliveryId}&select=status,cma_estimated_value,cma_confidence,assigned_broker_email,assigned_broker_name,broker_notified_at,errors`, {
    method: 'GET',
  })
  const row = rows?.[0]
  if (row && row.status !== last) {
    console.log(`      → status: ${row.status}`)
    last = row.status
  }
  finalRow = row
  if (['ready', 'sent', 'no_match', 'failed'].includes(row?.status)) break
  attempts++
  await new Promise((r) => setTimeout(r, 2000))
}
console.log()

if (!finalRow || finalRow.status !== 'ready') {
  console.log('Row state at end of polling:')
  console.log(JSON.stringify(finalRow, null, 2))
  if (finalRow?.status === 'no_match') {
    console.log('\n⚠️  status=no_match — address didn\'t resolve to an MLS property row. Pipeline working, but this address has no Supabase match.')
  }
  process.exit(finalRow?.status === 'ready' ? 0 : 1)
}

console.log('[4/5] Row is READY. Summary:')
console.log(`      → estimated value:  $${(finalRow.cma_estimated_value ?? 0).toLocaleString()}`)
console.log(`      → confidence:       ${finalRow.cma_confidence}`)
console.log(`      → assigned broker:  ${finalRow.assigned_broker_name} <${finalRow.assigned_broker_email}>`)
console.log(`      → notified at:      ${finalRow.broker_notified_at}`)
if (Array.isArray(finalRow.errors) && finalRow.errors.length > 0) {
  console.log(`      → errors:           ${JSON.stringify(finalRow.errors)}`)
}
console.log()

// Build signed preview URL for human inspection
const token = signToken(deliveryId)
const previewUrl = `${BASE_URL}/cma-drafts/${deliveryId}?token=${encodeURIComponent(token)}`
console.log(`Preview URL (also in the broker review email):\n${previewUrl}\n`)

// 5. Optional auto-send
if (!AUTO_SEND) {
  console.log('[5/5] --auto-send not set. Stop here — broker can click Send on the preview page.')
  process.exit(0)
}

console.log('[5/5] Calling /api/cma-drafts/<id>/send with the signed token…')
const sendRes = await fetch(`${BASE_URL}/api/cma-drafts/${deliveryId}/send`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token }),
})
const sendText = await sendRes.text()
console.log(`      → ${sendRes.status}: ${sendText.slice(0, 400)}`)
console.log()

if (sendRes.ok) {
  console.log('✅ SMOKE TEST PASSED. CMA email should be in mattmryan2@gmail.com inbox within 30s.')
} else {
  console.log('❌ Send failed.')
  process.exit(1)
}
