import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the service client BEFORE importing the module under test so the
// resolver picks up the fake query builder. The pure helpers are imported the
// same way and are unaffected by the mock.
const mockFrom = vi.fn()
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}))

import {
  normalizeEmail,
  normalizePhone,
  dedupeContactPoints,
  resolvePersonIdentity,
} from './resolvePersonIdentity'

describe('resolvePersonIdentity pure helpers', () => {
  describe('normalizeEmail', () => {
    it('lowercases and trims', () => {
      expect(normalizeEmail('  Matt@Ryan-Realty.COM ')).toBe('matt@ryan-realty.com')
    })
    it('returns null for empty / nullish', () => {
      expect(normalizeEmail('')).toBeNull()
      expect(normalizeEmail('   ')).toBeNull()
      expect(normalizeEmail(null)).toBeNull()
      expect(normalizeEmail(undefined)).toBeNull()
    })
  })

  describe('normalizePhone', () => {
    it('reduces to last 10 digits, stripping formatting and country code', () => {
      expect(normalizePhone('+1 (541) 213-6706')).toBe('5412136706')
      expect(normalizePhone('541.213.6706')).toBe('5412136706')
      expect(normalizePhone('15412136706')).toBe('5412136706')
    })
    it('keeps short numbers as their digits and returns null for empty', () => {
      expect(normalizePhone('12345')).toBe('12345')
      expect(normalizePhone('')).toBeNull()
      expect(normalizePhone(null)).toBeNull()
    })
  })

  describe('dedupeContactPoints', () => {
    it('native-only person: normalizes + dedupes a single email + phone', () => {
      const out = dedupeContactPoints([
        { kind: 'email', value: 'New.Lead@Example.com' },
        { kind: 'phone', value: '(541) 555-0100' },
      ])
      expect(out.emails).toEqual(['new.lead@example.com'])
      expect(out.phones).toEqual(['5415550100'])
    })

    it('multi-email person: dedupes case/format variants, preserves first-seen order', () => {
      const out = dedupeContactPoints([
        { kind: 'email', value: 'Primary@Example.com' },
        { kind: 'email', value: 'primary@example.com' }, // dup by case
        { kind: 'email', value: 'second@example.com' },
        { kind: 'phone', value: '+1-541-555-0100' },
        { kind: 'phone', value: '5415550100' }, // dup by format
        { kind: 'phone', value: '5415550200' },
      ])
      expect(out.emails).toEqual(['primary@example.com', 'second@example.com'])
      expect(out.phones).toEqual(['5415550100', '5415550200'])
    })

    it('ignores unknown kinds and skips empty values', () => {
      const out = dedupeContactPoints([
        { kind: 'address', value: '123 Main St' },
        { kind: 'email', value: '' },
        { kind: 'EMAIL', value: 'Mixed@Case.com' }, // kind is case-insensitive
        { kind: 'phone', value: null },
      ])
      expect(out.emails).toEqual(['mixed@case.com'])
      expect(out.phones).toEqual([])
    })
  })
})

// --- Full resolver against a mocked PostgREST query builder ----------------

type TableData = {
  crm_people?: { data: { id: number; fub_legacy_id: number | null } | null; error: unknown }
  crm_contact_points?: Array<{ kind: string; value: string }>
  visitor_identity_map?: Array<{ user_id: string | null; session_id: string | null }>
  visitor_sessions?: Array<{ session_id: string }>
}

// Build a chainable thenable that resolves to { data } for list reads and
// supports .maybeSingle() for the single-row crm_people read.
function makeBuilder(rows: { data: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = chain
  builder.eq = chain
  builder.or = chain
  builder.limit = chain
  builder.maybeSingle = () => Promise.resolve(rows)
  // For list reads the code awaits the builder directly.
  ;(builder as { then: unknown }).then = (resolve: (v: unknown) => unknown) => resolve(rows)
  return builder
}

function installTables(tables: TableData) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'crm_people') {
      return makeBuilder(tables.crm_people ?? { data: null, error: null })
    }
    if (table === 'crm_contact_points') {
      return makeBuilder({ data: tables.crm_contact_points ?? [], error: null })
    }
    if (table === 'visitor_identity_map') {
      return makeBuilder({ data: tables.visitor_identity_map ?? [], error: null })
    }
    if (table === 'visitor_sessions') {
      return makeBuilder({ data: tables.visitor_sessions ?? [], error: null })
    }
    return makeBuilder({ data: [], error: null })
  })
}

describe('resolvePersonIdentity resolver (mocked client)', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it('returns the empty bundle for a non-positive id without hitting the DB', async () => {
    installTables({})
    const out = await resolvePersonIdentity(0)
    expect(out).toEqual({
      crmPersonId: 0,
      fubLegacyId: null,
      emails: [],
      phones: [],
      authUserId: null,
      sessionIds: [],
    })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('FORK native-only: no fub_legacy_id, resolves authUserId + session from the identity map by email', async () => {
    installTables({
      crm_people: { data: { id: 42, fub_legacy_id: null }, error: null },
      crm_contact_points: [
        { kind: 'email', value: 'native@example.com' },
        { kind: 'phone', value: '(541) 555-0100' },
      ],
      visitor_identity_map: [{ user_id: 'auth-uuid-1', session_id: 'sess-native' }],
      // visitor_sessions is NOT queried for a native lead (no fub id).
    })
    const out = await resolvePersonIdentity(42)
    expect(out.fubLegacyId).toBeNull()
    expect(out.emails).toEqual(['native@example.com'])
    expect(out.phones).toEqual(['5415550100'])
    expect(out.authUserId).toBe('auth-uuid-1')
    expect(out.sessionIds).toEqual(['sess-native'])
    // visitor_sessions is skipped when there is no fub id.
    expect(mockFrom).not.toHaveBeenCalledWith('visitor_sessions')
  })

  it('FORK fub-only: carries fub_legacy_id, unions identity-map + direct visitor_sessions, no auth uuid', async () => {
    installTables({
      crm_people: { data: { id: 7, fub_legacy_id: 99001 }, error: null },
      crm_contact_points: [{ kind: 'email', value: 'Fub.Lead@Example.com' }],
      visitor_identity_map: [{ user_id: null, session_id: 'sess-a' }],
      visitor_sessions: [{ session_id: 'sess-a' }, { session_id: 'sess-b' }],
    })
    const out = await resolvePersonIdentity(7)
    expect(out.fubLegacyId).toBe(99001)
    expect(out.emails).toEqual(['fub.lead@example.com'])
    expect(out.authUserId).toBeNull()
    // dedupe across identity-map + direct sessions, order preserved.
    expect(out.sessionIds).toEqual(['sess-a', 'sess-b'])
    expect(mockFrom).toHaveBeenCalledWith('visitor_sessions')
  })

  it('FORK both / multi-email: multiple emails feed the identity-map lookup, first non-null user_id wins', async () => {
    installTables({
      crm_people: { data: { id: 13, fub_legacy_id: 12345 }, error: null },
      crm_contact_points: [
        { kind: 'email', value: 'Primary@Example.com' },
        { kind: 'email', value: 'primary@example.com' },
        { kind: 'email', value: 'alt@example.com' },
        { kind: 'phone', value: '+1 541 555 0100' },
      ],
      visitor_identity_map: [
        { user_id: null, session_id: 'sess-1' },
        { user_id: 'auth-uuid-9', session_id: 'sess-2' },
      ],
      visitor_sessions: [{ session_id: 'sess-2' }, { session_id: 'sess-3' }],
    })
    const out = await resolvePersonIdentity(13)
    expect(out.fubLegacyId).toBe(12345)
    expect(out.emails).toEqual(['primary@example.com', 'alt@example.com'])
    expect(out.phones).toEqual(['5415550100'])
    expect(out.authUserId).toBe('auth-uuid-9')
    expect(out.sessionIds).toEqual(['sess-1', 'sess-2', 'sess-3'])
  })

  it('returns the empty bundle when the person row is missing', async () => {
    installTables({
      crm_people: { data: null, error: null },
    })
    const out = await resolvePersonIdentity(999)
    expect(out).toEqual({
      crmPersonId: 999,
      fubLegacyId: null,
      emails: [],
      phones: [],
      authUserId: null,
      sessionIds: [],
    })
  })
})
