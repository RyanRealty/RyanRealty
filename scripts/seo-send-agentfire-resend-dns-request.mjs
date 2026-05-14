#!/usr/bin/env node
/**
 * Send a follow-up support request to AgentFire asking them to add the Resend
 * DNS records on Matt's behalf. Matt says AgentFire is his host and handles DNS
 * for him, so this is the correct channel.
 *
 * Usage: node --env-file=.env.local scripts/seo-send-agentfire-resend-dns-request.mjs
 */

import { google } from 'googleapis'

async function main() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL?.trim()
  const privateKeyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()
  const subject_email = process.env.GOOGLE_SERVICE_ACCOUNT_SUBJECT?.trim()

  if (!clientEmail || !privateKeyRaw || !subject_email) {
    console.error('Missing service account env vars')
    process.exit(1)
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKeyRaw.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
    subject: subject_email,
  })

  const gmail = google.gmail({ version: 'v1', auth })

  const to = 'support@agentfire.com'
  const subj = 'DNS records needed for Resend sender domain verification (mail.ryan-realty.com)'

  const body = `Hi AgentFire team,

Follow-up to today's earlier ticket about the JSON-LD parse error + footer "exclusive" Twig string. New, smaller request below.

We're using Resend (https://resend.com) as our transactional email provider. To send from "noreply@mail.ryan-realty.com" we need to verify the subdomain on Resend, which requires four DNS records added to ryan-realty.com. Since AgentFire manages our DNS (Cloudflare NS records: jeff.ns.cloudflare.com + eva.ns.cloudflare.com), please add the records below on our behalf.

Records to add (from the Resend domain setup page for mail.ryan-realty.com):

1. MX record
   Host:     send.mail (or whatever subdomain Resend recommended in your dashboard)
   Value:    feedback-smtp.us-east-1.amazonses.com
   Priority: 10
   Proxy:    OFF (grey cloud)

2. TXT record — SPF
   Host:     send.mail
   Value:    v=spf1 include:amazonses.com ~all
   Proxy:    OFF

3. TXT record — DKIM
   Host:     resend._domainkey.mail   (or the exact selector shown in Resend)
   Value:    [long DKIM public key — Matt will paste this from the Resend dashboard]
   Proxy:    OFF

4. TXT record — DMARC (optional, recommended)
   Host:     _dmarc
   Value:    v=DMARC1; p=none;
   Proxy:    OFF

The exact DKIM key value comes from our Resend dashboard. Matt will forward that to your ticket queue once you confirm receipt of this request. Or, if you have a faster way (e.g., a shared link to Resend or you handle this kind of request often), let us know the right intake.

For reference, the existing SPF on ryan-realty.com (apex) is:
  v=spf1 include:_spf.google.com ~all

That should stay — we're adding a SEPARATE SPF on the "mail" subdomain (or whichever subdomain Resend recommends). Apex SPF for Workspace doesn't conflict with subdomain SPF for Resend.

Why this matters: until the Resend domain is verified, our production email sends fail with a 403 "domain not verified" error. We have transactional emails going through Gmail API as a fallback, but Resend is the proper production path.

Thanks,
Matt Ryan
Ryan Realty
115 NW Oregon Avenue, Bend, OR 97703
541.213.6706
`

  const messageLines = [
    `From: ${subject_email}`,
    `To: ${to}`,
    `Subject: ${subj}`,
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
    console.log('Email sent. Gmail message id:', res.data.id)
  } catch (e) {
    console.error('SEND FAILED:', e?.message || e)
    process.exit(1)
  }
}

main().catch(e => {
  console.error('Fatal:', e?.message || e)
  process.exit(1)
})
