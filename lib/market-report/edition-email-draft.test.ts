import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

type Alert = { key: string; body: string; cooldownMinutes?: number }
const queueBrokerHealthAlert = vi.fn<(alert: Alert) => Promise<boolean>>(async () => true)
vi.mock('@/lib/crm/broker-alerts', () => ({
  queueBrokerHealthAlert: (alert: Alert) => queueBrokerHealthAlert(alert),
}))

import type { EditionRow } from '@/lib/data/market-report/editions'
import type { NewsletterCitationEntry } from '@/lib/data/newsletter'
import type { NewsletterByMarker } from '@/lib/data/newsletter/scheduled'
import { buildEditionEmail } from './edition-email'
import {
  backstopEditionEmails,
  draftEditionEmailAndTell,
  editionEmailMarker,
  ensureEditionEmailDraft,
  type EditionEmailDraftDeps,
} from './edition-email-draft'
import type { EditionPayload, Kpis, MarketSection } from './types'

const BUILD_A = '2026-09-25T13:48:04.422Z'
const BUILD_B = '2026-10-02T09:00:00.000Z'
const MARKER = 'cron:market-report-edition:2026-08'

const fig = (v: number | null, n: number) => ({ v, n })
function kpis(median: number, yoy = -0.0229): Kpis {
  return {
    period: { kind: 'month', start: '2026-08-01', end: '2026-08-31' },
    median: fig(median, 291), medianPrior: fig(null, 0), medianYoY: yoy,
    sales: 291, salesPrior: 329, salesYoY: -0.1155,
    dtc: fig(38, 279), dtcPrior: fig(null, 0), ppsf: fig(null, 0), stl: fig(null, 0), stol: fig(null, 0),
    priceCutShare: fig(null, 0), concessionShare: fig(null, 0), concessionMedian: fig(null, 0), cashShare: fig(null, 0),
    active: 1261, activeAssumed: 0, closed6: 1882, mos: 4.0202, verdict: 'balanced',
    newListings: 0, pendings: 0, medianActiveList: fig(null, 0),
  } as Kpis
}

function section(slug: string, label: string, k: Kpis): MarketSection {
  return { geo: { slug, label, type: slug === 'central-oregon' ? 'region' : 'city' }, segment: 'sfr', cadence: 'monthly', kpis: k, kpis12: k, summary: [] } as unknown as MarketSection
}

function editionRow(opts: { status?: EditionRow['status']; median?: number; yoy?: number; build?: string; monthly?: MarketSection[] } = {}): EditionRow {
  const build = opts.build ?? BUILD_A
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
    payload: {
      definitionId: 'mr-v1',
      generatedAt: build,
      region: section('central-oregon', 'Central Oregon', kpis(opts.median ?? 640000, opts.yoy)),
      monthly: opts.monthly ?? [],
    } as unknown as EditionPayload,
    citations: [],
    definition_id: 'mr-v1',
    generated_at: build,
    hold_reason: null,
  }
}

/** A stored email exactly as the builder wrote it from `edition`. */
function storedFrom(edition: EditionRow, status = 'draft', id = 'nl-0'): NewsletterByMarker {
  return { id, status, citations: buildEditionEmail(edition).citations }
}

type DepMocks = { [K in keyof EditionEmailDraftDeps]: Mock<EditionEmailDraftDeps[K]> }
type Override = Partial<DepMocks> & { listOpen?: Mock<() => Promise<Array<{ id: string; created_by: string }>>> }

function deps(over: Override = {}): DepMocks & Pick<Override, 'listOpen'> {
  return {
    getEdition: vi.fn<EditionEmailDraftDeps['getEdition']>(async () => editionRow()),
    findDraft: vi.fn<EditionEmailDraftDeps['findDraft']>(async () => null),
    createDraft: vi.fn<EditionEmailDraftDeps['createDraft']>(async () => ({ ok: true, id: 'nl-1' })),
    retireDraft: vi.fn<EditionEmailDraftDeps['retireDraft']>(async () => true),
    ...over,
  }
}

const republished = () => editionRow({ median: 655000, build: BUILD_B })

beforeEach(() => queueBrokerHealthAlert.mockClear())

describe('writing the month', () => {
  it('writes one draft for a published month, marked for the month, for everyone on the list, every citation stamped with its build', async () => {
    const d = deps()
    expect(await ensureEditionEmailDraft('2026-08', { create: true }, d)).toEqual({ status: 'created', id: 'nl-1', subject: 'Central Oregon market report: August 2026' })
    const input = d.createDraft.mock.calls[0]![0] as { created_by: string; audience: string; body_html: string; citations: NewsletterCitationEntry[] }
    expect(input.created_by).toBe(MARKER)
    expect(input.audience).toBe('all')
    expect(input.body_html).toContain('$640,000')
    expect(new Set(input.citations.map((c) => c.fetched_at))).toEqual(new Set([BUILD_A]))
  })

  it('does nothing for a month that is not published', async () => {
    const d = deps({ getEdition: vi.fn(async () => editionRow({ status: 'draft' })) })
    expect(await ensureEditionEmailDraft('2026-08', { create: true }, d)).toEqual({ status: 'skipped', reason: 'the 2026-08 edition is draft' })
    expect(d.createDraft).not.toHaveBeenCalled()
  })

  it('asked only to check, with no draft, reads nothing more and writes nothing', async () => {
    const d = deps()
    expect(await ensureEditionEmailDraft('2026-08', { create: false }, d)).toEqual({ status: 'skipped', reason: 'no 2026-08 email draft to check' })
    expect(d.getEdition).not.toHaveBeenCalled()
    expect(d.createDraft).not.toHaveBeenCalled()
  })

  it('reads back the draft another run wrote first when the unique index refuses a second', async () => {
    const findDraft = vi.fn<EditionEmailDraftDeps['findDraft']>(async () => null)
    findDraft.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'nl-first', status: 'draft', citations: [] })
    const d = deps({ findDraft, createDraft: vi.fn(async () => ({ ok: false, error: 'persist_failed' })) })
    expect(await ensureEditionEmailDraft('2026-08', { create: true }, d)).toEqual({ status: 'exists', id: 'nl-first', newsletterStatus: 'draft' })
  })

  it('refuses to write an email whose printed figures are not all cited', async () => {
    // A place label carrying a stat-shaped token the builder does not cite.
    const odd = editionRow({ monthly: [section('bend', 'Bend 12 listings', kpis(727500))] })
    const d = deps({ getEdition: vi.fn(async () => odd) })
    await expect(ensureEditionEmailDraft('2026-08', { create: true }, d)).rejects.toThrow('its email draft was not written: a printed figure has no citation')
    expect(d.createDraft).not.toHaveBeenCalled()
  })

  it('marks each month on its own key', () => {
    expect(editionEmailMarker('2026-09-01')).toBe('cron:market-report-edition:2026-09')
  })
})

describe('an existing email and its edition', () => {
  it('leaves alone an email built from this edition, or from a newer build than this read', async () => {
    for (const status of ['draft', 'scheduled', 'sending']) {
      const d = deps({ findDraft: vi.fn(async () => storedFrom(editionRow(), status)) })
      expect(await ensureEditionEmailDraft('2026-08', {}, d)).toEqual({ status: 'exists', id: 'nl-0', newsletterStatus: status })
      expect(d.retireDraft).not.toHaveBeenCalled()
    }
    const newer = deps({ findDraft: vi.fn(async () => storedFrom(republished())) })
    expect((await ensureEditionEmailDraft('2026-08', {}, newer)).status).toBe('exists')
    expect(newer.retireDraft).not.toHaveBeenCalled()
  })

  it('never touches one that is sent, failed or canceled (a month Matt skipped stays skipped)', async () => {
    for (const status of ['sent', 'failed', 'canceled']) {
      const d = deps({ getEdition: vi.fn(async () => republished()), findDraft: vi.fn(async () => storedFrom(editionRow(), status)) })
      expect(await ensureEditionEmailDraft('2026-08', { create: true }, d)).toEqual({ status: 'exists', id: 'nl-0', newsletterStatus: status })
      expect(d.getEdition).not.toHaveBeenCalled()
      expect(d.createDraft).not.toHaveBeenCalled()
    }
  })

  it('a rebuild with the same figures writes nothing', async () => {
    const d = deps({ getEdition: vi.fn(async () => editionRow({ build: BUILD_B })), findDraft: vi.fn(async () => storedFrom(editionRow())) })
    expect((await ensureEditionEmailDraft('2026-08', {}, d)).status).toBe('exists')
    expect(d.retireDraft).not.toHaveBeenCalled()
    expect(d.createDraft).not.toHaveBeenCalled()
  })

  it('replaces the email when the figures change: the old one canceled under a retired marker, a new draft written', async () => {
    const d = deps({ getEdition: vi.fn(async () => republished()), findDraft: vi.fn(async () => storedFrom(editionRow())) })
    expect(await ensureEditionEmailDraft('2026-08', {}, d)).toEqual({ status: 'replaced', id: 'nl-1', replacedId: 'nl-0', wasScheduled: false, build: BUILD_B })
    expect(d.retireDraft).toHaveBeenCalledWith('nl-0', `${MARKER}:replaced:${BUILD_B}`)
    const input = d.createDraft.mock.calls[0]![0] as { created_by: string; body_html: string; preview_text: string }
    expect(input.created_by).toBe(MARKER)
    expect(input.body_html).toBe(buildEditionEmail(republished()).bodyHtml)
    expect(input.preview_text).toContain('$655,000')
    expect(d.retireDraft.mock.invocationCallOrder[0]!).toBeLessThan(d.createDraft.mock.invocationCallOrder[0]!)
  })

  it('sees a change of direction the printed size hides ("down 2%" to "up 2%")', async () => {
    const up = editionRow({ yoy: 0.0229, build: BUILD_B })
    expect(buildEditionEmail(up).citations.map((c) => c.value)).toEqual(buildEditionEmail(editionRow()).citations.map((c) => c.value))
    const d = deps({ getEdition: vi.fn(async () => up), findDraft: vi.fn(async () => storedFrom(editionRow())) })
    expect((await ensureEditionEmailDraft('2026-08', {}, d)).status).toBe('replaced')
    expect((d.createDraft.mock.calls[0]![0] as { body_html: string }).body_html).toContain('up 2% from August 2025')
  })

  it('replaces a scheduled email too, and says it had been scheduled', async () => {
    const d = deps({ getEdition: vi.fn(async () => republished()), findDraft: vi.fn(async () => storedFrom(editionRow(), 'scheduled')) })
    expect(await ensureEditionEmailDraft('2026-08', {}, d)).toMatchObject({ status: 'replaced', wasScheduled: true })
  })

  it('an email already going out is left, and flagged', async () => {
    const d = deps({ getEdition: vi.fn(async () => republished()), findDraft: vi.fn(async () => storedFrom(editionRow(), 'sending')) })
    expect(await ensureEditionEmailDraft('2026-08', {}, d)).toEqual({ status: 'stale-sending', id: 'nl-0', build: BUILD_B })
    expect(d.retireDraft).not.toHaveBeenCalled()
  })

  it('when it moves under the replacement, reads it again and decides on what is there now', async () => {
    const stale = storedFrom(editionRow())
    const findDraft = vi.fn<EditionEmailDraftDeps['findDraft']>(async () => ({ ...stale, status: 'sending' }))
    findDraft.mockResolvedValueOnce(stale)
    const d = deps({ getEdition: vi.fn(async () => republished()), findDraft, retireDraft: vi.fn(async () => false) })
    expect(await ensureEditionEmailDraft('2026-08', {}, d)).toEqual({ status: 'stale-sending', id: 'nl-0', build: BUILD_B })
    expect(d.createDraft).not.toHaveBeenCalled()
  })

  it('a rebuilt edition whose email cannot be built still takes the old email out of reach, and says so first', async () => {
    const odd = editionRow({ build: BUILD_B, monthly: [section('bend', 'Bend 12 listings', kpis(727500))] })
    const d = deps({ getEdition: vi.fn(async () => odd), findDraft: vi.fn(async () => storedFrom(editionRow(), 'scheduled')) })
    await expect(ensureEditionEmailDraft('2026-08', {}, d)).rejects.toThrow(/^its scheduled email was pulled back and canceled so it cannot go out with the earlier figures/)
    expect(d.retireDraft).toHaveBeenCalledTimes(1)
    expect(d.createDraft).not.toHaveBeenCalled()
  })
})

describe('texts to Matt', () => {
  it('texts the review link when the newest month is drafted, on a 30-day key, and says nothing goes out without him', async () => {
    expect((await draftEditionEmailAndTell('2026-08', { create: true }, deps())).status).toBe('created')
    const alert = queueBrokerHealthAlert.mock.calls[0]![0]
    expect(alert.key).toBe('market-report-email-2026-08')
    expect(alert.cooldownMinutes).toBe(30 * 1440)
    expect(alert.body).toContain('https://ryan-realty.com/admin/newsletters/nl-1')
    expect(alert.body).toContain('Nothing goes out until you approve it.')
    expect(alert.body).not.toContain('—')
  })

  it('asks again for the newest month while its draft sits unsent (the queue dedupes), never for an older month', async () => {
    await draftEditionEmailAndTell('2026-08', { create: true }, deps({ findDraft: vi.fn(async () => storedFrom(editionRow())) }))
    expect(queueBrokerHealthAlert).toHaveBeenCalledTimes(1)
    queueBrokerHealthAlert.mockClear()
    await draftEditionEmailAndTell('2026-08', { create: false }, deps({ findDraft: vi.fn(async () => storedFrom(editionRow())) }))
    expect(queueBrokerHealthAlert).not.toHaveBeenCalled()
  })

  it('tells him about every replacement, keyed by build, with the new link and whether the old one was scheduled', async () => {
    await draftEditionEmailAndTell('2026-08', {}, deps({ getEdition: vi.fn(async () => republished()), findDraft: vi.fn(async () => storedFrom(editionRow(), 'scheduled')) }))
    const alert = queueBrokerHealthAlert.mock.calls[0]![0]
    expect(alert.key).toBe(`market-report-email-replaced-2026-08-${BUILD_B}`)
    expect(alert.body).toContain('pulled back and canceled, so it will not go out')
    expect(alert.body).toContain('https://ryan-realty.com/admin/newsletters/nl-1')
  })

  it('tells him to pause an email going out on old figures', async () => {
    await draftEditionEmailAndTell('2026-08', {}, deps({ getEdition: vi.fn(async () => republished()), findDraft: vi.fn(async () => storedFrom(editionRow(), 'sending')) }))
    const alert = queueBrokerHealthAlert.mock.calls[0]![0]
    expect(alert.key).toBe(`market-report-email-sending-2026-08-${BUILD_B}`)
    expect(alert.body).toContain('pause it')
  })

  it('never throws: a failure comes back as failed and is texted on a weekly key, outcome first', async () => {
    const r = await draftEditionEmailAndTell('2026-08', { create: true }, deps({ getEdition: vi.fn(async () => { throw new Error('read failed') }) }))
    expect(r).toEqual({ status: 'failed', error: 'read failed' })
    const alert = queueBrokerHealthAlert.mock.calls[0]![0]
    expect(alert.key).toBe('market-report-email-failed-2026-08')
    expect(alert.cooldownMinutes).toBe(7 * 1440)
  })
})

describe('backstopEditionEmails', () => {
  it('writes the newest month, and checks the other open emails without creating or reminding', async () => {
    const d = deps({
      findDraft: vi.fn(async (marker: string) => (marker.endsWith('2026-07') ? storedFrom(editionRow(), 'draft', 'nl-7') : null)),
      listOpen: vi.fn(async () => [
        { id: 'nl-8', created_by: 'cron:market-report-edition:2026-08' },
        { id: 'nl-7', created_by: 'cron:market-report-edition:2026-07' },
      ]),
    })
    const out = await backstopEditionEmails('2026-08', d)
    expect(Object.keys(out)).toEqual(['2026-08', '2026-07'])
    expect(out['2026-08']!.status).toBe('created')
    expect(out['2026-07']!.status).toBe('exists')
    expect(d.createDraft).toHaveBeenCalledTimes(1)
    expect(queueBrokerHealthAlert).toHaveBeenCalledTimes(1)
    expect(queueBrokerHealthAlert.mock.calls[0]![0].key).toBe('market-report-email-2026-08')
  })
})
