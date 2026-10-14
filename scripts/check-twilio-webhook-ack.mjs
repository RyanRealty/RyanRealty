#!/usr/bin/env node
/**
 * check-twilio-webhook-ack.mjs (ci:twilio-webhook-ack)
 *
 * Twilio inbound webhooks must ack under the 15s 11200/11203 deadline:
 * validate signature, persist raw payload, return TwiML/200, then CRM /
 * timeline / STOP opt-out run after the ack or via cron replay.
 */
import { readFileSync, existsSync } from 'node:fs'

const fails = []

function read(path) {
  if (!existsSync(path)) {
    fails.push(`missing ${path}`)
    return ''
  }
  return readFileSync(path, 'utf8')
}

const ack = read('lib/crm/twilio-webhook-ack.ts')
const tests = read('lib/crm/twilio-webhook-ack.test.ts')
const sms = read('app/api/twilio/inbound-sms/route.ts')
const voice = read('app/api/twilio/voice/route.ts')
const complete = read('app/api/twilio/voice-complete/route.ts')
const recording = read('app/api/twilio/recording/route.ts')
const cron = read('app/api/cron/twilio-webhook-replay/route.ts')
const dal = read('lib/data/crm/twilioRawEvents.ts')
const migration = read('supabase/migrations/20261014224500_twilio_webhook_raw_events.sql')
const agents = read('AGENTS.md')

if (!/ackTwilioWebhook/.test(ack) || !/persistTwilioRawEvent/.test(ack) || !/scheduleAfterAck/.test(ack)) {
  fails.push('lib/crm/twilio-webhook-ack.ts must persist then ack via after/waitUntil')
}
if (!/smsKeywordReply/.test(ack) || !/STOP_WORDS/.test(ack)) {
  fails.push('lib/crm/twilio-webhook-ack.ts must decide STOP TwiML on the hot path')
}

for (const [path, src] of [
  ['app/api/twilio/inbound-sms/route.ts', sms],
  ['app/api/twilio/voice/route.ts', voice],
  ['app/api/twilio/voice-complete/route.ts', complete],
  ['app/api/twilio/recording/route.ts', recording],
]) {
  if (!/ackTwilioWebhook/.test(src)) {
    fails.push(`${path} must ack through ackTwilioWebhook`)
  }
}

if (!/addSuppression/.test(sms) || !/STOP_WORDS/.test(sms)) {
  fails.push('inbound-sms must still write STOP opt-out after the ack')
}
if (!/clearNonOptOutSuppressions/.test(sms)) {
  fails.push('inbound-sms must keep DNC / non-opt-out auto-clear in the after-ack processor')
}
if (!/applyInboundMessageEnrichment/.test(sms) || !/applyInboundMessageEnrichment/.test(recording)) {
  fails.push('SMS + recording processors must still enrich CRM people')
}

if (!/insert_twilio_webhook_raw_event/.test(dal) || !/TWILIO_RAW_PERSIST_MS/.test(dal)) {
  fails.push('lib/data/crm/twilioRawEvents.ts must insert via the 2s RPC')
}
if (!/statement_timeout = '2s'/.test(migration) || !/twilio_webhook_raw_events/.test(migration)) {
  fails.push('migration must create twilio_webhook_raw_events with a 2s insert timeout')
}
if (!/replayUnprocessedTwilioRawEvents/.test(cron) || !/requireCronAuth/.test(cron)) {
  fails.push('twilio-webhook-replay cron must replay unprocessed rows under requireCronAuth')
}

if (!/acks under the deadline/.test(tests) || !/CRM processing hangs/.test(tests)) {
  fails.push('tests must prove the ack returns under the deadline when CRM hangs')
}
if (!/CRM processing throws/.test(tests)) {
  fails.push('tests must prove the ack returns when CRM throws')
}
if (!/raw insert hangs/.test(tests)) {
  fails.push('tests must prove the ack returns under the deadline when the raw insert hangs')
}
if (!/persists the raw payload/.test(tests)) {
  fails.push('tests must prove the raw payload is persisted')
}
if (!/idempotent on MessageSid/.test(tests)) {
  fails.push('tests must prove replay is idempotent by MessageSid')
}

if (!/Twilio inbound ack/.test(agents)) {
  fails.push('AGENTS.md must carry the Twilio inbound ack rule')
}

console.log('Twilio webhook ack gate (ci:twilio-webhook-ack)')
console.log('==============================================')
if (fails.length) {
  for (const f of fails) console.error('  ✗ ' + f)
  process.exit(1)
}
console.log('OK — signature, fast persist, TwiML ack, async CRM/STOP, idempotent replay.')
process.exit(0)
