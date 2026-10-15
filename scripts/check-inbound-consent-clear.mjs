#!/usr/bin/env node
/**
 * check-inbound-consent-clear.mjs (ci:inbound-consent-clear)
 *
 * Matt 2026-10-14: a tracked-email recipient who calls, leaves a voicemail,
 * texts, or emails back has DNC / no-SMS flags lifted, with a timeline note.
 * STOP never clears. Broker flags and email unsubscribe stay. The unit tests
 * hold the six cases; this gate holds the wiring so a deleted hookup fails CI.
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

const plan = read('lib/crm/inbound-consent-clear.ts')
const apply = read('lib/data/crm/applyInboundConsentClear.ts')
const tests = read('lib/crm/inbound-consent-clear.test.ts')
const applyTests = read('lib/data/crm/applyInboundConsentClear.test.ts')
const sms = read('app/api/twilio/inbound-sms/route.ts')
const voice = read('app/api/twilio/voice/route.ts')
const voicemail = read('app/api/twilio/voice-complete/route.ts')
const group = read('app/api/twilio/conversations-events/route.ts')
const gmail = read('lib/crm/gmail.ts')
const agents = read('AGENTS.md')

if (!/planInboundConsentClear/.test(plan) || !/isSmsStopKeyword/.test(plan)) {
  fails.push('lib/crm/inbound-consent-clear.ts must export planInboundConsentClear and isSmsStopKeyword')
}
if (!/applyInboundConsentClear/.test(apply)) {
  fails.push('lib/data/crm/applyInboundConsentClear.ts must export applyInboundConsentClear')
}

for (const [path, src] of [
  ['app/api/twilio/inbound-sms/route.ts', sms],
  ['app/api/twilio/voice/route.ts', voice],
  ['app/api/twilio/voice-complete/route.ts', voicemail],
  ['app/api/twilio/conversations-events/route.ts', group],
  ['lib/crm/gmail.ts', gmail],
]) {
  if (!/applyInboundConsentClear/.test(src)) {
    fails.push(`${path} must call applyInboundConsentClear`)
  }
}

if (!/isSmsStopKeyword\(body\)/.test(sms) || !/isSmsStopKeyword\(body\)/.test(group)) {
  fails.push('inbound SMS handlers must skip the consent clear on a STOP keyword')
}

for (const [path, src] of [
  ['lib/crm/inbound-consent-clear.ts', plan],
  ['lib/data/crm/applyInboundConsentClear.ts', apply],
]) {
  if (/sendSms\s*\(|sendCrmEmail\s*\(/.test(src)) {
    fails.push(`${path} must not send SMS or email`)
  }
}

for (const needle of [
  "event: 'call'",
  "event: 'voicemail'",
  "event: 'sms'",
  "event: 'email'",
  'skip-stop',
  'skip-no-send',
  'STOP',
]) {
  if (!tests.includes(needle)) {
    fails.push(`lib/crm/inbound-consent-clear.test.ts must cover ${needle}`)
  }
}

if (!/stop-keyword/.test(applyTests) || !/no-tracked-send/.test(applyTests)) {
  fails.push('lib/data/crm/applyInboundConsentClear.test.ts must cover STOP and no-tracked-send')
}

if (!/Inbound reply clears DNC/.test(agents) && !/34\./.test(agents)) {
  fails.push('AGENTS.md must include rule 34 (inbound reply clears DNC / no-SMS)')
}
if (!/applyInboundConsentClear/.test(agents)) {
  fails.push('AGENTS.md rule 34 must name applyInboundConsentClear')
}

console.log('Inbound consent clear gate (ci:inbound-consent-clear)')
console.log('====================================================')
if (fails.length) {
  for (const f of fails) console.error('  ✗ ' + f)
  process.exit(1)
}
console.log('OK — call/voicemail/SMS/email reply clear, STOP never clears, tests + AGENTS.md wired.')
process.exit(0)
