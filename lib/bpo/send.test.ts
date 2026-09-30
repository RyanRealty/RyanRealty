import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * sendBpoToLead rides the same two rails as the CMA send: the broker's Gmail,
 * then Resend. A send Gmail never answered may already be delivered, so it must
 * not go out a second time by Resend. A send Gmail refused still falls back.
 */

const h = vi.hoisted(() => ({
  sendGmailMessage: vi.fn(),
  sendEmail: vi.fn(),
  updateBpoRowFieldsBySlug: vi.fn(),
  logCmaTimelineEvent: vi.fn(),
  row: {
    status: 'final',
    archived_at: null,
    person_id: 7,
    html_content: '<html><body><h1>Broker price opinion</h1></body></html>',
    broker_slug: 'matthew-ryan',
    subject_address: '123 Main St, Bend, OR 97701',
    opinion_value: 525000,
    value_low: 500000,
    value_high: 540000,
    sent_count: 0,
  },
}))

vi.mock('@/lib/gmail-draft', () => ({ sendGmailMessage: h.sendGmailMessage }))
vi.mock('@/lib/resend', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/resend')>()),
  sendEmail: h.sendEmail,
}))
vi.mock('@/lib/data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/data')>()),
  getCmaBrokerBySlugOrEmail: vi.fn(async () => ({
    slug: 'matthew-ryan',
    display_name: 'Matt Ryan',
    title: 'Owner & Principal Broker',
    email: 'matt@ryan-realty.com',
    twilio_number: '+15417033095',
    photo_url: null,
  })),
  findCrmPersonIdByEmail: vi.fn(async () => 7),
  logCmaTimelineEvent: h.logCmaTimelineEvent,
}))
vi.mock('@/lib/data/bpo/reads', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/data/bpo/reads')>()),
  getBpoAdminRowBySlug: vi.fn(async () => h.row),
  updateBpoRowFieldsBySlug: h.updateBpoRowFieldsBySlug,
}))
vi.mock('@/lib/data/crm/getContactSendTarget', () => ({
  getContactSendTarget: vi.fn(async () => ({ email: 'client@example.com', name: 'Pat Client' })),
}))
vi.mock('@/lib/crm/suppressions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/crm/suppressions')>()),
  isSuppressed: vi.fn(async () => ({ suppressed: false, reasons: [] })),
}))
vi.mock('@/lib/pdf/html-to-pdf', () => ({ htmlToPdfBuffer: vi.fn(async () => Buffer.from('%PDF-1.7')) }))

import { sendBpoToLead } from '@/lib/bpo/send'

const SEND = { personId: 7, slug: 'bpo-123-main-st' }

let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  h.sendEmail.mockResolvedValue({ id: 'resend-1' })
  h.updateBpoRowFieldsBySlug.mockResolvedValue({ ok: true })
  h.logCmaTimelineEvent.mockResolvedValue(undefined)
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.clearAllMocks()
  consoleError.mockRestore()
})

describe('sendBpoToLead', () => {
  it('falls back to Resend when Gmail failed before anything went out', async () => {
    h.sendGmailMessage.mockResolvedValue({ ok: false, error: 'Gmail auth timed out after 10s' })

    const res = await sendBpoToLead(SEND)

    expect(h.sendEmail).toHaveBeenCalledTimes(1)
    expect(res).toMatchObject({ ok: true, transport: 'resend' })
  })

  it('does not fall back when Gmail never confirmed the send, and passes on the check-Sent error', async () => {
    const error =
      'Gmail did not confirm the send from matt@ryan-realty.com (The operation was aborted). It may have gone out, so check Sent in that mailbox before sending again.'
    h.sendGmailMessage.mockResolvedValue({ ok: false, unconfirmed: true, error })

    const res = await sendBpoToLead(SEND)

    expect(h.sendEmail).not.toHaveBeenCalled()
    expect(res).toEqual({ ok: false, error })
    expect(h.updateBpoRowFieldsBySlug).not.toHaveBeenCalled()
    expect(h.logCmaTimelineEvent).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining(SEND.slug))
  })
})
