import { describe, expect, it } from 'vitest'
import {
  CMA_LABEL_REPLY_IN,
  CMA_LABEL_REPLY_OUT,
  CMA_LABEL_SENT,
  assembleCmaThreadRecords,
  cmaTimelineChipLabel,
  labelSyncedCmaMessage,
  mergeSyncedGmailPayload,
  payloadForSyncedGmailMessage,
  type CmaThreadRecord,
} from './cma-thread-label'

const SUBJECT = "A market analysis for 62017 Nate's"
const THREAD = '1a0e98fa75d5376d'

const record: CmaThreadRecord = {
  personId: 64138,
  slug: 'cma-62017-nate-s',
  threadId: THREAD,
  subject: SUBJECT,
  clientEmail: 'cybend61@gmail.com',
}

function label(over: Partial<Parameters<typeof labelSyncedCmaMessage>[0]> = {}) {
  return labelSyncedCmaMessage({
    personId: 64138,
    direction: 'out',
    threadId: THREAD,
    subject: SUBJECT,
    counterpartyEmails: ['cybend61@gmail.com'],
    threads: [record],
    ...over,
  })
}

describe('labelSyncedCmaMessage', () => {
  it('labels the original send, an inbound reply, and a later outbound on the thread', () => {
    expect(label()?.cmaLabel).toBe(CMA_LABEL_SENT)
    expect(label({ direction: 'in', subject: `Re: ${SUBJECT}` })?.cmaLabel).toBe(CMA_LABEL_REPLY_IN)
    expect(label({ direction: 'out', subject: `Re: ${SUBJECT}` })?.cmaLabel).toBe(CMA_LABEL_REPLY_OUT)
    expect(label()?.cmaSlug).toBe('cma-62017-nate-s')
  })

  it('does not label a different known thread even when the counterparty matches', () => {
    expect(label({ threadId: 'some-other-thread', subject: `Re: ${SUBJECT}` })).toBeNull()
  })

  it('uses the subject fallback only when the CMA has no thread id', () => {
    const noThread: CmaThreadRecord = { ...record, threadId: null }
    expect(
      label({
        threads: [noThread],
        threadId: 'brand-new-thread',
        direction: 'in',
        subject: `Fwd: ${SUBJECT}`,
      })?.cmaLabel,
    ).toBe(CMA_LABEL_REPLY_IN)
    expect(
      label({
        threads: [noThread],
        threadId: null,
        direction: 'out',
        subject: SUBJECT,
      })?.cmaLabel,
    ).toBe(CMA_LABEL_SENT)
    expect(
      label({
        threads: [noThread],
        threadId: null,
        subject: 'Checking in on a different house',
      }),
    ).toBeNull()
    expect(
      label({
        threads: [noThread],
        threadId: null,
        subject: `Re: ${SUBJECT}`,
        counterpartyEmails: ['someone-else@gmail.com'],
      }),
    ).toBeNull()
  })

  it('leaves an unrelated subject unlabeled when the thread does not match', () => {
    expect(label({ threadId: null, subject: 'Your showing on Saturday' })).toBeNull()
  })

  it('does not subject-match when the stored thread id is known and the message has none', () => {
    expect(label({ threadId: null, direction: 'in', subject: `Re: ${SUBJECT}` })).toBeNull()
  })
})

describe('mergeSyncedGmailPayload', () => {
  it('keeps CMA fields when a later Gmail payload omits them, and adds gmailId', () => {
    const existing = {
      artifact: 'cma',
      slug: 'cma-62017-nate-s',
      cmaSlug: 'cma-62017-nate-s',
      cmaLabel: CMA_LABEL_SENT,
      gmailMessageId: 'abc',
      transport: 'gmail',
      threadId: THREAD,
    }
    const merged = mergeSyncedGmailPayload(existing, {
      gmailId: 'abc',
      threadId: THREAD,
      mailbox: 'matt@ryan-realty.com',
      snippet: 'hi',
    })
    expect(merged).toMatchObject({
      artifact: 'cma',
      slug: 'cma-62017-nate-s',
      cmaSlug: 'cma-62017-nate-s',
      cmaLabel: CMA_LABEL_SENT,
      gmailMessageId: 'abc',
      transport: 'gmail',
      threadId: THREAD,
      gmailId: 'abc',
      snippet: 'hi',
    })
  })

  it('builds a labelled sync payload and still merges onto a prior send row', () => {
    const incoming = payloadForSyncedGmailMessage({
      gmailId: 'abc',
      threadId: THREAD,
      mailbox: 'matt@ryan-realty.com',
      snippet: 'the analysis',
      personId: 64138,
      direction: 'out',
      subject: SUBJECT,
      counterpartyEmails: ['cybend61@gmail.com'],
      threads: [record],
    })
    expect(incoming.cmaLabel).toBe(CMA_LABEL_SENT)
    expect(cmaTimelineChipLabel(incoming)).toBe(CMA_LABEL_SENT)
    const merged = mergeSyncedGmailPayload(
      { artifact: 'cma', slug: 'cma-62017-nate-s', gmailMessageId: 'abc', transport: 'gmail', resendId: null },
      { ...incoming, cmaSlug: undefined, cmaLabel: undefined, artifact: undefined },
    )
    expect(merged.artifact).toBe('cma')
    expect(merged.gmailMessageId).toBe('abc')
    expect(merged.transport).toBe('gmail')
    expect(merged.gmailId).toBe('abc')
  })
})

describe('assembleCmaThreadRecords', () => {
  it('fills one slug from the send event plus the cma row, and keeps others apart', () => {
    const rows = assembleCmaThreadRecords({
      emailEvents: [
        {
          person_id: 64138,
          recipient_email: 'CYBEND61@gmail.com',
          subject: SUBJECT,
          email_key: 'cma:cma-62017-nate-s',
          meta: { slug: 'cma-62017-nate-s', gmailThreadId: THREAD },
        },
      ],
      timeline: [
        {
          person_id: 64138,
          title: SUBJECT,
          payload: { artifact: 'cma', slug: 'cma-62017-nate-s', threadId: THREAD },
        },
      ],
      cmas: [
        { person_id: 64138, slug: 'cma-62017-nate-s', client_email: 'cybend61@gmail.com' },
        { person_id: 64138, slug: 'cma-other', client_email: 'cybend61@gmail.com' },
        { person_id: 9, slug: 'cma-62017-nate-s', client_email: 'other@example.com' },
      ],
    })
    const cheryl = rows.find((r) => r.personId === 64138 && r.slug === 'cma-62017-nate-s')
    expect(cheryl).toEqual({
      personId: 64138,
      slug: 'cma-62017-nate-s',
      threadId: THREAD,
      subject: SUBJECT,
      clientEmail: 'cybend61@gmail.com',
    })
    expect(rows.find((r) => r.slug === 'cma-other')?.personId).toBe(64138)
    expect(rows.find((r) => r.personId === 9)?.clientEmail).toBe('other@example.com')
    expect(rows).toHaveLength(3)
  })

  it('skips a bad person id and an empty slug', () => {
    expect(
      assembleCmaThreadRecords({
        emailEvents: [{ person_id: 0, email_key: 'cma:nope', meta: { slug: 'nope' } }],
        cmas: [{ person_id: 4, slug: '  ' }],
      }),
    ).toEqual([])
  })
})
