import { describe, expect, it } from 'vitest'
import {
  composeListNextStep,
  composePersonNextStep,
  composePersonNowLine,
  replyIntentForUnreplied,
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

  it('names a market-update ask and a future seller', () => {
    const base = { unrepliedInbound: { channel: 'email' as const }, triageTask: null, sequenceWaiting: null }
    expect(composePersonNextStep({ ...base, replyIntent: 'market_updates' })).toBe(
      'Send market updates. They asked to stay in the loop.',
    )
    expect(composePersonNextStep({ ...base, replyIntent: 'future_seller' })).toBe(
      'Future seller. Renting for now, stay in touch.',
    )
  })

  it('uses a note written after the unreplied email, and ignores an older decline', () => {
    const inboundTs = Date.parse('2026-09-29T20:16:44.000Z')
    expect(
      replyIntentForUnreplied({ ts: inboundTs, replyIntent: null }, [
        { ts: '2026-09-29T20:24:26.000Z', payload: { intent: 'market_updates' } },
        { ts: '2026-09-29T18:00:00.000Z', payload: { intent: 'not_interested' } },
      ]),
    ).toBe('market_updates')
    expect(
      replyIntentForUnreplied({ ts: inboundTs, replyIntent: null }, [
        { ts: '2026-09-29T18:00:00.000Z', payload: { intent: 'not_interested' } },
      ]),
    ).toBeNull()
    expect(
      replyIntentForUnreplied({ ts: inboundTs, replyIntent: 'later' }, [
        { ts: '2026-09-29T21:00:00.000Z', payload: { intent: 'not_interested' } },
      ]),
    ).toBe('later')
  })

  it('treats newer inbound than outbound as unreplied', () => {
    const unreplied = unrepliedInboundFromMessages([
      { kind: 'sms_in', ts: '2026-08-19T18:00:00Z' },
      { kind: 'sms_out', ts: '2026-08-19T12:00:00Z' },
    ])
    expect(unreplied?.channel).toBe('sms')
  })
})
