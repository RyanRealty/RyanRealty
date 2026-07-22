#!/usr/bin/env node
/**
 * check-resend-webhook.mjs — OFF-CHAIN nightly check (NOT in ci:gates).
 *
 * Verifies that a Resend webhook is actually registered and pointed at
 * /api/webhooks/resend with the events our ingest route consumes. The route
 * (app/api/webhooks/resend/route.ts) feeds the newsletter engagement ledger,
 * the unified email_events store, the per-contact timeline, and the
 * bounce/complaint suppression writes — if the registration disappears on the
 * Resend side, all of that goes dark silently. This check makes that state
 * visible to CI-adjacent tooling.
 *
 * Posture (pattern-matched to ci:data-access / G16): this check needs a real
 * secret (RESEND_API_KEY), so it does NOT run in the secret-less static
 * ci:gates chain. It runs locally / nightly. When the key is absent it prints
 * a SKIPPED notice and exits 0 so a secret-less environment never fails on it.
 *
 * Asserted:
 *   - at least one webhook whose endpoint path includes /api/webhooks/resend
 *   - that webhook is enabled (status enabled/active when the API reports one)
 *   - its events cover the types the route ingests via classifyResendEvent:
 *       email.delivered, email.opened, email.clicked, email.bounced,
 *       email.complained            (HARD — missing any of these fails)
 *       email.unsubscribed          (WARN only — Resend's native one-click
 *                                    unsubscribe event; reported but not fatal
 *                                    so a provider-side rename cannot turn this
 *                                    check permanently red)
 *
 * Usage:
 *   node scripts/check-resend-webhook.mjs
 *   npm run ci:resend-webhook
 *
 * Exit codes: 0 = verified (or SKIPPED, no key), 1 = missing/misconfigured.
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const WEBHOOK_PATH = '/api/webhooks/resend'

/** Event types the ingest route consumes (lib/crm/resend-webhook.ts EVENT_MAP). */
const REQUIRED_EVENTS = [
  'email.delivered',
  'email.opened',
  'email.clicked',
  'email.bounced',
  'email.complained',
]
const WARN_EVENTS = ['email.unsubscribed']

/** Minimal .env.local reader (same pattern as check-vercel-deploy.mjs) — the
 *  nightly run happens on the Mac where secrets live in .env.local, not the shell. */
function readEnvLocal(key) {
  const path = resolve(process.cwd(), '.env.local')
  if (!existsSync(path)) return null
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (!m) continue
      if (m[1] !== key) continue
      return m[2].replace(/^["']|["']$/g, '').trim() || null
    }
  } catch {
    return null
  }
  return null
}

// Prefer a dedicated full-access key: the account's RESEND_API_KEY is a
// send-only restricted key (memory: reference_resend_email_setup) and Resend
// refuses webhook listing on it with 401 restricted_api_key. A full-access key
// stored as RESEND_WEBHOOKS_API_KEY lets this check verify without widening the
// scope of the key the send paths use.
const apiKey =
  process.env.RESEND_WEBHOOKS_API_KEY?.trim() ||
  readEnvLocal('RESEND_WEBHOOKS_API_KEY') ||
  process.env.RESEND_API_KEY?.trim() ||
  readEnvLocal('RESEND_API_KEY')

if (!apiKey) {
  console.log(
    '[check-resend-webhook] SKIPPED — RESEND_API_KEY not set. This is an off-chain ' +
      'nightly check (same posture as ci:data-access): it needs a real secret and ' +
      'never runs in the secret-less static gate chain.',
  )
  process.exit(0)
}

async function main() {
  const res = await fetch('https://api.resend.com/webhooks', {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    if (res.status === 401 && body.includes('restricted_api_key')) {
      // The registration is UNVERIFIABLE, which is exactly the dark state this
      // check exists to surface — fail with the precise remediation.
      console.error(
        '[check-resend-webhook] FAIL — the available Resend key is send-only restricted ' +
          'and cannot list webhooks, so the registration cannot be verified. ' +
          'Provision a full-access key in the Resend dashboard and store it as ' +
          'RESEND_WEBHOOKS_API_KEY in .env.local (keep the send path on the restricted key).',
      )
      process.exit(1)
    }
    console.error(`[check-resend-webhook] FAIL — Resend API returned ${res.status}: ${body.slice(0, 300)}`)
    process.exit(1)
  }
  const payload = await res.json()
  // Defensive on shape: { data: [...] } (documented) or a bare array.
  const webhooks = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : []

  if (webhooks.length === 0) {
    console.error('[check-resend-webhook] FAIL — no webhooks are registered on the Resend account.')
    process.exit(1)
  }

  const describe = (w) => {
    const endpoint = w.endpoint ?? w.url ?? '(no endpoint)'
    const status = w.status ?? '(no status)'
    const events = Array.isArray(w.events) ? w.events.join(', ') : '(no events)'
    return `  - ${endpoint} [${status}] events: ${events}`
  }

  const matching = webhooks.filter((w) => String(w.endpoint ?? w.url ?? '').includes(WEBHOOK_PATH))
  if (matching.length === 0) {
    console.error(
      `[check-resend-webhook] FAIL — no registered webhook targets ${WEBHOOK_PATH}. Registered webhooks:`,
    )
    for (const w of webhooks) console.error(describe(w))
    process.exit(1)
  }

  // Prefer an enabled matching webhook; if the API reports a status and none is
  // enabled, that is a failure (a disabled registration ingests nothing).
  const isEnabled = (w) => {
    const s = String(w.status ?? '').toLowerCase()
    return s === '' || s === 'enabled' || s === 'active'
  }
  const enabled = matching.filter(isEnabled)
  if (enabled.length === 0) {
    console.error(`[check-resend-webhook] FAIL — the webhook targeting ${WEBHOOK_PATH} is disabled:`)
    for (const w of matching) console.error(describe(w))
    process.exit(1)
  }

  // Events covered across every enabled matching webhook (Resend allows more
  // than one registration; coverage is what matters to the ingest route).
  const covered = new Set()
  for (const w of enabled) {
    for (const ev of Array.isArray(w.events) ? w.events : []) covered.add(String(ev).toLowerCase())
  }

  const missingRequired = REQUIRED_EVENTS.filter((ev) => !covered.has(ev))
  const missingWarn = WARN_EVENTS.filter((ev) => !covered.has(ev))

  if (missingRequired.length > 0) {
    console.error(
      `[check-resend-webhook] FAIL — webhook at ${WEBHOOK_PATH} is missing required events: ${missingRequired.join(', ')}.`,
    )
    console.error('Registered matching webhooks:')
    for (const w of enabled) console.error(describe(w))
    process.exit(1)
  }

  if (missingWarn.length > 0) {
    console.warn(
      `[check-resend-webhook] WARN — events not covered (non-fatal): ${missingWarn.join(', ')}. ` +
        'The route handles email.unsubscribed (Resend native one-click unsubscribe); ' +
        'add it to the webhook registration for full coverage.',
    )
  }

  console.log(
    `[check-resend-webhook] OK — ${enabled.length} enabled webhook(s) target ${WEBHOOK_PATH} ` +
      `covering: ${[...covered].sort().join(', ')}`,
  )
  for (const w of enabled) console.log(describe(w))
  process.exit(0)
}

main().catch((e) => {
  console.error(`[check-resend-webhook] FAIL — ${e instanceof Error ? e.message : String(e)}`)
  process.exit(1)
})
