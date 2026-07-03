#!/usr/bin/env node
/**
 * check-newsletter-events.mjs — engagement-ledger integrity gate (G-NL-10 + G-NL-13).
 *
 *   G-NL-13  Resend's native one-click unsubscribe must be handled — `EVENT_MAP`
 *            in lib/crm/resend-webhook.ts must contain `email.unsubscribed`, or an
 *            unsubscribe via the List-Unsubscribe header silently never reaches
 *            newsletter_subscribers (edge case T-8).
 *   G-NL-10  Open/click counts must derive from the DEDUPED ledger, not the
 *            newsletter_recipients counters a webhook redelivery inflates:
 *            - lib/data/newsletter/queue.ts must expose getNewsletterStatsFromLedger
 *              and it must read newsletter_recipient_events.
 *            - recordLedgerEvent must build a RECIPIENT-scoped dedupe_key
 *              (`nl:<id>:sub:<...>`), NOT a bare resend_message_id key (A3 — our own
 *              pixel has no message_id, and two sources must collapse to one row).
 *            - the Resend webhook must actually write the ledger (recordLedgerEvent).
 *
 * Static + comment-stripped (checks CODE, not comments).
 * Usage: node scripts/check-newsletter-events.mjs [--json] [--report]
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripJsComments } from './lib/strip-js-comments.mjs'

const ROOT = process.cwd()
const PATHS = {
  webhookLib: join(ROOT, 'lib/crm/resend-webhook.ts'),
  webhookRoute: join(ROOT, 'app/api/webhooks/resend/route.ts'),
  queue: join(ROOT, 'lib/data/newsletter/queue.ts'),
}
const read = (p) => (existsSync(p) ? stripJsComments(readFileSync(p, 'utf8')) : null)

export function runChecks({ webhookLib, webhookRoute, queue }) {
  const results = []
  const add = (id, ok, detail) => results.push({ id, ok, detail })

  // G-NL-13: email.unsubscribed in EVENT_MAP.
  add(
    'G-NL-13 unsubscribed-event',
    webhookLib != null && /['"]email\.unsubscribed['"]/.test(webhookLib),
    webhookLib == null
      ? 'lib/crm/resend-webhook.ts not found'
      : /['"]email\.unsubscribed['"]/.test(webhookLib)
        ? 'resend-webhook.ts — EVENT_MAP handles email.unsubscribed (T-8)'
        : "resend-webhook.ts — EVENT_MAP is missing 'email.unsubscribed' (a Resend unsubscribe never flips the subscriber)",
  )

  // G-NL-10a: stats derive from the ledger.
  const hasStatsFn = queue != null && /getNewsletterStatsFromLedger/.test(queue) && /newsletter_recipient_events|EVENTS/.test(queue)
  add(
    'G-NL-10 stats-from-ledger',
    hasStatsFn,
    hasStatsFn
      ? 'queue.ts — getNewsletterStatsFromLedger reads the newsletter_recipient_events ledger'
      : 'queue.ts — expected getNewsletterStatsFromLedger reading newsletter_recipient_events (counts must not come from the inflatable recipient counters)',
  )

  // G-NL-10b: recipient-scoped dedupe_key (A3), not message-id-scoped.
  const recipientScoped = queue != null && /dedupe\s*=\s*`nl:\$\{[^}]*\}:sub:/.test(queue)
  add(
    'G-NL-10 recipient-scoped-dedupe',
    recipientScoped,
    recipientScoped
      ? 'queue.ts — recordLedgerEvent builds a recipient-scoped dedupe_key (nl:<id>:sub:<...>)'
      : 'queue.ts — recordLedgerEvent must build a recipient-scoped dedupe_key `nl:${newsletterId}:sub:${key}:...` (A3), not a resend_message_id key',
  )

  // G-NL-10c: the webhook writes the ledger.
  const webhookWrites = webhookRoute != null && /recordLedgerEvent\(/.test(webhookRoute)
  add(
    'G-NL-10 webhook-writes-ledger',
    webhookWrites,
    webhookWrites
      ? 'resend webhook — writes the engagement ledger via recordLedgerEvent'
      : 'resend webhook — must call recordLedgerEvent to populate the deduped ledger',
  )

  return results
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const asJson = process.argv.includes('--json')
  const report = process.argv.includes('--report')
  const results = runChecks({ webhookLib: read(PATHS.webhookLib), webhookRoute: read(PATHS.webhookRoute), queue: read(PATHS.queue) })
  const failures = results.filter((r) => !r.ok)
  if (asJson) console.log(JSON.stringify({ pass: failures.length === 0, results }, null, 2))
  else {
    for (const r of results) console.log(`${r.ok ? '✓' : '✗'} newsletter-events: ${r.id} — ${r.detail}`)
    if (failures.length) console.error(`\n✗ newsletter-events: ${failures.length} check(s) failed.`)
    else console.log(`\n✓ newsletter-events: all ${results.length} checks passed (G-NL-10, G-NL-13).`)
  }
  if (failures.length && !report) process.exit(1)
  process.exit(0)
}
