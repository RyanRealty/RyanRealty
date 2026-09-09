/**
 * An open draft is a person's document from the moment it is claimed.
 *
 * Send walk 2026-09-08: two intake requests landed on other people's open
 * drafts (Rob Voth's cma-19968, Merle Lookabaugh's cma-1617-nw-8th) and the
 * "open draft → refresh contact fields" rule rewrote their client name and
 * email while person_id kept pointing at the first person. The slot resolver
 * now steps past a draft that belongs to someone else. Pure: the chain fetch
 * is mocked through the DAL read the resolver uses.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const rows = new Map<string, Record<string, unknown>>()

vi.mock('server-only', () => ({}))
vi.mock('@/lib/data', () => ({
  getCmaAdminReviewRowBySlug: async (slug: string) => rows.get(slug) ?? null,
}))

const BASE = 'cma-19968'

function draft(extra: Record<string, unknown>) {
  return { id: 'row-1', slug: BASE, status: 'draft', html_path: `pending:${BASE}`, person_id: null, client_email: null, ...extra }
}

describe('resolveWritableCmaSlot and the person who is asking', () => {
  beforeEach(() => rows.clear())

  it('an unclaimed open draft is the slot for anyone', async () => {
    rows.set(BASE, draft({}))
    const { resolveWritableCmaSlot } = await import('@/lib/cma/versions')
    const slot = await resolveWritableCmaSlot(BASE, { personId: 63426, email: 'marketing+casey@ryan-realty.com' })
    expect(slot.ok && slot.slug).toBe(BASE)
    expect(slot.ok && slot.existing?.id).toBe('row-1')
  })

  it('the person who claimed the draft gets it back, by person id or by email', async () => {
    rows.set(BASE, draft({ person_id: 63676, client_email: 'robvoth@hotmail.com' }))
    const { resolveWritableCmaSlot } = await import('@/lib/cma/versions')
    const byId = await resolveWritableCmaSlot(BASE, { personId: 63676, email: 'other@example.com' })
    expect(byId.ok && byId.slug).toBe(BASE)
    const byEmail = await resolveWritableCmaSlot(BASE, { personId: null, email: 'RobVoth@hotmail.com' })
    expect(byEmail.ok && byEmail.slug).toBe(BASE)
  })

  it("another person's open draft is stepped past to a new version", async () => {
    rows.set(BASE, draft({ person_id: 63676, client_email: 'robvoth@hotmail.com' }))
    const { resolveWritableCmaSlot } = await import('@/lib/cma/versions')
    const slot = await resolveWritableCmaSlot(BASE, { personId: 63426, email: 'marketing+casey@ryan-realty.com' })
    expect(slot.ok && slot.slug).toBe(`${BASE}--v2`)
    expect(slot.ok && slot.existing).toBeNull()
    expect(slot.ok && slot.priorStatus).toBe('draft (another requester)')
  })

  it('a draft claimed by email only still belongs to that person', async () => {
    rows.set(BASE, draft({ client_email: 'curtisbradfish@yahoo.com' }))
    const { resolveWritableCmaSlot } = await import('@/lib/cma/versions')
    const slot = await resolveWritableCmaSlot(BASE, { personId: 63425, email: 'marketing+blake@ryan-realty.com' })
    expect(slot.ok && slot.slug).toBe(`${BASE}--v2`)
  })

  it('a caller with no identity keeps the old rule: the open draft is the slot', async () => {
    rows.set(BASE, draft({ person_id: 63676, client_email: 'robvoth@hotmail.com' }))
    const { resolveWritableCmaSlot } = await import('@/lib/cma/versions')
    const anon = await resolveWritableCmaSlot(BASE)
    expect(anon.ok && anon.slug).toBe(BASE)
    const empty = await resolveWritableCmaSlot(BASE, { personId: null, email: null })
    expect(empty.ok && empty.slug).toBe(BASE)
  })

  it('the step lands after the newest version, never on a protected one', async () => {
    rows.set(BASE, { id: 'row-0', slug: BASE, status: 'delivered', person_id: 1, client_email: 'a@b.c' })
    rows.set(`${BASE}--v2`, { ...draft({ person_id: 63676, client_email: 'robvoth@hotmail.com' }), id: 'row-2', slug: `${BASE}--v2` })
    const { resolveWritableCmaSlot } = await import('@/lib/cma/versions')
    const slot = await resolveWritableCmaSlot(BASE, { personId: 63426, email: 'marketing+casey@ryan-realty.com' })
    expect(slot.ok && slot.slug).toBe(`${BASE}--v3`)
  })
})
