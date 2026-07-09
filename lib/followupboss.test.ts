import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// The CRM mirror calls createServiceClient() -> Supabase. Stub it so the sendEvent
// success path doesn't touch the network in tests.
vi.mock('./crm/mirror', () => ({
  mirrorSiteEvent: vi.fn(),
  mirrorEnrollmentToCrm: vi.fn(),
  mirrorNoteToCrm: vi.fn(),
  mirrorPersonFromFub: vi.fn(),
  mirrorTaskToCrm: vi.fn(),
}))

// FUB DECOMMISSIONED (2026-06-24): sendEvent now captures natively via
// ensureNativeLead and never touches FollowUp Boss. Mock the native writer.
type NativeLeadInput = { name?: string | null; email?: string | null; phone?: string | null; source: string; tags?: string[]; assignedBroker?: string }
const ensureNativeLeadMock = vi.fn(async (_input: NativeLeadInput) => ({ personId: 1, created: true }))
vi.mock('@/lib/data/crm/ensureNativeLead', () => ({ ensureNativeLead: ensureNativeLeadMock }))

import { isPlaceholderLeadEmail, sendEvent } from './followupboss'

// Lead-create path (audit p3.2). Placeholder emails (@placeholder.ryan-realty.com)
// are synthetic stand-ins for leads with no real email. They must be recognized so
// they are never treated as a real dedup key or a deliverable address.
describe('isPlaceholderLeadEmail', () => {
  it('matches the placeholder domain (case-insensitive, trimmed)', () => {
    expect(isPlaceholderLeadEmail('lead123@placeholder.ryan-realty.com')).toBe(true)
    expect(isPlaceholderLeadEmail('  X@PLACEHOLDER.Ryan-Realty.com  ')).toBe(true)
  })
  it('rejects real addresses and empty input', () => {
    expect(isPlaceholderLeadEmail('buyer@gmail.com')).toBe(false)
    expect(isPlaceholderLeadEmail('matt@ryan-realty.com')).toBe(false)
    expect(isPlaceholderLeadEmail('')).toBe(false)
    expect(isPlaceholderLeadEmail(null)).toBe(false)
    expect(isPlaceholderLeadEmail(undefined)).toBe(false)
  })
})

// sendEvent post-decommission: it captures the lead NATIVELY (ensureNativeLead)
// and NEVER posts to Follow Up Boss. It maps the event to native fields, infers
// the audience tag from the event type, and returns the native success shape.
describe('sendEvent (native capture, FUB decommissioned)', () => {
  const person = { firstName: 'Jane', lastName: 'Doe', emails: [{ value: 'jane@example.com' }], phones: [{ value: '5415551234' }] }

  beforeEach(() => {
    ensureNativeLeadMock.mockClear()
    ensureNativeLeadMock.mockResolvedValue({ personId: 1, created: true })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('never POSTs to FollowUp Boss', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await sendEvent({ type: 'Registration', source: 'Website', person })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('captures natively with mapped fields + source tag, returns the native shape with personId', async () => {
    const r = await sendEvent({ type: 'Registration', source: 'Buyer LP', person })
    expect(r).toEqual({ ok: true, status: 200, personId: 1 })
    expect(ensureNativeLeadMock).toHaveBeenCalledTimes(1)
    const arg = ensureNativeLeadMock.mock.calls[0][0]
    expect(arg).toMatchObject({ name: 'Jane Doe', email: 'jane@example.com', phone: '5415551234', source: 'Buyer LP' })
    expect(arg.tags).toContain('source:Buyer LP')
  })

  // BLOCKER fix: sendEvent must return the native personId so LP enrichment can
  // run against it. Previously it returned only { ok, status } and every
  // enrichment gated on the now-always-null fubPersonId never ran.
  it('returns the native personId from ensureNativeLead', async () => {
    ensureNativeLeadMock.mockResolvedValueOnce({ personId: 4242, created: true })
    const r = await sendEvent({ type: 'Seller Inquiry', source: 'Seller LP', person })
    expect(r).toEqual({ ok: true, status: 200, personId: 4242 })
  })

  it('surfaces a skipped native capture (no key) as personId null', async () => {
    // ensureNativeLead returns personId 0 when it skips (anonymous, no key).
    ensureNativeLeadMock.mockResolvedValueOnce({ personId: 0, created: false })
    const r = await sendEvent({ type: 'Viewed Page', source: 'Website', person: {} })
    expect(r).toEqual({ ok: true, status: 200, personId: null })
  })

  it('infers audience:seller from a Seller Inquiry', async () => {
    await sendEvent({ type: 'Seller Inquiry', source: 'Seller LP', person })
    expect(ensureNativeLeadMock.mock.calls[0][0].tags).toContain('audience:seller')
  })

  it('infers audience:buyer from a Property Inquiry', async () => {
    await sendEvent({ type: 'Property Inquiry', source: 'Listing', person })
    expect(ensureNativeLeadMock.mock.calls[0][0].tags).toContain('audience:buyer')
  })

  it('passes a valid broker attribution through as assignedBroker', async () => {
    await sendEvent({ type: 'Registration', source: 'S', person, brokerAttribution: { brokerSlug: 'rebecca' } })
    expect(ensureNativeLeadMock.mock.calls[0][0].assignedBroker).toBe('rebecca')
  })

  it('returns a failure result (never throws) when native capture fails', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    ensureNativeLeadMock.mockRejectedValueOnce(new Error('db down'))
    expect(await sendEvent({ type: 'Registration', source: 'S', person })).toEqual({ ok: false, error: 'native capture failed' })
    errSpy.mockRestore()
  })
})
