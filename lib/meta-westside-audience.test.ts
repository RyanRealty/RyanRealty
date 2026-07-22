import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'
import {
  WESTSIDE_AUDIENCE_ID,
  WESTSIDE_SCHEMA,
  normalizeCity,
  normalizeStateCode,
  normalizeZip,
  isRealtorTagged,
  buildWestsidePayload,
  loadWestsideInputs,
  resolveWestsideRunMode,
  refreshWestsideAudience,
  summarizeWestsideRun,
  type WestsideInputs,
  type WestsideParcelRow,
  type WestsidePersonRow,
  type WestsideRefreshResult,
} from './meta-westside-audience'
import { META_MIN_AUDIENCE_SIZE } from '@/lib/meta/audienceLedger'

const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')

function parcel(overrides: Partial<WestsideParcelRow> = {}): WestsideParcelRow {
  return {
    apn: 'APN-1',
    owner1_first: 'John',
    owner1_last: 'Smith',
    mail_city: 'Bend',
    mail_state: 'OR',
    mail_zip: '97703',
    site_zip: null,
    person_id: null,
    ...overrides,
  }
}

function person(overrides: Partial<WestsidePersonRow> = {}): WestsidePersonRow {
  return {
    id: 1,
    tags: [],
    emails: [],
    phones: [],
    first_name: null,
    last_name: null,
    ...overrides,
  }
}

const META_ENV_KEYS = [
  'META_AUDIENCE_PUSH_ENABLED',
  'META_PAGE_ACCESS_TOKEN',
  'META_PAGE_TOKEN',
  'META_USER_ACCESS_TOKEN',
  'META_USER_ACCESS_TOKEN_USER',
] as const

const savedEnv: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const k of META_ENV_KEYS) {
    savedEnv[k] = process.env[k]
    delete process.env[k]
  }
})
afterEach(() => {
  for (const k of META_ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k]
    else process.env[k] = savedEnv[k]
  }
  vi.restoreAllMocks()
})

// ── Location normalizers ─────────────────────────────────────────────────────

describe('location normalizers (Meta CT/ST/ZIP spec)', () => {
  it('normalizeCity lowercases and strips non-letters', () => {
    expect(normalizeCity('Bend')).toBe('bend')
    expect(normalizeCity('La Pine')).toBe('lapine')
    expect(normalizeCity("  Coeur d'Alene ")).toBe('coeurdalene')
    expect(normalizeCity(null)).toBe('')
    expect(normalizeCity(undefined)).toBe('')
  })

  it('normalizeStateCode returns a 2-letter lowercase code', () => {
    expect(normalizeStateCode('OR')).toBe('or')
    expect(normalizeStateCode('Oregon')).toBe('or')
    expect(normalizeStateCode(' wa ')).toBe('wa')
    expect(normalizeStateCode(null)).toBe('')
  })

  it('normalizeZip keeps the first 5 digits', () => {
    expect(normalizeZip('97703-1234')).toBe('97703')
    expect(normalizeZip(' 97703 ')).toBe('97703')
    expect(normalizeZip('abc')).toBe('')
    expect(normalizeZip(null)).toBe('')
  })
})

// ── Realtor tag detection ────────────────────────────────────────────────────

describe('isRealtorTagged', () => {
  it('matches any realtor/industry keyword, case-insensitive, as substring', () => {
    expect(isRealtorTagged(['Realtor'])).toBe(true)
    expect(isRealtorTagged(['principal-BROKER'])).toBe(true)
    expect(isRealtorTagged(['industry:realtor'])).toBe(true)
    expect(isRealtorTagged(['listing agent'])).toBe(true)
    expect(isRealtorTagged(['seller-lead', 'westside'])).toBe(false)
    expect(isRealtorTagged([])).toBe(false)
    expect(isRealtorTagged(null)).toBe(false)
    expect(isRealtorTagged(undefined)).toBe(false)
  })
})

// ── Pure payload builder ─────────────────────────────────────────────────────

describe('buildWestsidePayload -- exclusions', () => {
  it('excludes parcels whose linked person is hard-stop suppressed', () => {
    const inputs: WestsideInputs = {
      parcels: [parcel({ apn: 'A', person_id: 10 }), parcel({ apn: 'B' })],
      suppressedPersonIds: [10],
      people: [person({ id: 10, first_name: 'Sue', last_name: 'Pressed' })],
    }
    const out = buildWestsidePayload(inputs)
    expect(out.counts.excludedSuppressed).toBe(1)
    expect(out.counts.eligible).toBe(1)
    expect(out.rows).toHaveLength(1)
  })

  it('excludes parcels whose linked person carries a realtor tag', () => {
    const inputs: WestsideInputs = {
      parcels: [parcel({ apn: 'A', person_id: 11 }), parcel({ apn: 'B' })],
      suppressedPersonIds: [],
      people: [person({ id: 11, tags: ['industry:realtor'] })],
    }
    const out = buildWestsidePayload(inputs)
    expect(out.counts.excludedRealtors).toBe(1)
    expect(out.counts.eligible).toBe(1)
  })

  it('suppression outranks realtor tagging in the counts (script order)', () => {
    const inputs: WestsideInputs = {
      parcels: [parcel({ person_id: 12 })],
      suppressedPersonIds: [12],
      people: [person({ id: 12, tags: ['realtor'] })],
    }
    const out = buildWestsidePayload(inputs)
    expect(out.counts.excludedSuppressed).toBe(1)
    expect(out.counts.excludedRealtors).toBe(0)
  })

  it('skips parcels missing owner1_first or owner1_last', () => {
    const inputs: WestsideInputs = {
      parcels: [
        parcel({ apn: 'A', owner1_first: null }),
        parcel({ apn: 'B', owner1_last: '' }),
        parcel({ apn: 'C' }),
      ],
      suppressedPersonIds: [],
      people: [],
    }
    const out = buildWestsidePayload(inputs)
    expect(out.counts.skippedMissingName).toBe(2)
    expect(out.counts.eligible).toBe(1)
  })

  it('includes unlinked parcels with name+location keys only', () => {
    const out = buildWestsidePayload({
      parcels: [parcel()],
      suppressedPersonIds: [],
      people: [],
    })
    expect(out.rows).toHaveLength(1)
    const [email, phone, fn, ln, ct, st, zip] = out.rows[0]
    expect(email).toBe('')
    expect(phone).toBe('')
    expect(fn).toBe(sha('john'))
    expect(ln).toBe(sha('smith'))
    expect(ct).toBe(sha('bend'))
    expect(st).toBe(sha('or'))
    expect(zip).toBe(sha('97703'))
    expect(out.counts.withEmail).toBe(0)
    expect(out.counts.withPhone).toBe(0)
  })
})

describe('buildWestsidePayload -- hashing and CRM preference', () => {
  it('hashes the linked person email/phone/name, preferring CRM data over the parcel', () => {
    const inputs: WestsideInputs = {
      parcels: [parcel({ person_id: 20, owner1_first: 'Deed', owner1_last: 'Name' })],
      suppressedPersonIds: [],
      people: [
        person({
          id: 20,
          emails: ['Jane@Test.com'],
          phones: ['(541) 555-1234'],
          first_name: "Jane-Marie",
          last_name: "O'Brien",
        }),
      ],
    }
    const out = buildWestsidePayload(inputs)
    const [email, phone, fn, ln] = out.rows[0]
    expect(email).toBe(sha('jane@test.com'))
    expect(phone).toBe(sha('15415551234'))
    // Canonical name normalization: punctuation + whitespace stripped.
    expect(fn).toBe(sha('janemarie'))
    expect(ln).toBe(sha('obrien'))
    expect(out.counts.withEmail).toBe(1)
    expect(out.counts.withPhone).toBe(1)
  })

  it('unwraps { value } contact objects (crm_people jsonb shape)', () => {
    const inputs: WestsideInputs = {
      parcels: [parcel({ person_id: 21 })],
      suppressedPersonIds: [],
      people: [
        person({
          id: 21,
          emails: [{ value: 'obj@test.com' }] as unknown as readonly unknown[],
          phones: [{ value: '5415557777' }] as unknown as readonly unknown[],
        }),
      ],
    }
    const out = buildWestsidePayload(inputs)
    expect(out.rows[0][0]).toBe(sha('obj@test.com'))
    expect(out.rows[0][1]).toBe(sha('15415557777'))
  })

  it('falls back to parcel owner name when the linked person has none', () => {
    const inputs: WestsideInputs = {
      parcels: [parcel({ person_id: 22, owner1_first: 'Deed', owner1_last: 'Holder' })],
      suppressedPersonIds: [],
      people: [person({ id: 22 })],
    }
    const out = buildWestsidePayload(inputs)
    expect(out.rows[0][2]).toBe(sha('deed'))
    expect(out.rows[0][3]).toBe(sha('holder'))
  })

  it('drops invalid email/phone instead of hashing garbage', () => {
    const inputs: WestsideInputs = {
      parcels: [parcel({ person_id: 23 })],
      suppressedPersonIds: [],
      people: [person({ id: 23, emails: ['not-an-email'], phones: ['555'] })],
    }
    const out = buildWestsidePayload(inputs)
    expect(out.rows[0][0]).toBe('')
    expect(out.rows[0][1]).toBe('')
    expect(out.counts.withEmail).toBe(0)
    expect(out.counts.withPhone).toBe(0)
  })

  it('applies the Bend/OR defaults and the mail_zip -> site_zip fallback', () => {
    const inputs: WestsideInputs = {
      parcels: [parcel({ mail_city: null, mail_state: null, mail_zip: null, site_zip: '97701' })],
      suppressedPersonIds: [],
      people: [],
    }
    const out = buildWestsidePayload(inputs)
    expect(out.rows[0][4]).toBe(sha('bend'))
    expect(out.rows[0][5]).toBe(sha('or'))
    expect(out.rows[0][6]).toBe(sha('97701'))
  })

  it('emits ONLY 64-char hex or empty cells -- no raw PII in the payload', () => {
    const inputs: WestsideInputs = {
      parcels: [
        parcel({ person_id: 24 }),
        parcel({ apn: 'APN-2', owner1_first: 'Alice', owner1_last: 'Jones' }),
      ],
      suppressedPersonIds: [],
      people: [person({ id: 24, emails: ['john@test.com'], phones: ['5415550000'] })],
    }
    const out = buildWestsidePayload(inputs)
    expect(out.schema).toEqual(WESTSIDE_SCHEMA)
    for (const row of out.rows) {
      expect(row).toHaveLength(WESTSIDE_SCHEMA.length)
      for (const cell of row) {
        expect(cell === '' || /^[0-9a-f]{64}$/.test(cell)).toBe(true)
      }
    }
    const serialized = JSON.stringify(out.rows)
    expect(serialized).not.toContain('john@test.com')
    expect(serialized).not.toContain('5415550000')
    expect(serialized).not.toContain('Alice')
    expect(serialized).not.toContain('Smith')
  })

  it('reports totals: totalParcels, linkedParcels, eligible', () => {
    const inputs: WestsideInputs = {
      parcels: [
        parcel({ apn: 'A', person_id: 30 }),
        parcel({ apn: 'B' }),
        parcel({ apn: 'C', owner1_first: null }),
      ],
      suppressedPersonIds: [],
      people: [person({ id: 30 })],
    }
    const out = buildWestsidePayload(inputs)
    expect(out.counts.totalParcels).toBe(3)
    expect(out.counts.linkedParcels).toBe(1)
    expect(out.counts.eligible).toBe(2)
  })
})

// ── Run-mode double-gate ─────────────────────────────────────────────────────

describe('resolveWestsideRunMode (the double-gate, pure)', () => {
  it('requested dry-run always wins', () => {
    expect(
      resolveWestsideRunMode({ dryRunRequested: true, pushFlagEnabled: true, enforcePushFlag: true }),
    ).toEqual({ dryRun: true, reason: 'requested' })
  })

  it('stays dry when the flag is enforced but disabled', () => {
    expect(
      resolveWestsideRunMode({ dryRunRequested: false, pushFlagEnabled: false, enforcePushFlag: true }),
    ).toEqual({ dryRun: true, reason: 'flag-disabled' })
  })

  it('goes live when the flag is enforced and enabled', () => {
    expect(
      resolveWestsideRunMode({ dryRunRequested: false, pushFlagEnabled: true, enforcePushFlag: true }),
    ).toEqual({ dryRun: false })
  })

  it('CLI posture (enforcePushFlag:false) ignores the env flag', () => {
    expect(
      resolveWestsideRunMode({ dryRunRequested: false, pushFlagEnabled: false, enforcePushFlag: false }),
    ).toEqual({ dryRun: false })
  })
})

// ── Input loading (injected fetch, no network) ───────────────────────────────

describe('loadWestsideInputs', () => {
  it('loads parcels, then chunked suppressions + people for linked ids', async () => {
    const parcels = [parcel({ apn: 'A', person_id: 1 }), parcel({ apn: 'B', person_id: 2 })]
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/westside_parcels')) {
        return new Response(JSON.stringify(parcels), { status: 200 })
      }
      if (url.includes('/crm_suppressions')) {
        expect(url).toContain('channel=eq.all')
        expect(url).toContain('person_id=in.(1,2)')
        return new Response(JSON.stringify([{ person_id: 2 }]), { status: 200 })
      }
      if (url.includes('/crm_people')) {
        expect(url).toContain('id=in.(1,2)')
        return new Response(
          JSON.stringify([person({ id: 1 }), person({ id: 2 })]),
          { status: 200 },
        )
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const out = await loadWestsideInputs({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      supabaseUrl: 'https://sb.test',
      supabaseKey: 'service-key',
    })
    expect(out.parcels).toHaveLength(2)
    expect(out.suppressedPersonIds).toEqual([2])
    expect(out.people).toHaveLength(2)
    // 1 parcels page + 1 suppressions + 1 people = 3 reads.
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('FAILS CLOSED: a failed suppressions read throws', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/westside_parcels')) {
        return new Response(JSON.stringify([parcel({ person_id: 1 })]), { status: 200 })
      }
      if (url.includes('/crm_suppressions')) {
        return new Response('boom', { status: 500 })
      }
      return new Response(JSON.stringify([]), { status: 200 })
    })
    await expect(
      loadWestsideInputs({
        fetchImpl: fetchImpl as unknown as typeof fetch,
        supabaseUrl: 'https://sb.test',
        supabaseKey: 'service-key',
      }),
    ).rejects.toThrow(/Supabase fetch failed \(500\)/)
  })

  it('throws when Supabase credentials are missing', async () => {
    const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    try {
      await expect(loadWestsideInputs()).rejects.toThrow(/missing NEXT_PUBLIC_SUPABASE_URL/)
    } finally {
      if (origUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl
      if (origKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = origKey
    }
  })
})

// ── The refresh: dry-run is provably network-free ────────────────────────────

const FIXTURE_INPUTS: WestsideInputs = {
  parcels: [
    parcel({ apn: 'A', person_id: 40 }),
    parcel({ apn: 'B', owner1_first: 'Alice', owner1_last: 'Jones' }),
    parcel({ apn: 'C', person_id: 41 }),
    parcel({ apn: 'D', owner1_first: null }),
  ],
  suppressedPersonIds: [41],
  people: [
    person({ id: 40, emails: ['john@test.com'], phones: ['5415550000'] }),
    person({ id: 41 }),
  ],
}

const fixtureReader = async () => FIXTURE_INPUTS

describe('refreshWestsideAudience -- dry run (default)', () => {
  it('makes ZERO Meta API calls by default (fetch never invoked)', async () => {
    const fetchSpy = vi.fn()
    const out = await refreshWestsideAudience({
      fetchImpl: fetchSpy as unknown as typeof fetch,
      readInputs: fixtureReader,
    })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(out.dryRun).toBe(true)
    expect(out.dryRunReason).toBe('requested')
    expect(out.audienceId).toBe(WESTSIDE_AUDIENCE_ID)
    expect(out.counts.eligible).toBe(2)
    expect(out.counts.excludedSuppressed).toBe(1)
    expect(out.counts.skippedMissingName).toBe(1)
    expect(out.numReceived).toBeUndefined()
  })

  it('stays dry with dryRun:false when META_AUDIENCE_PUSH_ENABLED is unset', async () => {
    const fetchSpy = vi.fn()
    const out = await refreshWestsideAudience({
      dryRun: false,
      fetchImpl: fetchSpy as unknown as typeof fetch,
      readInputs: fixtureReader,
    })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(out.dryRun).toBe(true)
    expect(out.dryRunReason).toBe('flag-disabled')
  })

  it('stays dry with dryRun:false when the flag is a near-miss value', async () => {
    process.env.META_AUDIENCE_PUSH_ENABLED = 'TRUE'
    const fetchSpy = vi.fn()
    const out = await refreshWestsideAudience({
      dryRun: false,
      fetchImpl: fetchSpy as unknown as typeof fetch,
      readInputs: fixtureReader,
    })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(out.dryRun).toBe(true)
    expect(out.dryRunReason).toBe('flag-disabled')
  })

  it('falls back to dry (missing-credentials) when live is requested without a token', async () => {
    process.env.META_AUDIENCE_PUSH_ENABLED = 'true'
    const fetchSpy = vi.fn()
    const out = await refreshWestsideAudience({
      dryRun: false,
      fetchImpl: fetchSpy as unknown as typeof fetch,
      readInputs: fixtureReader,
    })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(out.dryRun).toBe(true)
    expect(out.dryRunReason).toBe('missing-credentials')
    expect(out.errors).toHaveLength(1)
  })

  it('propagates an input-read failure BEFORE any Meta call (fail closed)', async () => {
    const fetchSpy = vi.fn()
    await expect(
      refreshWestsideAudience({
        dryRun: false,
        fetchImpl: fetchSpy as unknown as typeof fetch,
        readInputs: async () => {
          throw new Error('suppressions unavailable')
        },
      }),
    ).rejects.toThrow('suppressions unavailable')
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('refreshWestsideAudience -- live path (flag set + dryRun:false + token)', () => {
  beforeEach(() => {
    process.env.META_AUDIENCE_PUSH_ENABLED = 'true'
    process.env.META_PAGE_ACCESS_TOKEN = 'test-token'
  })

  it('POSTs hashed rows to the audience /users endpoint and sums Meta counts', async () => {
    const calls: Array<{ url: string; body: { payload: { schema: string[]; data: string[][] } } }> = []
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), body: JSON.parse(String(init?.body)) })
      return new Response(JSON.stringify({ num_received: 2, num_invalid_entries: 1 }), {
        status: 200,
      })
    })

    const out = await refreshWestsideAudience({
      dryRun: false,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      readInputs: fixtureReader,
    })

    expect(out.dryRun).toBe(false)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(calls[0].url).toContain(`/${WESTSIDE_AUDIENCE_ID}/users`)
    expect(calls[0].url).toContain('access_token=test-token')
    expect(calls[0].body.payload.schema).toEqual([...WESTSIDE_SCHEMA])
    expect(calls[0].body.payload.data).toHaveLength(2)
    // Every uploaded cell is hashed or empty -- no raw PII on the wire.
    for (const row of calls[0].body.payload.data) {
      for (const cell of row) {
        expect(cell === '' || /^[0-9a-f]{64}$/.test(cell)).toBe(true)
      }
    }
    expect(out.numReceived).toBe(2)
    expect(out.numInvalid).toBe(1)
    expect(out.errors).toHaveLength(0)
  })

  it('splits uploads into 5,000-row batches', async () => {
    const manyParcels = Array.from({ length: 5001 }, (_, i) =>
      parcel({ apn: `APN-${i}`, owner1_first: 'A', owner1_last: `B${i}` }),
    )
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { payload: { data: string[][] } }
      return new Response(
        JSON.stringify({ num_received: body.payload.data.length, num_invalid_entries: 0 }),
        { status: 200 },
      )
    })
    const out = await refreshWestsideAudience({
      dryRun: false,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      readInputs: async () => ({ parcels: manyParcels, suppressedPersonIds: [], people: [] }),
    })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(out.numReceived).toBe(5001)
  })

  it('records a failed batch as an error and keeps going', async () => {
    let call = 0
    const fetchImpl = vi.fn(async () => {
      call += 1
      if (call === 1) return new Response(JSON.stringify({ error: 'nope' }), { status: 400 })
      return new Response(JSON.stringify({ num_received: 1, num_invalid_entries: 0 }), {
        status: 200,
      })
    })
    const manyParcels = Array.from({ length: 5001 }, (_, i) =>
      parcel({ apn: `APN-${i}`, owner1_first: 'A', owner1_last: `B${i}` }),
    )
    const out = await refreshWestsideAudience({
      dryRun: false,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      readInputs: async () => ({ parcels: manyParcels, suppressedPersonIds: [], people: [] }),
    })
    expect(out.errors).toHaveLength(1)
    expect(out.errors[0]).toContain('400')
    expect(out.numReceived).toBe(1)
  })

  it('uses the system-user token when no page token is set', async () => {
    delete process.env.META_PAGE_ACCESS_TOKEN
    process.env.META_USER_ACCESS_TOKEN = 'su-token'
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      void input
      return new Response(JSON.stringify({ num_received: 2, num_invalid_entries: 0 }), {
        status: 200,
      })
    })
    const out = await refreshWestsideAudience({
      dryRun: false,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      readInputs: fixtureReader,
    })
    expect(out.dryRun).toBe(false)
    expect(String(fetchImpl.mock.calls[0][0])).toContain('access_token=su-token')
  })
})

// ── Ledger summary ───────────────────────────────────────────────────────────

describe('summarizeWestsideRun', () => {
  const baseResult: WestsideRefreshResult = {
    dryRun: true,
    dryRunReason: 'requested',
    audienceId: WESTSIDE_AUDIENCE_ID,
    audienceName: 'RR Westside Bend Homeowners',
    counts: {
      totalParcels: 100,
      linkedParcels: 40,
      excludedSuppressed: 3,
      excludedRealtors: 2,
      skippedMissingName: 5,
      eligible: 90,
      withEmail: 20,
      withPhone: 15,
    },
    errors: [],
  }

  it('maps a dry run into the shared AudienceRunSummary shape', () => {
    const s = summarizeWestsideRun(baseResult)
    expect(s.dryRun).toBe(true)
    expect(s.matchCount).toBe(90)
    expect(s.belowMinimumMatch).toBe(90 < META_MIN_AUDIENCE_SIZE)
    expect(s.add.wouldUpload).toBe(90)
    expect(s.add.excludedSuppressed).toBe(3)
    expect(s.add.excludedRealtors).toBe(2)
    expect(s.add.skippedUnhashable).toBe(5)
    expect(s.add.audienceId).toBe(WESTSIDE_AUDIENCE_ID)
    // The westside refresh has no remove leg -- structurally zero.
    expect(s.remove.requested).toBe(0)
    expect(s.remove.wouldRemove).toBe(0)
    expect(s.message).toContain('DRY')
    expect(s.message).toContain(WESTSIDE_AUDIENCE_ID)
  })

  it('uses numReceived as matchCount on a live run and clears the floor at 1000+', () => {
    const s = summarizeWestsideRun({
      ...baseResult,
      dryRun: false,
      dryRunReason: undefined,
      numReceived: 12000,
      numInvalid: 3,
    })
    expect(s.dryRun).toBe(false)
    expect(s.matchCount).toBe(12000)
    expect(s.belowMinimumMatch).toBe(false)
    expect(s.add.numReceived).toBe(12000)
    expect(s.add.numInvalid).toBe(3)
    expect(s.message).toContain('LIVE')
  })

  it('flags a below-floor population and carries errors through', () => {
    const s = summarizeWestsideRun({ ...baseResult, errors: ['batch@0: 400 {}'] })
    expect(s.belowMinimumMatch).toBe(true)
    expect(s.message).toContain('match floor')
    expect(s.errors).toEqual(['batch@0: 400 {}'])
    expect(s.message).toContain('1 error(s)')
  })
})
