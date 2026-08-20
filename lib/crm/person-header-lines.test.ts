import { describe, expect, it } from 'vitest'
import {
  composeListNextStep,
  composePersonNextStep,
  composePersonNowLine,
  unrepliedInboundFromMessages,
} from '@/lib/crm/person-header-lines'

describe('person glance lines', () => {
  it('says reply when the latest message is inbound', () => {
    expect(
      composePersonNextStep({
        unrepliedInbound: { channel: 'sms' },
        replyIntent: null,
        triageTask: null,
        sequenceWaiting: null,
      }),
    ).toBe('Reply to their text.')
  })

  it('names the waiting sequence when nothing is unreplied', () => {
    expect(
      composePersonNextStep({
        unrepliedInbound: null,
        replyIntent: null,
        triageTask: null,
        sequenceWaiting: { sequenceName: 'New lead', channel: 'sms' },
      }),
    ).toBe('Send the next New lead text.')
  })

  it('derives a list next line from last inbound activity', () => {
    expect(composeListNextStep({ lastActivityKind: 'sms_in', sequenceWaiting: null })).toBe('Reply to their text.')
    expect(
      composeListNextStep({
        lastActivityKind: 'page_view',
        sequenceWaiting: { sequenceName: 'New lead', channel: 'email' },
      }),
    ).toBe('Send the next New lead email.')
  })

  it('says they are not on the site when there is no recent view', () => {
    expect(composePersonNowLine({ latestListingView: null, nowMs: Date.parse('2026-08-19T22:00:00Z') })).toBe(
      'Not on the site.',
    )
  })

  it('treats newer inbound than outbound as unreplied', () => {
    const unreplied = unrepliedInboundFromMessages([
      { kind: 'sms_in', ts: '2026-08-19T18:00:00Z' },
      { kind: 'sms_out', ts: '2026-08-19T12:00:00Z' },
    ])
    expect(unreplied?.channel).toBe('sms')
  })
})
