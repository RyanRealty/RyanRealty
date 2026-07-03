#!/usr/bin/env node
/**
 * check-newsletter-broker.mjs — the per-broker identity-swap gate (G-NL-5 + G-NL-8).
 *
 * The whole point of the newsletter is that each recipient's copy is branded by
 * THEIR assigned broker (spec §5). Two ways that silently breaks:
 *
 *   G-NL-5a  The render attributes by the SENDER's slug (the admin who clicked
 *            send) instead of the recipient's FROZEN broker — the exact pre-build
 *            bug. Assert lib/newsletter/send-queue.ts resolves the broker from
 *            `recipient.broker` (via normalizeBroker(recipient.broker)).
 *   G-NL-5b  Engagement analytics need broker on opens/clicks from BOTH sources.
 *            The Resend webhook arrives keyed only by message_id, so it must
 *            resolve broker via newsletter_recipients and stamp it (H1). Assert
 *            app/api/webhooks/resend/route.ts looks up `newsletter_recipients` by
 *            `resend_message_id` for `broker` and passes `broker: eventBroker`.
 *   G-NL-8   Email clients can't load relative/app-hosted images, so every broker
 *            headshot in the shell/render must be an ABSOLUTE https:// URL. Assert
 *            the HEADSHOTS map in send-queue.ts has only https:// values and no
 *            bare `/images/brokers/` relative path.
 *
 * Static + comment-stripped (checks CODE, not doc comments).
 *
 * Usage: node scripts/check-newsletter-broker.mjs [--json] [--report]
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripJsComments } from './lib/strip-js-comments.mjs'

const ROOT = process.cwd()
const PATHS = {
  sendQueue: join(ROOT, 'lib/newsletter/send-queue.ts'),
  webhook: join(ROOT, 'app/api/webhooks/resend/route.ts'),
}

function safeRead(p) {
  return existsSync(p) ? stripJsComments(readFileSync(p, 'utf8')) : null
}

export function runChecks({ sendQueue, webhook }) {
  const results = []

  // G-NL-5a: render resolves broker from the recipient's frozen slug.
  if (sendQueue == null) {
    results.push({ id: 'G-NL-5a recipient-broker', ok: false, detail: 'lib/newsletter/send-queue.ts not found' })
  } else {
    const ok = /normalizeBroker\(\s*recipient\.broker\s*\)/.test(sendQueue)
    results.push({
      id: 'G-NL-5a recipient-broker',
      ok,
      detail: ok
        ? 'send-queue.ts — render resolves broker from recipient.broker (frozen), not the sender slug'
        : 'send-queue.ts — expected normalizeBroker(recipient.broker); the render must use the RECIPIENT\'s frozen broker, not the sender',
    })
  }

  // G-NL-5b: webhook stamps broker from newsletter_recipients by message_id.
  if (webhook == null) {
    results.push({ id: 'G-NL-5b webhook-broker', ok: false, detail: 'app/api/webhooks/resend/route.ts not found' })
  } else {
    const looksUp = /newsletter_recipients/.test(webhook) && /resend_message_id/.test(webhook) && /broker/.test(webhook)
    const stamps = /broker:\s*eventBroker/.test(webhook)
    const ok = looksUp && stamps
    results.push({
      id: 'G-NL-5b webhook-broker',
      ok,
      detail: ok
        ? 'resend webhook — resolves broker via newsletter_recipients(resend_message_id) and stamps it on the event rows (H1)'
        : `resend webhook — missing ${!looksUp ? 'the newsletter_recipients broker lookup by resend_message_id' : ''}${!looksUp && !stamps ? ' and ' : ''}${!stamps ? 'broker: eventBroker on the event write' : ''}`,
    })
  }

  // G-NL-8: broker headshots are absolute https:// (email can't load relative assets).
  if (sendQueue == null) {
    results.push({ id: 'G-NL-8 headshot-https', ok: false, detail: 'lib/newsletter/send-queue.ts not found' })
  } else {
    const mapMatch = sendQueue.match(/HEADSHOTS[^=]*=\s*\{([\s\S]*?)\}/)
    const body = mapMatch ? mapMatch[1] : ''
    const urls = [...body.matchAll(/'([^']+)'|"([^"]+)"/g)].map((m) => m[1] ?? m[2]).filter((u) => u.includes('/'))
    const allHttps = urls.length >= 3 && urls.every((u) => u.startsWith('https://'))
    const noRelative = !/['"]\/images\/brokers\//.test(sendQueue)
    const ok = allHttps && noRelative
    results.push({
      id: 'G-NL-8 headshot-https',
      ok,
      detail: ok
        ? `send-queue.ts — all ${urls.length} broker headshots are absolute https:// URLs`
        : `send-queue.ts — headshots must be absolute https:// (found ${urls.length} url(s); relative /images/brokers/ path ${noRelative ? 'absent' : 'PRESENT — email clients can\'t load it'})`,
    })
  }

  return results
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const asJson = process.argv.includes('--json')
  const report = process.argv.includes('--report')
  const results = runChecks({ sendQueue: safeRead(PATHS.sendQueue), webhook: safeRead(PATHS.webhook) })
  const failures = results.filter((r) => !r.ok)
  if (asJson) {
    console.log(JSON.stringify({ pass: failures.length === 0, results }, null, 2))
  } else {
    for (const r of results) console.log(`${r.ok ? '✓' : '✗'} newsletter-broker: ${r.id} — ${r.detail}`)
    if (failures.length) console.error(`\n✗ newsletter-broker: ${failures.length} check(s) failed.`)
    else console.log(`\n✓ newsletter-broker: all ${results.length} checks passed (G-NL-5, G-NL-8).`)
  }
  if (failures.length && !report) process.exit(1)
  process.exit(0)
}
