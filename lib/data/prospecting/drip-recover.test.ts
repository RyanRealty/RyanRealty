/**
 * D. Stuck-send recovery: a claim whose function died mid-send is finalized
 * when its email left, released when it provably did not, and left exactly as
 * it is (one console.error + a broker alert) when that cannot be proven.
 *
 * Fixture: the 2026-09-29 incident row, claimed 22:55:27Z, never sent.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  listStaleFirstTouchSends: vi.fn(),
  listEmailEventsSince: vi.fn(),
  finalizeRecoveredFirstTouchSend: vi.fn(),
  releaseStuckFirstTouchSend: vi.fn(),
  getProspect: vi.fn(),
  getLatestClientReadyCmaRowForBaseSlug: vi.fn(),
  getCmaBrokerBySlugOrEmail: vi.fn(),
  getCrmMailboxes: vi.fn(),
  findSentMessageTo: vi.fn(),
  queueBrokerHealthAlert: vi.fn(),
}))

vi.mock('./stuck-send', () => ({
  listStaleFirstTouchSends: h.listStaleFirstTouchSends,
  listEmailEventsSince: h.listEmailEventsSince,
  finalizeRecoveredFirstTouchSend: h.finalizeRecoveredFirstTouchSend,
  releaseStuckFirstTouchSend: h.releaseStuckFirstTouchSend,
}))
vi.mock('./get', () => ({ getProspect: h.getProspect }))
vi.mock('@/lib/cma/versions', () => ({
  getLatestClientReadyCmaRowForBaseSlug: h.getLatestClientReadyCmaRowForBaseSlug,
}))
vi.mock('@/lib/data/cma/builderReads', () => ({ getCmaBrokerBySlugOrEmail: h.getCmaBrokerBySlugOrEmail }))
vi.mock('@/lib/data/brokers/directory', () => ({ getCrmMailboxes: h.getCrmMailboxes }))
vi.mock('@/lib/crm/gmail-sent-lookup', () => ({
  findSentMessageTo: h.findSentMessageTo,
  SENT_LOOKUP_SKEW_MS: 60_000,
}))
vi.mock('@/lib/crm/broker-alerts', () => ({
  BROKER_ALERT_ORIGIN: 'https://ryan-realty.com',
  queueBrokerHealthAlert: h.queueBrokerHealthAlert,
}))

import {
  decideStuckSend,
  MAX_STUCK_SENDS_PER_RUN,
  pickStuckSendsForRun,
  recoverStuckFirstTouchSends,
} from './drip-recover'
import { isCmaEmailKeyForBase, prospectDocBaseSlug } from './doc-slug'

const NOW = new Date('2026-09-30T15:00:00.000Z')
const OWNER = 'owner@example.com'
const STUCK = {
  kind: 'expired' as const,
  id: '20260819192123649950000000',
  claimAt: '2026-09-29T22:55:27.279426+00:00',
  queuedAt: '2026-09-29T22:53:48.909+00:00',
  contactEmail: OWNER,
  streetAddress: '3153 Cromwell',
}
const PROSPECT = {
  kind: 'expired',
  id: STUCK.id,
  streetAddress: '3153 Cromwell',
  contactEmail: OWNER,
  doc: { state: 'ready', slug: 'cma-3153-cromwell', docType: 'cma', status: 'finalized', recommendedList: null },
}

function event(over: Record<string, unknown>) {
  return {
    id: 1,
    event: 'sent',
    emailKey: 'cma:cma-3153-cromwell',
    messageId: 'gmail-msg-1',
    recipientEmail: OWNER,
    personId: 77,
    occurredAt: '2026-09-29T22:56:40.000Z',
    ...over,
  }
}

let consoleError: ReturnType<typeof vi.spyOn>
let consoleWarn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  for (const fn of Object.values(h)) fn.mockReset()
  h.listStaleFirstTouchSends.mockResolvedValue([STUCK])
  h.getProspect.mockResolvedValue(PROSPECT)
  h.getLatestClientReadyCmaRowForBaseSlug.mockResolvedValue({
    slug: 'cma-3153-cromwell',
    row: { client_email: OWNER, broker_slug: 'matthew-ryan' },
  })
  h.getCmaBrokerBySlugOrEmail.mockResolvedValue({ email: 'matt@ryan-realty.com' })
  h.getCrmMailboxes.mockResolvedValue([
    { email: 'matt@ryan-realty.com', slug: 'matt' },
    { email: 'paul@ryan-realty.com', slug: 'paul' },
  ])
  h.listEmailEventsSince.mockResolvedValue([])
  h.findSentMessageTo.mockResolvedValue({ status: 'absent', searched: 2 })
  h.finalizeRecoveredFirstTouchSend.mockResolvedValue(true)
  h.releaseStuckFirstTouchSend.mockResolvedValue(true)
  h.queueBrokerHealthAlert.mockResolvedValue(true)
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  consoleError.mockRestore()
  consoleWarn.mockRestore()
})

describe('recoverStuckFirstTouchSends — found in email_events', () => {
  it("finalizes with the rail's own message id and send time, and never asks Gmail", async () => {
    h.listEmailEventsSince.mockResolvedValue([event({})])
    const out = await recoverStuckFirstTouchSends(NOW)
    expect(out).toEqual([
      {
        kind: 'expired',
        id: STUCK.id,
        claimAt: STUCK.claimAt,
        outcome: 'finalized',
        via: 'email-events',
        messageId: 'gmail-msg-1',
        sentAt: '2026-09-29T22:56:40.000Z',
      },
    ])
    expect(h.finalizeRecoveredFirstTouchSend).toHaveBeenCalledWith({
      kind: 'expired',
      id: STUCK.id,
      claimAt: STUCK.claimAt,
      messageId: 'gmail-msg-1',
      sentAt: '2026-09-29T22:56:40.000Z',
      personId: 77,
    })
    expect(h.findSentMessageTo).not.toHaveBeenCalled()
    expect(h.releaseStuckFirstTouchSend).not.toHaveBeenCalled()
    expect(h.queueBrokerHealthAlert).not.toHaveBeenCalled()
  })

  it('reads events from a minute before the claim, by owner address and CMA base', async () => {
    await recoverStuckFirstTouchSends(NOW)
    expect(h.listStaleFirstTouchSends).toHaveBeenCalledWith(NOW)
    expect(h.listEmailEventsSince).toHaveBeenCalledWith({
      recipients: [OWNER],
      cmaBaseSlug: 'cma-3153-cromwell',
      sinceIso: '2026-09-29T22:54:27.279Z',
    })
  })

  it('counts a later version of the same CMA (--v2) as the same send', async () => {
    h.listEmailEventsSince.mockResolvedValue([event({ emailKey: 'cma:cma-3153-cromwell--v2', messageId: 'm-v2' })])
    const out = await recoverStuckFirstTouchSends(NOW)
    expect(out[0]).toMatchObject({ outcome: 'finalized', via: 'email-events', messageId: 'm-v2' })
  })
})

describe('recoverStuckFirstTouchSends — found in Gmail Sent', () => {
  it('finalizes with the Sent message id and the time Gmail sent it', async () => {
    h.findSentMessageTo.mockResolvedValue({
      status: 'found',
      hit: {
        mailbox: 'matt@ryan-realty.com',
        recipient: OWNER,
        messageId: '19a2b3c4d5e6f7',
        threadId: 't1',
        sentAt: '2026-09-29T22:57:05.000Z',
      },
    })
    const out = await recoverStuckFirstTouchSends(NOW)
    expect(out).toEqual([
      {
        kind: 'expired',
        id: STUCK.id,
        claimAt: STUCK.claimAt,
        outcome: 'finalized',
        via: 'gmail-sent',
        messageId: '19a2b3c4d5e6f7',
        sentAt: '2026-09-29T22:57:05.000Z',
      },
    ])
    expect(h.finalizeRecoveredFirstTouchSend).toHaveBeenCalledWith({
      kind: 'expired',
      id: STUCK.id,
      claimAt: STUCK.claimAt,
      messageId: '19a2b3c4d5e6f7',
      sentAt: '2026-09-29T22:57:05.000Z',
      personId: null,
    })
    expect(h.releaseStuckFirstTouchSend).not.toHaveBeenCalled()
  })

  it('searches every mailbox the rail can send from, for the owner, from the claim', async () => {
    h.getCmaBrokerBySlugOrEmail.mockResolvedValue({ email: 'rebeccapeterson@ryan-realty.com' })
    await recoverStuckFirstTouchSends(NOW)
    expect(h.getCmaBrokerBySlugOrEmail).toHaveBeenCalledWith({ slug: 'matthew-ryan' })
    expect(h.findSentMessageTo).toHaveBeenCalledWith({
      mailboxes: ['matt@ryan-realty.com', 'paul@ryan-realty.com', 'rebeccapeterson@ryan-realty.com'],
      recipients: [OWNER],
      since: new Date(STUCK.claimAt),
    })
  })

  it("adds the CMA's pinned recipient when it differs from the prospect's address", async () => {
    h.getLatestClientReadyCmaRowForBaseSlug.mockResolvedValue({
      slug: 'cma-3153-cromwell',
      row: { client_email: 'Other@Example.com ', broker_slug: null },
    })
    await recoverStuckFirstTouchSends(NOW)
    expect(h.findSentMessageTo).toHaveBeenCalledWith(
      expect.objectContaining({ recipients: [OWNER, 'other@example.com'] }),
    )
  })
})

describe('recoverStuckFirstTouchSends — proven absent', () => {
  it('releases the claim back to the queue so the next run sends it', async () => {
    const out = await recoverStuckFirstTouchSends(NOW)
    expect(out).toEqual([
      { kind: 'expired', id: STUCK.id, claimAt: STUCK.claimAt, outcome: 'released', requeued: true },
    ])
    expect(h.releaseStuckFirstTouchSend).toHaveBeenCalledWith({
      kind: 'expired',
      id: STUCK.id,
      claimAt: STUCK.claimAt,
      queuedAt: STUCK.queuedAt,
    })
    expect(h.finalizeRecoveredFirstTouchSend).not.toHaveBeenCalled()
    expect(h.queueBrokerHealthAlert).not.toHaveBeenCalled()
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('releases a manual (never queued) claim to unsent, not to queued', async () => {
    h.listStaleFirstTouchSends.mockResolvedValue([{ ...STUCK, queuedAt: null }])
    const out = await recoverStuckFirstTouchSends(NOW)
    expect(out[0]).toMatchObject({ outcome: 'released', requeued: false })
    expect(h.releaseStuckFirstTouchSend).toHaveBeenCalledWith(expect.objectContaining({ queuedAt: null }))
  })

  it('ignores events that are clearly some other email (a sequence step, another owner)', async () => {
    h.listEmailEventsSince.mockResolvedValue([
      event({ event: 'sent', emailKey: 'seq:42:step:1' }),
      event({ event: 'open', emailKey: 'seq:42:step:1' }),
      // Another owner's CMA with a look-alike slug, surfaced by the key prefix read.
      event({ event: 'open', emailKey: 'cma:cma-3153-cromwell-apt-2', recipientEmail: 'someone-else@example.com' }),
    ])
    const out = await recoverStuckFirstTouchSends(NOW)
    expect(out[0]).toMatchObject({ outcome: 'released' })
  })
})

describe('recoverStuckFirstTouchSends — a second CMA for the same house', () => {
  // The rail (lib/cma/prospect-send-claim.ts) claims this same owner row when it
  // sends a different cmas row built for the same house; that send is keyed with
  // the other document's slug.
  it("finalizes on that document's sent row to the owner", async () => {
    h.listEmailEventsSince.mockResolvedValue([
      event({ emailKey: 'cma:cma-3153-cromwell-dr', messageId: 'other-doc-msg', occurredAt: '2026-09-29T22:58:00.000Z' }),
    ])
    const out = await recoverStuckFirstTouchSends(NOW)
    expect(out[0]).toMatchObject({
      outcome: 'finalized',
      via: 'email-events',
      messageId: 'other-doc-msg',
      sentAt: '2026-09-29T22:58:00.000Z',
    })
    expect(h.findSentMessageTo).not.toHaveBeenCalled()
  })

  it("prefers this prospect's own document when both are there", async () => {
    h.listEmailEventsSince.mockResolvedValue([
      event({ emailKey: 'cma:cma-3153-cromwell-dr', messageId: 'other-doc-msg', occurredAt: '2026-09-29T22:56:00.000Z' }),
      event({ emailKey: 'cma:cma-3153-cromwell', messageId: 'own-doc-msg', occurredAt: '2026-09-29T22:57:00.000Z' }),
    ])
    const out = await recoverStuckFirstTouchSends(NOW)
    expect(out[0]).toMatchObject({ outcome: 'finalized', messageId: 'own-doc-msg' })
  })

  it('leaves the row when that document was opened by the owner but has no sent row to stamp', async () => {
    h.listEmailEventsSince.mockResolvedValue([event({ event: 'open', emailKey: 'cma:cma-3153-cromwell-dr', messageId: null })])
    const out = await recoverStuckFirstTouchSends(NOW)
    expect(out[0]).toMatchObject({
      outcome: 'unresolved',
      reason: expect.stringMatching(/'open' event on cma:cma-3153-cromwell-dr/),
    })
    expect(h.releaseStuckFirstTouchSend).not.toHaveBeenCalled()
  })
})

describe('recoverStuckFirstTouchSends — cannot check: left untouched', () => {
  function expectUntouched(out: Awaited<ReturnType<typeof recoverStuckFirstTouchSends>>, reason: RegExp) {
    expect(out).toEqual([
      { kind: 'expired', id: STUCK.id, claimAt: STUCK.claimAt, outcome: 'unresolved', reason: expect.stringMatching(reason) },
    ])
    expect(h.finalizeRecoveredFirstTouchSend).not.toHaveBeenCalled()
    expect(h.releaseStuckFirstTouchSend).not.toHaveBeenCalled()
    // Logged once, alerted once, per row per run.
    expect(consoleError).toHaveBeenCalledTimes(1)
    expect(h.queueBrokerHealthAlert).toHaveBeenCalledTimes(1)
    expect(h.queueBrokerHealthAlert).toHaveBeenCalledWith({
      key: `drip-stuck-send:expired:${STUCK.id}`,
      body: expect.stringContaining('3153 Cromwell'),
    })
    const body = String(h.queueBrokerHealthAlert.mock.calls[0]![0].body)
    expect(body).toContain(`https://ryan-realty.com/admin/prospecting/expired/${STUCK.id}`)
    expect(body.length).toBeLessThanOrEqual(600)
  }

  it('when Gmail Sent could not be searched (no DWD client / API error)', async () => {
    h.findSentMessageTo.mockResolvedValue({
      status: 'unknown',
      errors: ['matt@ryan-realty.com: no Gmail client (service account missing)'],
    })
    expectUntouched(await recoverStuckFirstTouchSends(NOW), /could not check Gmail Sent: .*no Gmail client/)
  })

  it('when an untracked email event reached the owner after the claim (a Resend fallback trace)', async () => {
    h.listEmailEventsSince.mockResolvedValue([
      event({ event: 'email.delivered', emailKey: null, messageId: 're_123', personId: null }),
    ])
    expectUntouched(await recoverStuckFirstTouchSends(NOW), /'email\.delivered' event to the owner with no key/)
  })

  it('when the CMA was opened but no sent row or Sent message can be stamped', async () => {
    h.listEmailEventsSince.mockResolvedValue([event({ event: 'open', messageId: null })])
    expectUntouched(await recoverStuckFirstTouchSends(NOW), /'open' event on cma:cma-3153-cromwell/)
  })

  it('when the email_events read fails', async () => {
    h.listEmailEventsSince.mockRejectedValue(new Error('email_events read (recipient) failed: timeout'))
    expectUntouched(await recoverStuckFirstTouchSends(NOW), /the check failed: email_events read/)
    expect(h.findSentMessageTo).not.toHaveBeenCalled()
  })

  it('when the prospect cannot be read', async () => {
    h.getProspect.mockResolvedValue(null)
    expectUntouched(await recoverStuckFirstTouchSends(NOW), /prospect record could not be read/)
  })

  it('when there is no address on file to check against', async () => {
    h.listStaleFirstTouchSends.mockResolvedValue([{ ...STUCK, contactEmail: null }])
    h.getProspect.mockResolvedValue({ ...PROSPECT, contactEmail: null })
    h.getLatestClientReadyCmaRowForBaseSlug.mockResolvedValue(null)
    expectUntouched(await recoverStuckFirstTouchSends(NOW), /no owner email address/)
  })

  it('when the only address on file is one of our own', async () => {
    h.listStaleFirstTouchSends.mockResolvedValue([{ ...STUCK, contactEmail: 'marketing+harness@ryan-realty.com' }])
    h.getProspect.mockResolvedValue({ ...PROSPECT, contactEmail: null })
    h.getLatestClientReadyCmaRowForBaseSlug.mockResolvedValue(null)
    expectUntouched(await recoverStuckFirstTouchSends(NOW), /no owner email address/)
  })

  it('when the release write itself fails', async () => {
    h.releaseStuckFirstTouchSend.mockRejectedValue(new Error('release stuck send failed: conn reset'))
    const out = await recoverStuckFirstTouchSends(NOW)
    expect(out[0]).toMatchObject({ outcome: 'unresolved', reason: expect.stringMatching(/release write failed/) })
    expect(h.queueBrokerHealthAlert).toHaveBeenCalledTimes(1)
  })

  it('still settles when the alert queue itself fails', async () => {
    h.findSentMessageTo.mockResolvedValue({ status: 'unknown', errors: ['x'] })
    h.queueBrokerHealthAlert.mockRejectedValue(new Error('alerts down'))
    const out = await recoverStuckFirstTouchSends(NOW)
    expect(out[0]).toMatchObject({ outcome: 'unresolved' })
  })
})

describe('recoverStuckFirstTouchSends — fenced writes', () => {
  it("reports 'changed' and leaves the row when it moved under the recovery", async () => {
    h.releaseStuckFirstTouchSend.mockResolvedValue(false)
    const out = await recoverStuckFirstTouchSends(NOW)
    expect(out).toEqual([{ kind: 'expired', id: STUCK.id, claimAt: STUCK.claimAt, outcome: 'changed' }])
    expect(h.queueBrokerHealthAlert).not.toHaveBeenCalled()
  })

  it('does nothing when no claim is stale', async () => {
    h.listStaleFirstTouchSends.mockResolvedValue([])
    expect(await recoverStuckFirstTouchSends(NOW)).toEqual([])
    expect(h.getProspect).not.toHaveBeenCalled()
  })

  it('propagates a failed stale-row read so the drain fails closed', async () => {
    h.listStaleFirstTouchSends.mockRejectedValue(new Error('stuck sends read (expired) failed: down'))
    await expect(recoverStuckFirstTouchSends(NOW)).rejects.toThrow(/stuck sends read/)
  })
})

describe('recoverStuckFirstTouchSends — every stuck row gets its turn', () => {
  it('rotates a fixed page of stale claims per minute, so none is starved', () => {
    const rows = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    const minute = (m: number) => new Date(m * 60_000)
    expect(MAX_STUCK_SENDS_PER_RUN).toBe(3)
    expect(pickStuckSendsForRun(rows, minute(0))).toEqual(['a', 'b', 'c'])
    expect(pickStuckSendsForRun(rows, minute(1))).toEqual(['d', 'e', 'f'])
    expect(pickStuckSendsForRun(rows, minute(2))).toEqual(['g'])
    expect(pickStuckSendsForRun(rows, minute(3))).toEqual(['a', 'b', 'c'])
    const seen = new Set([0, 1, 2].flatMap((m) => pickStuckSendsForRun(rows, minute(m))))
    expect(seen.size).toBe(rows.length)
    expect(pickStuckSendsForRun(['only'], minute(5))).toEqual(['only'])
    expect(pickStuckSendsForRun([], minute(5))).toEqual([])
  })

  it('examines at most one page per run, and reaches a newer stuck send behind unresolved old ones', async () => {
    const stale = [1, 2, 3, 4].map((n) => ({ ...STUCK, id: `OLD-${n}`, claimAt: `2026-09-2${n}T10:00:00+00:00` }))
    stale.push({ ...STUCK, id: 'NEW', claimAt: '2026-09-29T23:00:00+00:00' })
    h.listStaleFirstTouchSends.mockResolvedValue(stale)
    h.findSentMessageTo.mockResolvedValue({ status: 'unknown', errors: ['dwd down'] })

    const firstRun = await recoverStuckFirstTouchSends(new Date(0))
    expect(firstRun.map((o) => o.id)).toEqual(['OLD-1', 'OLD-2', 'OLD-3'])
    const secondRun = await recoverStuckFirstTouchSends(new Date(60_000))
    expect(secondRun.map((o) => o.id)).toEqual(['OLD-4', 'NEW'])
  })
})

describe('decideStuckSend (pure)', () => {
  const base = 'cma-3153-cromwell'
  it('prefers the rail sent row over Gmail, and Gmail over nothing', () => {
    const gmail = {
      status: 'found' as const,
      hit: { mailbox: 'm', recipient: OWNER, messageId: 'g', threadId: null, sentAt: '2026-09-29T23:00:00.000Z' },
    }
    expect(decideStuckSend({ baseSlug: base, recipients: [OWNER], events: [event({})], sent: gmail })).toMatchObject({
      verdict: 'found',
      via: 'email-events',
    })
    expect(decideStuckSend({ baseSlug: base, recipients: [OWNER], events: [], sent: gmail })).toMatchObject({
      verdict: 'found',
      via: 'gmail-sent',
      messageId: 'g',
    })
  })

  it('is absent only when Gmail answered absent and nothing traces the send', () => {
    expect(decideStuckSend({ baseSlug: base, recipients: [OWNER], events: [], sent: { status: 'absent', searched: 3 } })).toEqual({
      verdict: 'absent',
    })
    expect(decideStuckSend({ baseSlug: base, recipients: [OWNER], events: [], sent: null })).toMatchObject({
      verdict: 'unknown',
    })
  })

  // Review finding (2026-09-29): a test send of the same CMA to one of our own
  // addresses after the claim must never mark the owner as emailed.
  it('never counts a send to one of our own addresses as the owner email', () => {
    const internalSent = event({ recipientEmail: 'marketing+harness@ryan-realty.com', messageId: 'test-msg' })
    const absent = { status: 'absent' as const, searched: 3 }
    expect(decideStuckSend({ baseSlug: base, recipients: [OWNER], events: [internalSent], sent: absent })).toEqual({
      verdict: 'absent',
    })
    // An internal CMA client_email in the recipient list is ignored too.
    expect(
      decideStuckSend({
        baseSlug: base,
        recipients: [OWNER, 'matt@ryan-realty.com'],
        events: [event({ emailKey: 'cma:cma-9-other', recipientEmail: 'matt@ryan-realty.com' })],
        sent: absent,
      }),
    ).toEqual({ verdict: 'absent' })
    // The owner's own send on the same key still counts.
    expect(decideStuckSend({ baseSlug: base, recipients: [OWNER], events: [internalSent, event({})], sent: absent })).toMatchObject({
      verdict: 'found',
      via: 'email-events',
      messageId: 'gmail-msg-1',
    })
  })
})

describe('doc-slug helpers', () => {
  it('uses the built doc base, else the address slug', () => {
    expect(prospectDocBaseSlug({ doc: { state: 'sent', slug: 'cma-3153-cromwell--v3' } as never, streetAddress: 'x' })).toBe(
      'cma-3153-cromwell',
    )
    expect(prospectDocBaseSlug({ doc: { state: 'none' }, streetAddress: '3153 Cromwell' })).toBe('cma-3153-cromwell')
    expect(prospectDocBaseSlug({ doc: { state: 'none' }, streetAddress: null })).toBeNull()
  })

  it('matches the base and its --vN versions exactly, nothing else', () => {
    expect(isCmaEmailKeyForBase('cma:cma-1-main', 'cma-1-main')).toBe(true)
    expect(isCmaEmailKeyForBase('cma:cma-1-main--v2', 'cma-1-main')).toBe(true)
    expect(isCmaEmailKeyForBase('cma:cma-1-main--v12', 'cma-1-main')).toBe(true)
    expect(isCmaEmailKeyForBase('cma:cma-1-main-apt-2', 'cma-1-main')).toBe(false)
    expect(isCmaEmailKeyForBase('cma:cma-1-main--v', 'cma-1-main')).toBe(false)
    expect(isCmaEmailKeyForBase('cma:cma-1-main--vx', 'cma-1-main')).toBe(false)
    expect(isCmaEmailKeyForBase('bpo:cma-1-main', 'cma-1-main')).toBe(false)
    expect(isCmaEmailKeyForBase(null, 'cma-1-main')).toBe(false)
    expect(isCmaEmailKeyForBase('cma:cma-1-main', null)).toBe(false)
  })
})
