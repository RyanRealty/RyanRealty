#!/usr/bin/env node
/**
 * check-inbound-message-enrich.mjs (ci:inbound-message-enrich)
 *
 * Inbound voicemail transcription and inbound SMS must enrich the CRM person
 * (name on placeholder only, timeline note, lead type / source, unverified
 * scam flag) without sending a reply. The unit tests hold the Elize, real-name
 * no-overwrite, and scam fixtures.
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

const sms = read('app/api/twilio/inbound-sms/route.ts')
const recording = read('app/api/twilio/recording/route.ts')
const enrich = read('lib/crm/inbound-message-enrich.ts')
const extract = read('lib/crm/inbound-message-extract.ts')
const apply = read('lib/data/crm/applyInboundMessageEnrichment.ts')
const tests = read('lib/crm/inbound-message-enrich.test.ts')
const enroll = read('lib/crm/enroll.ts')
const replay = read('app/api/admin/crm/inbound-enrich/route.ts')

if (!/applyInboundMessageEnrichment/.test(sms)) {
  fails.push('app/api/twilio/inbound-sms/route.ts must call applyInboundMessageEnrichment')
}
if (!/applyInboundMessageEnrichment/.test(recording)) {
  fails.push('app/api/twilio/recording/route.ts must call applyInboundMessageEnrichment')
}
if (!/kind === 'voicemail'/.test(recording) && !/row\.kind === 'voicemail'/.test(recording)) {
  fails.push('app/api/twilio/recording/route.ts must enrich voicemail only, not live-call recordings')
}

for (const [path, src] of [
  ['lib/crm/inbound-message-enrich.ts', enrich],
  ['lib/crm/inbound-message-extract.ts', extract],
  ['lib/data/crm/applyInboundMessageEnrichment.ts', apply],
]) {
  if (/sendSms\s*\(|sendCrmEmail\s*\(/.test(src)) {
    fails.push(`${path} must not send SMS or email`)
  }
}

if (!/createAnthropic/.test(extract) || !/CLASSIFIER_MODEL/.test(extract)) {
  fails.push('lib/crm/inbound-message-extract.ts must use Claude via lib/ai/anthropic')
}

if (!/ELIZE_INBOUND_SMS/.test(tests) || !/Elize Marais/.test(tests)) {
  fails.push('lib/crm/inbound-message-enrich.test.ts must include the Elize Marais fixture')
}
if (!/real-name no-overwrite/.test(tests) || !/Jane Doe/.test(tests)) {
  fails.push('lib/crm/inbound-message-enrich.test.ts must include a real-name no-overwrite case')
}
if (!/scam/.test(tests) || !/QUALITY_UNVERIFIED_TAG|quality:unverified/.test(tests)) {
  fails.push('lib/crm/inbound-message-enrich.test.ts must include a scam / unverified case')
}

if (!/hasUnverifiedTag/.test(enroll) || !/quality:unverified/.test(enroll)) {
  fails.push('lib/crm/enroll.ts must skip quality:unverified so a bulk-text flag does not enroll')
}

if (!/replayInboundMessageEnrichment/.test(replay) || !/requireCronAuth/.test(replay)) {
  fails.push('app/api/admin/crm/inbound-enrich/route.ts must replay under requireCronAuth')
}

if (!/isPlaceholderPersonName/.test(enrich) || !/isIndustryContact/.test(enrich)) {
  fails.push('lib/crm/inbound-message-enrich.ts must gate name writes on placeholder + industry:contact')
}

console.log('Inbound message enrich gate (ci:inbound-message-enrich)')
console.log('======================================================')
if (fails.length) {
  for (const f of fails) console.error('  ✗ ' + f)
  process.exit(1)
}
console.log('OK — SMS + voicemail enrich, no reply send, fixtures + enroll skip wired.')
process.exit(0)
