#!/usr/bin/env node
/**
 * check-newsletter-reputation.mjs — pre-send deliverability gate (G-NL-20).
 *
 * A once-a-month bulk blast from news.ryan-realty.com is a recurring volume spike
 * that Gmail scores on standing reputation. Sending into a LOW/BAD reputation (or
 * a spam rate over Google's 0.30% ceiling) torches deliverability for months. So a
 * LARGE send must consult the latest Google Postmaster snapshot and BLOCK on a bad
 * verdict — with a no-data → warm-up fallback (the first sends have no Postmaster
 * data; defer to the ramp, never blast, never hard-block).
 *
 *   G-NL-20  lib/newsletter/send-queue.ts enqueue must consult getLatestDeliverability
 *            + deliverabilityVerdict and refuse a large send when the verdict is
 *            'block'. lib/data/deliverability/index.ts deliverabilityVerdict must
 *            return 'warmup' on null (no data) — not 'allow', not 'block'.
 *
 * Static + comment-stripped. Usage: node scripts/check-newsletter-reputation.mjs [--json] [--report]
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripJsComments } from './lib/strip-js-comments.mjs'

const ROOT = process.cwd()
const PATHS = {
  sendQueue: join(ROOT, 'lib/newsletter/send-queue.ts'),
  deliverability: join(ROOT, 'lib/data/deliverability/index.ts'),
}
const read = (p) => (existsSync(p) ? stripJsComments(readFileSync(p, 'utf8')) : null)

export function runChecks({ sendQueue, deliverability }) {
  const results = []
  const add = (id, ok, detail) => results.push({ id, ok, detail })

  // Enqueue consults deliverability + blocks on the verdict.
  const consults = sendQueue != null && /getLatestDeliverability\(/.test(sendQueue) && /deliverabilityVerdict\(/.test(sendQueue)
  const blocks = sendQueue != null && /verdict\.action\s*===\s*'block'/.test(sendQueue)
  add(
    'G-NL-20 enqueue-consults-reputation',
    consults && blocks,
    consults && blocks
      ? 'send-queue.ts — enqueue consults getLatestDeliverability + deliverabilityVerdict and blocks a large send on a block verdict'
      : `send-queue.ts — ${!consults ? 'enqueue must call getLatestDeliverability + deliverabilityVerdict' : ''}${!consults && !blocks ? '; ' : ''}${!blocks ? "must refuse when verdict.action === 'block'" : ''}`,
  )

  // No-data → warmup fallback (not allow, not hard-block).
  const warmupFallback =
    deliverability != null && /if\s*\(\s*!row\s*\)\s*return\s*\{\s*action:\s*'warmup'/.test(deliverability)
  add(
    'G-NL-20 no-data-warmup',
    warmupFallback,
    warmupFallback
      ? 'deliverability/index.ts — deliverabilityVerdict returns warmup on no data (defers to the ramp)'
      : "deliverability/index.ts — deliverabilityVerdict must return { action: 'warmup' } when row is null (no Postmaster data yet)",
  )

  return results
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const asJson = process.argv.includes('--json')
  const report = process.argv.includes('--report')
  const results = runChecks({ sendQueue: read(PATHS.sendQueue), deliverability: read(PATHS.deliverability) })
  const failures = results.filter((r) => !r.ok)
  if (asJson) console.log(JSON.stringify({ pass: failures.length === 0, results }, null, 2))
  else {
    for (const r of results) console.log(`${r.ok ? '✓' : '✗'} newsletter-reputation: ${r.id} — ${r.detail}`)
    if (failures.length) console.error(`\n✗ newsletter-reputation: ${failures.length} check(s) failed.`)
    else console.log(`\n✓ newsletter-reputation: all ${results.length} checks passed (G-NL-20).`)
  }
  if (failures.length && !report) process.exit(1)
  process.exit(0)
}
