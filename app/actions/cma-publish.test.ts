/**
 * The publish action is the security boundary, not the UI.
 *
 * `publishCmaToListingAction` is a `'use server'` export, which means it is a
 * public POST endpoint reachable with any slug, by anyone who can reach the
 * admin origin with a session. The admin panel hiding the button is a courtesy.
 * These tests call the action DIRECTLY with documents the public guard
 * (`isPublishable`, lib/data/cma/getPublishedCma.ts) rejects and assert that
 * nothing is ever written.
 *
 * Everything below the action is doubled: the session, the admin role, and both
 * DAL functions. That is deliberate — this locks the ACTION's contract, and
 * the guard's own behavior against live Supabase is locked separately by
 * lib/data/cma/getPublishedCma.int.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

let session: { user: { email: string } } | null = null
vi.mock('@/app/actions/auth', () => ({
  getSession: () => Promise.resolve(session),
}))

// Faithful to the real getAdminRoleForEmail: a null/blank email is never a role.
let adminRole: { role: string } | null = null
vi.mock('@/app/actions/admin-roles', () => ({
  getAdminRoleForEmail: (email: string | null | undefined) =>
    Promise.resolve(email && String(email).trim() ? adminRole : null),
}))

const getCmaAdminRowBySlug = vi.fn()
const updateCmaRowFieldsBySlug = vi.fn()
vi.mock('@/lib/data', () => ({
  getCmaAdminRowBySlug: (...args: unknown[]) => getCmaAdminRowBySlug(...args),
  updateCmaRowFieldsBySlug: (...args: unknown[]) => updateCmaRowFieldsBySlug(...args),
}))

// The guard module pulls in makeResilientCached, which calls unstable_cache at
// module scope. Keep the real export shape and stub only what this test hits.
vi.mock('next/cache', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/cache')>()),
  revalidatePath: () => {},
  revalidateTag: () => {},
}))

import { publishCmaToListingAction, unpublishCmaFromListingAction } from '@/app/actions/cma-publish'
import { isPublishable } from '@/lib/data/cma/getPublishedCma'

/** A document that satisfies every clause of the guard. */
function publishableRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cma-1',
    slug: 'cma-test',
    doc_type: 'cma',
    status: 'finalized',
    archived_at: null,
    value_low: 900000,
    value_high: 1000000,
    subject_listing_key: 'ZZTESTLISTINGKEY',
    subject_address: '1 Test Way, Bend, OR 97701',
    build_summary: { pricing: { needs_review: false } },
    ...overrides,
  }
}

beforeEach(() => {
  session = { user: { email: 'matt@ryan-realty.com' } }
  adminRole = { role: 'superuser' }
  getCmaAdminRowBySlug.mockReset().mockResolvedValue(publishableRow())
  updateCmaRowFieldsBySlug.mockReset().mockResolvedValue({ ok: true })
})

describe('authz', () => {
  it('anon and report_viewer are refused before any read or write', async () => {
    session = null
    expect((await publishCmaToListingAction('cma-test')).error).toBe('Unauthorized')
    expect((await unpublishCmaFromListingAction('cma-test')).error).toBe('Unauthorized')

    session = { user: { email: 'viewer@ryan-realty.com' } }
    adminRole = { role: 'report_viewer' }
    expect((await publishCmaToListingAction('cma-test')).error).toBe('Unauthorized')
    expect((await unpublishCmaFromListingAction('cma-test')).error).toBe('Unauthorized')

    expect(getCmaAdminRowBySlug).not.toHaveBeenCalled()
    expect(updateCmaRowFieldsBySlug).not.toHaveBeenCalled()
  })
})

describe('the action refuses every document the guard would reject', () => {
  // Each case is one clause of isPublishable, plus the admin-side "no listing
  // attached" precondition. The table is asserted against the guard itself
  // below, so a future guard change that this table does not cover fails here.
  const rejected: Array<[string, Record<string, unknown>]> = [
    ['an expired-listing audit', { doc_type: 'expired-audit' }],
    ['a BPO', { doc_type: 'bpo' }],
    ['an unfinished draft', { status: 'draft' }],
    ['an archived document (status)', { status: 'archived' }],
    ['an archived document (timestamp)', { archived_at: '2026-07-01T00:00:00Z' }],
    ['a missing value range', { value_low: null, value_high: null }],
    ['an inverted value range', { value_low: 1000000, value_high: 900000 }],
    ['a zero low', { value_low: 0 }],
    ['a document its own pricing audit flagged', { build_summary: { pricing: { needs_review: true } } }],
  ]

  it.each(rejected)('refuses %s and writes nothing', async (_label, overrides) => {
    const row = publishableRow(overrides)
    getCmaAdminRowBySlug.mockResolvedValue(row)

    const result = await publishCmaToListingAction('cma-test')

    expect(result.error).toBe('This CMA cannot go on a listing page.')
    expect(result.blockers?.length ?? 0).toBeGreaterThan(0)
    expect(updateCmaRowFieldsBySlug).not.toHaveBeenCalled()
    // The refusal and the public guard agree: with the flag forced on, this
    // same row would still not be publishable.
    expect(isPublishable({ ...row, published_to_listing: true })).toBe(false)
  })

  it('refuses a document with no listing attached, which the guard has no reason to catch', async () => {
    const row = publishableRow({ subject_listing_key: null })
    getCmaAdminRowBySlug.mockResolvedValue(row)

    const result = await publishCmaToListingAction('cma-test')

    expect(result.error).toBe('This CMA cannot go on a listing page.')
    expect(result.blockers).toContain(
      'No listing is attached to this document, so there is no page for it to appear on.',
    )
    expect(updateCmaRowFieldsBySlug).not.toHaveBeenCalled()
  })

  it('refuses a slug that does not exist', async () => {
    getCmaAdminRowBySlug.mockResolvedValue(null)
    expect((await publishCmaToListingAction('nope')).error).toBe('CMA not found')
    expect(updateCmaRowFieldsBySlug).not.toHaveBeenCalled()
  })

  it('refuses an empty slug before touching the database', async () => {
    expect((await publishCmaToListingAction('   ')).error).toBe('Missing CMA slug')
    expect(getCmaAdminRowBySlug).not.toHaveBeenCalled()
  })
})

describe('the happy path writes the flag and the audit stamp', () => {
  it('publishes, recording who and when', async () => {
    const result = await publishCmaToListingAction('  CMA-Test  ')

    expect(result.error).toBeNull()
    expect(getCmaAdminRowBySlug).toHaveBeenCalledWith('cma-test')
    const [slug, updates] = updateCmaRowFieldsBySlug.mock.calls[0]
    expect(slug).toBe('cma-test')
    expect(updates.published_to_listing).toBe(true)
    expect(updates.published_by).toBe('matt@ryan-realty.com')
    expect(Date.parse(String(updates.published_at))).toBeGreaterThan(0)

    // The row this action just wrote is one the public guard accepts.
    expect(isPublishable({ ...publishableRow(), published_to_listing: true })).toBe(true)
  })

  it('reports a failed write instead of claiming success', async () => {
    updateCmaRowFieldsBySlug.mockResolvedValue({ ok: false, error: 'db down' })
    expect((await publishCmaToListingAction('cma-test')).error).toBe('db down')
  })
})

describe('unpublish works from any state', () => {
  it('clears the flag and the stamp on a document that is now archived and flagged', async () => {
    getCmaAdminRowBySlug.mockResolvedValue(
      publishableRow({
        status: 'archived',
        archived_at: '2026-07-01T00:00:00Z',
        build_summary: { pricing: { needs_review: true } },
        published_to_listing: true,
      }),
    )

    const result = await unpublishCmaFromListingAction('cma-test')

    expect(result.error).toBeNull()
    const [, updates] = updateCmaRowFieldsBySlug.mock.calls[0]
    expect(updates).toEqual({ published_to_listing: false, published_at: null, published_by: null })
  })
})
