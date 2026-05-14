#!/usr/bin/env node
/**
 * Send a test email from matt@ryan-realty.com to marketing@ryan-realty.com
 * to exercise the inbox pipeline end-to-end.
 *
 * Usage:
 *   node --env-file=.env.local scripts/marketing-inbox-send-test-email.mjs
 */

import { google } from 'googleapis'

const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL?.trim()
const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()

const auth = new google.auth.JWT({
  email: clientEmail,
  key: privateKey.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/gmail.send'],
  subject: 'matt@ryan-realty.com',
})

const gmail = google.gmail({ version: 'v1', auth })

const subject = 'TEST: listing reel for MLS 220189422'
const body = `Inbox pipeline smoke test.

Make a listing reel for MLS 220189422.

This is a brand-new listing — coming on market this week. Standard treatment.

— Matt`

const messageLines = [
  'From: Matt Ryan <matt@ryan-realty.com>',
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
  console.log('Sent. Gmail id:', res.data.id, 'threadId:', res.data.threadId)
} catch (e) {
  console.error('SEND FAILED:', e?.message || e)
  process.exit(1)
}
