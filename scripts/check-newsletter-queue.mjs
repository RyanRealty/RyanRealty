#!/usr/bin/env node
/**
 * check-newsletter-queue.mjs — send-lock + no-mega-loop + reconciler gate for
 * the newsletter queue (covers G-NL-9).
 *
 * Two admins clicking "send" on the same newsletter within the same second is
 * a real scenario (Matt + a broker, or a double-click). Without a CAS
 * (compare-and-swap) lock, both requests read status='draft', both proceed,
 * and every recipient gets mailed twice. Separately, the admin action must
 * enqueue and return immediately — if it synchronously loops over every
 * recipient calling sendEmail(), a large list times out the request and the
 * safety net (retry, cron drain, dedup) is bypassed entirely. And an enqueue
 * with no reconciler is a queue that can stall forever with no automated
 * recovery.
 *
 *   G-NL-9  CAS lock: `lib/data/newsletter/queue.ts` `claimNewsletterForSending`
 *           must be a conditional UPDATE (status: 'sending' guarded by
 *           .in('status', ['draft', 'scheduled'])), not read-then-write — two
 *           concurrent claims can only have one winner.
 *   G-NL-9  No synchronous mega-loop: `app/actions/newsletter.ts`
 *           `adminSendNewsletterAction` must NOT call `sendEmail(` directly
 *           (it enqueues; the drain sends) and MUST call `enqueueNewsletter(`.
 *   G-NL-9  Reconciler exists: `app/api/cron/newsletter-reconcile/route.ts`
 *           must exist to recover stalled/orphaned sends.
 *
 * Static text checks only — no network calls, no live send. Mirrors the house
 * style of scripts/check-newsletter-compliance.mjs.
 *
 * Usage:
 *   node scripts/check-newsletter-queue.mjs            # human output
 *   node scripts/check-newsletter-queue.mjs --json      # machine output
 *   node scripts/check-newsletter-queue.mjs --report    # never exits 1
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripJsComments } from './lib/strip-js-comments.mjs'

const ROOT = process.cwd()

const PATHS = {
  queue: join(ROOT, 'lib/data/newsletter/queue.ts'),
  bulkAction: join(ROOT, 'app/actions/newsletter.ts'),
  reconcileRoute: join(ROOT, 'app/api/cron/newsletter-reconcile/route.ts'),
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
export function runChecks({ queue, bulkAction, reconcileRouteExists }) {
  const results = []

  // G-NL-9a: CAS lock in claimNewsletterForSending.
  if (queue == null) {
    results.push({ id: 'G-NL-9 cas-lock', ok: false, detail: 'lib/data/newsletter/queue.ts not found' })
  } else {
    const hasSendingUpdate = /status:\s*'sending'/.test(queue)
    const hasDraftScheduledGuard = /\[\s*'draft'\s*,\s*'scheduled'\s*\]/.test(queue)
    const ok = hasSendingUpdate && hasDraftScheduledGuard
    results.push({
      id: 'G-NL-9 cas-lock',
      ok,
      detail: ok
        ? "lib/data/newsletter/queue.ts — claimNewsletterForSending is a conditional update (status: 'sending' guarded by .in('status', ['draft', 'scheduled']))"
        : `lib/data/newsletter/queue.ts — missing ${!hasSendingUpdate ? "status: 'sending' update" : ''}${!hasSendingUpdate && !hasDraftScheduledGuard ? ' and ' : ''}${!hasDraftScheduledGuard ? "['draft', 'scheduled'] guard" : ''} (a read-then-write claim lets two concurrent sends double-mail every recipient)`,
    })
  }

  // G-NL-9b: no synchronous mega-loop calling sendEmail directly; must enqueue.
  // Scope the sendEmail check to adminSendNewsletterAction's BODY — a single
  // test-send-to-self (adminTestSendNewsletterAction) legitimately calls sendEmail
  // once and must not trip this gate. Only the BULK approve path must be loop-free.
  if (bulkAction == null) {
    results.push({ id: 'G-NL-9 no-sync-mega-loop', ok: false, detail: 'app/actions/newsletter.ts not found' })
  } else {
    const start = bulkAction.indexOf('function adminSendNewsletterAction')
    let body = ''
    if (start >= 0) {
      const rest = bulkAction.slice(start)
      const nextExport = rest.slice(1).search(/\n(export\s+(async\s+)?function|export\s+const)\b/)
      body = nextExport >= 0 ? rest.slice(0, nextExport + 1) : rest
    }
    const callsSendEmailDirectly = start >= 0 && /sendEmail\(/.test(body)
    const callsEnqueue = /enqueueNewsletter\(/.test(body)
    const ok = start >= 0 && !callsSendEmailDirectly && callsEnqueue
    results.push({
      id: 'G-NL-9 no-sync-mega-loop',
      ok,
      detail: ok
        ? 'app/actions/newsletter.ts — adminSendNewsletterAction enqueues via enqueueNewsletter(...) and does not call sendEmail(...) directly'
        : `app/actions/newsletter.ts — ${callsSendEmailDirectly ? 'calls sendEmail(...) directly (a synchronous mega-loop over recipients will time out the request and bypass the queue safety net)' : ''}${callsSendEmailDirectly && !callsEnqueue ? ' and ' : ''}${!callsEnqueue ? 'does not call enqueueNewsletter(...)' : ''}`,
    })
  }

  // G-NL-9c: reconciler route exists.
  results.push({
    id: 'G-NL-9 reconciler-exists',
    ok: reconcileRouteExists,
    detail: reconcileRouteExists
      ? 'app/api/cron/newsletter-reconcile/route.ts — exists'
      : 'app/api/cron/newsletter-reconcile/route.ts — not found (a stalled/orphaned send has no automated recovery path)',
  })

  return results
}

function loadInputs() {
  return {
    queue: safeRead(PATHS.queue),
    bulkAction: safeRead(PATHS.bulkAction),
    reconcileRouteExists: existsSync(PATHS.reconcileRoute),
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
      console.log(`${r.ok ? '✓' : '✗'} newsletter-queue: ${r.id} — ${r.detail}`)
    }
    if (failures.length) {
      console.error(`\n✗ newsletter-queue: ${failures.length} check(s) failed. Fix the source, not this gate.`)
    } else {
      console.log(`\n✓ newsletter-queue: all ${results.length} checks passed (G-NL-9).`)
    }
  }

  if (failures.length && !report) process.exit(1)
  process.exit(0)
}
