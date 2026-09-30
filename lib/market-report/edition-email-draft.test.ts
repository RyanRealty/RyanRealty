import { beforeEach, describe, expect, it, vi } from 'vitest'

type Alert = { key: string; body: string; cooldownMinutes?: number }
const queueBrokerHealthAlert = vi.fn<(alert: Alert) => Promise<boolean>>(async () => true)
vi.mock('@/lib/crm/broker-alerts', () => ({
  queueBrokerHealthAlert: (alert: Alert) => queueBrokerHealthAlert(alert),
}))

import type { EditionRow } from '@/lib/data/market-report/editions'
import {
  draftEditionEmailAndTell,
  editionEmailMarker,
  ensureEditionEmailDraft,
  type EditionEmailDraftDeps,
} from './edition-email-draft'
import type { EditionPayload, Kpis, MarketSection } from './types'

const fig = (v: number | null, n: number) => ({ v, n })
const k = {
  period: { kind: 'month', start: '2026-08-01', end: '2026-08-31' },
  median: fig(640000, 291), medianPrior: fig(null, 0), medianYoY: -0.0229,
  sales: 291, salesPrior: 329, salesYoY: -0.1155,
  dtc: fig(38, 279), dtcPrior: fig(null, 0), ppsf: fig(null, 0), stl: fig(null, 0), stol: fig(null, 0),
  priceCutShare: fig(null, 0), concessionShare: fig(null, 0), concessionMedian: fig(null, 0), cashShare: fig(null, 0),
  active: 1261, activeAssumed: 0, closed6: 1882, mos: 4.0202, verdict: 'balanced',
  newListings: 0, pendings: 0, medianActiveList: fig(null, 0),
} as Kpis
const region = { geo: { slug: 'central-oregon', label: 'Central Oregon', type: 'region' }, segment: 'sfr', cadence: 'monthly', kpis: k, kpis12: k, summary: [] } as unknown as MarketSection

function editionRow(status: EditionRow['status'] = 'published'): EditionRow {
  return {
    edition_month: '2026-08-01',
    slug: 'central-oregon-2026-08',
    title: 'Central Oregon Market Report: August 2026',
    summary: null,
    pdf_path: 'central-oregon/2026/ryan-realty-central-oregon-market-report-2026-08.pdf',
    pdf_bytes: 1,
    page_count: 1,
    published_at: '2026-09-25T02:49:18.911Z',
    data_complete_through: '2026-09-24',
    figures: null,
    status,
    payload: { definitionId: 'mr-v1', generatedAt: '2026-09-25T13:48:04.422Z', region, monthly: [] } as unknown as EditionPayload,
    citations: [],
    definition_id: 'mr-v1',
    generated_at: '2026-09-25T13:48:04.422Z',
    hold_reason: null,
  }
}

function deps(over: Partial<EditionEmailDraftDeps> = {}) {
  const d = {
    getEdition: vi.fn(async () => editionRow()),
    findDraft: vi.fn(async () => null as { id: string; status: string } | null),
    createDraft: vi.fn(async () => ({ ok: true, id: 'nl-1' })),
    updateDraft: vi.fn(async () => ({ ok: true })),
    setCitations: vi.fn(async () => ({ ok: true })),
    ...over,
  }
  return d as typeof d & EditionEmailDraftDeps
}

beforeEach(() => queueBrokerHealthAlert.mockClear())

describe('ensureEditionEmailDraft', () => {
  it('writes one draft for a published month, marked for the month, with its trace, for everyone on the list', async () => {
    const d = deps()
    const r = await ensureEditionEmailDraft('2026-08', {}, d)
    expect(r).toEqual({ status: 'created', id: 'nl-1', subject: 'Central Oregon market report: August 2026' })
    expect(d.createDraft).toHaveBeenCalledTimes(1)
    const input = d.createDraft.mock.calls[0]![0] as Record<string, unknown>
    expect(input.created_by).toBe('cron:market-report-edition:2026-08')
    expect(input.audience).toBe('all')
    expect((input.citations as unknown[]).length).toBeGreaterThan(5)
    expect(String(input.body_html)).toContain('$640,000')
  })

  it('does nothing for a month that is not published', async () => {
    const d = deps({ getEdition: vi.fn(async () => editionRow('draft')) })
    expect(await ensureEditionEmailDraft('2026-08', {}, d)).toEqual({ status: 'skipped', reason: 'the 2026-08 edition is draft' })
    const none = deps({ getEdition: vi.fn(async () => null) })
    expect((await ensureEditionEmailDraft('2026-09', {}, none)).status).toBe('skipped')
    expect(d.createDraft).not.toHaveBeenCalled()
    expect(none.createDraft).not.toHaveBeenCalled()
  })

  it('never drafts a month twice, whatever became of the first draft', async () => {
    for (const status of ['draft', 'scheduled', 'sent']) {
      const d = deps({ findDraft: vi.fn(async () => ({ id: 'nl-0', status })) })
      expect(await ensureEditionEmailDraft('2026-08', {}, d)).toEqual({ status: 'exists', id: 'nl-0', newsletterStatus: status })
      expect(d.createDraft).not.toHaveBeenCalled()
      expect(d.updateDraft).not.toHaveBeenCalled()
    }
  })

  it('a republish rewrites a draft that is still a draft, and never one Matt scheduled', async () => {
    const d = deps({ findDraft: vi.fn(async () => ({ id: 'nl-0', status: 'draft' })) })
    expect((await ensureEditionEmailDraft('2026-08', { refresh: true }, d)).status).toBe('refreshed')
    expect(d.updateDraft).toHaveBeenCalledTimes(1)
    expect(d.setCitations).toHaveBeenCalledTimes(1)
    const scheduled = deps({ findDraft: vi.fn(async () => ({ id: 'nl-0', status: 'scheduled' })) })
    expect((await ensureEditionEmailDraft('2026-08', { refresh: true }, scheduled)).status).toBe('exists')
    expect(scheduled.updateDraft).not.toHaveBeenCalled()
  })

  it('reads back the draft another run wrote first when the unique index refuses a second', async () => {
    const findDraft = vi.fn(async () => null as { id: string; status: string } | null)
    findDraft.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'nl-first', status: 'draft' })
    const d = deps({ findDraft, createDraft: vi.fn(async () => ({ ok: false, error: 'persist_failed' })) })
    expect(await ensureEditionEmailDraft('2026-08', {}, d)).toEqual({ status: 'exists', id: 'nl-first', newsletterStatus: 'draft' })
  })

  it('marks each month on its own key', () => {
    expect(editionEmailMarker('2026-09-01')).toBe('cron:market-report-edition:2026-09')
  })
})

describe('draftEditionEmailAndTell', () => {
  it('texts Matt the review link when a draft is new, and says nothing goes out without him', async () => {
    const r = await draftEditionEmailAndTell('2026-08', {}, deps())
    expect(r.status).toBe('created')
    expect(queueBrokerHealthAlert).toHaveBeenCalledTimes(1)
    const alert = queueBrokerHealthAlert.mock.calls[0]![0]
    expect(alert.key).toBe('market-report-email-2026-08')
    expect(alert.body).toContain('https://ryan-realty.com/admin/newsletters/nl-1')
    expect(alert.body).toContain('Nothing goes out until you approve it.')
    expect(alert.body).not.toContain('—')
  })

  it('stays quiet when the draft already exists', async () => {
    await draftEditionEmailAndTell('2026-08', {}, deps({ findDraft: vi.fn(async () => ({ id: 'nl-0', status: 'draft' })) }))
    expect(queueBrokerHealthAlert).not.toHaveBeenCalled()
  })

  it('never throws: a failure comes back as failed and is texted on a weekly key', async () => {
    const d = deps({ getEdition: vi.fn(async () => { throw new Error('read failed') }) })
    const r = await draftEditionEmailAndTell('2026-08', {}, d)
    expect(r).toEqual({ status: 'failed', error: 'read failed' })
    const alert = queueBrokerHealthAlert.mock.calls[0]![0]
    expect(alert.key).toBe('market-report-email-failed-2026-08')
    expect(alert.cooldownMinutes).toBe(7 * 1440)
  })
})
