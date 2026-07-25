#!/usr/bin/env node
/**
 * check-web-push-durable.mjs (ci:web-push-durable) — W5.5 leg (b).
 *
 * THE CLASS this gate blocks: a notification channel that is "built" but goes
 * dark without anyone noticing. Leg (a) of this very row shipped a serverless
 * SMS drain whose CAS claim (`status -> 'sending'`) was rejected by a CHECK
 * constraint on every run, and nothing caught it. Web push is the DURABLE
 * channel, so the ways it can silently die are pinned here:
 *
 *  1. The service worker actually shows the notification (a push listener that
 *     never calls showNotification, or one not held open by waitUntil, drops the
 *     alert), and it does NOT install a fetch handler — this worker must never
 *     interpose on a single navigation.
 *  2. The push pass runs OUTSIDE the CRM_SMS_ALERTS cutover flag. If it drifts
 *     below that early return, flipping the SMS flag takes web push down with
 *     it, which is the opposite of durable.
 *  3. Push claims its OWN column (pushed_at). The moment it claims `status`
 *     instead, one channel starts eating the other channel's rows and a broker
 *     silently gets one notification instead of two.
 *  4. An unprovisioned VAPID keypair degrades OBSERVABLY and BEFORE any claim —
 *     rows stay unclaimed so the backlog delivers when keys land, the cron
 *     response says 'unconfigured', and a health alert pages the broker. A bare
 *     `return` on missing keys is the silent-death path.
 *  5. Candidate selection ignores `status`: an alert already texted still earns
 *     its push, because this is a parallel channel and not a fallback.
 *  6. The subscribe/test routes authenticate via the shared admin guards and
 *     derive the broker from the SESSION, never from the request body.
 *  7. The opt-in control is MOUNTED on an admin page — a subscribe button that
 *     renders nowhere is the "built, not flipped" failure this program exists
 *     to stop.
 *  8. The migration that widens crm_broker_alerts_status_check keeps 'sending'
 *     (leg a's claim) and 'push_only' (push-only brokers) legal.
 *
 * Usage: node scripts/check-web-push-durable.mjs   (wired into ci:gates)
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SW = 'public/sw.js'
const DRAIN = 'app/api/cron/crm-alert-drain/route.ts'
const DELIVER = 'app/api/push/_lib/deliver.ts'
const STORE = 'app/api/push/_lib/store.ts'
const SUBSCRIBE = 'app/api/push/subscribe/route.ts'
const TEST_ROUTE = 'app/api/push/test/route.ts'
const OPT_IN = 'components/admin/push/BrokerPushOptIn.tsx'
const MIGRATIONS = 'supabase/migrations'

const fails = []

function read(p) {
  if (!existsSync(p)) {
    fails.push(`${p}: missing — the web-push channel cannot work without it.`)
    return null
  }
  return readFileSync(p, 'utf8')
}

/** Strip comments so ORDERING assertions read code, not prose about the code. */
function code(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

function must(src, file, needle, why) {
  if (src && !src.includes(needle)) fails.push(`${file}: missing \`${needle}\` — ${why}`)
}

function mustNot(src, file, needle, why) {
  if (src && src.includes(needle)) fails.push(`${file}: contains \`${needle}\` — ${why}`)
}

// ── 1. the service worker actually shows the notification ───────────────────
const sw = read(SW)
if (sw) {
  must(sw, SW, "addEventListener('push'", 'without a push listener the browser receives the message and drops it.')
  must(sw, SW, 'showNotification', 'a push handler that never shows a notification delivers nothing.')
  must(sw, SW, 'event.waitUntil(self.registration.showNotification', 'showNotification must be held open by waitUntil or the worker can be killed before the alert paints.')
  must(sw, SW, "addEventListener('notificationclick'", 'tapping the alert must deep-link into the CRM.')
  mustNot(sw, SW, "addEventListener('fetch'", 'this worker is push-only; a fetch handler would put it in front of every navigation on the site.')
}

// ── 2 + 3. the drain wiring: push first, push outside the SMS flag ──────────
const drain = code(read(DRAIN) ?? '')
if (drain) {
  must(drain, DRAIN, 'drainWebPush', 'the cron must run the web-push pass; nothing else drains it.')
  const iPush = drain.indexOf('drainWebPush(')
  const iFlag = drain.indexOf('CRM_SMS_ALERTS')
  if (iPush >= 0 && iFlag >= 0 && iPush > iFlag) {
    fails.push(
      `${DRAIN}: the drainWebPush() call sits BELOW the CRM_SMS_ALERTS check. Web push is the durable ` +
        `channel — it must run whichever way the SMS cutover flag is set, so the call belongs above that early return.`,
    )
  }
  // Every exit path reports the push outcome, or the channel dies unobserved.
  // Slice each response by BALANCED parens — a naive regex stops at the first
  // `})` inside a nested map callback and reports a false miss.
  const silent = []
  for (let at = drain.indexOf('NextResponse.json('); at >= 0; at = drain.indexOf('NextResponse.json(', at + 1)) {
    let depth = 0
    let end = at
    for (let i = drain.indexOf('(', at); i < drain.length; i += 1) {
      if (drain[i] === '(') depth += 1
      else if (drain[i] === ')') {
        depth -= 1
        if (depth === 0) {
          end = i
          break
        }
      }
    }
    const call = drain.slice(at, end + 1)
    if (!/\bpush\b\s*[,:}]/.test(call)) silent.push(call.split('\n')[0].trim())
  }
  if (silent.length) {
    fails.push(
      `${DRAIN}: ${silent.length} response(s) omit the \`push\` summary. Every drain response must report the ` +
        `web-push outcome (mode/candidates/delivered) so a dark channel is visible in the cron log.`,
    )
  }
}

// ── 3 + 4. the delivery pass ────────────────────────────────────────────────
const deliverRaw = read(DELIVER)
const deliver = code(deliverRaw ?? '')
if (deliver) {
  must(deliver, DELIVER, 'claimPushDelivery', 'push must CAS-claim its own column, first-writer-wins, like the SMS drain does.')
  mustNot(deliver, DELIVER, 'claimAlert', 'push must NOT take the SMS claim — the two channels would then cannibalise each other and a broker would get one alert instead of two.')
  if (/status:\s*['"]/.test(deliver)) {
    fails.push(`${DELIVER}: writes crm_broker_alerts.status. The push pass owns pushed_at only; status belongs to the SMS state machine.`)
  }

  const iUnconfigured = deliver.indexOf("mode: 'unconfigured'")
  const iClaim = deliver.indexOf('claimPushDelivery(')
  if (iUnconfigured < 0) {
    fails.push(`${DELIVER}: no 'unconfigured' mode. A missing VAPID keypair must degrade visibly, not return an empty result that reads like "nothing to send".`)
  } else if (iClaim >= 0 && iUnconfigured > iClaim) {
    fails.push(`${DELIVER}: the unconfigured branch runs AFTER the claim loop. Rows would be consumed while the channel is dark and never delivered once keys land.`)
  }
  must(deliver, DELIVER, 'queueBrokerHealthAlert', 'an unprovisioned keypair with live subscribers must page a human, not just log.')
}

// ── 5. candidate selection is channel-independent ───────────────────────────
const store = code(read(STORE) ?? '')
if (store) {
  const fn = store.slice(store.indexOf('export async function listPushCandidates'))
  const body = fn.slice(0, fn.indexOf('\n}\n') + 1)
  must(body, STORE, "is('pushed_at', null)", 'listPushCandidates must select on the push claim column.')
  if (/\.eq\(\s*['"]status['"]/.test(body) || /\.in\(\s*['"]status['"]/.test(body)) {
    fails.push(
      `${STORE}: listPushCandidates filters on \`status\`. Web push is parallel to SMS, not a fallback — an alert ` +
        `already texted (status 'sent') must still be pushed, and a push_only row must still be selected.`,
    )
  }
}

// ── 6. the write surfaces are admin-authed and session-scoped ──────────────
for (const f of [SUBSCRIBE, TEST_ROUTE]) {
  const src = code(read(f) ?? '')
  if (!src) continue
  must(src, f, '@/lib/auth/guards', 'broker push registration is an admin surface; it authenticates through the shared guard.')
  must(src, f, 'requireAdminOr403', 'the route must reject a caller with no admin session.')
  must(src, f, 'CRM_BROKER_BY_EMAIL', 'the target broker is resolved from the signed-in email, not chosen by the caller.')
  must(src, f, 'ctx.email', 'the broker lookup must key off the SESSION email returned by the guard.')
  if (/\bbody\s*[.[]\s*['"]?broker/.test(src) || /=\s*await\s+request\.json\(\)[\s\S]{0,200}?\bbroker\b/.test(src)) {
    fails.push(
      `${f}: reads a broker from the request body. One signed-in admin could then register a device that notifies ` +
        `a different broker — the broker must come from the session only.`,
    )
  }
}

// ── 7. the opt-in control is mounted, not shelved ───────────────────────────
if (existsSync(OPT_IN)) {
  const mounted = []
  const walk = (dir) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.tsx?$/.test(e) && readFileSync(p, 'utf8').includes('components/admin/push/BrokerPushOptIn')) mounted.push(p)
    }
  }
  walk('app/admin')
  if (mounted.length === 0) {
    fails.push(
      `${OPT_IN}: exists but no page under app/admin/ imports it. A subscribe control nobody can reach means no ` +
        `broker can ever opt in — the channel is built and not flipped.`,
    )
  }
} else {
  fails.push(`${OPT_IN}: missing — brokers need a control to turn the channel on.`)
}

// ── 8. the alert status constraint keeps both claims legal ──────────────────
const statusMigrations = existsSync(MIGRATIONS)
  ? readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .filter((f) => readFileSync(join(MIGRATIONS, f), 'utf8').includes('crm_broker_alerts_status_check'))
  : []
if (statusMigrations.length === 0) {
  fails.push(`${MIGRATIONS}: no migration defines crm_broker_alerts_status_check.`)
} else {
  const latest = statusMigrations[statusMigrations.length - 1]
  const sql = readFileSync(join(MIGRATIONS, latest), 'utf8')
  const add = sql.slice(sql.lastIndexOf('add constraint crm_broker_alerts_status_check'))
  for (const [v, why] of [
    ["'sending'", "the serverless drain's CAS claim writes status='sending'; without it every claim is rejected by Postgres (the leg-a defect)"],
    ["'push_only'", 'a push-only broker alert needs a status neither SMS drainer selects'],
  ]) {
    if (!add.includes(v)) fails.push(`${MIGRATIONS}/${latest}: crm_broker_alerts_status_check does not allow ${v} — ${why}.`)
  }
}

console.log('web-push durable-channel gate (ci:web-push-durable)')
console.log('===================================================')
if (fails.length) {
  for (const f of fails) console.error(`  ✗ ${f}`)
  console.error(`\nFAILED — ${fails.length} problem(s). See W5.5 leg (b) in docs/plans/PROGRAM_2026-07-21/COMPLETION-LEDGER.json.`)
  process.exit(1)
}
console.log('OK — service worker shows alerts, the push pass runs outside the SMS flag on its own claim,')
console.log('     unprovisioned keys degrade observably without consuming the queue, and the opt-in is mounted.')
process.exit(0)
