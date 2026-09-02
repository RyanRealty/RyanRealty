import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Authz tests for app/actions/search-areas.ts (named saved areas, Phase 2.4).
 * Lives under lib/ (like lib/crm/*.action.test.ts) so the vitest include glob
 * picks it up. Every action must refuse without a session; setAreaPublic must
 * additionally refuse non-broker sessions; every DAL write must carry the
 * session user id (never a client-passed one).
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

let session: { user: { id: string; email: string | null } } | null = null
vi.mock('@/app/actions/auth', () => ({
  getSession: () => Promise.resolve(session),
}))

let role: { role: string; brokerId: string | null } | null = null
vi.mock('@/app/actions/admin-roles', () => ({
  getAdminRoleForEmail: () => Promise.resolve(role),
}))

const calls: Array<{ fn: string; args: unknown[] }> = []
let dalOk = true
let ownedRow: Record<string, unknown> | null = null
vi.mock('@/lib/data', () => ({
  SEARCH_AREAS_CACHE_TAG: 'search-areas',
  createAreaForUser: (...args: unknown[]) => {
    calls.push({ fn: 'createAreaForUser', args })
    return Promise.resolve(dalOk ? { ok: true, id: 'a1' } : { ok: false, error: 'nope' })
  },
  updateAreaForUser: (...args: unknown[]) => {
    calls.push({ fn: 'updateAreaForUser', args })
    return Promise.resolve(dalOk ? { ok: true, id: 'a1' } : { ok: false, error: 'nope' })
  },
  deleteAreaForUser: (...args: unknown[]) => {
    calls.push({ fn: 'deleteAreaForUser', args })
    return Promise.resolve({ ok: dalOk, error: dalOk ? undefined : 'nope' })
  },
  getAreaForUser: (...args: unknown[]) => {
    calls.push({ fn: 'getAreaForUser', args })
    return Promise.resolve(ownedRow)
  },
  setAreaPublicById: (...args: unknown[]) => {
    calls.push({ fn: 'setAreaPublicById', args })
    return Promise.resolve(dalOk ? { ok: true, id: 'a1' } : { ok: false, error: 'nope' })
  },
}))

const revalidated: string[] = []
vi.mock('next/cache', () => ({
  revalidatePath: (p: string) => revalidated.push(`path:${p}`),
  revalidateTag: (t: string) => revalidated.push(`tag:${t}`),
}))

import {
  createArea,
  renameArea,
  deleteArea,
  setAreaPublic,
} from '@/app/actions/search-areas'

const SHAPES = [
  { type: 'polygon', coords: [[-121.4, 44.0], [-121.25, 44.0], [-121.25, 44.12]] },
]

beforeEach(() => {
  session = { user: { id: 'user-1', email: 'someone@example.com' } }
  role = null
  dalOk = true
  ownedRow = null
  calls.length = 0
  revalidated.length = 0
})

describe('search-areas actions — session gate', () => {
  it('every action refuses without a session and never touches the DAL', async () => {
    session = null
    expect((await createArea('Bend West Side', SHAPES)).error).toBe('Not signed in')
    expect((await renameArea('a1', 'New name')).error).toBe('Not signed in')
    expect((await deleteArea('a1')).error).toBe('Not signed in')
    expect((await setAreaPublic('a1', true, 'bend-west-side')).error).toBe('Not signed in')
    expect(calls).toHaveLength(0)
  })
})

describe('createArea', () => {
  it('creates with the SESSION user id and owner_kind user for non-brokers', async () => {
    const result = await createArea('  Bend West Side ', SHAPES)
    expect(result.error).toBeNull()
    const call = calls.find((c) => c.fn === 'createAreaForUser')
    expect(call?.args[0]).toMatchObject({
      userId: 'user-1',
      name: 'Bend West Side',
      ownerKind: 'user',
    })
  })
  it('stamps owner_kind broker for broker sessions', async () => {
    role = { role: 'broker', brokerId: 'b1' }
    await createArea('Old Bend', SHAPES)
    expect(calls.find((c) => c.fn === 'createAreaForUser')?.args[0]).toMatchObject({ ownerKind: 'broker' })
  })
  it('rejects a bad name / bad shapes before any DAL call', async () => {
    expect((await createArea('  ', SHAPES)).error).toBeTruthy()
    expect((await createArea('Fine', [])).error).toBeTruthy()
    expect((await createArea('Fine', [{ ...SHAPES[0], exclude: true }])).error).toBeTruthy()
    expect(calls).toHaveLength(0)
  })
})

describe('owner-scoped writes carry the session user id', () => {
  it('renameArea', async () => {
    await renameArea('a1', 'River West')
    const call = calls.find((c) => c.fn === 'updateAreaForUser')
    expect(call?.args.slice(0, 2)).toEqual(['a1', 'user-1'])
  })
  it('deleteArea', async () => {
    await deleteArea('a1')
    const call = calls.find((c) => c.fn === 'deleteAreaForUser')
    expect(call?.args).toEqual(['a1', 'user-1'])
  })
})

describe('setAreaPublic — broker gate', () => {
  it('refuses a plain signed-in user', async () => {
    role = null
    const result = await setAreaPublic('a1', true, 'bend-west-side')
    expect(result.error).toBe('Only brokers can publish an area')
    expect(calls.filter((c) => c.fn === 'setAreaPublicById')).toHaveLength(0)
  })
  it('refuses a report_viewer role', async () => {
    role = { role: 'report_viewer', brokerId: null }
    expect((await setAreaPublic('a1', true, 'bend-west-side')).error).toBe(
      'Only brokers can publish an area',
    )
  })
  it('brokers can only publish rows THEY own (ownership read is user-scoped)', async () => {
    role = { role: 'broker', brokerId: 'b1' }
    ownedRow = null // getAreaForUser(id, session user) found nothing
    const result = await setAreaPublic('a1', true, 'bend-west-side')
    expect(result.error).toBe('Area not found')
    expect(calls.find((c) => c.fn === 'getAreaForUser')?.args).toEqual(['a1', 'user-1'])
    expect(calls.filter((c) => c.fn === 'setAreaPublicById')).toHaveLength(0)
  })
  it('publishes with a validated slug and revalidates the landing surfaces', async () => {
    role = { role: 'superuser', brokerId: null }
    ownedRow = { id: 'a1', slug: null, is_public: false }
    const result = await setAreaPublic('a1', true, 'Bend-West-Side')
    expect(result.error).toBeNull()
    expect(calls.find((c) => c.fn === 'setAreaPublicById')?.args).toEqual([
      'a1',
      { isPublic: true, slug: 'bend-west-side' },
    ])
    expect(revalidated).toContain('tag:search-areas')
    expect(revalidated).toContain('path:/areas/bend-west-side')
  })
  it('rejects a malformed slug before writing', async () => {
    role = { role: 'broker', brokerId: 'b1' }
    ownedRow = { id: 'a1', slug: null, is_public: false }
    const result = await setAreaPublic('a1', true, 'Bad Slug!')
    expect(result.error).toBeTruthy()
    expect(calls.filter((c) => c.fn === 'setAreaPublicById')).toHaveLength(0)
  })
})
