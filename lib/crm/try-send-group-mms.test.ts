import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Matt 2026-10-04: a group text in quiet hours waits until 8am. A group the
 * governed layer refuses for quiet hours (Pacific, or any number's own zone)
 * must come back failed, never as a fallback to one-to-one texts, which would
 * reach whoever's zone happened to be open.
 */

const h = vi.hoisted(() => ({
  getSendTarget: vi.fn(),
  sendGovernedGroupMms: vi.fn(),
  groupQuietHold: vi.fn(),
  proxy: '+15415550000' as string | null,
}))

vi.mock('@/lib/data/crm/getSendTarget', () => ({ getSendTarget: h.getSendTarget }))
vi.mock('@/lib/crm/merge', () => ({ renderCrmMerge: (body: string) => body }))
vi.mock('@/lib/identity/outbound-links', () => ({ decorateOutboundText: (body: string) => body }))
vi.mock('@/lib/crm/merge-context', () => ({ buildMergeContext: async () => ({}) }))
vi.mock('@/lib/crm/twilio', () => ({ brokerTwilioNumber: async () => h.proxy }))
vi.mock('@/lib/crm/attachments', () => ({ loadGroupMedia: async () => ({ ok: true, media: [] }) }))
vi.mock('@/lib/comms/sendGovernedGroupMms', () => ({
  sendGovernedGroupMms: h.sendGovernedGroupMms,
  groupQuietHold: h.groupQuietHold,
}))

import { trySendGroupMms } from './try-send-group-mms'
import { GROUP_THREAD_FALLBACK_NOTICE } from './compose-group'

const access = { email: 'matt@example.com', role: 'superuser' as const, brokerSlug: 'matt' }

function attempt(explicitGroupThread: boolean) {
  return trySendGroupMms({
    personId: 42,
    recipientIds: [42, 43],
    rawPhones: [],
    body: 'hello both',
    attachments: [],
    access,
    explicitGroupThread,
    requirePersonInScope: async () => ({ ok: true }),
    revalidate: () => {},
  })
}

beforeEach(() => {
  h.getSendTarget.mockReset().mockImplementation(async (id: number) => ({
    phone: id === 42 ? '+15415551111' : '+12125550100',
    person: { id, name: 'Jane', assigned_broker: 'matt' },
  }))
  h.sendGovernedGroupMms.mockReset()
  h.groupQuietHold.mockReset().mockReturnValue(null)
  h.proxy = '+15415550000'
})

describe('trySendGroupMms under quiet hours', () => {
  it('holds the whole group: failed, with the refusal, and no one-to-one fallback', async () => {
    h.sendGovernedGroupMms.mockResolvedValue({ ok: false, stage: 'quiet-hours', error: 'Quiet hours for this number' })
    expect(await attempt(true)).toEqual({ status: 'failed', error: 'Quiet hours for this number' })
    expect(await attempt(false)).toEqual({ status: 'failed', error: 'Quiet hours for this number' })
  })

  it('holds the group before the no-line fallback can split it (code review 2026-10-04)', async () => {
    h.proxy = null // a broker with no Twilio line: the group falls back to one-to-one texts
    h.groupQuietHold.mockReturnValue({ ok: false, stage: 'quiet-hours', error: 'Quiet hours for this number' })
    expect(await attempt(true)).toEqual({ status: 'failed', error: 'Quiet hours for this number' })
    expect(await attempt(false)).toEqual({ status: 'failed', error: 'Quiet hours for this number' })
    expect(h.sendGovernedGroupMms).not.toHaveBeenCalled()
    // Every number on the thread is asked, the 212 spouse included.
    expect(h.groupQuietHold).toHaveBeenCalledWith(
      [
        { personId: 42, phone: '+15415551111' },
        { personId: 43, phone: '+12125550100' },
      ],
      42,
      'crm:manual-group-sms',
    )
  })

  it('a broker override skips the hold', async () => {
    h.groupQuietHold.mockReturnValue({ ok: false, stage: 'quiet-hours', error: 'Quiet hours' })
    h.sendGovernedGroupMms.mockResolvedValue({ ok: true, conversationSid: 'C', messageSid: 'M', chatServiceSid: null, media: [] })
    const res = await trySendGroupMms({
      personId: 42,
      recipientIds: [42, 43],
      rawPhones: [],
      body: 'hello both',
      attachments: [],
      access,
      explicitGroupThread: true,
      overrideQuietHours: true,
      requirePersonInScope: async () => ({ ok: true }),
      revalidate: () => {},
    })
    expect(res).toEqual({ status: 'sent' })
    expect(h.groupQuietHold).not.toHaveBeenCalled()
  })

  it('still falls back to one-to-one when the carrier group itself fails', async () => {
    h.sendGovernedGroupMms.mockResolvedValue({ ok: false, stage: 'provider', error: 'conversations down' })
    expect(await attempt(true)).toEqual({ status: 'fallback', notice: GROUP_THREAD_FALLBACK_NOTICE })
    expect(await attempt(false)).toEqual({ status: 'continue' })
  })
})
