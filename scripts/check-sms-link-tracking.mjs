#!/usr/bin/env node
/**
 * check-sms-link-tracking.mjs — ci:sms-link-tracking (W1.4).
 *
 * "SMS click tracking everywhere": every code path that sends a lead-facing SMS
 * must rewrite its links to tracked short links (instrumentSmsLinks) — directly,
 * or via the governed chokepoint (sendGovernedSms, which instruments internally)
 * — so a click is attributed to the person. The sequence engine shipped
 * uninstrumented person-keyed SMS, and nothing caught it. This gate makes that
 * impossible: any file that calls a raw provider send (sendSms /
 * sendSmsViaMessagingService) must ALSO instrument, unless it is an explicitly
 * documented exemption.
 *
 * assert-what-must-be-true (no baseline). A new raw sender that forgets to
 * instrument fails the build.
 *
 * ROBUSTNESS: both the "has a raw send" and "instruments" probes run against a
 * COMMENT- AND STRING-STRIPPED copy of the source (stripNonCode). A mention of
 * `instrumentSmsLinks(` in a comment or a string literal must NOT satisfy the
 * gate — only a real call in live code counts. (Verified 2026-07-22: without the
 * strip, a `// TODO: call instrumentSmsLinks(...)` comment next to a real
 * un-instrumented sendSms() falsely passed.) Granularity is per-file, not
 * per-call: a file that both instruments and does a genuinely non-attributable
 * raw send (no person to key a click to) passes — those live in EXEMPT with a
 * reason, or are covered because every current attributable sender instruments.
 *
 * Usage: node scripts/check-sms-link-tracking.mjs
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const SEND_CALL = /\b(?:sendSms|sendSmsViaMessagingService)\s*\(/
const INSTRUMENTS = /\b(?:instrumentSmsLinks|sendGovernedSms)\s*\(/

// Files that call a raw provider send but legitimately do NOT instrument links,
// each with a reason. Keep TINY — a new entry needs a real justification.
const EXEMPT = new Map([
  ['lib/crm/twilio.ts', 'the provider primitive — this IS sendSms/sendSmsViaMessagingService, not a lead-facing caller'],
  ['app/api/twilio/inbound-sms/route.ts', 'forwards an inbound lead text to the BROKER cell (internal, not a lead-facing tracked send) + raw no-contact group replies with no person to key to'],
  ['app/actions/crm-template-test.ts', 'broker self-test template preview to the CALLING BROKER\'S OWN cell (sample merge data) — not a lead-facing send, no person to attribute a click to (already a NON_SENDER in the CAN-SPAM gate for the same reason)'],
])

// Char-by-char tokenizer: return the source with line comments, block comments,
// and string/template literals blanked out, so a regex can only match REAL code.
// Same doctrine as check-site-index-freshness / check-sitemap-resolvable — a
// dead comment or a decoy string can never satisfy a "must be present" probe.
function stripNonCode(src) {
  let out = ''
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    const c2 = src[i + 1]
    // Line comment
    if (c === '/' && c2 === '/') {
      while (i < n && src[i] !== '\n') i++
      continue
    }
    // Block comment
    if (c === '/' && c2 === '*') {
      i += 2
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++
      i += 2
      continue
    }
    // String / template literal — blank the interior, keep newlines for line math
    if (c === '"' || c === "'" || c === '`') {
      const quote = c
      out += ' '
      i++
      while (i < n) {
        if (src[i] === '\\') { i += 2; continue }
        if (src[i] === quote) { i++; break }
        out += src[i] === '\n' ? '\n' : ' '
        i++
      }
      continue
    }
    out += c
    i++
  }
  return out
}

function walk(dir, out) {
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.')) continue
    const full = join(dir, e.name)
    if (e.isDirectory()) walk(full, out)
    else if (/\.(ts|tsx|js|mjs)$/.test(e.name) && !/\.test\.|\.spec\./.test(e.name)) out.push(full)
  }
}

const files = []
for (const root of ['app', 'lib']) walk(root, files)

const problems = []
for (const f of files) {
  const code = stripNonCode(readFileSync(f, 'utf8'))
  if (!SEND_CALL.test(code)) continue
  const rel = f.replace(/\\/g, '/')
  if (EXEMPT.has(rel)) continue
  if (!INSTRUMENTS.test(code)) {
    problems.push(`${rel}: calls a raw SMS provider send (sendSms/sendSmsViaMessagingService) but never instruments links (instrumentSmsLinks / sendGovernedSms). A lead-facing SMS with un-tracked links loses click attribution — instrument the body before sending, or add a documented EXEMPT entry if it is genuinely not lead-facing.`)
  }
}

console.log('SMS link-tracking gate (ci:sms-link-tracking)')
console.log('============================================')
console.log(`raw-send files scanned · exemptions: ${EXEMPT.size}`)
if (problems.length) {
  console.error(`\n\x1b[31m✗ ci:sms-link-tracking: ${problems.length} un-instrumented SMS sender(s)\x1b[0m`)
  for (const p of problems) console.error(`  ✗ ${p}`)
  process.exit(1)
}
console.log('✓ Every lead-facing SMS sender instruments its links (or is a documented exemption).')
process.exit(0)
