import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Guard-order coverage for the governed send chokepoint (§A4).
 *
 * The load-bearing contract: hard-stop → suppression (fail closed) →
 * quiet hours (SMS) → idempotency → provider → timeline. A person refused at
 * stage N NEVER reaches stage N+1 — a suppressed person must never touch the
 * quiet-hours clock, the idempotency ledger, a provider rail, or the
 * timeline (except the P12 block ledger, which records the refusal). Every guard is the EXISTING canonical function, mocked here at
 * the module boundary so ordering is observable.
 */

const h = vi.hoisted(() => ({
  isSuppressed: vi.fn(),
  inSmsQuietHours: vi.fn(),
  withSendIdempotency: vi.fn(),
  getSendTarget: vi.fn(),
  renderCrmMerge: vi.fn(),
  attributeSiteLinks: vi.fn(),
  buildMergeContext: vi.fn(),
  sendSms: vi.fn(),
  sendSmsViaMessagingService: vi.fn(),
  sendGroupMms: vi.fn(),
  brokerTwilioNumber: vi.fn(),
  instrumentSmsLinks: vi.fn(),
  recordConversationMessage: vi.fn(),
  sendCrmEmail: vi.fn(),
  prepareDeliverableEmail: vi.fn(),
  resendSendEmail: vi.fn(),
  recordEmailEvent: vi.fn(),
  inserts: [] as Array<{ table: string; rows: unknown }>,
  fileCommsToVault: vi.fn(),
}))

vi.mock('@/lib/crm/suppressions', () => ({ isSuppressed: h.isSuppressed }))
vi.mock('@/lib/crm/quiet-hours', () => ({ inSmsQuietHours: h.inSmsQuietHours }))
vi.mock('@/lib/crm/idempotency', () => ({ withSendIdempotency: h.withSendIdempotency }))
vi.mock('@/lib/data/crm/getSendTarget', () => ({ getSendTarget: h.getSendTarget }))
vi.mock('@/lib/crm/merge', () => ({
  renderCrmMerge: h.renderCrmMerge,
  attributeSiteLinks: h.attributeSiteLinks,
}))
vi.mock('@/lib/crm/merge-context', () => ({ buildMergeContext: h.buildMergeContext }))
vi.mock('@/lib/crm/twilio', () => ({
  sendSms: h.sendSms,
  sendSmsViaMessagingService: h.sendSmsViaMessagingService,
  brokerTwilioNumber: h.brokerTwilioNumber,
}))
vi.mock('@/lib/crm/twilio-conversations', () => ({ sendGroupMms: h.sendGroupMms }))
vi.mock('@/lib/data/crm/shortLinks', () => ({ instrumentSmsLinks: h.instrumentSmsLinks }))
vi.mock('@/lib/crm/record-message', () => ({ recordConversationMessage: h.recordConversationMessage }))
vi.mock('@/lib/tc/file-comms-write', () => ({ fileCommsToVault: h.fileCommsToVault }))
vi.mock('@/lib/crm/gmail', () => ({
  CRM_MAILBOXES: [
    { email: 'matt@ryan-realty.com', slug: 'matt' },
    { email: 'rebeccapeterson@ryan-realty.com', slug: 'rebecca' },
    { email: 'paul@ryan-realty.com', slug: 'paul' },
  ],
  sendCrmEmail: h.sendCrmEmail,
}))
vi.mock('@/lib/email/prepare', () => ({ prepareDeliverableEmail: h.prepareDeliverableEmail }))
vi.mock('@/lib/resend', () => ({ sendEmail: h.resendSendEmail }))
vi.mock('@/lib/crm/email-events', () => ({
  recordEmailEvent: (...a: unknown[]) => h.recordEmailEvent(...a),
  sendTypeFromEmailKey: (key?: string | null) => (key ? 'one-off' : 'other'),
}))
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: string) => ({
      insert: (rows: unknown) => {
        h.inserts.push({ table, rows })
        return Promise.resolve({ error: null })
      },
    }),
  }),
}))

import { sendGovernedSms } from './sendGovernedSms'
import { sendGovernedGroupMms } from './sendGovernedGroupMms'
import { sendGovernedEmail } from './sendGovernedEmail'
import { QUIET_HOURS_ERROR } from './guards'

const PERSON = {
  id: 42,
  fub_legacy_id: null,
  phones: [],
  emails: [],
  addresses: [],
  assigned_broker: 'rebecca',
  name: 'Test Person',
  first_name: 'Test',
  last_name: 'Person',
  stage: 'Lead',
  source: null,
  lender_name: null,
  custom: {},
}

function passAllGuards() {
  h.isSuppressed.mockResolvedValue({ suppressed: false, reasons: [] })
  h.inSmsQuietHours.mockReturnValue(false)
}

function wireHappySmsPath() {
  h.getSendTarget.mockResolvedValue({ person: PERSON, phone: '+15415551234' })
  h.buildMergeContext.mockResolvedValue({})
  h.renderCrmMerge.mockImplementation((text: string) => `merged:${text}`)
  h.attributeSiteLinks.mockImplementation((text: string) => `attr:${text}`)
  h.instrumentSmsLinks.mockImplementation(async (text: string) => `tracked:${text}`)
  h.brokerTwilioNumber.mockResolvedValue('+15415550000')
  h.sendSms.mockResolvedValue({ ok: true, sid: 'SM123' })
  h.recordConversationMessage.mockResolvedValue({ ok: true, conversationId: 'c1', messageId: 'm1', deduped: false })
}

beforeEach(() => {
  vi.clearAllMocks()
  h.inserts.length = 0
  h.fileCommsToVault.mockResolvedValue({ filed: false, documentIds: [], checklistItemIds: [], skipped: 'no-deal' })
  // Idempotency default: transparent pass-through (the ledger is exercised by
  // its own unit tests in lib/crm) — these tests assert WHEN it is consulted.
  h.withSendIdempotency.mockImplementation(async (_args: unknown, run: () => Promise<unknown>) => run())
  h.recordEmailEvent.mockResolvedValue({ ok: true, inserted: true, event: 'sent', personId: 7 })
})

describe('sendGovernedSms — guard order', () => {
  const baseReq = {
    personId: 42,
    payload: { body: 'hello' },
    purpose: 'test',
    initiator: { kind: 'broker' as const, broker: null },
  }

  it('hard-stop tag blocks first, as its own stage, before any other stage runs', async () => {
    h.isSuppressed.mockResolvedValue({ suppressed: true, reasons: ['tag:compliance:hard-stop'] })
    const res = await sendGovernedSms(baseReq)
    expect(res).toEqual({
      ok: false,
      stage: 'hard-stop',
      error: 'Blocked by suppression (tag:compliance:hard-stop)',
    })
    expect(h.inSmsQuietHours).not.toHaveBeenCalled()
    expect(h.withSendIdempotency).not.toHaveBeenCalled()
    expect(h.getSendTarget).not.toHaveBeenCalled()
    expect(h.sendSms).not.toHaveBeenCalled()
    expect(h.sendSmsViaMessagingService).not.toHaveBeenCalled()
    expect(h.inserts.filter((i) => i.table !== 'admin_actions')).toHaveLength(0)
    expect(h.fileCommsToVault).not.toHaveBeenCalled()
  })

  it('a suppressed person NEVER reaches quiet hours, idempotency, the provider, or the timeline', async () => {
    h.isSuppressed.mockResolvedValue({ suppressed: true, reasons: ['sms:stop-keyword'] })
    const res = await sendGovernedSms({ ...baseReq, idempotencyKey: 'k1', overrideQuietHours: true })
    expect(res).toEqual({
      ok: false,
      stage: 'suppression',
      error: 'Blocked by suppression (sms:stop-keyword)',
    })
    expect(h.inSmsQuietHours).not.toHaveBeenCalled()
    expect(h.withSendIdempotency).not.toHaveBeenCalled()
    expect(h.sendSms).not.toHaveBeenCalled()
    expect(h.inserts.filter((i) => i.table !== 'admin_actions')).toHaveLength(0)
  })

  it('fails CLOSED when the suppression read errors (reason string propagated)', async () => {
    h.isSuppressed.mockResolvedValue({ suppressed: true, reasons: ['suppression-check-failed: boom'] })
    const res = await sendGovernedSms(baseReq)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.stage).toBe('suppression')
    expect(h.sendSms).not.toHaveBeenCalled()
  })

  it('quiet hours blocks after suppression passes, before idempotency and the provider', async () => {
    h.isSuppressed.mockResolvedValue({ suppressed: false, reasons: [] })
    h.inSmsQuietHours.mockReturnValue(true)
    const res = await sendGovernedSms({ ...baseReq, idempotencyKey: 'k1' })
    expect(res).toEqual({ ok: false, stage: 'quiet-hours', error: QUIET_HOURS_ERROR })
    expect(h.withSendIdempotency).not.toHaveBeenCalled()
    expect(h.getSendTarget).not.toHaveBeenCalled()
    expect(h.sendSms).not.toHaveBeenCalled()
    expect(h.inserts.filter((i) => i.table !== 'admin_actions')).toHaveLength(0)
  })

  it('a manual 1:1 override passes quiet hours (A6) and sends', async () => {
    h.isSuppressed.mockResolvedValue({ suppressed: false, reasons: [] })
    h.inSmsQuietHours.mockReturnValue(true)
    wireHappySmsPath()
    const res = await sendGovernedSms({ ...baseReq, overrideQuietHours: true })
    expect(res).toEqual({ ok: true, sid: 'SM123', to: '+15415551234' })
    expect(h.sendSms).toHaveBeenCalledTimes(1)
  })

  it('happy path: merge → tracked body to Twilio, readable body + exact row shape to the timeline', async () => {
    passAllGuards()
    wireHappySmsPath()
    const res = await sendGovernedSms(baseReq)
    expect(res).toEqual({ ok: true, sid: 'SM123', to: '+15415551234' })
    // initiator.broker null → falls back to the person's assigned broker
    expect(h.brokerTwilioNumber).toHaveBeenCalledWith('rebecca')
    expect(h.sendSms).toHaveBeenCalledWith({
      from: '+15415550000',
      to: '+15415551234',
      body: 'tracked:attr:merged:hello',
      mediaUrls: undefined,
    })
    expect(h.inserts).toHaveLength(1)
    expect(h.inserts[0].table).toBe('crm_timeline')
    expect(h.inserts[0].rows).toEqual({
      person_id: 42,
      kind: 'sms_out',
      title: 'Text sent',
      body: 'attr:merged:hello',
      payload: { twilioSid: 'SM123', to: '+15415551234', hasMedia: false },
      broker: 'rebecca',
      source: 'app',
      dedupe_key: 'twilio:SM123:p42',
    })
    expect(h.recordConversationMessage).toHaveBeenCalledTimes(1)
    expect(h.fileCommsToVault).toHaveBeenCalledWith(
      expect.objectContaining({
        personIds: [42],
        channel: 'sms',
        title: 'Text sent',
        dedupeKey: 'sms-out:SM123',
      }),
    )
  })

  it('no phone on file refuses at the recipient stage without touching the provider', async () => {
    passAllGuards()
    h.getSendTarget.mockResolvedValue({ person: PERSON, phone: '' })
    const res = await sendGovernedSms(baseReq)
    expect(res).toEqual({ ok: false, stage: 'recipient', error: 'No phone number on file' })
    expect(h.sendSms).not.toHaveBeenCalled()
    expect(h.inserts.filter((i) => i.table !== 'admin_actions')).toHaveLength(0)
  })

  it('wraps the send in the existing idempotency key pattern sms:{personId}:{key}', async () => {
    passAllGuards()
    wireHappySmsPath()
    await sendGovernedSms({ ...baseReq, idempotencyKey: 'abc' })
    expect(h.withSendIdempotency).toHaveBeenCalledTimes(1)
    expect(h.withSendIdempotency.mock.calls[0][0]).toEqual({
      key: 'sms:42:abc',
      scope: 'sms',
      onInFlight: { ok: true },
    })
  })

  it('provider failure surfaces the rail error and writes nothing', async () => {
    passAllGuards()
    wireHappySmsPath()
    h.sendSms.mockResolvedValue({ ok: false, error: 'twilio down' })
    const res = await sendGovernedSms(baseReq)
    expect(res).toEqual({ ok: false, stage: 'provider', error: 'twilio down' })
    expect(h.inserts.filter((i) => i.table !== 'admin_actions')).toHaveLength(0)
  })
})

describe('sendGovernedEmail — guard order', () => {
  const gmailReq = {
    personId: 7,
    purpose: 'test',
    initiator: { kind: 'broker' as const, broker: 'matt' as const },
    payload: {
      rail: 'gmail' as const,
      to: ['lead@example.com'],
      cc: [],
      bcc: [],
      subject: 'Subject line',
      bodyText: 'Body text',
      extraPersonIds: [8],
      primaryAddress: 'lead@example.com',
    },
  }

  it('a suppressed person NEVER reaches idempotency, the Gmail rail, or the timeline', async () => {
    h.isSuppressed.mockResolvedValue({ suppressed: true, reasons: ['email:all:unsubscribed'] })
    const res = await sendGovernedEmail({ ...gmailReq, idempotencyKey: 'k9' })
    expect(res).toEqual({
      ok: false,
      stage: 'suppression',
      error: 'Blocked by suppression (email:all:unsubscribed)',
    })
    expect(h.withSendIdempotency).not.toHaveBeenCalled()
    expect(h.sendCrmEmail).not.toHaveBeenCalled()
    expect(h.inserts.filter((i) => i.table !== 'admin_actions')).toHaveLength(0)
  })

  it('hard-stop reports as its own stage on email too', async () => {
    h.isSuppressed.mockResolvedValue({ suppressed: true, reasons: ['tag:compliance:hard-stop'] })
    const res = await sendGovernedEmail(gmailReq)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.stage).toBe('hard-stop')
    expect(h.sendCrmEmail).not.toHaveBeenCalled()
  })

  it('quiet hours does NOT gate email — sends even inside the SMS quiet window', async () => {
    h.isSuppressed.mockResolvedValue({ suppressed: false, reasons: [] })
    h.inSmsQuietHours.mockReturnValue(true)
    h.sendCrmEmail.mockResolvedValue({ ok: true, gmailId: 'g1', plainBody: 'plain' })
    h.recordConversationMessage.mockResolvedValue({ ok: true, conversationId: 'c1', messageId: 'm1', deduped: false })
    const res = await sendGovernedEmail(gmailReq)
    expect(res).toEqual({ ok: true, providerId: 'g1' })
  })

  it('gmail rail: one timeline row per contact (primary + extras), exact dedupe keys', async () => {
    h.isSuppressed.mockResolvedValue({ suppressed: false, reasons: [] })
    h.sendCrmEmail.mockResolvedValue({ ok: true, gmailId: 'g1', plainBody: 'plain' })
    h.recordConversationMessage.mockResolvedValue({ ok: true, conversationId: 'c1', messageId: 'm1', deduped: false })
    const res = await sendGovernedEmail(gmailReq)
    expect(res).toEqual({ ok: true, providerId: 'g1' })
    expect(h.sendCrmEmail).toHaveBeenCalledTimes(1)
    expect(h.sendCrmEmail.mock.calls[0][0]).toMatchObject({
      fromMailbox: 'matt@ryan-realty.com',
      to: ['lead@example.com'],
      subject: 'Subject line',
      bodyText: 'Body text',
      withSignature: true,
      track: { personId: 7, emailKey: 'gov:test:7', label: 'Subject line', broker: 'matt' },
    })
    expect(h.inserts).toHaveLength(1)
    const rows = h.inserts[0].rows as Array<Record<string, unknown>>
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      person_id: 7, kind: 'email_out', title: 'Subject line', body: 'plain',
      broker: 'matt', source: 'app', dedupe_key: 'gmail:g1:p7',
    })
    expect(rows[1]).toMatchObject({ person_id: 8, dedupe_key: 'gmail:g1:p8' })
  })

  it('wraps the send in the existing idempotency key pattern email:{personId}:{key}', async () => {
    h.isSuppressed.mockResolvedValue({ suppressed: false, reasons: [] })
    h.sendCrmEmail.mockResolvedValue({ ok: true, gmailId: 'g1', plainBody: 'plain' })
    h.recordConversationMessage.mockResolvedValue({ ok: true, conversationId: 'c1', messageId: 'm1', deduped: false })
    await sendGovernedEmail({ ...gmailReq, idempotencyKey: 'xyz' })
    expect(h.withSendIdempotency).toHaveBeenCalledTimes(1)
    expect(h.withSendIdempotency.mock.calls[0][0]).toEqual({
      key: 'email:7:xyz',
      scope: 'email',
      onInFlight: { ok: true },
    })
  })

  it('resend rail: routes through prepareDeliverableEmail and logs the resend id', async () => {
    h.isSuppressed.mockResolvedValue({ suppressed: false, reasons: [] })
    h.prepareDeliverableEmail.mockReturnValue({
      subject: 'S', html: '<p>H</p>', text: 'T', headers: { 'List-Unsubscribe': '<u>' }, report: { level: 'pass', issues: [] },
    })
    h.resendSendEmail.mockResolvedValue({ id: 're_1' })
    h.recordConversationMessage.mockResolvedValue({ ok: true, conversationId: 'c1', messageId: 'm1', deduped: false })
    const res = await sendGovernedEmail({
      personId: 7,
      purpose: 'cma:delivery',
      initiator: { kind: 'system', source: 'cma' },
      payload: { rail: 'resend', to: 'lead@example.com', subject: 'S', html: '<p>H</p>' },
    })
    expect(res).toEqual({ ok: true, providerId: 're_1' })
    expect(h.prepareDeliverableEmail).toHaveBeenCalledTimes(1)
    expect(h.resendSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'lead@example.com',
        headers: { 'List-Unsubscribe': '<u>' },
        personId: 7,
        emailKey: 'gov:cma:delivery:7',
        brokerSlug: 'matt',
      }),
    )
    expect(h.inserts).toHaveLength(1)
    expect(h.inserts[0].rows).toMatchObject({
      person_id: 7, kind: 'email_out', source: 'automation', dedupe_key: 'resend:re_1:p7',
    })
  })

  it('gmail rail: records a sent email_events row for the primary recipient', async () => {
    h.isSuppressed.mockResolvedValue({ suppressed: false, reasons: [] })
    h.sendCrmEmail.mockResolvedValue({ ok: true, gmailId: 'g1', plainBody: 'plain' })
    h.recordConversationMessage.mockResolvedValue({ ok: true, conversationId: 'c1', messageId: 'm1', deduped: false })
    await sendGovernedEmail({
      ...gmailReq,
      payload: { ...gmailReq.payload, track: { personId: 7, emailKey: 'manual:7:1', label: 'Subject line' } },
    })
    expect(h.recordEmailEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: 'g1',
        recipientEmail: 'lead@example.com',
        personId: 7,
        event: 'sent',
        emailKey: 'manual:7:1',
        sendType: 'one-off',
      }),
    )
  })

  it('gmail rail: bulk claim path does not write a second sent row', async () => {
    h.isSuppressed.mockResolvedValue({ suppressed: false, reasons: [] })
    h.sendCrmEmail.mockResolvedValue({ ok: true, gmailId: 'g1', plainBody: 'plain' })
    h.recordConversationMessage.mockResolvedValue({ ok: true, conversationId: 'c1', messageId: 'm1', deduped: false })
    await sendGovernedEmail({ ...gmailReq, recordSentEvent: false })
    expect(h.recordEmailEvent).not.toHaveBeenCalled()
  })

  it('resend rail: a suppressed person never reaches prepare or the provider', async () => {
    h.isSuppressed.mockResolvedValue({ suppressed: true, reasons: ['do_not_email'] })
    const res = await sendGovernedEmail({
      personId: 7,
      purpose: 'cma:delivery',
      initiator: { kind: 'system', source: 'cma' },
      payload: { rail: 'resend', to: 'lead@example.com', subject: 'S', html: '<p>H</p>' },
    })
    expect(res.ok).toBe(false)
    expect(h.prepareDeliverableEmail).not.toHaveBeenCalled()
    expect(h.resendSendEmail).not.toHaveBeenCalled()
  })
})

describe('sendGovernedGroupMms — one thread, same guards', () => {
  const groupReq = {
    primaryPersonId: 42,
    members: [
      { personId: 42, phone: '+15415551111' },
      { personId: 43, phone: '+15415552222' },
    ],
    projectedAddress: '+15417033095',
    mergedBody: 'hello both',
    friendlyName: 'Group · Jane',
    purpose: 'crm:manual-group-sms',
    initiator: { kind: 'broker' as const, broker: 'matt' },
  }

  it('a suppressed member blocks the whole group and never calls Twilio', async () => {
    passAllGuards()
    h.isSuppressed.mockImplementation(async (personId: number) =>
      personId === 43
        ? { suppressed: true, reasons: ['sms:stop-keyword'] }
        : { suppressed: false, reasons: [] },
    )
    const res = await sendGovernedGroupMms(groupReq)
    expect(res.ok).toBe(false)
    if (res.ok === false) expect(res.stage).toBe('suppression')
    expect(h.sendGroupMms).not.toHaveBeenCalled()
    expect(h.inserts.filter((i) => i.table === 'crm_timeline')).toHaveLength(0)
    expect(h.fileCommsToVault).not.toHaveBeenCalled()
  })

  it('sends one group thread after every member clears guards', async () => {
    passAllGuards()
    h.instrumentSmsLinks.mockImplementation(async (text: string) => `tracked:${text}`)
    h.recordConversationMessage.mockResolvedValue({
      ok: true,
      conversationId: 'c1',
      messageId: 'm1',
      deduped: false,
    })
    h.sendGroupMms.mockResolvedValue({
      ok: true,
      conversationSid: 'CH1',
      messageSid: 'IM1',
      chatServiceSid: 'IS1',
      media: [],
    })
    const res = await sendGovernedGroupMms(groupReq)
    expect(res).toMatchObject({ ok: true, conversationSid: 'CH1', messageSid: 'IM1' })
    expect(h.sendGroupMms).toHaveBeenCalledTimes(1)
    expect(h.sendGroupMms.mock.calls[0][0].participants).toEqual(['+15415551111', '+15415552222'])
    expect(h.inserts.filter((i) => i.table === 'crm_timeline')).toHaveLength(2)
    expect(h.fileCommsToVault).toHaveBeenCalledWith(
      expect.objectContaining({
        personIds: [42, 43],
        channel: 'sms',
        title: 'Group text sent',
        dedupeKey: 'sms-out:IM1',
      }),
    )
  })
})
