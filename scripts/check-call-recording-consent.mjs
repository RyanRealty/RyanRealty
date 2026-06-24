#!/usr/bin/env node
/**
 * check-call-recording-consent.mjs — locks the call-recording consent
 * announcement to the record directive (Twilio cutover 2026-06-24).
 *
 * Matt directed (2026-06-24) that calls are recorded company-wide. Oregon
 * (ORS 165.540) is one-party consent, but out-of-state callers can be in
 * two-party-consent states (CA/WA), so every TwiML route that records MUST first
 * play a "may be recorded / this call is recorded" announcement — that notice
 * plus the caller continuing is the consent. This gate fails the build if a
 * record directive (record="record-from-answer-dual" or a <Record> verb) ever
 * appears in a voice route without an accompanying recorded-notice <Say>, so a
 * refactor can never silently strip the disclosure and expose Matt's license.
 *
 * Mirrors ci:sms-consent for the voice channel.
 *
 * Usage: node scripts/check-call-recording-consent.mjs
 */

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// Every TwiML route that can record a caller.
const ROUTES = [
  'app/api/twilio/voice/route.ts',
  'app/api/twilio/voice-complete/route.ts',
  'app/api/twilio/outbound-bridge/route.ts',
]

const RECORD_DIRECTIVE = /record="record-from-answer-dual"|<Record\b/i
// A spoken notice that the call/message is recorded.
const RECORDED_NOTICE = /<Say>[^<]*\b(recorded|is recorded|may be recorded)\b/i

const failures = []
for (const rel of ROUTES) {
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) continue // route may not exist in all branches
  const src = readFileSync(abs, 'utf8')
  if (RECORD_DIRECTIVE.test(src) && !RECORDED_NOTICE.test(src)) {
    failures.push(rel)
  }
}

if (failures.length === 0) {
  console.log('✓ call-recording-consent: every recording voice route plays a "recorded" announcement (ORS 165.540 + two-party-consent).')
  process.exit(0)
}

console.error('\ncall-recording-consent gate FAILED — a record directive without a recorded-notice <Say>:')
for (const f of failures) console.error(`  ${f}`)
console.error('\nAdd a <Say> that the call may be recorded BEFORE the <Dial record=...> / <Record> verb.')
console.error('Continuing past the notice is the consent (ORS 165.540 one-party + out-of-state two-party callers).')
process.exit(1)
