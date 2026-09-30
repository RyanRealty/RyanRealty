import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

type Alert = { key: string; body: string; cooldownMinutes?: number }
const queueBrokerHealthAlert = vi.fn<(alert: Alert) => Promise<boolean>>(async () => true)
vi.mock('@/lib/crm/broker-alerts', () => ({
  queueBrokerHealthAlert: (alert: Alert) => queueBrokerHealthAlert(alert),
}))

import type { EditionRow } from '@/lib/data/market-report/editions'
import type { NewsletterByMarker } from '@/lib/data/newsletter/scheduled'
import { buildEditionEmail } from './edition-email'
import {
  backstopEditionEmails,
  bodyFingerprint,
  draftEditionEmailAndTell,
  editionEmailMarker,
  ensureEditionEmailDraft,
  type EditionEmailDraftDeps,
} from './edition-email-draft'
import type { EditionPayload, Kpis, MarketSection } from './types'

const fig = (v: number | null, n: number) => ({ v, n })
function kpis(median: number): Kpis {
  return {
    period: { kind: 'month', start: '2026-08-01', end: '2026-08-31' },
    median: fig(median, 291), medianPrior: fig(null, 0), medianYoY: -0.0229,
    sales: 291, salesPrior: 329, salesYoY: -0.1155,
    dtc: fig(38, 279), dtcPrior: fig(null, 0), ppsf: fig(null, 0), stl: fig(null, 0), stol: fig(null, 0),
    priceCutShare: fig(null, 0), concessionShare: fig(null, 0), concessionMedian: fig(null, 0), cashShare: fig(null, 0),
    active: 1261, activeAssumed: 0, closed6: 1882, mos: 4.0202, verdict: 'balanced',
    newListings: 0, pendings: 0, medianActiveList: fig(null, 0),
  } as Kpis
}

function editionRow(opts: { status?: EditionRow['status']; median?: number; generatedAt?: string } = {}): EditionRow {
  const k = kpis(opts.median ?? 640000)
  const region = { geo: { slug: 'central-oregon', label: 'Central Oregon', type: 'region' }, segment: 'sfr', cadence: 'monthly', kpis: k, kpis12: k, summary: [] } as unknown as MarketSection
  const generatedAt = opts.generatedAt ?? '2026-09-25T13:48:04.422Z'
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
    status: opts.status ?? 'published',
    payload: { definitionId: 'mr-v1', generatedAt, region, monthly: [] } as unknown as EditionPayload,
    citations: [],
    definition_id: 'mr-v1',
    generated_at: generatedAt,
    hold_reason: null,
  }
}

/** A stored draft exactly as ensureEditionEmailDraft would have written it from `edition`. */
async function storedDraftFrom(edition: EditionRow, status = 'draft'): Promise<NewsletterByMarker> {
  const d = deps({ getEdition: vi.fn(async () => edition) })
  await ensureEditionEmailDraft('2026-08', {}, d)
  const input = d.createDraft.mock.calls[0]![0] as { body_html: string; citations: NewsletterByMarker['citations'] }
  return { id: 'nl-0', status, body_html: input.body_html, citations: input.citations }
}

type DepMocks = { [K in keyof EditionEmailDraftDeps]: Mock<EditionEmailDraftDeps[K]> }
type Override = Partial<DepMocks> & { listOpen?: Mock<() => Promise<Array<{ id: string; created_by: string }>>> }

function deps(over: Override = {}): DepMocks & Pick<Override, 'listOpen'> {
  return {
    getEdition: vi.fn<EditionEmailDraftDeps['getEdition']>(async () => editionRow()),
    findDraft: vi.fn<EditionEmailDraftDeps['findDraft']>(async () => null),
    createDraft: vi.fn<EditionEmailDraftDeps['createDraft']>(async () => ({ ok: true, id: 'nl-1' })),
    rewriteDraft: vi.fn<EditionEmailDraftDeps['rewriteDraft']>(async () => true),
    unschedule: vi.fn<EditionEmailDraftDeps['unschedule']>(async () => true),
    ...over,
  }
}

beforeEach(() => queueBrokerHealthAlert.mockClear())

describe('ensureEditionEmailDraft: writing the month', () => {
  it('writes one draft for a published month, marked for the month, for everyone on the list, its trace ending in the provenance line', async () => {
    const d = deps()
    const r = await ensureEditionEmailDraft('2026-08', {}, d)
    expect(r).toEqual({ status: 'created', id: 'nl-1', subject: 'Central Oregon market report: August 2026' })
    const input = d.createDraft.mock.calls[0]![0] as { created_by: string; audience: string; body_html: string; citations: Array<{ figure: string; value: unknown }> }
    expect(input.created_by).toBe('cron:market-report-edition:2026-08')
    expect(input.audience).toBe('all')
    expect(input.body_html).toContain('$640,000')
    const last = input.citations.at(-1)!
    expect(last.figure).toBe('Email draft source')
    expect(last.value).toBe(`body ${bodyFingerprint(input.body_html)}`)
  })

  it('does nothing for a month that is not published, and never creates when asked only to re-check', async () => {
    const draftEdition = deps({ getEdition: vi.fn(async () => editionRow({ status: 'draft' })) })
    expect(await ensureEditionEmailDraft('2026-08', {}, draftEdition)).toEqual({ status: 'skipped', reason: 'the 2026-08 edition is draft' })
    const none = deps({ getEdition: vi.fn(async () => null) })
    expect((await ensureEditionEmailDraft('2026-09', {}, none)).status).toBe('skipped')
    const recheck = deps()
    expect((await ensureEditionEmailDraft('2026-08', { create: false }, recheck)).status).toBe('skipped')
    for (const d of [draftEdition, none, recheck]) expect(d.createDraft).not.toHaveBeenCalled()
  })

  it('reads back the draft another run wrote first when the unique index refuses a second', async () => {
    const findDraft = vi.fn(async () => null as NewsletterByMarker | null)
    findDraft.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'nl-first', status: 'draft', body_html: '', citations: [] })
    const d = deps({ findDraft, createDraft: vi.fn(async () => ({ ok: false, error: 'persist_failed' })) })
    expect(await ensureEditionEmailDraft('2026-08', {}, d)).toEqual({ status: 'exists', id: 'nl-first', newsletterStatus: 'draft' })
  })

  it('marks each month on its own key', () => {
    expect(editionEmailMarker('2026-09-01')).toBe('cron:market-report-edition:2026-09')
  })
})

describe('ensureEditionEmailDraft: an existing draft', () => {
  it('leaves a draft on the current figures alone, draft or scheduled', async () => {
    const edition = editionRow()
    for (const status of ['draft', 'scheduled']) {
      const stored = await storedDraftFrom(edition, status)
      const d = deps({ getEdition: vi.fn(async () => edition), findDraft: vi.fn(async () => stored) })
      expect(await ensureEditionEmailDraft('2026-08', {}, d)).toEqual({ status: 'exists', id: 'nl-0', newsletterStatus: status })
      expect(d.createDraft).not.toHaveBeenCalled()
      expect(d.rewriteDraft).not.toHaveBeenCalled()
      expect(d.unschedule).not.toHaveBeenCalled()
    }
  })

  it('never touches one that is sending, sent, failed, or canceled (a month Matt skipped stays skipped)', async () => {
    for (const status of ['sending', 'sent', 'failed', 'canceled']) {
      const d = deps({
        getEdition: vi.fn(async () => editionRow({ median: 655000 })),
        findDraft: vi.fn(async () => ({ id: 'nl-0', status, body_html: '<p>old</p>', citations: [] })),
      })
      expect(await ensureEditionEmailDraft('2026-08', {}, d)).toEqual({ status: 'exists', id: 'nl-0', newsletterStatus: status })
      expect(d.createDraft).not.toHaveBeenCalled()
      expect(d.rewriteDraft).not.toHaveBeenCalled()
    }
  })

  it('rebuilds an unedited draft when the report is republished with new figures, whatever path republished it', async () => {
    const stored = await storedDraftFrom(editionRow({ median: 640000 }))
    const d = deps({ getEdition: vi.fn(async () => editionRow({ median: 655000, generatedAt: '2026-10-02T00:00:00.000Z' })), findDraft: vi.fn(async () => stored) })
    const r = await ensureEditionEmailDraft('2026-08', { create: false }, d)
    expect(r).toEqual({ status: 'refreshed', id: 'nl-0', subject: 'Central Oregon market report: August 2026', wasScheduled: false })
    const fields = d.rewriteDraft.mock.calls[0]![1] as { body_html: string; citations: Array<{ value: unknown }> }
    expect(fields.body_html).toContain('$655,000')
    expect(fields.citations.some((c) => c.value === 655000)).toBe(true)
  })

  it('takes a scheduled draft back to draft before rebuilding it: its approval was for the old figures', async () => {
    const stored = await storedDraftFrom(editionRow({ median: 640000 }), 'scheduled')
    const d = deps({ getEdition: vi.fn(async () => editionRow({ median: 655000 })), findDraft: vi.fn(async () => stored) })
    const r = await ensureEditionEmailDraft('2026-08', {}, d)
    expect(d.unschedule).toHaveBeenCalledWith('nl-0')
    expect(r).toMatchObject({ status: 'refreshed', wasScheduled: true })
  })

  it('leaves a scheduled draft the send cron already took', async () => {
    const stored = await storedDraftFrom(editionRow({ median: 640000 }), 'scheduled')
    const d = deps({ getEdition: vi.fn(async () => editionRow({ median: 655000 })), findDraft: vi.fn(async () => stored), unschedule: vi.fn(async () => false) })
    expect(await ensureEditionEmailDraft('2026-08', {}, d)).toEqual({ status: 'exists', id: 'nl-0', newsletterStatus: 'sending' })
    expect(d.rewriteDraft).not.toHaveBeenCalled()
  })

  it("keeps Matt's edits and traces the new figures, so the check names each stale number", async () => {
    const stored = await storedDraftFrom(editionRow({ median: 640000 }))
    const edited = { ...stored, body_html: stored.body_html!.replace('Our monthly report', 'A note from Matt. Our monthly report') }
    const d = deps({ getEdition: vi.fn(async () => editionRow({ median: 655000 })), findDraft: vi.fn(async () => edited) })
    const r = await ensureEditionEmailDraft('2026-08', {}, d)
    expect(r).toEqual({ status: 'stale-edited', id: 'nl-0', wasScheduled: false })
    const fields = d.rewriteDraft.mock.calls[0]![1] as Record<string, unknown>
    expect(Object.keys(fields)).toEqual(['citations'])
  })

  it('the rebuilt email is the same email a fresh month gets', async () => {
    const stored = await storedDraftFrom(editionRow({ median: 640000 }))
    const d = deps({ getEdition: vi.fn(async () => editionRow({ median: 655000 })), findDraft: vi.fn(async () => stored) })
    await ensureEditionEmailDraft('2026-08', {}, d)
    const fields = d.rewriteDraft.mock.calls[0]![1] as { body_html: string }
    expect(fields.body_html).toBe(buildEditionEmail(editionRow({ median: 655000 })).bodyHtml)
  })
})

describe('texts to Matt', () => {
  it('texts the review link when a draft is new, on a 30-day key, and says nothing goes out without him', async () => {
    const r = await draftEditionEmailAndTell('2026-08', { create: true }, deps())
    expect(r.status).toBe('created')
    const alert = queueBrokerHealthAlert.mock.calls[0]![0]
    expect(alert.key).toBe('market-report-email-2026-08')
    expect(alert.cooldownMinutes).toBe(30 * 1440)
    expect(alert.body).toContain('https://ryan-realty.com/admin/newsletters/nl-1')
    expect(alert.body).toContain('Nothing goes out until you approve it.')
    expect(alert.body).not.toContain('—')
  })

  it('asks for the same text again while the draft sits unsent, so one that failed to queue is retried (the queue dedupes the rest)', async () => {
    const stored = await storedDraftFrom(editionRow())
    queueBrokerHealthAlert.mockClear()
    await draftEditionEmailAndTell('2026-08', {}, deps({ findDraft: vi.fn(async () => stored) }))
    expect(queueBrokerHealthAlert).toHaveBeenCalledTimes(1)
    expect(queueBrokerHealthAlert.mock.calls[0]![0].key).toBe('market-report-email-2026-08')
  })

  it('says nothing about a month already sent or skipped', async () => {
    await draftEditionEmailAndTell('2026-08', {}, deps({ findDraft: vi.fn(async () => ({ id: 'nl-0', status: 'canceled', body_html: '', citations: [] })) }))
    expect(queueBrokerHealthAlert).not.toHaveBeenCalled()
  })

  it('tells him when a republish rebuilt his draft, and when it moved a scheduled one back', async () => {
    const stored = await storedDraftFrom(editionRow({ median: 640000 }), 'scheduled')
    queueBrokerHealthAlert.mockClear()
    await draftEditionEmailAndTell('2026-08', {}, deps({ getEdition: vi.fn(async () => editionRow({ median: 655000 })), findDraft: vi.fn(async () => stored) }))
    const alert = queueBrokerHealthAlert.mock.calls[0]![0]
    expect(alert.key).toBe('market-report-email-refresh-2026-08')
    expect(alert.body).toContain('back to a draft')
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

describe('backstopEditionEmails', () => {
  it('writes the newest month and re-checks every other open draft without creating one', async () => {
    const getEdition = vi.fn(async (month: string) => (month === '2026-07' ? editionRow({ median: 600000 }) : editionRow()))
    const d = deps({
      getEdition,
      listOpen: vi.fn(async () => [
        { id: 'nl-7', created_by: 'cron:market-report-edition:2026-07' },
        { id: 'nl-8', created_by: 'cron:market-report-edition:2026-08' },
      ]),
    })
    const out = await backstopEditionEmails('2026-08', d)
    expect(Object.keys(out)).toEqual(['2026-08', '2026-07'])
    expect(out['2026-08']!.status).toBe('created')
    expect(out['2026-07']).toEqual({ status: 'skipped', reason: 'no 2026-07 email draft to re-check' })
    expect(d.createDraft).toHaveBeenCalledTimes(1)
  })
})
