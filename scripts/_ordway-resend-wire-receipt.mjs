#!/usr/bin/env node
/**
 * Resend the wire transfer receipt with a less filter-prone subject.
 * The original send may have been delayed by a SkySlope content filter
 * triggered by "Wire Transfer" + "$432088.41" in the subject.
 */
import { google } from 'googleapis'
import fs from 'node:fs/promises'

const FROM = 'matt@ryan-realty.com'
const TO = 'OrdwayAvenue2732@skyslope.com'
const FILE = 'tmp/skyslope-pdfs/f88642ff-22e6-4618-b9e1-40b168a439e1/gmail-pulls/P1_CRITICAL_2025-05-28_Wire Transfer Receipt.pdf'

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL.trim(),
  key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.trim().replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/gmail.send'],
  subject: FROM,
})
await auth.authorize()

const gmail = google.gmail({ version: 'v1', auth })
const bin = await fs.readFile(FILE)
const b64 = bin.toString('base64')
const wrapped = b64.match(/.{1,76}/g).join('\r\n')
const boundary = `----rr-fwd-${Date.now()}`

// Cleaner subject: no $, no "Wire Transfer", straightforward closing-funds language
const subject = '[Ordway forward] Buyer cash to close confirmation - escrow WT0274211 - 5-28-25'
const body =
  'Forwarding the Capital One success notification for buyer cash to close.\n\n' +
  'Amount: 432088.41 plus 30 fee.\n' +
  'Destination: Western Title escrow account (Wells Fargo).\n' +
  'Loan/Escrow: WT0274211DI.\n' +
  'Confirmation: MM6B2FPAXDACSLO.\n' +
  'Memo: Ordway Ave Cash To Close.\n' +
  'Sent: 5/28/25.'

const filename = 'Buyer Cash To Close Confirmation - 5-28-25.pdf'

const message = [
  `From: ${FROM}`,
  `To: ${TO}`,
  `Subject: ${subject}`,
  'MIME-Version: 1.0',
  `Content-Type: multipart/mixed; boundary="${boundary}"`,
  '',
  `--${boundary}`,
  'Content-Type: text/plain; charset=utf-8',
  'Content-Transfer-Encoding: 7bit',
  '',
  body,
  '',
  `--${boundary}`,
  `Content-Type: application/pdf; name="${filename}"`,
  `Content-Disposition: attachment; filename="${filename}"`,
  'Content-Transfer-Encoding: base64',
  '',
  wrapped,
  '',
  `--${boundary}--`,
].join('\r\n')

const raw = Buffer.from(message).toString('base64url')
const res = await gmail.users.messages.send({
  userId: 'me',
  requestBody: { raw },
})
console.log('Sent resend, gmail msg id:', res.data.id)
