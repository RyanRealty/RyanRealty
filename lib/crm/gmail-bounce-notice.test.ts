import { describe, expect, it } from 'vitest'
import { matchSentToBounce, normalizeRfcMessageId, parseBounceNotice } from './gmail-bounce-notice'

const GMAIL_DSN = `This is the mail system at host gmr-mx.google.com.

I'm sorry to have to inform you that your message could not
be delivered to one or more recipients.

Final-Recipient: rfc822; gone@example.com
Action: failed
Status: 5.1.1
Remote-MTA: dns; example.com
Diagnostic-Code: smtp; 550-5.1.1 The email account that you tried to reach does not exist.

--
`

const OUTLOOK_DSN = `Delivery has failed to these recipients or groups:

Your message to missing@hotmail.com couldn't be delivered.
X-Failed-Recipients: missing@hotmail.com

Remote Server returned '550 5.1.1 RESOLVER.ADR.RecipNotFound; not found'
`

const SOFT_GMAIL = `Final-Recipient: rfc822; mailbox@example.com
Action: delayed
Status: 4.2.2
Diagnostic-Code: smtp; 452-4.2.2 The recipient's inbox is out of storage space.
`

describe('parseBounceNotice — Gmail DSN', () => {
  it('reads the failed recipient, 5.x.x status, and marks a hard bounce', () => {
    const n = parseBounceNotice({
      from: 'Mail Delivery Subsystem <mailer-daemon@googlemail.com>',
      subject: 'Delivery Status Notification (Failure)',
      inReplyTo: '<abc123@ryan-realty.com>',
      references: '<abc123@ryan-realty.com>',
      text: GMAIL_DSN,
    })
    expect(n.isBounce).toBe(true)
    expect(n.failedRecipients).toEqual(['gone@example.com'])
    expect(n.status).toBe('5.1.1')
    expect(n.hard).toBe(true)
    expect(n.inReplyTo).toBe('abc123@ryan-realty.com')
    expect(n.references).toEqual(['abc123@ryan-realty.com'])
    expect(n.diagnostic).toMatch(/does not exist/i)
  })
})

describe('parseBounceNotice — Outlook undeliverable', () => {
  it('reads X-Failed-Recipients and the 5.1.1 RecipNotFound line', () => {
    const n = parseBounceNotice({
      from: 'Microsoft Outlook <postmaster@outlook.com>',
      subject: 'Undeliverable: A market analysis for 2465 7th',
      inReplyTo: '<cma.1@ryan-realty.com>',
      text: OUTLOOK_DSN,
    })
    expect(n.isBounce).toBe(true)
    expect(n.failedRecipients).toEqual(['missing@hotmail.com'])
    expect(n.status).toBe('5.1.1')
    expect(n.hard).toBe(true)
    expect(n.diagnostic).toMatch(/RecipNotFound/i)
  })
})

describe('parseBounceNotice — soft bounce', () => {
  it('does not mark a 4.x.x delay as hard', () => {
    const n = parseBounceNotice({
      from: 'mailer-daemon@googlemail.com',
      subject: 'Delivery Status Notification (Delay)',
      text: SOFT_GMAIL,
    })
    expect(n.isBounce).toBe(true)
    expect(n.failedRecipients).toEqual(['mailbox@example.com'])
    expect(n.status).toBe('4.2.2')
    expect(n.hard).toBe(false)
  })
})

describe('parseBounceNotice — not a bounce', () => {
  it('returns isBounce false for a human reply', () => {
    const n = parseBounceNotice({
      from: 'pat@example.com',
      subject: 'Re: A market analysis for 2465 7th',
      inReplyTo: '<cma.1@ryan-realty.com>',
      text: 'Thanks, we will take a look.',
    })
    expect(n.isBounce).toBe(false)
    expect(n.failedRecipients).toEqual([])
  })
})

describe('normalizeRfcMessageId', () => {
  it('strips angle brackets and lowercases', () => {
    expect(normalizeRfcMessageId('<AbC@Ryan-Realty.com>')).toBe('abc@ryan-realty.com')
    expect(normalizeRfcMessageId('  xyz@host  ')).toBe('xyz@host')
    expect(normalizeRfcMessageId(null)).toBeNull()
  })
})

describe('matchSentToBounce', () => {
  const notice = parseBounceNotice({
    from: 'mailer-daemon@googlemail.com',
    subject: 'Delivery Status Notification (Failure)',
    inReplyTo: '<cma.1@ryan-realty.com>',
    references: '<cma.1@ryan-realty.com>',
    text: 'Final-Recipient: rfc822; gone@example.com\nAction: failed\nStatus: 5.1.1\n',
  })
  const sents = [
    {
      recipient_email: 'other@example.com',
      meta: { gmailThreadId: 'thr-other', rfcMessageId: '<other@ryan-realty.com>' },
    },
    {
      recipient_email: 'gone@example.com',
      meta: { gmailThreadId: 'thr-1', rfcMessageId: '<cma.1@ryan-realty.com>' },
    },
  ]

  it('matches on Gmail thread id first', () => {
    expect(matchSentToBounce(sents, { threadId: 'thr-1', notice })?.recipient_email).toBe(
      'gone@example.com',
    )
  })

  it('matches on In-Reply-To against the stored RFC Message-ID', () => {
    expect(matchSentToBounce(sents, { threadId: null, notice })?.recipient_email).toBe(
      'gone@example.com',
    )
  })

  it('falls back to the failed-recipient address', () => {
    const noIds = parseBounceNotice({
      from: 'mailer-daemon@googlemail.com',
      subject: 'Delivery Status Notification (Failure)',
      text: 'Final-Recipient: rfc822; gone@example.com\nAction: failed\nStatus: 5.1.1\n',
    })
    const byAddr = [
      { recipient_email: 'gone@example.com', meta: {} },
    ]
    expect(matchSentToBounce(byAddr, { notice: noIds })?.recipient_email).toBe('gone@example.com')
  })
})
