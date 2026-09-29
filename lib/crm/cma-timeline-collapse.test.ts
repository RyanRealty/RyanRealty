import { describe, expect, it } from 'vitest'
import { collapseCmaSendDuplicates } from './cma-timeline-collapse'

const SUBJECT = "A market analysis for 62017 Nate's"
const THREAD = '1a0e98fa75d5376d'
const GMAIL_TS = '2026-09-29T19:48:20.000Z'
const APP_TS = '2026-09-29T19:48:21.000Z'

const gmailBody = 'Matt here. Attached is the market analysis.'
const appBody = "CMA sent to cybend61@gmail.com for 62017 Nate's."

function cherylRows() {
  return [
    {
      id: 101,
      personId: 64138,
      kind: 'email_out',
      source: 'gmail',
      ts: GMAIL_TS,
      title: SUBJECT,
      body: gmailBody,
      payload: {
        gmailId: '18cma64138',
        threadId: THREAD,
        mailbox: 'matt@ryan-realty.com',
      },
    },
    {
      id: 102,
      personId: 64138,
      kind: 'email_out',
      source: 'app',
      ts: APP_TS,
      title: SUBJECT,
      body: appBody,
      payload: {
        artifact: 'cma',
        slug: 'cma-62017-nate-s',
        transport: 'gmail',
        mailbox: 'matt@ryan-realty.com',
        gmailMessageId: '18cma64138',
        resendId: null,
      },
    },
    {
      id: 103,
      personId: 64138,
      kind: 'email_in',
      source: 'gmail',
      ts: '2026-09-29T20:16:44.000Z',
      title: `Re: ${SUBJECT}`,
      body: 'Yes please keep me in the loop on the market.',
      payload: { gmailId: '18reply', threadId: THREAD },
    },
  ]
}

describe('collapseCmaSendDuplicates', () => {
  it('shows one row for person 64138, keeping the gmail timestamp and merging the CMA label', () => {
    const items = collapseCmaSendDuplicates(cherylRows())
    expect(items.map((row) => row.id)).toEqual([101, 103])
    const sent = items[0]!
    expect(sent.ts).toBe(GMAIL_TS)
    expect(sent.title).toBe(SUBJECT)
    expect(sent.body).toBe(gmailBody)
    expect(sent.payload).toMatchObject({
      gmailId: '18cma64138',
      cmaSlug: 'cma-62017-nate-s',
      cmaLabel: 'CMA sent',
      threadId: THREAD,
      artifact: 'cma',
    })
    expect(items[1]!.kind).toBe('email_in')
  })

  it('does not collapse a different person, a Resend send, or a non-email row', () => {
    const rows = [
      ...cherylRows(),
      {
        id: 201,
        personId: 9,
        kind: 'email_out',
        source: 'gmail',
        ts: GMAIL_TS,
        title: SUBJECT,
        body: 'other',
        payload: { gmailId: '18otherperson', threadId: 'other-thread' },
      },
      {
        id: 202,
        personId: 9,
        kind: 'email_out',
        source: 'app',
        ts: APP_TS,
        title: SUBJECT,
        body: 'CMA sent to other@example.com for 1 Main.',
        payload: { artifact: 'cma', slug: 'cma-other', gmailMessageId: '18cma64138', transport: 'gmail' },
      },
      {
        id: 301,
        personId: 64138,
        kind: 'email_out',
        source: 'app',
        ts: '2026-09-29T21:00:00.000Z',
        title: 'A market analysis for 1 Main',
        body: 'CMA sent via Resend.',
        payload: { artifact: 'cma', slug: 'cma-resend', transport: 'resend', gmailMessageId: null },
      },
      {
        id: 401,
        personId: 64138,
        kind: 'system',
        source: 'gmail',
        ts: '2026-09-29T20:24:26.000Z',
        title: 'Email reply classified: Not interested',
        body: null,
        payload: { intent: 'not_interested' },
      },
    ]
    const items = collapseCmaSendDuplicates(rows)
    expect(items.map((row) => row.id)).toEqual([101, 103, 201, 202, 301, 401])
  })

  it('collapses on subject within 120 seconds when both ids are absent, and not past that', () => {
    const gmail = {
      id: 1,
      personId: 64138,
      kind: 'email_out' as const,
      source: 'gmail',
      ts: GMAIL_TS,
      title: SUBJECT,
      body: gmailBody,
      payload: { threadId: THREAD },
    }
    const app = {
      id: 2,
      personId: 64138,
      kind: 'email_out' as const,
      source: 'app',
      ts: '2026-09-29T19:50:20.000Z',
      title: SUBJECT,
      body: appBody,
      payload: { artifact: 'cma', slug: 'cma-62017-nate-s' },
    }
    const collapsed = collapseCmaSendDuplicates([gmail, app])
    expect(collapsed).toHaveLength(1)
    expect(collapsed[0]!.id).toBe(1)
    expect((collapsed[0]!.payload as { cmaSlug?: string }).cmaSlug).toBe('cma-62017-nate-s')

    const late = { ...app, ts: '2026-09-29T19:50:20.001Z' }
    expect(collapseCmaSendDuplicates([gmail, late])).toHaveLength(2)

    const otherCase = { ...app, title: SUBJECT.toUpperCase() }
    expect(collapseCmaSendDuplicates([gmail, otherCase])).toHaveLength(2)
  })
})
