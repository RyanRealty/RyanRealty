/**
 * Approving a needs_review CMA records the acknowledgement and leaves the
 * flag and its findings in place. Without the acknowledgement, nothing is written.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let session: { user: { email: string } } | null = null
// Matt's 80% line (lib/cma/send-floor.ts) reads the CMA row; not held unless a test says so.
const floorMock = vi.hoisted(() => ({
  getCmaSendFloorBySlug: vi.fn(async (_slug: string, _ctx?: unknown) => ({
    held: false as boolean,
    ratio: null as number | null,
    reason: null as string | null,
    unreadable: undefined as true | undefined,
  })),
}))
vi.mock('@/lib/data/cma/send-floor', () => floorMock)

vi.mock('@/app/actions/auth', () => ({
  getSession: () => Promise.resolve(session),
}))

let adminRole: { role: string } | null = null
vi.mock('@/app/actions/admin-roles', () => ({
  getAdminRoleForEmail: (email: string | null | undefined) =>
    Promise.resolve(email && String(email).trim() ? adminRole : null),
}))

vi.mock('@/lib/cma-request', () => ({
  createCmaRequest: vi.fn(),
}))
vi.mock('@/lib/cma/build', () => ({
  buildCma: vi.fn(),
}))
vi.mock('@/lib/cma/subject', () => ({
  resolveCmaSubject: vi.fn(),
}))
vi.mock('@/lib/cma/send', () => ({
  sendCmaToLead: vi.fn(),
  prepareCmaSendPreview: vi.fn(),
}))
vi.mock('@/lib/cma/first-contact-override', () => ({
  saveCmaFirstContactOverride: vi.fn(),
}))

const getCmaAdminReviewRowBySlug = vi.fn()
const updateCmaRowFieldsBySlug = vi.fn()
vi.mock('@/lib/data', () => ({
  attachCmaToPerson: vi.fn(),
  getCmaAdminReviewRowBySlug: (...args: unknown[]) => getCmaAdminReviewRowBySlug(...args),
  updateCmaRowFieldsBySlug: (...args: unknown[]) => updateCmaRowFieldsBySlug(...args),
  deleteCmaRowById: vi.fn(),
}))

vi.mock('@/lib/data/crm/cmaKickoff', () => ({
  getPersonForCmaKickoff: vi.fn(),
}))
vi.mock('@/lib/data/crm/searchPeople', () => ({
  searchPeopleByName: vi.fn(),
}))
vi.mock('@/lib/crm/revalidate-person', () => ({
  revalidatePerson: vi.fn(),
}))
vi.mock('next/cache', () => ({
  revalidatePath: () => {},
}))

import { approveCmaAction, unarchiveCmaAction } from '@/app/actions/cma-admin'

const NOW = '2026-09-29T18:30:00.000Z'
const REASON = 'Failed ask cap: recommended list was above the expired ask.'

function flaggedSummary() {
  return {
    needs_review: true,
    review_reason: REASON,
    audit: {
      used_llm: true,
      verdict: 'pass',
      findings: [{ severity: 'major', claim: 'keep me' }],
    },
    pricing: { needs_review: true, review_reason: REASON, failed_ask_capped: true },
  }
}

function flaggedRow() {
  return {
    slug: 'cma-test',
    html_path: 'db:cmas.html_content:cma-test',
    status: 'draft',
    build_summary: flaggedSummary(),
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(NOW))
  session = { user: { email: 'matt@ryan-realty.com' } }
  adminRole = { role: 'superuser' }
  getCmaAdminReviewRowBySlug.mockReset()
  updateCmaRowFieldsBySlug.mockReset().mockResolvedValue({ ok: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('approveCmaAction and the 80% line (Matt 2026-09-30)', () => {
  it('never finalizes a held expired CMA, even with an acknowledgement', async () => {
    getCmaAdminReviewRowBySlug.mockResolvedValue({ ...flaggedRow(), build_summary: {} })
    floorMock.getCmaSendFloorBySlug.mockResolvedValue({ held: true, ratio: 0.727, reason: 'Held for Matt: priced at $618,000, 72.7% of the last list of $849,000. Expired CMAs under 80% of the last list never send (Matt 2026-09-30).' })
    const plain = await approveCmaAction('cma-test')
    const acked = await approveCmaAction('cma-test', { acknowledgeReview: true })
    expect(plain.error).toContain('Held for Matt')
    expect(acked.error).toContain('Held for Matt')
    expect(updateCmaRowFieldsBySlug).not.toHaveBeenCalled()
    floorMock.getCmaSendFloorBySlug.mockResolvedValue({ held: false, ratio: 0.94, reason: null })
  })
})

describe('approveCmaAction review acknowledgement', () => {
  it('returns needsReviewAck and writes nothing when the row needs review and was not acknowledged', async () => {
    getCmaAdminReviewRowBySlug.mockResolvedValue(flaggedRow())
    const omitted = await approveCmaAction('cma-test')
    expect(omitted).toEqual({
      error: `Flagged for broker review: ${REASON}`,
      needsReviewAck: true,
    })
    const explicit = await approveCmaAction('cma-test', { acknowledgeReview: false })
    expect(explicit.needsReviewAck).toBe(true)
    expect(explicit.error).toContain(REASON)
    expect(updateCmaRowFieldsBySlug).not.toHaveBeenCalled()
  })

  it('records who, when, and the flag text, and preserves needs_review and review_reason', async () => {
    const summary = flaggedSummary()
    getCmaAdminReviewRowBySlug.mockResolvedValue({
      slug: 'cma-test',
      html_path: 'db:cmas.html_content:cma-test',
      status: 'draft',
      build_summary: summary,
    })
    const res = await approveCmaAction('CMA-Test', { acknowledgeReview: true })
    expect(res).toEqual({ error: null })
    expect(summary).not.toHaveProperty('review_acknowledgement')
    expect(updateCmaRowFieldsBySlug).toHaveBeenCalledTimes(1)
    const [slug, updates] = updateCmaRowFieldsBySlug.mock.calls[0] as [
      string,
      { status: string; finalized_at: string; build_summary: Record<string, unknown> },
    ]
    expect(slug).toBe('cma-test')
    expect(updates.status).toBe('finalized')
    expect(updates.finalized_at).toBe(NOW)
    expect(updates.build_summary).toEqual({
      ...summary,
      review_acknowledgement: {
        acknowledged_by: 'matt@ryan-realty.com',
        acknowledged_at: NOW,
        review_reason: REASON,
      },
    })
    expect(updates.build_summary.needs_review).toBe(true)
    expect(updates.build_summary.review_reason).toBe(REASON)
    expect(updates.build_summary.audit).toEqual(summary.audit)
    expect(updates.build_summary.pricing).toEqual(summary.pricing)
  })

  it('records flagReason when needs_review is false and prefers a stored review_reason', async () => {
    const summary = {
      needs_review: false,
      review_reason: null as string | null,
      audit: {
        used_llm: true,
        verdict: 'review',
        summary: 'The narrative overstates what the comps support.',
        findings: [{ severity: 'major', claim: 'keep me' }],
      },
    }
    getCmaAdminReviewRowBySlug.mockResolvedValue({
      html_path: 'db:cmas.html_content:cma-test',
      status: 'draft',
      build_summary: summary,
    })
    const flag = 'The adversarial audit returned a review verdict.'
    const withoutAck = await approveCmaAction('cma-test', { flagReason: flag })
    expect(withoutAck).toEqual({ error: null })
    expect(updateCmaRowFieldsBySlug).toHaveBeenCalledWith('cma-test', {
      status: 'finalized',
      finalized_at: NOW,
    })

    updateCmaRowFieldsBySlug.mockClear()
    const res = await approveCmaAction('cma-test', { acknowledgeReview: true, flagReason: flag })
    expect(res).toEqual({ error: null })
    expect(summary).not.toHaveProperty('review_acknowledgement')
    const [, updates] = updateCmaRowFieldsBySlug.mock.calls[0] as [
      string,
      { build_summary: Record<string, unknown> },
    ]
    expect(updates.build_summary).toEqual({
      ...summary,
      review_acknowledgement: {
        acknowledged_by: 'matt@ryan-realty.com',
        acknowledged_at: NOW,
        review_reason: flag,
      },
    })
    expect(updates.build_summary.needs_review).toBe(false)
    expect(updates.build_summary.review_reason).toBeNull()
    expect(updates.build_summary.audit).toEqual(summary.audit)

    summary.review_reason = 'Stored reason stays.'
    updateCmaRowFieldsBySlug.mockClear()
    await approveCmaAction('cma-test', { acknowledgeReview: true, flagReason: flag })
    const [, preferred] = updateCmaRowFieldsBySlug.mock.calls[0] as [
      string,
      { build_summary: { review_acknowledgement: { review_reason: string }; review_reason: string; needs_review: boolean } },
    ]
    expect(preferred.build_summary.review_acknowledgement.review_reason).toBe('Stored reason stays.')
    expect(preferred.build_summary.review_reason).toBe('Stored reason stays.')
    expect(preferred.build_summary.needs_review).toBe(false)
  })

  it('finalizes a clean row without writing an acknowledgement', async () => {
    getCmaAdminReviewRowBySlug.mockResolvedValue({
      html_path: 'db:cmas.html_content:cma-test',
      status: 'draft',
      build_summary: { needs_review: false, review_reason: null, pricing: { recommended: 1 } },
    })
    const res = await approveCmaAction('cma-test', { acknowledgeReview: true })
    expect(res).toEqual({ error: null })
    expect(updateCmaRowFieldsBySlug).toHaveBeenCalledWith('cma-test', {
      status: 'finalized',
      finalized_at: NOW,
    })
  })

  it('does not let an acknowledgement skip the document or auth gates', async () => {
    session = null
    expect(await approveCmaAction('cma-test', { acknowledgeReview: true })).toEqual({ error: 'Unauthorized' })
    expect(getCmaAdminReviewRowBySlug).not.toHaveBeenCalled()

    session = { user: { email: 'matt@ryan-realty.com' } }
    getCmaAdminReviewRowBySlug.mockResolvedValue({
      html_path: 'pending:cma-test',
      build_summary: flaggedSummary(),
    })
    const res = await approveCmaAction('cma-test', { acknowledgeReview: true })
    expect(res.error).toMatch(/no built document/)
    expect(res.needsReviewAck).toBeUndefined()
    expect(updateCmaRowFieldsBySlug).not.toHaveBeenCalled()
  })
})

describe('unarchiveCmaAction (Matt 2026-09-30)', () => {
  const archived = {
    slug: 'cma-test',
    html_path: 'db:cmas.html_content:cma-test',
    status: 'archived',
    built_at: '2026-09-30T20:59:58.000+00:00',
    finalized_at: '2026-09-30T21:10:00.000+00:00',
    delivered_at: '2026-09-30T21:42:56.000+00:00',
    build_summary: {},
  }
  beforeEach(() => {
    floorMock.getCmaSendFloorBySlug.mockClear()
    floorMock.getCmaSendFloorBySlug.mockResolvedValue({ held: false, ratio: 0.94, reason: null, unreadable: undefined })
  })

  it('keeps a held CMA archived', async () => {
    getCmaAdminReviewRowBySlug.mockResolvedValue(archived)
    floorMock.getCmaSendFloorBySlug.mockResolvedValueOnce({
      held: true,
      ratio: 0.727,
      reason: 'Held for Matt: priced at $618,000, 72.7% of the last list of $849,000.',
      unreadable: undefined,
    })
    const res = await unarchiveCmaAction('cma-test')
    expect(res.error).toContain('stays archived')
    expect(updateCmaRowFieldsBySlug).not.toHaveBeenCalled()
  })

  it('restores a delivered CMA as delivered when nothing was rebuilt since approval', async () => {
    getCmaAdminReviewRowBySlug.mockResolvedValue(archived)
    const res = await unarchiveCmaAction('cma-test')
    expect(res).toEqual({ error: null })
    expect(updateCmaRowFieldsBySlug).toHaveBeenCalledWith('cma-test', { status: 'delivered', archived_at: null })
  })

  it('restores a report rebuilt after approval as a draft, so it must be approved again', async () => {
    getCmaAdminReviewRowBySlug.mockResolvedValue({ ...archived, built_at: '2026-09-30T23:30:00.000+00:00' })
    const res = await unarchiveCmaAction('cma-test')
    expect(res).toEqual({ error: null })
    expect(updateCmaRowFieldsBySlug).toHaveBeenCalledWith('cma-test', { status: 'draft', archived_at: null })
    expect(floorMock.getCmaSendFloorBySlug).not.toHaveBeenCalledWith('cma-test')
  })
})
