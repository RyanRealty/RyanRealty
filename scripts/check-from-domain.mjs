#!/usr/bin/env node
/**
 * check-from-domain.mjs (ci:from-domain)
 *
 * CRM and tracked Resend sends default From to the verified root domain
 * ryan-realty.com (verified 2026-10-14). Display name and Reply-To stay with
 * the broker. The one config is SEND_DOMAIN in lib/email/broker-identity.ts.
 *
 * Usage: node scripts/check-from-domain.mjs
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

const identity = read('lib/email/broker-identity.ts')
const identityTest = read('lib/email/broker-identity.test.ts')
const oneOff = read('lib/comms/sendOneOffEmail.ts')
const requestEmails = read('lib/cma/request-emails.ts')

if (!/export const SEND_DOMAIN = 'ryan-realty\.com'/.test(identity)) {
  fails.push("lib/email/broker-identity.ts must export SEND_DOMAIN = 'ryan-realty.com'")
}
if (/export const SEND_DOMAIN = 'mail\.ryan-realty\.com'/.test(identity) || /const SEND_DOMAIN = 'mail\.ryan-realty\.com'/.test(identity)) {
  fails.push('SEND_DOMAIN must not be mail.ryan-realty.com')
}
if (!identity.includes('local}@${SEND_DOMAIN}')) {
  fails.push('brokerSendIdentity / companyMailboxIdentity must build From on SEND_DOMAIN')
}

if (!/matt@ryan-realty\.com/.test(identityTest) || /matt@mail\.ryan-realty\.com/.test(identityTest)) {
  fails.push('lib/email/broker-identity.test.ts must expect matt@ryan-realty.com, not the mail. subdomain')
}

if (/A Workspace mailbox[\s\S]{0,80}is Reply-To, not From/.test(oneOff)) {
  fails.push('lib/comms/sendOneOffEmail.ts must not rewrite a root-domain From onto mail.ryan-realty.com')
}
if (/replace\(['"]@ryan-realty\.com['"],\s*['"]@mail\.ryan-realty\.com['"]\)/.test(requestEmails)) {
  fails.push('lib/cma/request-emails.ts must not rewrite From onto @mail.ryan-realty.com')
}
if (!/brokerSendIdentity/.test(requestEmails)) {
  fails.push('lib/cma/request-emails.ts Resend fallback must use brokerSendIdentity')
}

console.log('From domain gate (ci:from-domain)')
console.log('================================')
if (fails.length) {
  for (const f of fails) console.error('  ✗ ' + f)
  process.exit(1)
}
console.log('ok: default From domain is ryan-realty.com (SEND_DOMAIN)')
