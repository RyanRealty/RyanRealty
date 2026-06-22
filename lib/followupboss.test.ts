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

import { isPlaceholderFubEmail, sendEvent } from './followupboss'

// Lead-create path (audit p3.2). Placeholder emails (@placeholder.ryan-realty.com)
// are synthetic stand-ins for leads with no real email. They must be recognized so
// they are never treated as a real dedup key or a deliverable address.
describe('isPlaceholderFubEmail', () => {
  it('matches the placeholder domain (case-insensitive, trimmed)', () => {
    expect(isPlaceholderFubEmail('lead123@placeholder.ryan-realty.com')).toBe(true)
    expect(isPlaceholderFubEmail('  X@PLACEHOLDER.Ryan-Realty.com  ')).toBe(true)
  })
  it('rejects real addresses and empty input', () => {
    expect(isPlaceholderFubEmail('buyer@gmail.com')).toBe(false)
    expect(isPlaceholderFubEmail('matt@ryan-realty.com')).toBe(false)
    expect(isPlaceholderFubEmail('')).toBe(false)
    expect(isPlaceholderFubEmail(null)).toBe(false)
    expect(isPlaceholderFubEmail(undefined)).toBe(false)
  })
})

const ORIG_KEY = process.env.FOLLOWUPBOSS_API_KEY
const ORIG_FUB = process.env.FUB_API_KEY

// sendEvent is the FUB /v1/events lead-create path (one of the plan's 5 critical
// paths). It must fail closed without a key (never crash, never silently "succeed"),
// build the correct event payload, and surface API/network errors honestly.
describe('sendEvent (FUB lead-create)', () => {
  const person = { firstName: 'Jane', lastName: 'Doe', emails: [{ value: 'jane@example.com' }] }

  beforeEach(() => {
    process.env.FOLLOWUPBOSS_API_KEY = 'test-key'
    delete process.env.FUB_API_KEY
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    if (ORIG_KEY === undefined) delete process.env.FOLLOWUPBOSS_API_KEY
    else process.env.FOLLOWUPBOSS_API_KEY = ORIG_KEY
    if (ORIG_FUB === undefined) delete process.env.FUB_API_KEY
    else process.env.FUB_API_KEY = ORIG_FUB
  })

  it('fails closed without an API key and does not hit the network', async () => {
    delete process.env.FOLLOWUPBOSS_API_KEY
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const r = await sendEvent({ type: 'Registration', source: 'Website', person })
    expect(r).toEqual({ ok: false, error: 'FollowUp Boss not configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('POSTs the event payload to /v1/events with Basic auth and the default system', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    await sendEvent({ type: 'Registration', source: 'Buyer LP', person, message: 'hi' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.followupboss.com/v1/events')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toMatch(/^Basic /)
    const body = JSON.parse(init.body as string)
    expect(body).toMatchObject({ type: 'Registration', source: 'Buyer LP', system: 'Ryan Realty Website', message: 'hi' })
    expect(body.person).toEqual(person)
  })

  it('omits optional fields that are absent or empty (no property / campaign / message)', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    await sendEvent({ type: 'Registration', source: 'X', person, property: {}, campaign: { source: '' } })
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect('property' in body).toBe(false)
    expect('campaign' in body).toBe(false)
    expect('message' in body).toBe(false)
  })

  it('returns ok on a 204', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
    expect(await sendEvent({ type: 'Registration', source: 'S', person })).toEqual({ ok: true, status: 204 })
  })

  it('surfaces the parsed error on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'bad request' }), { status: 400 })))
    expect(await sendEvent({ type: 'Registration', source: 'S', person })).toEqual({
      ok: false,
      status: 400,
      error: 'bad request',
    })
  })

  it('returns a network-error result when fetch throws', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('boom')
    }))
    expect(await sendEvent({ type: 'Registration', source: 'S', person })).toEqual({
      ok: false,
      error: 'FUB network error',
    })
    errSpy.mockRestore()
  })
})
