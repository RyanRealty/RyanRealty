import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSendGoverned = vi.fn()
vi.mock('@/lib/comms/sendGovernedEmail', () => ({
  sendGovernedEmail: (...args: unknown[]) => mockSendGoverned(...args),
}))

vi.mock('@/lib/data/crm/personByEmailCi', () => ({
  personIdsByEmailCi: async () => [99],
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({}),
}))

const mockGetRecipients = vi.fn()
const mockGetTemplate = vi.fn()
vi.mock('@/lib/data/crm/getEmailCohortRecipients', () => ({
  getEmailCohortRecipients: (...args: unknown[]) => mockGetRecipients(...args),
  getCrmTemplateForSend: (...args: unknown[]) => mockGetTemplate(...args),
}))

vi.mock('@/lib/crm/merge-context', () => ({
  buildMergeContext: async () => ({
    agent: { firstName: 'Matt', lastName: 'Ryan' },
    sender: { firstName: 'Matt', lastName: 'Ryan' },
    company: { name: 'Ryan Realty', address: null },
    lender: null,
    leadSource: { name: null, campaign: null },
    timeZone: 'America/Los_Angeles',
  }),
}))

vi.mock('@/lib/crm/attributed-links', () => ({
  attributeOutbound: (html: string) => html,
}))

const mockGetSignature = vi.fn()
vi.mock('@/lib/crm/email-signature', () => ({
  getSignatureForMailbox: (...args: unknown[]) => mockGetSignature(...args),
}))

import { sendBatchTestEmail } from './email-cohort-test'

const sample = {
  id: 7,
  fub_legacy_id: 100,
  email: 'lead@example.com',
  assigned_broker: 'matt',
  name: 'Jane Doe',
  first_name: 'Jane',
  last_name: 'Doe',
  stage: 'Lead',
  source: null,
  lender_name: null,
  emails: [{ value: 'lead@example.com', isPrimary: 1 }],
  phones: [],
  addresses: [],
  custom: {},
}

describe('sendBatchTestEmail — signature + from match the cohort', () => {
  beforeEach(() => {
    mockSendGoverned.mockReset()
    mockGetSignature.mockReset()
    mockGetRecipients.mockReset()
    mockGetTemplate.mockReset()
    mockGetRecipients.mockResolvedValue([sample])
    mockSendGoverned.mockResolvedValue({ ok: true, providerId: 't1' })
    mockGetSignature.mockResolvedValue({ html: '<div id="sig">Matt</div>', plain: 'Matt' })
  })

  it('puts the signature in the body and the named from + reply-to on the Resend rail', async () => {
    const out = await sendBatchTestEmail({
      to: 'matt@ryan-realty.com',
      samplePersonId: 7,
      params: { subject: 'Hi %first%', body: '<p>Hello %first%</p>' },
    })
    expect(out).toEqual({ ok: true, sentTo: 'matt@ryan-realty.com', mergedAgainst: 'lead@example.com' })
    const req = mockSendGoverned.mock.calls[0][0]
    expect(req.payload.rail).toBe('resend')
    expect(req.payload.html).toContain('<p>Hello Jane</p>')
    expect(req.payload.html).toContain('<div id="sig">Matt</div>')
    expect(req.payload.from).toBe('"Matt Ryan · Ryan Realty" <matt@mail.ryan-realty.com>')
    expect(req.payload.replyTo).toBe('matt@ryan-realty.com')
    expect(req.payload.subject).toBe('[TEST] Hi Jane')
  })

  it('omits the signature when the toggle is off', async () => {
    const out = await sendBatchTestEmail({
      to: 'matt@ryan-realty.com',
      samplePersonId: 7,
      params: { subject: 'Hi', body: '<p>Hello</p>', includeSignature: false },
    })
    expect(out.ok).toBe(true)
    const html = mockSendGoverned.mock.calls[0][0].payload.html as string
    expect(html).toBe('<p>Hello</p>')
    expect(html).not.toContain('id="sig"')
    expect(mockGetSignature).not.toHaveBeenCalled()
  })

  it('sends the test from the actor mailbox when sendVia is gmail', async () => {
    const out = await sendBatchTestEmail({
      to: 'matt@ryan-realty.com',
      samplePersonId: 7,
      params: { subject: 'Hi', body: '<p>Hello</p>', sendVia: 'gmail' },
    })
    expect(out.ok).toBe(true)
    const req = mockSendGoverned.mock.calls[0][0]
    expect(req.payload.rail).toBe('gmail')
    expect(req.payload.to).toEqual(['matt@ryan-realty.com'])
    expect(req.payload.bodyText).toContain('<div id="sig">Matt</div>')
    expect(req.payload.withSignature).toBe(false)
    expect(req.initiator.broker).toBe('matt')
  })
})
