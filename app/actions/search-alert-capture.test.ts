/**
 * Listing-alert signup must stitch the browser to the CRM person it creates.
 * Mocks only — never create a live CRM person, never hit production.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  sendEvent: vi.fn(),
  canonicallyTagLead: vi.fn(),
  createNativeTask: vi.fn(),
  upsertListingAlert: vi.fn(),
  fireLeadGenerated: vi.fn(),
  stitchFormSubmitIdentity: vi.fn(),
  getCookie: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ get: h.getCookie }),
  headers: () => Promise.resolve({ get: () => null }),
}))

vi.mock('@/lib/rate-limit', () => ({
  getAuthLimiter: () => null,
}))

vi.mock('@/lib/followupboss', () => ({
  sendEvent: (...args: unknown[]) => h.sendEvent(...args),
}))

vi.mock('@/lib/canonical-lead-tagger', () => ({
  canonicallyTagLead: (...args: unknown[]) => h.canonicallyTagLead(...args),
}))

vi.mock('@/lib/data/crm/ensureNativeLead', () => ({
  createNativeTask: (...args: unknown[]) => h.createNativeTask(...args),
}))

vi.mock('@/lib/data/leads/listingAlerts', () => ({
  upsertListingAlert: (...args: unknown[]) => h.upsertListingAlert(...args),
}))

vi.mock('@/lib/lead-tracking', () => ({
  fireLeadGenerated: (...args: unknown[]) => h.fireLeadGenerated(...args),
}))

vi.mock('@/lib/visitor-backfill', () => ({
  stitchFormSubmitIdentity: (...args: unknown[]) => h.stitchFormSubmitIdentity(...args),
}))

import { submitSearchAlertSignup } from '@/app/actions/search-alert-capture'

const PERSON_ID = 42
const EMAIL = 'buyer@example.com'
const RR_VID = 'rr-vid-from-cookie'
const SESSION_ID = '550e8400-e29b-41d4-a716-446655440000'

const BASE = {
  email: EMAIL,
  filters: { city: 'Bend' } as Record<string, unknown>,
  company: '',
}

async function signup(overrides: Partial<typeof BASE> & { sessionId?: string } = {}) {
  return submitSearchAlertSignup({ ...BASE, ...overrides })
}

beforeEach(() => {
  h.sendEvent.mockReset()
  h.canonicallyTagLead.mockReset()
  h.createNativeTask.mockReset()
  h.upsertListingAlert.mockReset()
  h.fireLeadGenerated.mockReset()
  h.stitchFormSubmitIdentity.mockReset()
  h.getCookie.mockReset()

  h.sendEvent.mockResolvedValue({ ok: true, status: 200, personId: PERSON_ID })
  h.canonicallyTagLead.mockResolvedValue(undefined)
  h.createNativeTask.mockResolvedValue(undefined)
  h.upsertListingAlert.mockResolvedValue({ ok: true })
  h.fireLeadGenerated.mockResolvedValue(undefined)
  h.stitchFormSubmitIdentity.mockResolvedValue(undefined)
  h.getCookie.mockImplementation((name: string) =>
    name === 'rr_vid' ? { value: RR_VID } : undefined,
  )
})

describe('submitSearchAlertSignup identity stitch', () => {
  it('calls stitchFormSubmitIdentity with rr_vid + person id when a person exists', async () => {
    const result = await signup()

    expect(result).toEqual({ ok: true })
    expect(h.stitchFormSubmitIdentity).toHaveBeenCalledTimes(1)
    expect(h.stitchFormSubmitIdentity).toHaveBeenCalledWith({
      personId: PERSON_ID,
      email: EMAIL,
      rrVid: RR_VID,
      sessionId: undefined,
    })
    expect(h.getCookie).toHaveBeenCalledWith('rr_vid')
    expect(h.sendEvent).toHaveBeenCalled()
    expect(h.canonicallyTagLead).toHaveBeenCalled()
    expect(h.createNativeTask).toHaveBeenCalled()
    expect(h.upsertListingAlert).toHaveBeenCalled()
  })

  it('passes a valid uuid v4 sessionId through to stitch', async () => {
    const result = await signup({ sessionId: SESSION_ID })

    expect(result).toEqual({ ok: true })
    expect(h.stitchFormSubmitIdentity).toHaveBeenCalledTimes(1)
    expect(h.stitchFormSubmitIdentity).toHaveBeenCalledWith({
      personId: PERSON_ID,
      email: EMAIL,
      rrVid: RR_VID,
      sessionId: SESSION_ID,
    })
  })

  it('does not stitch when the honeypot is filled', async () => {
    const result = await signup({ company: 'Acme Bot Farm' })

    expect(result).toEqual({ ok: true })
    expect(h.sendEvent).not.toHaveBeenCalled()
    expect(h.stitchFormSubmitIdentity).not.toHaveBeenCalled()
    expect(h.upsertListingAlert).not.toHaveBeenCalled()
  })

  it('still succeeds when stitch throws', async () => {
    h.stitchFormSubmitIdentity.mockRejectedValue(new Error('identity graph down'))

    const result = await signup({ sessionId: SESSION_ID })

    expect(result).toEqual({ ok: true })
    expect(h.upsertListingAlert).toHaveBeenCalled()
  })

  it('does not stitch when sendEvent returns no person', async () => {
    h.sendEvent.mockResolvedValueOnce({ ok: false, status: 500 })

    const result = await signup({ sessionId: SESSION_ID })

    expect(result).toEqual({ ok: true })
    expect(h.stitchFormSubmitIdentity).not.toHaveBeenCalled()
    expect(h.upsertListingAlert).toHaveBeenCalled()
  })
})
