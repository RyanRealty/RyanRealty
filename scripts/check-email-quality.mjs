#!/usr/bin/env node
/**
 * ci:email-quality — every NEW automated-email sender must route through
 * prepareDeliverableEmail() (CONTACT360 Phase 9.E.4).
 *
 * prepareDeliverableEmail (lib/email/prepare.ts) is the single inbox-placement
 * preflight: it forces a plain-text alternative, a CAN-SPAM footer (visible
 * unsubscribe + physical address), the RFC 8058 List-Unsubscribe headers, and a
 * deliverability score. A marketing/automated email built without it is a spam /
 * undeliverability risk.
 *
 * This is a RATCHET. The current senders that do NOT yet use the preflight are
 * grandfathered in scripts/email-quality-baseline.json — that file is the
 * migration backlog. The gate FAILS when:
 *   - a NEW sender (not in the baseline) sends automated email without the
 *     preflight, OR
 *   - a baselined sender is migrated/removed (lock the win: re-baseline).
 *
 * As each sender is migrated to prepareDeliverableEmail (or classified as a
 * genuinely-internal send -> NON_SENDER), the baseline shrinks. It may only
 * shrink. Re-baseline: npm run ci:email-quality:baseline
 *
 * Usage: node scripts/check-email-quality.mjs [--report | --write-baseline]
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = process.cwd()
const BASELINE = join(ROOT, 'scripts/email-quality-baseline.json')
const SCAN = ['lib', 'app']

// Files that DEFINE the send primitives / the preflight itself — not senders.
const NON_SENDER = new Set([
  'lib/resend.ts',
  'lib/crm/gmail.ts',
  'lib/email/prepare.ts',
  'lib/email/deliverability.ts',
  // Internal infrastructure alerts — not marketing/automated sends
  'lib/deploy-health-alert.ts',
])

const SEND_CALL = /\bsendEmail\s*\(|\bsendBatchEmails\s*\(|\bsendCrmEmail\s*\(/
const PREFLIGHT = /prepareDeliverableEmail/

/** Pure: does this source build+send an automated email? (testable) */
export function sendsAutomatedEmail(src) {
  return SEND_CALL.test(src)
}

/** Pure: does this source send without routing through the preflight? (testable) */
export function flagsMissingPreflight(src) {
  return SEND_CALL.test(src) && !PREFLIGHT.test(src)
}

function walk(dir, out = []) {
  const abs = join(ROOT, dir)
  if (!existsSync(abs)) return out
  for (const name of readdirSync(abs)) {
    if (name === 'node_modules' || name === '.next') continue
    const rel = `${dir}/${name}`
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.(ts|tsx)$/.test(name)) out.push(rel)
  }
  return out
}

function currentMissing() {
  const files = SCAN.flatMap((d) => walk(d))
  const missing = []
  for (const rel of files) {
    if (NON_SENDER.has(rel)) continue
    const src = readFileSync(join(ROOT, rel), 'utf8')
    if (flagsMissingPreflight(src)) missing.push(rel)
  }
  return missing.sort()
}

function loadBaseline() {
  if (!existsSync(BASELINE)) return []
  try {
    return JSON.parse(readFileSync(BASELINE, 'utf8'))
  } catch {
    return []
  }
}

function run(mode) {
  const missing = currentMissing()

  if (mode === '--write-baseline') {
    writeFileSync(BASELINE, JSON.stringify(missing, null, 2) + '\n')
    console.log(`email-quality: baseline written — ${missing.length} grandfathered sender(s).`)
    return 0
  }

  const baseline = loadBaseline()
  const baseSet = new Set(baseline)
  const curSet = new Set(missing)
  const added = missing.filter((f) => !baseSet.has(f))
  const removed = baseline.filter((f) => !curSet.has(f))

  if (mode === '--report') {
    console.log(`email-quality: ${missing.length} un-preflighted sender(s); baseline ${baseline.length}.`)
    missing.forEach((f) => console.log(`  - ${f}`))
    return 0
  }

  const fails = []
  if (added.length) {
    fails.push(
      `${added.length} NEW automated-email sender(s) bypass prepareDeliverableEmail:\n` +
        added.map((f) => `      ${f}`).join('\n') +
        `\n  Route the send through prepareDeliverableEmail() from '@/lib/email/prepare' (multipart + ` +
        `List-Unsubscribe + CAN-SPAM footer + deliverability scoring). If it is genuinely NOT a ` +
        `marketing/automated send (a 1:1 broker reply or internal alert), add it to NON_SENDER in this gate.`,
    )
  }
  if (removed.length) {
    fails.push(
      `${removed.length} baselined sender(s) are no longer un-preflighted (migrated or removed):\n` +
        removed.map((f) => `      ${f}`).join('\n') +
        `\n  Lock the win — the baseline may only shrink: npm run ci:email-quality:baseline`,
    )
  }

  if (fails.length) {
    console.error('✗ email-quality:\n\n  ' + fails.join('\n\n  ') + '\n')
    return 1
  }
  console.log(
    `✓ email-quality: no new un-preflighted email senders ` +
      `(${missing.length} grandfathered in the migration backlog, ratcheting down).`,
  )
  return 0
}

// Only execute when invoked directly, so a vitest can import the pure helpers.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(run(process.argv[2]))
}
