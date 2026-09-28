import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  bounceDisposition,
  bounceSideEffects,
  bounceTextFromMime,
  matchSentToBounce,
  normalizeRfcMessageId,
  parseBounceNotice,
} from './gmail-bounce-notice'

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

describe('bounce disposition', () => {
  it('treats a 5.1.1 hard failure as bounced', () => {
    const n = parseBounceNotice({
      from: 'mailer-daemon@googlemail.com',
      subject: 'Delivery Status Notification (Failure)',
      text: GMAIL_DSN,
    })
    expect(n.smtpCode).toBe('550')
    expect(bounceDisposition(n)).toBe('bounced')
    expect(bounceSideEffects('bounced')).toEqual({
      emailEvent: 'bounce',
      cmaStatus: 'bounced',
      timeline: true,
      suppress: true,
    })
  })

  it('treats a bare 550 SMTP code as a hard bounce', () => {
    const n = parseBounceNotice({
      from: 'mailer-daemon@googlemail.com',
      subject: 'Delivery Status Notification (Failure)',
      text: 'Final-Recipient: rfc822; gone@example.com\nAction: failed\nDiagnostic-Code: smtp; 550 No such user\n',
    })
    expect(n.status).toBeNull()
    expect(n.smtpCode).toBe('550')
    expect(n.hard).toBe(true)
    expect(bounceDisposition(n)).toBe('bounced')
  })

  it('does not bounce Action: failed when the status is 4.x.x', () => {
    const n = parseBounceNotice({
      from: 'mailer-daemon@googlemail.com',
      subject: 'Delivery Status Notification (Delay)',
      text: 'Final-Recipient: rfc822; mailbox@example.com\nAction: failed\nStatus: 4.2.2\nDiagnostic-Code: smtp; 450 mailbox temporarily unavailable\n',
    })
    expect(n.hard).toBe(false)
    expect(bounceDisposition(n)).toBe('deferred')
  })

  it('does not bounce a 4.x.x delay, even when the prose sounds permanent', () => {
    const n = parseBounceNotice({
      from: 'mailer-daemon@googlemail.com',
      subject: 'Delivery Status Notification (Delay)',
      text: `${SOFT_GMAIL}\nThe mailbox unavailable note is about a later retry.\n`,
    })
    expect(n.status).toBe('4.2.2')
    expect(n.hard).toBe(false)
    expect(bounceDisposition(n)).toBe('deferred')
    expect(bounceSideEffects('deferred')).toEqual({
      emailEvent: null,
      cmaStatus: null,
      timeline: false,
      suppress: false,
    })
  })

  it('ignores mail that is not a DSN', () => {
    const n = parseBounceNotice({
      from: 'pat@example.com',
      subject: 'Re: the report',
      text: 'Thanks, we will take a look. 550 is just a number I typed.',
    })
    expect(bounceDisposition(n)).toBe('ignore')
    expect(bounceSideEffects('ignore').emailEvent).toBeNull()
  })
})

describe('bounceTextFromMime', () => {
  it('reads Status from message/delivery-status when the plain part has none', () => {
    const status = Buffer.from(
      'Final-Recipient: rfc822; gone@example.com\nAction: failed\nStatus: 5.1.1\nDiagnostic-Code: smtp; 550 5.1.1 user unknown\n',
    ).toString('base64url')
    const plain = Buffer.from('The delivery report is attached.').toString('base64url')
    const text = bounceTextFromMime({
      mimeType: 'multipart/report',
      parts: [
        { mimeType: 'text/plain', body: { data: plain } },
        { mimeType: 'message/delivery-status', body: { data: status } },
        {
          mimeType: 'message/rfc822',
          parts: [{ mimeType: 'text/plain', body: { data: Buffer.from('Status: 2.0.0\n').toString('base64url') } }],
        },
      ],
    })
    const n = parseBounceNotice({
      from: 'mailer-daemon@googlemail.com',
      subject: 'Delivery Status Notification (Failure)',
      text,
    })
    expect(n.failedRecipients).toEqual(['gone@example.com'])
    expect(n.status).toBe('5.1.1')
    expect(bounceDisposition(n)).toBe('bounced')
    expect(text).not.toMatch(/Status: 2\.0\.0/)
  })

  it('falls back to the plain text when there is no delivery-status part', () => {
    const plain = Buffer.from(
      'Your message to gone@example.com could not be delivered.\n550 5.1.1 user unknown\n',
    ).toString('base64url')
    const text = bounceTextFromMime({ mimeType: 'text/plain', body: { data: plain } })
    const n = parseBounceNotice({
      from: 'mailer-daemon@googlemail.com',
      subject: 'Delivery Status Notification (Failure)',
      text,
    })
    expect(n.failedRecipients).toEqual(['gone@example.com'])
    expect(n.smtpCode).toBe('550')
    expect(bounceDisposition(n)).toBe('bounced')
  })
})

describe('the bounce watch only stamps a hard bounce', () => {
  const src = readFileSync(join(process.cwd(), 'lib/crm/gmail-bounce-watch.ts'), 'utf8')

  it('gates the event, the timeline, and the CMA stamp on bounceSideEffects', () => {
    expect(src).toMatch(/bounceSideEffects\(bounceDisposition/)
    expect(src).toMatch(/stampCmaHardBounce/)
    expect(src).toMatch(/bounceTextFromMime/)
    expect(src).not.toMatch(/delivered_at/)
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

  it('matches References when In-Reply-To is the notice itself', () => {
    const notice = parseBounceNotice({
      from: 'mailer-daemon@googlemail.com',
      subject: 'Delivery Status Notification (Failure)',
      inReplyTo: '<dsn-1@googlemail.com>',
      references: '<dsn-1@googlemail.com> <cma.1@ryan-realty.com>',
      text: 'Final-Recipient: rfc822; gone@example.com\nAction: failed\nStatus: 5.1.1\n',
    })
    expect(matchSentToBounce(sents, { threadId: null, notice })?.recipient_email).toBe('gone@example.com')
  })

  it('uses the first sent row for a recipient, which is the newest', () => {
    const notice = parseBounceNotice({
      from: 'mailer-daemon@googlemail.com',
      subject: 'Delivery Status Notification (Failure)',
      text: 'Final-Recipient: rfc822; gone@example.com\nAction: failed\nStatus: 5.1.1\n',
    })
    const ordered = [
      { recipient_email: 'gone@example.com', meta: { rfcMessageId: '<newer@ryan-realty.com>' } },
      { recipient_email: 'gone@example.com', meta: { rfcMessageId: '<older@ryan-realty.com>' } },
    ]
    expect(matchSentToBounce(ordered, { notice })?.meta.rfcMessageId).toBe('<newer@ryan-realty.com>')
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
