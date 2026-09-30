import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The lead's "we got your request" confirmation goes from the broker's Gmail,
 * with Resend as the fallback. A send Gmail never answered may already be in
 * the lead's inbox, so it must not go out a second time by Resend. A send that
 * failed before anything went out still falls back.
 */

const h = vi.hoisted(() => ({
  sendGmailMessage: vi.fn(),
  sendEmail: vi.fn(),
}))

vi.mock('@/lib/gmail-draft', () => ({ sendGmailMessage: h.sendGmailMessage }))
vi.mock('@/lib/resend', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/resend')>()),
  sendEmail: h.sendEmail,
}))
vi.mock('@/lib/crm/suppressions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/crm/suppressions')>()),
  isSuppressedByEmail: vi.fn(async () => ({ suppressed: false, reasons: [] })),
}))
vi.mock('@/lib/comms/sendGovernedEmail', () => ({ sendGovernedEmail: vi.fn() }))
vi.mock('@/lib/data/crm/getPersonIdsByEmail', () => ({ getPersonIdsByEmail: vi.fn(async () => []) }))

import { sendLeadConfirmation } from '@/lib/cma/request-emails'

const LEAD = {
  leadEmail: 'lead@example.com',
  leadName: 'Pat Lead',
  subjectAddress: '123 Main St, Bend, OR 97701',
  brokerName: 'Matt Ryan',
  brokerEmail: 'matt@ryan-realty.com',
}

let consoleWarn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  h.sendEmail.mockResolvedValue({ id: 'resend-1' })
  consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.clearAllMocks()
  consoleWarn.mockRestore()
})

describe('sendLeadConfirmation', () => {
  it('falls back to Resend when Gmail failed before anything went out', async () => {
    h.sendGmailMessage.mockResolvedValue({ ok: false, error: 'Gmail auth timed out after 10s' })

    await sendLeadConfirmation(LEAD)

    expect(h.sendEmail).toHaveBeenCalledTimes(1)
    expect(h.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'lead@example.com' }))
  })

  it('does not fall back when Gmail never confirmed the send', async () => {
    h.sendGmailMessage.mockResolvedValue({
      ok: false,
      unconfirmed: true,
      error: 'Gmail did not confirm the send from matt@ryan-realty.com (The operation was aborted).',
    })

    await sendLeadConfirmation(LEAD)

    expect(h.sendEmail).not.toHaveBeenCalled()
    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('Not falling back to Resend'))
  })
})
