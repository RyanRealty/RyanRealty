#!/usr/bin/env node
/**
 * check-crm-sms-channel-safety.mjs — gate for the 2026-06-16 expired-listing
 * iMessage incident.
 *
 * Three regressions, each a real-money TCPA / reputational hazard, are blocked:
 *
 *  1. The CRM sequence engine must NEVER route a lead/homeowner text through a
 *     personal iMessage. The broker-alert relay (crm_broker_alerts → osascript
 *     Messages) is for INTERNAL broker alerts only. Any reintroduction of an
 *     iMessage lead-fallback (the `LEAD_SMS_IMESSAGE_FALLBACK` branch, or an
 *     insert into crm_broker_alerts from the sequence engine) fails the build.
 *
 *  2. The relay (scripts/crm-alert-relay.mjs) must keep its broker-phone
 *     whitelist — the hard backstop that refuses to iMessage any non-broker
 *     number even if something upstream queues one.
 *
 *  3. A do-not-call contact must be suppressed for SMS as well as voice (a text
 *     is a "call" under the TCPA). The suppression mapping for
 *     `contact:do-not-call` must include the 'sms' channel.
 *
 * Usage: node scripts/check-crm-sms-channel-safety.mjs
 */
import { readFileSync } from 'node:fs'

const ENGINE = 'app/api/cron/crm-sequence-engine/route.ts'
const RELAY = 'scripts/crm-alert-relay.mjs'
const SUPPRESS = 'lib/crm/suppressions.ts'

const fails = []
const read = (p) => {
  try {
    return readFileSync(p, 'utf8')
  } catch {
    fails.push(`Cannot read ${p} — expected this file to exist.`)
    return ''
  }
}

// ── 1. sequence engine must not iMessage leads ──────────────────────────────
const engine = read(ENGINE)
if (/LEAD_SMS_IMESSAGE_FALLBACK/.test(engine)) {
  fails.push(
    `${ENGINE}: references LEAD_SMS_IMESSAGE_FALLBACK. The iMessage lead-fallback ` +
      `was removed in the 2026-06-16 incident — lead texts go through Twilio A2P ` +
      `or queue visibly, never a personal iMessage. Do not reintroduce it.`,
  )
}
// An insert into crm_broker_alerts from the sequence engine means lead texts are
// being smuggled into the broker-alert relay again.
if (/crm_broker_alerts/.test(engine)) {
  fails.push(
    `${ENGINE}: writes to crm_broker_alerts. The sequence engine must not queue ` +
      `into the broker-alert relay (that relay iMessages broker lines only). ` +
      `Route lead SMS through the Twilio messaging service instead.`,
  )
}

// ── 2. relay must keep the broker-phone whitelist backstop ──────────────────
const relay = read(RELAY)
if (relay && !/BROKER_PHONES/.test(relay)) {
  fails.push(
    `${RELAY}: missing the BROKER_PHONES whitelist. The relay must refuse any ` +
      `to_phone that is not a broker line (Matt/Rebecca/Paul) — the hard backstop ` +
      `against iMessaging a homeowner.`,
  )
}

// ── 3. do-not-call must suppress SMS (TCPA: a text is a call) ────────────────
const suppress = read(SUPPRESS)
const dncLine = suppress.match(/contact:do-not-call'[^\n]*channels:\s*\[([^\]]*)\]/)
if (suppress && (!dncLine || !/'sms'/.test(dncLine[1]))) {
  fails.push(
    `${SUPPRESS}: 'contact:do-not-call' must suppress the 'sms' channel (a text ` +
      `is legally a call under the TCPA). Found: ${dncLine ? dncLine[1].trim() : 'no mapping'}.`,
  )
}

if (fails.length) {
  console.error('✗ crm-sms-channel-safety FAILED:\n')
  for (const f of fails) console.error('  • ' + f + '\n')
  process.exit(1)
}
console.log('✓ crm-sms-channel-safety: lead SMS never routes through iMessage; relay whitelisted; do-not-call suppresses SMS.')
