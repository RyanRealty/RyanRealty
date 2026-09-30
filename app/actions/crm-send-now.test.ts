import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * A broker's "Send now" (review 2026-09-30):
 *   - her PAUSE holds like her stop: her page promises "Nothing goes out until
 *     you resume it", so a manual send is refused while she has it paused;
 *   - an answer the email provider never gave is worded as what it is: the
 *     report may have gone out, it will not be sent twice, and Matt was paged.
 */

const h = vi.hoisted(() => ({
  deliver: vi.fn(),
  subscription: null as Record<string, unknown> | null,
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/crm/revalidate-person', () => ({ revalidatePerson: vi.fn() }))
vi.mock('@/app/actions/crm', () => ({
  requireCrmAccess: async () => ({ ok: true, access: { email: 'matt@ryan-realty.com', role: 'superuser', brokerSlug: 'matt' } }),
  requirePersonInScope: async () => ({ ok: true }),
}))
vi.mock('@/lib/crm/market-report-admin', () => ({ sanitizeAdminAreas: (a: string[]) => ({ areas: a, unknown: [] }) }))
vi.mock('@/lib/crm/market-report-deliver', () => ({ deliverMarketReport: (...a: unknown[]) => h.deliver(...a) }))
vi.mock('@/lib/data/crm/marketReportSubscription', () => ({
  getMarketReportContact: async () => ({
    personId: 64138,
    name: 'Cheryl Younger',
    firstName: 'Cheryl',
    primaryEmail: 'cheryl@example.com',
    assignedBroker: 'matt',
    deleted: false,
    mergedInto: null,
  }),
  getReportSubscriptionRecord: async () => h.subscription,
}))

import { sendMarketReportNowAction } from './crm-send-now'

function form(): FormData {
  const f = new FormData()
  f.append('areas', 'bend')
  return f
}

function sub(over: Record<string, unknown> = {}) {
  return {
    id: 9016,
    personId: 64138,
    areas: ['bend'],
    frequency: 'monthly',
    isActive: true,
    lastSentAt: null,
    stoppedAt: null,
    stoppedVia: null,
    pausedAt: null,
    pausedVia: null,
    ...over,
  }
}

beforeEach(() => {
  h.deliver.mockReset()
  h.subscription = sub()
})

describe('sendMarketReportNowAction', () => {
  it('refuses while SHE has the report paused, like her stop, and sends nothing', async () => {
    h.subscription = sub({ isActive: false, pausedAt: '2026-09-20T00:00:00Z', pausedVia: 'email-link' })
    const out = await sendMarketReportNowAction(64138, form())
    expect(out).toMatchObject({ ok: false })
    expect((out as { error: string }).error).toContain('paused market reports themselves')
    expect(h.deliver).not.toHaveBeenCalled()
  })

  it('a broker pause does not block a broker send', async () => {
    h.subscription = sub({ isActive: false, pausedAt: '2026-09-20T00:00:00Z', pausedVia: 'admin' })
    h.deliver.mockResolvedValue({ status: 'sent', messageId: 'm', subject: 's', figures: [], spark: null, replayed: false })
    expect(await sendMarketReportNowAction(64138, form())).toEqual({ ok: true })
  })

  it('an answer the provider never gave says it may have gone out and will not be sent twice', async () => {
    h.deliver.mockResolvedValue({ status: 'unknown', detail: 'Unable to fetch data.' })
    const out = await sendMarketReportNowAction(64138, form())
    expect((out as { error: string }).error).toContain('may have gone out')
    expect((out as { error: string }).error).toContain('not be sent twice')
  })
})
