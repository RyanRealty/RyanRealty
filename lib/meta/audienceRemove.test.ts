import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { decideRemoval, removeFromCrmAudience, type AudienceRemovePerson } from './audienceRemove'
import { CRM_AUDIENCE_NAME } from './audienceUpload'

const PEOPLE: AudienceRemovePerson[] = [
  { personId: 1, firstName: 'John', lastName: 'Smith', emails: ['john@test.com'], phones: ['5551234567'] },
  { personId: 2, firstName: 'Jane', lastName: 'Doe', emails: ['jane@test.com'], phones: [] },
  // name-only -> unhashable, must be skipped (no email AND no phone).
  { personId: 3, firstName: 'No', lastName: 'Keys', emails: [], phones: [] },
]

const fakeResolve = (people: AudienceRemovePerson[]) => async () => people

describe('decideRemoval (pure)', () => {
  it('hashes contactable people and skips unhashable ones', () => {
    const { records, skippedUnhashable } = decideRemoval(PEOPLE)
    expect(records).toHaveLength(2) // john, jane
    expect(skippedUnhashable).toBe(1) // the name-only row
    // Every emitted key is a 64-char SHA-256 hex -- no raw PII.
    for (const rec of records) {
      for (const v of Object.values(rec)) expect(v).toMatch(/^[0-9a-f]{64}$/)
    }
    expect(JSON.stringify(records)).not.toContain('john@test.com')
    expect(JSON.stringify(records)).not.toContain('5551234567')
  })

  it('returns no records for an empty input', () => {
    expect(decideRemoval([])).toEqual({ records: [], skippedUnhashable: 0 })
  })
})

describe('removeFromCrmAudience -- dry run (default)', () => {
  const origFlag = process.env.META_AUDIENCE_PUSH_ENABLED
  afterEach(() => {
    if (origFlag === undefined) delete process.env.META_AUDIENCE_PUSH_ENABLED
    else process.env.META_AUDIENCE_PUSH_ENABLED = origFlag
    vi.restoreAllMocks()
  })

  it('returns the dry-run shape and NEVER calls Meta by default', async () => {
    const fetchSpy = vi.fn()
    const out = await removeFromCrmAudience([1, 2, 3], {
      resolvePeople: fakeResolve(PEOPLE),
      fetchImpl: fetchSpy as unknown as typeof fetch,
    })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(out.dryRun).toBe(true)
    expect(out.dryRunReason).toBe('requested')
    expect(out.requested).toBe(3)
    expect(out.wouldRemove).toBe(2)
    expect(out.skippedUnhashable).toBe(1)
    expect(out.audienceName).toBe(CRM_AUDIENCE_NAME)
    for (const rec of out.sampleHash) {
      for (const v of Object.values(rec)) expect(v).toMatch(/^[0-9a-f]{64}$/)
    }
  })

  it('stays dry even with dryRun:false when the env flag is not set', async () => {
    delete process.env.META_AUDIENCE_PUSH_ENABLED
    const fetchSpy = vi.fn()
    const out = await removeFromCrmAudience([1, 2], {
      dryRun: false,
      resolvePeople: fakeResolve(PEOPLE),
      fetchImpl: fetchSpy as unknown as typeof fetch,
    })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(out.dryRun).toBe(true)
    expect(out.dryRunReason).toBe('flag-disabled')
  })

  it('stays dry with dryRun:false when the flag is a near-miss value', async () => {
    process.env.META_AUDIENCE_PUSH_ENABLED = 'TRUE'
    const fetchSpy = vi.fn()
    const out = await removeFromCrmAudience([1], {
      dryRun: false,
      resolvePeople: fakeResolve(PEOPLE),
      fetchImpl: fetchSpy as unknown as typeof fetch,
    })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(out.dryRun).toBe(true)
    expect(out.dryRunReason).toBe('flag-disabled')
  })
})

describe('removeFromCrmAudience -- live path (flag set + dryRun:false)', () => {
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

  it('finds the audience then DELETEs hashed users in the MULTI_KEY schema', async () => {
    const calls: Array<{ url: string; method: string; body: unknown }> = []
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase()
      const body = init?.body ? JSON.parse(String(init.body)) : undefined
      calls.push({ url, method, body })
      if (method === 'GET') {
        return new Response(JSON.stringify({ data: [{ id: 'aud-123', name: CRM_AUDIENCE_NAME }] }), { status: 200 })
      }
      // DELETE /users
      return new Response(JSON.stringify({ num_received: 2 }), { status: 200 })
    })

    const out = await removeFromCrmAudience([1, 2, 3], {
      dryRun: false,
      resolvePeople: fakeResolve(PEOPLE),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(out.dryRun).toBe(false)
    expect(out.audienceId).toBe('aud-123')
    expect(out.numRemoved).toBe(2)

    const del = calls.find((c) => c.method === 'DELETE')
    expect(del).toBeDefined()
    expect(del!.url).toContain('aud-123/users')
    const payload = (del!.body as { payload: { schema: string[]; data: string[][] } }).payload
    expect(payload.schema).toEqual(['EMAIL', 'PHONE', 'FN', 'LN'])
    expect(payload.data).toHaveLength(2)
    expect(JSON.stringify(payload)).not.toContain('john@test.com')
  })

  it('falls back to dry when creds are missing even with the flag + dryRun:false', async () => {
    delete process.env.META_USER_ACCESS_TOKEN
    const fetchSpy = vi.fn()
    const out = await removeFromCrmAudience([1], {
      dryRun: false,
      resolvePeople: fakeResolve(PEOPLE),
      fetchImpl: fetchSpy as unknown as typeof fetch,
    })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(out.dryRun).toBe(true)
    expect(out.errors).toContain('missing META_USER_ACCESS_TOKEN')
  })
})
