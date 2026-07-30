/**
 * Admin alert-queue action tests (app/actions/alert-admin.ts): getCrmAccess
 * gating, pending-queue grouping, and engine-settings validation — against a
 * mocked DAL.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

let access: { email: string; role: string; brokerSlug: string | null } | null = {
  email: 'matt@ryan-realty.com',
  role: 'superuser',
  brokerSlug: 'matt',
}
vi.mock('@/app/actions/crm', () => ({
  getCrmAccess: () => Promise.resolve(access),
}))

const getListingAlertById = vi.fn()
const getListingAlertsByIds = vi.fn()
const updateListingAlertEngineSettings = vi.fn()
vi.mock('@/lib/data/leads/listingAlerts', () => ({
  getListingAlertById: (...args: unknown[]) => getListingAlertById(...args),
  getListingAlertsByIds: (...args: unknown[]) => getListingAlertsByIds(...args),
  updateListingAlertEngineSettings: (...args: unknown[]) =>
    updateListingAlertEngineSettings(...args),
}))

const listPendingAlertQueue = vi.fn()
vi.mock('@/lib/data/leads/listingAlertQueue', () => ({
  listPendingAlertQueue: (...args: unknown[]) => listPendingAlertQueue(...args),
}))

import {
  listPendingAlertApprovalsAction,
  getAlertEngineSettingsAction,
  updateAlertEngineSettingsAction,
} from '@/app/actions/alert-admin'

const ALL_ON = {
  new: true,
  price_change: true,
  status_change: true,
  back_on_market: true,
  sold: true,
  open_house: true,
}

function alertRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Alert ${id}`,
    email: `${id}@example.com`,
    is_active: true,
    notification_frequency: 'weekly',
    preview_mode: true,
    events: null,
    schedule_days: [1, 4],
    filters: { city: 'Bend' },
    ...overrides,
  }
}

function queueRow(id: string, alertId: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    alert_id: alertId,
    listing_key: `mls-${id}`,
    event_type: 'new',
    event_payload: {
      card: { address: `${id} Main St`, price: 500000, detailUrl: `https://x.test/${id}` },
    },
    status: 'pending',
    created_at: '2026-07-29T00:00:00Z',
    decided_at: null,
    decided_by: null,
    ...overrides,
  }
}

beforeEach(() => {
  access = { email: 'matt@ryan-realty.com', role: 'superuser', brokerSlug: 'matt' }
  getListingAlertById.mockReset().mockResolvedValue(alertRow('a1'))
  getListingAlertsByIds.mockReset().mockResolvedValue([alertRow('a1'), alertRow('a2')])
  updateListingAlertEngineSettings.mockReset().mockResolvedValue({ ok: true })
  listPendingAlertQueue.mockReset().mockResolvedValue([])
})

describe('access gate', () => {
  it('every action refuses a non-admin before touching the DAL', async () => {
    access = null
    expect((await listPendingAlertApprovalsAction()).error).toBe('Unauthorized')
    expect((await getAlertEngineSettingsAction('a1')).error).toBe('Unauthorized')
    expect((await updateAlertEngineSettingsAction('a1', { previewMode: true })).error).toBe('Unauthorized')
    expect(listPendingAlertQueue).not.toHaveBeenCalled()
    expect(getListingAlertById).not.toHaveBeenCalled()
    expect(updateListingAlertEngineSettings).not.toHaveBeenCalled()
  })
})

describe('listPendingAlertApprovalsAction', () => {
  it('groups pending rows by alert and resolves the card snippet', async () => {
    listPendingAlertQueue.mockResolvedValue([
      queueRow('q1', 'a1'),
      queueRow('q2', 'a2', { event_type: 'price_change' }),
      queueRow('q3', 'a1', { event_payload: {} }), // no card snapshot
    ])
    const res = await listPendingAlertApprovalsAction()
    expect(res.error).toBeNull()
    expect(res.data).toHaveLength(2)
    const g1 = res.data!.find((g) => g.alert.id === 'a1')!
    expect(g1.items.map((i) => i.id)).toEqual(['q1', 'q3'])
    expect(g1.items[0].card?.address).toBe('q1 Main St')
    expect(g1.items[1].card).toBeNull()
    expect(g1.alert.previewMode).toBe(true)
    expect(g1.alert.scheduleDays).toEqual([1, 4])
    // Stored events null → normalized default map (all six keys present).
    expect(Object.keys(g1.alert.events).sort()).toEqual(
      ['back_on_market', 'new', 'open_house', 'price_change', 'sold', 'status_change'],
    )
  })

  it('drops orphaned queue rows whose alert no longer exists', async () => {
    listPendingAlertQueue.mockResolvedValue([queueRow('q1', 'a1'), queueRow('q2', 'ghost')])
    getListingAlertsByIds.mockResolvedValue([alertRow('a1')])
    const res = await listPendingAlertApprovalsAction()
    expect(res.data).toHaveLength(1)
    expect(res.data![0].alert.id).toBe('a1')
  })

  it('an empty queue returns an empty list without reading alerts', async () => {
    const res = await listPendingAlertApprovalsAction()
    expect(res.data).toEqual([])
    expect(getListingAlertsByIds).not.toHaveBeenCalled()
  })
})

describe('updateAlertEngineSettingsAction', () => {
  it('writes preview mode + events + normalized schedule days', async () => {
    const res = await updateAlertEngineSettingsAction('a1', {
      previewMode: false,
      events: ALL_ON,
      scheduleDays: [3, 3, 0],
    })
    expect(res.error).toBeNull()
    expect(updateListingAlertEngineSettings).toHaveBeenCalledWith('a1', {
      previewMode: false,
      events: ALL_ON,
      scheduleDays: [0, 3],
    })
  })

  it('rejects out-of-bounds schedule days and unknown keys', async () => {
    expect((await updateAlertEngineSettingsAction('a1', { scheduleDays: [7] })).error).toBe(
      'Those settings are not valid',
    )
    expect((await updateAlertEngineSettingsAction('a1', { bogus: true })).error).toBe(
      'Those settings are not valid',
    )
    expect((await updateAlertEngineSettingsAction('a1', {})).error).toBe('Nothing to change')
    expect(updateListingAlertEngineSettings).not.toHaveBeenCalled()
  })
})

describe('getAlertEngineSettingsAction', () => {
  it('returns normalized settings for one alert', async () => {
    const res = await getAlertEngineSettingsAction('a1')
    expect(res.error).toBeNull()
    expect(res.data).toMatchObject({
      id: 'a1',
      previewMode: true,
      frequency: 'weekly',
      scheduleDays: [1, 4],
    })
  })

  it('reports a missing alert', async () => {
    getListingAlertById.mockResolvedValue(null)
    const res = await getAlertEngineSettingsAction('nope')
    expect(res.error).toBe('Alert not found')
  })
})
