import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { syncCrmAudience, CRM_AUDIENCE_NAME } from './audienceUpload'
import type { AudienceEligiblePerson } from '@/lib/data/crm/getAudienceEligiblePeople'

// A tiny eligible population the mocked reader returns.
function fakeReader(
  people: AudienceEligiblePerson[],
  excludedSuppressed: number,
): typeof import('@/lib/data/crm/getAudienceEligiblePeople').getAudienceEligiblePeople {
  return async () => ({ people, excludedSuppressed })
}

const PEOPLE: AudienceEligiblePerson[] = [
  { personId: 1, firstName: 'John', lastName: 'Smith', emails: ['john@test.com'], phones: ['5551234567'] },
  { personId: 2, firstName: 'Jane', lastName: 'Doe', emails: ['jane@test.com'], phones: [] },
  // name-only -> unhashable, must be skipped (no email AND no phone).
  { personId: 3, firstName: 'No', lastName: 'Keys', emails: [], phones: [] },
]

describe('syncCrmAudience -- dry run (default)', () => {
  const origFlag = process.env.META_AUDIENCE_PUSH_ENABLED
  afterEach(() => {
    if (origFlag === undefined) delete process.env.META_AUDIENCE_PUSH_ENABLED
    else process.env.META_AUDIENCE_PUSH_ENABLED = origFlag
    vi.restoreAllMocks()
  })

  it('returns the dry-run shape and NEVER calls Meta by default', async () => {
    const fetchSpy = vi.fn()
    const out = await syncCrmAudience({
      readEligible: fakeReader(PEOPLE, 7),
      fetchImpl: fetchSpy as unknown as typeof fetch,
    })

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(out.dryRun).toBe(true)
    expect(out.dryRunReason).toBe('requested')
    // 2 hashable people (john, jane); the name-only row is skipped.
    expect(out.wouldUpload).toBe(2)
    expect(out.excludedSuppressed).toBe(7)
    expect(out.skippedUnhashable).toBe(1)
    expect(out.audienceName).toBe(CRM_AUDIENCE_NAME)
    // sampleHash carries only HASHED ids -- 64-char hex, no raw PII.
    expect(out.sampleHash.length).toBeGreaterThan(0)
    for (const rec of out.sampleHash) {
      for (const v of Object.values(rec)) {
        expect(v).toMatch(/^[0-9a-f]{64}$/)
      }
    }
    const serialized = JSON.stringify(out.sampleHash)
    expect(serialized).not.toContain('john@test.com')
    expect(serialized).not.toContain('5551234567')
  })

  it('stays dry even with dryRun:false when the env flag is not set', async () => {
    delete process.env.META_AUDIENCE_PUSH_ENABLED
    const fetchSpy = vi.fn()
    const out = await syncCrmAudience({
      dryRun: false,
      readEligible: fakeReader(PEOPLE, 0),
      fetchImpl: fetchSpy as unknown as typeof fetch,
    })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(out.dryRun).toBe(true)
    expect(out.dryRunReason).toBe('flag-disabled')
  })

  it('stays dry with dryRun:false when the flag is a near-miss value', async () => {
    process.env.META_AUDIENCE_PUSH_ENABLED = 'TRUE'
    const fetchSpy = vi.fn()
    const out = await syncCrmAudience({
      dryRun: false,
      readEligible: fakeReader(PEOPLE, 0),
      fetchImpl: fetchSpy as unknown as typeof fetch,
    })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(out.dryRun).toBe(true)
    expect(out.dryRunReason).toBe('flag-disabled')
  })
})

describe('syncCrmAudience -- live path (flag set + dryRun:false)', () => {
  const origFlag = process.env.META_AUDIENCE_PUSH_ENABLED
  const origToken = process.env.META_USER_ACCESS_TOKEN
  const origAcct = process.env.META_AD_ACCOUNT_ID

  beforeEach(() => {
    process.env.META_AUDIENCE_PUSH_ENABLED = 'true'
    process.env.META_USER_ACCESS_TOKEN = 'test-token'
    process.env.META_AD_ACCOUNT_ID = 'act_1178780510184911'
  })
  afterEach(() => {
    const restore = (k: string, v: string | undefined) =>
      v === undefined ? delete process.env[k] : (process.env[k] = v)
    restore('META_AUDIENCE_PUSH_ENABLED', origFlag)
    restore('META_USER_ACCESS_TOKEN', origToken)
    restore('META_AD_ACCOUNT_ID', origAcct)
    vi.restoreAllMocks()
  })

  it('creates the audience then pushes hashed users in the MULTI_KEY schema', async () => {
    const calls: Array<{ url: string; body: unknown }> = []
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : undefined
      const method = (init?.method ?? 'GET').toUpperCase()
      calls.push({ url, body })
      if (url.includes('/users')) {
        // POST hashed users.
        return new Response(JSON.stringify({ num_received: 2, num_invalid_entries: 0 }), { status: 200 })
      }
      if (method === 'GET') {
        // GET existing list -> empty so we create.
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      // POST create audience.
      return new Response(JSON.stringify({ id: 'aud-123' }), { status: 200 })
    })

    const out = await syncCrmAudience({
      dryRun: false,
      readEligible: fakeReader(PEOPLE, 3),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(out.dryRun).toBe(false)
    expect(out.audienceId).toBe('aud-123')
    expect(out.numReceived).toBe(2)
    expect(out.numInvalid).toBe(0)
    expect(out.excludedSuppressed).toBe(3)

    const usersCall = calls.find((c) => c.url.includes('/users'))
    expect(usersCall).toBeDefined()
    const payload = (usersCall!.body as { payload: { schema: string[]; data: string[][] } }).payload
    expect(payload.schema).toEqual(['EMAIL', 'PHONE', 'FN', 'LN'])
    // 2 hashable rows, each a 4-column positional row of hashes/empties.
    expect(payload.data).toHaveLength(2)
    for (const row of payload.data) {
      expect(row).toHaveLength(4)
      for (const cell of row) {
        expect(cell === '' || /^[0-9a-f]{64}$/.test(cell)).toBe(true)
      }
    }
    // No raw PII anywhere in the outbound payload.
    expect(JSON.stringify(payload)).not.toContain('john@test.com')
  })

  it('falls back to dry when creds are missing even with the flag + dryRun:false', async () => {
    delete process.env.META_USER_ACCESS_TOKEN
    const fetchSpy = vi.fn()
    const out = await syncCrmAudience({
      dryRun: false,
      readEligible: fakeReader(PEOPLE, 0),
      fetchImpl: fetchSpy as unknown as typeof fetch,
    })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(out.dryRun).toBe(true)
    expect(out.errors).toContain('missing META_USER_ACCESS_TOKEN')
  })
})
