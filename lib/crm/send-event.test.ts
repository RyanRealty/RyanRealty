import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

type NativeLeadInput = {
  name?: string | null
  email?: string | null
  phone?: string | null
  source: string
  tags?: string[]
  assignedBroker?: string
  screen?: { honeypot?: boolean; note?: string | null }
}
type NativeLeadResult = { personId: number; created: boolean; quality?: { suspect: boolean; signals: string[] } }
const ensureNativeLeadMock = vi.fn(async (_input: NativeLeadInput): Promise<NativeLeadResult> => ({ personId: 1, created: true }))
vi.mock('@/lib/data/crm/ensureNativeLead', () => ({ ensureNativeLead: ensureNativeLeadMock }))

import { isPlaceholderLeadEmail, sendEvent } from './send-event'

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

describe('sendEvent (native capture)', () => {
  const person = { firstName: 'Jane', lastName: 'Doe', emails: [{ value: 'jane@example.com' }], phones: [{ value: '5415551234' }] }

  beforeEach(() => {
    ensureNativeLeadMock.mockClear()
    ensureNativeLeadMock.mockResolvedValue({ personId: 1, created: true })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not POST to a third-party CRM host', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await sendEvent({ type: 'Registration', source: 'Website', person })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('captures natively with mapped fields + source tag, returns the native shape with personId', async () => {
    const r = await sendEvent({ type: 'Registration', source: 'Buyer LP', person })
    expect(r).toEqual({ ok: true, status: 200, personId: 1, suspect: false })
    expect(ensureNativeLeadMock).toHaveBeenCalledTimes(1)
    const arg = ensureNativeLeadMock.mock.calls[0][0]
    expect(arg).toMatchObject({ name: 'Jane Doe', email: 'jane@example.com', phone: '5415551234', source: 'Buyer LP' })
    expect(arg.tags).toContain('source:Buyer LP')
  })

  it('returns the native personId from ensureNativeLead', async () => {
    ensureNativeLeadMock.mockResolvedValueOnce({ personId: 4242, created: true })
    const r = await sendEvent({ type: 'Seller Inquiry', source: 'Seller LP', person })
    expect(r).toEqual({ ok: true, status: 200, personId: 4242, suspect: false })
  })

  it('surfaces a skipped native capture (no key) as personId null', async () => {
    ensureNativeLeadMock.mockResolvedValueOnce({ personId: 0, created: false })
    const r = await sendEvent({ type: 'Viewed Page', source: 'Website', person: {} })
    expect(r).toEqual({ ok: true, status: 200, personId: null, suspect: false })
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

  // FUNNEL-1 (2026-09-23): sendEvent is the public write entry, so it screens by
  // default, carries the form's honeypot, and reports the verdict to the caller.
  it('screens by default and forwards the honeypot and the message', async () => {
    await sendEvent({ type: 'General Inquiry', source: 'contact-form', person, message: '[Buying] hi', screen: { honeypot: true } })
    expect(ensureNativeLeadMock.mock.calls[0][0].screen).toEqual({ honeypot: true, note: '[Buying] hi' })
    await sendEvent({ type: 'General Inquiry', source: 'contact-form', person })
    expect(ensureNativeLeadMock.mock.calls[1][0].screen).toEqual({ honeypot: false, note: null })
  })

  it('a broker keying a contact in by hand opts out of the screen', async () => {
    await sendEvent({ type: 'General Inquiry', source: 'Manual entry', person, screen: false })
    expect(ensureNativeLeadMock.mock.calls[0][0].screen).toBeUndefined()
  })

  it('reports a suspect verdict to the caller', async () => {
    ensureNativeLeadMock.mockResolvedValueOnce({ personId: 9, created: true, quality: { suspect: true, signals: ['honeypot'] } })
    expect(await sendEvent({ type: 'General Inquiry', source: 'contact-form', person })).toEqual({
      ok: true,
      status: 200,
      personId: 9,
      suspect: true,
    })
  })

  it('returns a failure result (never throws) when native capture fails', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    ensureNativeLeadMock.mockRejectedValueOnce(new Error('db down'))
    expect(await sendEvent({ type: 'Registration', source: 'S', person })).toEqual({ ok: false, error: 'native capture failed' })
    errSpy.mockRestore()
  })
})
