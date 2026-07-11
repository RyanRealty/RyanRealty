#!/usr/bin/env node
/**
 * check-newsletter-drain-safety.mjs — recipient-level re-check gate for the
 * newsletter drain + the one-click opt-out guard (covers G-NL-6).
 *
 * A newsletter can sit in the queue for hours (scheduled sends, admin review
 * delay) between the moment a recipient was enrolled and the moment the
 * drain actually dispatches to them. If the drain trusts the enrollment-time
 * snapshot instead of re-checking suppression + subscriber status at drain
 * time, a person who unsubscribed or hard-bounced in the interim gets mailed
 * anyway — a CAN-SPAM / deliverability risk to Ryan Realty's license
 * (CLAUDE.md §0). Separately, the one-click contact-form path must never
 * silently reactivate someone who previously opted out.
 *
 *   G-NL-6  `lib/newsletter/send-queue.ts` drain must re-check BOTH
 *           suppression (`isSuppressedByEmail(`) AND active subscriber status
 *           (`status !== 'active'`) per recipient before sending.
 *   G-NL-6  `app/actions/contact-newsletter.ts` must guard against
 *           reactivating an opt-out: the file must reference the existing
 *           subscriber row (`existing`) AND refuse when it is not active
 *           (`!== 'active'`).
 *
 * Static text checks only — no network calls, no live send. Mirrors the house
 * style of scripts/check-newsletter-compliance.mjs.
 *
 * Usage:
 *   node scripts/check-newsletter-drain-safety.mjs            # human output
 *   node scripts/check-newsletter-drain-safety.mjs --json      # machine output
 *   node scripts/check-newsletter-drain-safety.mjs --report    # never exits 1
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripJsComments } from './lib/strip-js-comments.mjs'

const ROOT = process.cwd()

const PATHS = {
  sendQueue: join(ROOT, 'lib/newsletter/send-queue.ts'),
  contactNewsletter: join(ROOT, 'app/actions/contact-newsletter.ts'),
  // The queue DAL: crash-recovery + finalize live here (NL-H2 double-send guard).
  queue: join(ROOT, 'lib/data/newsletter/queue.ts'),
}

// Strip comments so a required token in a doc comment can't fake a pass (a gate
// must check CODE, not comments — see scripts/lib/strip-js-comments.mjs).
function safeRead(path) {
  return existsSync(path) ? stripJsComments(readFileSync(path, 'utf8')) : null
}

/**
 * Slice out a single named function's body from comment-stripped source, so a check
 * scopes to THAT function (e.g. requeueStaleClaims) and can't be faked by a matching
 * token elsewhere in the file. Returns the text from the function's opening brace to
 * the start of the next top-level `export ` (or end of file), or null if not found.
 */
function extractFunctionBody(src, name) {
  if (src == null) return null
  const start = src.search(new RegExp(`function\\s+${name}\\b`))
  if (start < 0) return null
  const rest = src.slice(start)
  const nextExport = rest.slice(1).search(/\n(?:export\s+)?(?:async\s+)?function\s+\w+\b/)
  return nextExport < 0 ? rest : rest.slice(0, nextExport + 1)
}

/**
 * Pure: run every check against already-read file contents. Returns an array
 * of { id, ok, detail } — one row per assertion, in check order.
 */
export function runChecks({ sendQueue, contactNewsletter, queue }) {
  const results = []

  // G-NL-6a: drain re-checks suppression AND active status per recipient.
  if (sendQueue == null) {
    results.push({ id: 'G-NL-6 drain-recheck', ok: false, detail: 'lib/newsletter/send-queue.ts not found' })
  } else {
    const hasSuppressionCheck = /isSuppressedByEmail\(/.test(sendQueue)
    const hasActiveCheck = /status\s*!==\s*'active'/.test(sendQueue)
    const ok = hasSuppressionCheck && hasActiveCheck
    results.push({
      id: 'G-NL-6 drain-recheck',
      ok,
      detail: ok
        ? "lib/newsletter/send-queue.ts — drain re-checks isSuppressedByEmail(...) and status !== 'active' per recipient"
        : `lib/newsletter/send-queue.ts — missing ${!hasSuppressionCheck ? 'isSuppressedByEmail(...) call' : ''}${!hasSuppressionCheck && !hasActiveCheck ? ' and ' : ''}${!hasActiveCheck ? "status !== 'active' check" : ''} (a recipient who unsubscribed/bounced after enrollment could still get mailed)`,
    })
  }

  // G-NL-6c: crash-recovery keys on the CLAIM time, not the enqueue time (NL-H2).
  // requeueStaleClaims must reset stuck 'sending' rows by comparing claimed_at (when
  // the row was claimed) against the cutoff — NOT created_at (the row's enqueue time,
  // which is always old, so EVERY unfinalized row requeued → the recipient double-sent).
  if (queue == null) {
    results.push({ id: 'G-NL-6 requeue-keys-claimed-at', ok: false, detail: 'lib/data/newsletter/queue.ts not found' })
  } else {
    const body = extractFunctionBody(queue, 'requeueStaleClaims')
    const keysClaimedAt = body != null && /\.lt\(\s*['"]claimed_at['"]/.test(body)
    const stillKeysCreatedAt = body != null && /\.lt\(\s*['"]created_at['"]/.test(body)
    const ok = keysClaimedAt && !stillKeysCreatedAt
    results.push({
      id: 'G-NL-6 requeue-keys-claimed-at',
      ok,
      detail:
        body == null
          ? 'lib/data/newsletter/queue.ts — requeueStaleClaims(...) not found'
          : ok
            ? "lib/data/newsletter/queue.ts — requeueStaleClaims keys crash-recovery on .lt('claimed_at', cutoff)"
            : `lib/data/newsletter/queue.ts — requeueStaleClaims must key on .lt('claimed_at', cutoff)${stillKeysCreatedAt ? " and must NOT key on .lt('created_at', ...) (enqueue time is always old → every stuck row requeues → double-send)" : ' (claimed_at filter missing)'}`,
    })
  }

  // G-NL-6d: finalizeRecipient must CHECK its update error, not swallow it (NL-H2).
  // A swallowed error leaves the row in 'sending'; the stale-claim recovery then
  // requeues it and the recipient is emailed a second time. The finalize must
  // destructure { error } and act on it (log + raise).
  if (queue == null) {
    results.push({ id: 'G-NL-6 finalize-checks-error', ok: false, detail: 'lib/data/newsletter/queue.ts not found' })
  } else {
    const body = extractFunctionBody(queue, 'finalizeRecipient')
    const destructuresError = body != null && /const\s*\{\s*error\s*\}\s*=\s*await\s+sb/.test(body)
    const actsOnError = body != null && /if\s*\(\s*error\s*\)/.test(body) && /(throw|console\.error)/.test(body)
    const ok = destructuresError && actsOnError
    results.push({
      id: 'G-NL-6 finalize-checks-error',
      ok,
      detail:
        body == null
          ? 'lib/data/newsletter/queue.ts — finalizeRecipient(...) not found'
          : ok
            ? 'lib/data/newsletter/queue.ts — finalizeRecipient checks its update error and raises/logs on failure'
            : `lib/data/newsletter/queue.ts — finalizeRecipient must ${!destructuresError ? 'destructure { error } from the update' : ''}${!destructuresError && !actsOnError ? ' and ' : ''}${!actsOnError ? 'guard on it (if (error) → throw/console.error)' : ''} (a swallowed finalize error strands the row in \'sending\' → double-send on requeue)`,
    })
  }

  // G-NL-6b: one-click path refuses to reactivate a non-active subscriber.
  if (contactNewsletter == null) {
    results.push({ id: 'G-NL-6 no-reactivate-optout', ok: false, detail: 'app/actions/contact-newsletter.ts not found' })
  } else {
    const hasExisting = /\bexisting\b/.test(contactNewsletter)
    const hasNotActiveGuard = /!==\s*'active'/.test(contactNewsletter)
    const ok = hasExisting && hasNotActiveGuard
    results.push({
      id: 'G-NL-6 no-reactivate-optout',
      ok,
      detail: ok
        ? "app/actions/contact-newsletter.ts — refuses to re-subscribe/send when an existing subscriber is not 'active'"
        : `app/actions/contact-newsletter.ts — missing ${!hasExisting ? 'a reference to the existing subscriber row' : ''}${!hasExisting && !hasNotActiveGuard ? ' and ' : ''}${!hasNotActiveGuard ? "a !== 'active' guard" : ''} (the one-click path could silently reactivate an opt-out)`,
    })
  }

  return results
}

function loadInputs() {
  return {
    sendQueue: safeRead(PATHS.sendQueue),
    contactNewsletter: safeRead(PATHS.contactNewsletter),
    queue: safeRead(PATHS.queue),
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
      console.log(`${r.ok ? '✓' : '✗'} newsletter-drain-safety: ${r.id} — ${r.detail}`)
    }
    if (failures.length) {
      console.error(`\n✗ newsletter-drain-safety: ${failures.length} check(s) failed. Fix the source, not this gate.`)
    } else {
      console.log(`\n✓ newsletter-drain-safety: all ${results.length} checks passed (G-NL-6).`)
    }
  }

  if (failures.length && !report) process.exit(1)
  process.exit(0)
}
