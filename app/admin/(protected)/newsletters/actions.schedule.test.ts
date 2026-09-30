import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Approve & Schedule schedules only the version its pre-send checks passed
 * on. A monthly market report email is rebuilt when its report is
 * republished; a rebuild that lands while the checks run must not be
 * scheduled in place of the body Matt reviewed.
 */
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/app/actions/crm', () => ({
  getCrmAccess: async () => ({ email: 'matt@ryan-realty.com', role: 'superuser' }),
}))
const runPreSendGates = vi.fn(async () => ({ ok: true, r2: { ok: true, failures: [], checked: 3 }, r3: { ok: true, failures: [], checked: 1 } }))
vi.mock('@/lib/newsletter/pre-send-gates', () => ({ runPreSendGates: () => runPreSendGates() }))
const getNewsletter = vi.fn()
vi.mock('@/lib/data', () => ({ getNewsletter: (id: string) => getNewsletter(id), setSubscriberStatus: vi.fn() }))
const scheduleNewsletter = vi.fn()
vi.mock('@/lib/data/newsletter/scheduled', () => ({
  scheduleNewsletter: (...a: unknown[]) => scheduleNewsletter(...a),
  unscheduleNewsletter: vi.fn(),
}))
vi.mock('@/lib/data/newsletter/queue', () => ({ setNewsletterPaused: vi.fn(), isNewsletterPaused: vi.fn() }))
vi.mock('@/lib/data/newsletter/subscribersAdmin', () => ({
  deleteSubscriber: vi.fn(),
  getSubscriberById: vi.fn(),
  reassignSubscriberBroker: vi.fn(),
  updateSubscriberFields: vi.fn(),
}))

import { adminScheduleNewsletterAction } from './actions'

const draft = { id: 'nl-1', status: 'draft', body_html: '<p>x</p>', body_text: null, citations: [], updated_at: '2026-09-30T09:23:32.123456+00:00' }
const when = new Date(Date.now() + 86_400_000).toISOString()

afterEach(() => {
  getNewsletter.mockReset()
  scheduleNewsletter.mockReset()
})

describe('adminScheduleNewsletterAction', () => {
  it('schedules the version it checked, by its updated_at', async () => {
    getNewsletter.mockResolvedValue(draft)
    scheduleNewsletter.mockResolvedValue(true)
    expect(await adminScheduleNewsletterAction('nl-1', when)).toEqual({ ok: true })
    expect(scheduleNewsletter).toHaveBeenCalledWith('nl-1', when, draft.updated_at)
  })

  it('refuses a draft that changed while it was being checked, and says so', async () => {
    getNewsletter.mockResolvedValueOnce(draft).mockResolvedValueOnce({ ...draft, updated_at: '2026-09-30T09:24:00+00:00' })
    scheduleNewsletter.mockResolvedValue(false)
    expect(await adminScheduleNewsletterAction('nl-1', when)).toEqual({ ok: false, error: 'draft_changed' })
  })

  it('still reports a newsletter that is no longer a draft', async () => {
    getNewsletter.mockResolvedValueOnce(draft).mockResolvedValueOnce({ ...draft, status: 'sending' })
    scheduleNewsletter.mockResolvedValue(false)
    expect(await adminScheduleNewsletterAction('nl-1', when)).toEqual({ ok: false, error: 'not_a_draft' })
  })
})
