#!/usr/bin/env node
/**
 * Send a test email from paul@ryan-realty.com (a non-matt@ broker
 * address) to marketing@ryan-realty.com to confirm the domain-wildcard
 * allowlist works for the rest of the brokerage.
 *
 * Requires gmail.send DWD scope (already authorized).
 *
 * Usage: node --env-file=.env.local scripts/marketing-inbox-send-test-broker.mjs
 */

import { google } from 'googleapis'

const FROM = process.argv[2] || 'paul@ryan-realty.com'

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL.trim(),
  key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.trim().replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/gmail.send'],
  subject: FROM,
})

const gmail = google.gmail({ version: 'v1', auth })

const subject = 'TEST: just-listed flyer for MLS 220189999 (paul test)'
const body = `Pipeline broker-wildcard smoke test.

Make a just-listed flyer for MLS 220189999. Test from ${FROM} — confirming the @ryan-realty.com domain wildcard allowlist works in production.

Thanks,
Paul (test)`

const messageLines = [
  `From: ${FROM}`,
  'To: marketing@ryan-realty.com',
  `Subject: ${subject}`,
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=utf-8',
  'Content-Transfer-Encoding: 7bit',
  '',
  body,
]
const raw = Buffer.from(messageLines.join('\r\n')).toString('base64url')

try {
  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  })
  console.log('Sent from:', FROM)
  console.log('Gmail id: ', res.data.id)
  console.log('Thread id:', res.data.threadId)
} catch (e) {
  console.error('SEND FAILED:', e?.message || e)
  process.exit(1)
}
