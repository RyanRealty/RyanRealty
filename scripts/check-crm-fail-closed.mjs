#!/usr/bin/env node
/**
 * check-crm-fail-closed.mjs (ci:crm-fail-closed) — audit p0.3.
 *
 * CRM compliance must fail toward NOT messaging:
 *  1. enroll.ts hard-stop checks must capture the query .error and bail (fail
 *     closed) — a network blip must never enroll a hard-stopped contact.
 *  2. inbound-sms must implement a START handler (the STOP auto-reply promises
 *     "Reply START to resubscribe"), so an opt-out is reversible.
 */
import { readFileSync } from 'node:fs'

const fails = []

const enroll = readFileSync('lib/crm/enroll.ts', 'utf8')
const hardStopReads = (enroll.match(/from\('crm_suppressions'\)/g) || []).length
const errGuards = (enroll.match(/hardStopError/g) || []).length
// each hard-stop read needs its own error guard (declared + checked = 2 mentions each)
if (errGuards < hardStopReads * 2) {
  fails.push(`lib/crm/enroll.ts: ${hardStopReads} hard-stop read(s) but only ${errGuards} hardStopError mention(s) — every hard-stop check must fail CLOSED (capture .error and return)`)
}

const inbound = readFileSync('app/api/twilio/inbound-sms/route.ts', 'utf8')
if (!/START_WORDS/.test(inbound) || !/removeSuppression/.test(inbound)) {
  fails.push('app/api/twilio/inbound-sms: must implement a START handler (START_WORDS + removeSuppression) to honor the "Reply START to resubscribe" promise')
}

console.log('CRM compliance fail-closed gate (ci:crm-fail-closed)')
console.log('===================================================')
if (fails.length) {
  for (const f of fails) console.error('  ✗ ' + f)
  console.error('\nFAILED — see the p0.3 entry in docs/audit/REMEDIATION_PROGRESS.md.')
  process.exit(1)
}
console.log('OK — hard-stop checks fail closed + STOP/START is reversible.')
process.exit(0)
