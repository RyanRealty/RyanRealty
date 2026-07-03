#!/usr/bin/env node
/**
 * check-email-tracking.mjs — email open/click tracking safety gate (covers
 * G-NL-11 prod hard-fail + TTL/nonce, and G-NL-10 crm_timeline dedup).
 *
 * Email tracking tokens (lib/email-tracking.ts) are HMAC-signed and gate a
 * real write path (crm_timeline inserts, 302 redirects). A regression here is
 * either a forgery hole (anyone can fabricate open/click events, or worse,
 * mint a click token that redirects to an arbitrary target) or a timeline
 * flood (a pixel firing on every render/forward writes hundreds of duplicate
 * rows and buries the real communications history). Static checks only:
 *
 *   G-NL-11 prod hard-fail: `assertTrackingSecret` must exist and must refuse
 *     to operate (`throw`) when `NODE_ENV === 'production'` and the secret is
 *     the public dev-fallback — the same posture as the Resend webhook.
 *
 *   G-NL-11 TTL/nonce: `signEmailToken` must stamp an expiry (`body.exp =`)
 *     and a nonce (`body.n =`, sourced from `randomBytes(`) so a token can't
 *     be replayed forever and two otherwise-identical tokens are
 *     distinguishable. `verifyEmailToken` must read that expiry (`o.exp`) so
 *     an expired token is rejected on verify, not just stamped on sign.
 *
 *   G-NL-10 timeline dedup: both tracking routes
 *     (app/api/track/e/open/route.ts, app/api/track/e/click/route.ts) must
 *     upsert into crm_timeline with a `dedupe_key` + `onConflict` +
 *     `ignoreDuplicates` so a repeat open/click collapses to one row instead
 *     of flooding the comms chain.
 *
 * Static text checks only — no network calls, no live token signing. Mirrors
 * the house style of scripts/check-email-send-gated.mjs.
 *
 * Usage:
 *   node scripts/check-email-tracking.mjs            # human output
 *   node scripts/check-email-tracking.mjs --json      # machine output
 *   node scripts/check-email-tracking.mjs --report    # never exits 1
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripJsComments } from './lib/strip-js-comments.mjs'

const ROOT = process.cwd()

const PATHS = {
  tracking: join(ROOT, 'lib/email-tracking.ts'),
  openRoute: join(ROOT, 'app/api/track/e/open/route.ts'),
  clickRoute: join(ROOT, 'app/api/track/e/click/route.ts'),
}

// Strip comments so a required token in a doc comment can't fake a pass (a gate
// must check CODE, not comments — see scripts/lib/strip-js-comments.mjs).
function safeRead(path) {
  return existsSync(path) ? stripJsComments(readFileSync(path, 'utf8')) : null
}

/**
 * Pure: run every check against already-read file contents. Returns an array
 * of { id, ok, detail } — one row per assertion, in check order.
 */
export function runChecks({ tracking, openRoute, clickRoute }) {
  const results = []

  if (tracking == null) {
    results.push({ id: 'file-exists', ok: false, detail: 'lib/email-tracking.ts not found' })
  } else {
    // G-NL-11 prod hard-fail.
    const fnMatch = tracking.match(/function\s+assertTrackingSecret\s*\([\s\S]*?\n\}/)
    const fnBody = fnMatch ? fnMatch[0] : ''
    const hasFn = fnMatch != null
    const checksProdEnv = /NODE_ENV\s*===\s*['"]production['"]/.test(fnBody)
    const throwsOnFail = /\bthrow\b/.test(fnBody)
    const prodHardFailOk = hasFn && checksProdEnv && throwsOnFail
    results.push({
      id: 'G-NL-11 prod-hard-fail',
      ok: prodHardFailOk,
      detail: prodHardFailOk
        ? 'lib/email-tracking.ts — assertTrackingSecret() checks NODE_ENV === \'production\' and throws on the insecure fallback'
        : `lib/email-tracking.ts — assertTrackingSecret ${!hasFn ? 'not found' : `missing ${!checksProdEnv ? "NODE_ENV === 'production' check" : ''}${!checksProdEnv && !throwsOnFail ? ' and ' : ''}${!throwsOnFail ? 'a throw' : ''}`}`,
    })

    // G-NL-11 TTL/nonce on sign.
    const hasExpSet = /body\.exp\s*=/.test(tracking)
    const hasNonceSet = /body\.n\s*=/.test(tracking)
    const hasRandomBytes = /randomBytes\(/.test(tracking)
    const signOk = hasExpSet && hasNonceSet && hasRandomBytes
    results.push({
      id: 'G-NL-11 sign-ttl-nonce',
      ok: signOk,
      detail: signOk
        ? 'lib/email-tracking.ts — signEmailToken sets body.exp + body.n via randomBytes(...)'
        : `lib/email-tracking.ts — signEmailToken missing ${!hasExpSet ? 'body.exp =' : ''}${!hasExpSet && (!hasNonceSet || !hasRandomBytes) ? ', ' : ''}${!hasNonceSet ? 'body.n =' : ''}${!hasNonceSet && !hasRandomBytes ? ', ' : ''}${!hasRandomBytes ? 'randomBytes(...)' : ''}`,
    })

    // G-NL-11 TTL enforcement on verify.
    const hasExpRead = /\bo\.exp\b/.test(tracking)
    const verifyOk = hasExpRead && hasRandomBytes
    results.push({
      id: 'G-NL-11 verify-ttl-enforced',
      ok: verifyOk,
      detail: verifyOk
        ? 'lib/email-tracking.ts — verifyEmailToken reads o.exp and the file uses randomBytes(...) for nonces'
        : `lib/email-tracking.ts — missing ${!hasExpRead ? 'o.exp read in verifyEmailToken' : ''}${!hasExpRead && !hasRandomBytes ? ' and ' : ''}${!hasRandomBytes ? 'randomBytes(...) usage' : ''}`,
    })
  }

  // G-NL-10 timeline dedup on both tracking routes.
  for (const [label, src] of [
    ['app/api/track/e/open/route.ts', openRoute],
    ['app/api/track/e/click/route.ts', clickRoute],
  ]) {
    if (src == null) {
      results.push({ id: `G-NL-10 timeline-dedup (${label})`, ok: false, detail: `${label} not found` })
      continue
    }
    const hasDedupeKey = /dedupe_key/.test(src)
    const hasOnConflict = /onConflict/.test(src)
    const hasIgnoreDup = /ignoreDuplicates/.test(src)
    const ok = hasDedupeKey && hasOnConflict && hasIgnoreDup
    results.push({
      id: `G-NL-10 timeline-dedup (${label})`,
      ok,
      detail: ok
        ? `${label} — crm_timeline upsert has dedupe_key + onConflict + ignoreDuplicates`
        : `${label} — missing ${!hasDedupeKey ? 'dedupe_key' : ''}${!hasDedupeKey && (!hasOnConflict || !hasIgnoreDup) ? ', ' : ''}${!hasOnConflict ? 'onConflict' : ''}${!hasOnConflict && !hasIgnoreDup ? ', ' : ''}${!hasIgnoreDup ? 'ignoreDuplicates' : ''} on the crm_timeline write (repeat opens/clicks will flood the comms chain)`,
    })
  }

  return results
}

function loadInputs() {
  return {
    tracking: safeRead(PATHS.tracking),
    openRoute: safeRead(PATHS.openRoute),
    clickRoute: safeRead(PATHS.clickRoute),
  }
}

// ── runner ───────────────────────────────────────────────────────────────────

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const asJson = process.argv.includes('--json')
  const report = process.argv.includes('--report')

  const results = runChecks(loadInputs())
  const failures = results.filter((r) => !r.ok)

  if (asJson) {
    console.log(JSON.stringify({ pass: failures.length === 0, results }, null, 2))
  } else {
    for (const r of results) {
      console.log(`${r.ok ? '✓' : '✗'} email-tracking: ${r.id} — ${r.detail}`)
    }
    if (failures.length) {
      console.error(`\n✗ email-tracking: ${failures.length} check(s) failed. Fix lib/email-tracking.ts or the track routes.`)
    } else {
      console.log(`\n✓ email-tracking: all ${results.length} checks passed (G-NL-11, G-NL-10).`)
    }
  }

  if (failures.length && !report) process.exit(1)
  process.exit(0)
}
