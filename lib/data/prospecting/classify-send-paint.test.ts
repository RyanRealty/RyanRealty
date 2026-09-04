/**
 * List SEND paint fail-closed (Remarkable/Dodds + Pine Vista class).
 * Market hard-skip and missing CRM person must never classify as sendable —
 * same gate class as canOpenProspectSend / enroll hide (#180/#188).
 */
import { describe, expect, it } from 'vitest'
import { classifyProspect, prospectWorklistStateWord } from './classify'
import { blockAllChannels, type ProspectComplianceState, type ProspectDocState } from './types'

function compliance(over: Partial<ProspectComplianceState> = {}): ProspectComplianceState {
  return {
    hardStop: false,
    flags: [],
    relisted: false,
    offMarket: false,
    suppressedSms: false,
    noPhone: false,
    noEmail: false,
    reasons: [],
    channels: {
      sms: { blocked: true, reason: 'On the do-not-call registry' },
      email: { blocked: false, reason: null },
      call: { blocked: true, reason: 'On the do-not-call registry' },
    },
    allChannelsBlocked: false,
    ...over,
  }
}

const ready: ProspectDocState = { state: 'ready', slug: 'cma-x', docType: 'expired-audit', status: 'draft', recommendedList: 500000 }
const failed: ProspectDocState = { state: 'failed', reason: 'Property re-listed (Active/Pending)' }

describe('classifyProspect SEND paint', () => {
  it('excludes RELISTED + EMAIL OK even when build failed (Remarkable/Dodds)', () => {
    expect(classifyProspect(failed, compliance({ relisted: true, reasons: ['Relisted in MLS'] }), false, 27014)).toBe(
      'excluded',
    )
  })

  it('excludes RELISTED + EMAIL OK when audit is ready (never Send)', () => {
    expect(classifyProspect(ready, compliance({ relisted: true }), true, 1)).toBe('excluded')
  })

  it('does not paint Send when email open but no CRM person (Pine Vista)', () => {
    expect(classifyProspect(ready, compliance(), true, null)).toBe('no-phone')
  })

  it('no person linked → Link contact / not SEND even if channel looks email-open', () => {
    const bucket = classifyProspect(ready, compliance(), true, null)
    expect(bucket).not.toBe('sendable')
    expect(prospectWorklistStateWord(bucket, null, ready.state)).toBe('Link contact')
    expect(prospectWorklistStateWord(bucket, null, ready.state)).not.toBe('Send')
  })

  it('paints sendable when email open, market clear, and person linked', () => {
    expect(classifyProspect(ready, compliance(), true, 18198)).toBe('sendable')
  })

  it('keeps allChannelsBlocked as excluded ahead of doc state', () => {
    expect(
      classifyProspect(
        failed,
        compliance({
          allChannelsBlocked: true,
          channels: blockAllChannels('Compliance hard stop on the record'),
        }),
        false,
        1,
      ),
    ).toBe('excluded')
  })

  it('never returns sendable after farm-stub gate nulls personId', () => {
    expect(classifyProspect(ready, compliance(), true, null)).toBe('no-phone')
  })
})
