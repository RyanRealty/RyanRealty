#!/usr/bin/env node
/**
 * Reply to Brycen at AgentFire with the DKIM record needed to verify
 * mail.ryan-realty.com at Resend. Sends from matt@ryan-realty.com via
 * Google Workspace DWD impersonation.
 *
 * Usage:
 *   node --env-file=.env.local /tmp/reply-to-brycen.mjs
 */

import { google } from 'googleapis'

const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL?.trim()
const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()
if (!clientEmail || !privateKey) {
  console.error('Missing GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')
  process.exit(1)
}

const auth = new google.auth.JWT({
  email: clientEmail,
  key: privateKey.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/gmail.send'],
  subject: 'matt@ryan-realty.com',
})
const gmail = google.gmail({ version: 'v1', auth })

// Thread via threadId only — DWD scope is gmail.send so we can't read
// the original message's headers. Gmail threads outgoing messages by
// threadId regardless of In-Reply-To, so the reply still lands in
// the same conversation.
const THREAD_ID = '19e2834e859241ab'
const replySubject = 'Re: DNS records needed for Resend sender domain verification (mail.ryan-realty.com)'

const body = `Hi Brycen,

Thanks for the fast turnaround on the MX, SPF, and DMARC records — much appreciated.

Here's the missing DKIM record value:

  Type:  TXT
  Name:  resend._domainkey.mail
  Value: p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDel8keJ0IVB3kHpkM7QDgn0yLYMRbZBIAFTw5VDNwef9gkyrPgO0Kkx7kr2IB+K1evwVxkw8+6ewge8a/gABdGOhEYOAwMFE8iD3I0QovmxL55OnUnBlwlhYfo2wweZXDe6GcfPcp1D06E4IF+Bw7dbMfBf5Hu1LrvKDdGqUA23wIDAQAB
  TTL:   Auto
  Proxy: OFF (grey cloud)

One small correction on the previously-added records: I set up the Resend domain as "mail.ryan-realty.com" (subdomain) rather than the bare "ryan-realty.com", so the records should live as subdomains of "mail" exactly as you already configured them ("send.mail" for the MX and SPF, "resend._domainkey.mail" for this DKIM). If they're already set on send.mail and the DMARC at _dmarc, just adding this DKIM TXT should complete the verification.

Once the DKIM is in place, I'll click "Verify DNS Records" in Resend and we're done. No need to wait for me — you can reply once it's added and I'll handle verification on my end.

Thanks again,
Matt
Ryan Realty
541.213.6706
`

const headersOut = [
  'From: Matt Ryan <matt@ryan-realty.com>',
  'To: support@agentfire.com',
  `Subject: ${replySubject}`,
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=utf-8',
  'Content-Transfer-Encoding: 7bit',
]
const raw = Buffer.from(headersOut.join('\r\n') + '\r\n\r\n' + body).toString('base64url')

try {
  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw,
      threadId: THREAD_ID,
    },
  })
  console.log('Sent. Gmail id:', res.data.id, 'threadId:', res.data.threadId, 'labels:', res.data.labelIds?.join(','))
} catch (e) {
  console.error('SEND FAILED:', e?.message || e)
  process.exit(1)
}
