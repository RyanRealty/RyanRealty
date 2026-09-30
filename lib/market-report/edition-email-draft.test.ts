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
  EditionEmailError,
  type EditionEmailDraftDeps,
} from './edition-email-draft'
import type { EditionPayload, Kpis, MarketSection } from './types'

const BUILD_A = '2026-09-25T13:48:04.422Z'
const BUILD_B = '2026-10-02T09:00:00.000Z'
const BUILD_C = '2026-10-03T09:00:00.000Z'
const MARKER = 'cron:market-report-edition:2026-08'
const REPLACED = `${MARKER}:replaced:nl-0`

const fig = (v: number | null, n: number) => ({ v, n })
function kpis(median: number, yoy = -0.0229, dtcN = 279): Kpis {
  return {
    period: { kind: 'month', start: '2026-08-01', end: '2026-08-31' },
    median: fig(median, 291), medianPrior: fig(null, 0), medianYoY: yoy,
    sales: 291, salesPrior: 329, salesYoY: -0.1155,
    dtc: fig(38, dtcN), dtcPrior: fig(null, 0), ppsf: fig(null, 0), stl: fig(null, 0), stol: fig(null, 0),
    priceCutShare: fig(null, 0), concessionShare: fig(null, 0), concessionMedian: fig(null, 0), cashShare: fig(null, 0),
    active: 1261, activeAssumed: 0, closed6: 1882, mos: 4.0202, verdict: 'balanced',
    newListings: 0, pendings: 0, medianActiveList: fig(null, 0),
  } as Kpis
}

function section(slug: string, label: string, k: Kpis): MarketSection {
  return { geo: { slug, label, type: slug === 'central-oregon' ? 'region' : 'city' }, segment: 'sfr', cadence: 'monthly', kpis: k, kpis12: k, summary: [] } as unknown as MarketSection
}

function editionRow(
  opts: { status?: EditionRow['status']; median?: number; yoy?: number; dtcN?: number; build?: string; monthly?: MarketSection[] } = {},
): EditionRow {
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
      region: section('central-oregon', 'Central Oregon', kpis(opts.median ?? 640000, opts.yoy, opts.dtcN)),
      monthly: opts.monthly ?? [],
    } as unknown as EditionPayload,
    citations: [],
    definition_id: 'mr-v1',
    // As PostgREST returns a timestamptz.
    generated_at: build.replace('Z', '+00:00'),
    hold_reason: null,
  }
}

/** A stored email exactly as the builder wrote it from `edition`. */
function storedFrom(edition: EditionRow, status = 'draft', id = 'nl-0'): NewsletterByMarker {
  return { id, status, citations: buildEditionEmail(edition).citations }
}

/** A printed figure the builder does not cite: the email fails R-2 and is never written. */
const unbuildable = (build = BUILD_B) => editionRow({ build, monthly: [section('bend', 'Bend 12 listings', kpis(727500))] })
const republished = () => editionRow({ median: 655000, build: BUILD_B })

type DepMocks = { [K in keyof EditionEmailDraftDeps]: Mock<EditionEmailDraftDeps[K]> }
type ListMonths = Mock<(prefix: string, sinceIso: string) => Promise<Array<{ id: string; created_by: string }>>>
type Override = Partial<DepMocks> & { listMonths?: ListMonths }

function deps(over: Override = {}): DepMocks & { listMonths?: ListMonths } {
  return {
    getEdition: vi.fn<EditionEmailDraftDeps['getEdition']>(async () => editionRow()),
    findDraft: vi.fn<EditionEmailDraftDeps['findDraft']>(async () => null),
    findReplaced: vi.fn<EditionEmailDraftDeps['findReplaced']>(async () => null),
    createDraft: vi.fn<EditionEmailDraftDeps['createDraft']>(async () => ({ ok: true, id: 'nl-1' })),
    replaceDraft: vi.fn<EditionEmailDraftDeps['replaceDraft']>(async () => ({ ok: true, id: 'nl-1', previousStatus: 'draft', touched: false })),
    retireDraft: vi.fn<EditionEmailDraftDeps['retireDraft']>(async () => true),
    restamp: vi.fn<EditionEmailDraftDeps['restamp']>(async () => true),
    ...over,
  }
}

function wrote(d: DepMocks): boolean {
  return d.createDraft.mock.calls.length + d.replaceDraft.mock.calls.length + d.retireDraft.mock.calls.length + d.restamp.mock.calls.length > 0
}

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
    expect(wrote(d)).toBe(false)
  })

  it('asked only to check, with no email for the month, reads nothing more and writes nothing', async () => {
    const d = deps()
    expect(await ensureEditionEmailDraft('2026-08', { create: false }, d)).toEqual({ status: 'skipped', reason: 'no 2026-08 email to check' })
    expect(d.findReplaced).toHaveBeenCalledWith(MARKER)
    expect(d.getEdition).not.toHaveBeenCalled()
    expect(wrote(d)).toBe(false)
  })

  it('writes the email of a month whose replacement was never written, even when only asked to check', async () => {
    const d = deps({ findReplaced: vi.fn(async () => ({ id: 'nl-0' })) })
    expect(await ensureEditionEmailDraft('2026-08', { create: false }, d)).toMatchObject({ status: 'created', id: 'nl-1' })
  })

  it('checks the draft another run wrote first when the unique index refuses a second', async () => {
    const findDraft = vi.fn<EditionEmailDraftDeps['findDraft']>(async () => storedFrom(editionRow(), 'draft', 'nl-first'))
    findDraft.mockResolvedValueOnce(null)
    const d = deps({ findDraft, createDraft: vi.fn(async () => ({ ok: false, error: 'persist_failed' })) })
    expect(await ensureEditionEmailDraft('2026-08', { create: true }, d)).toEqual({ status: 'exists', id: 'nl-first', newsletterStatus: 'draft' })
  })

  it('says why when a draft cannot be written at all', async () => {
    const d = deps({ createDraft: vi.fn(async () => ({ ok: false, error: 'persist_failed' })) })
    await expect(ensureEditionEmailDraft('2026-08', { create: true }, d)).rejects.toThrow('its email was not drafted: persist_failed')
    expect(d.createDraft).toHaveBeenCalledTimes(3)
  })

  it('refuses to write an email whose printed figures are not all cited', async () => {
    const d = deps({ getEdition: vi.fn(async () => unbuildable(BUILD_A)) })
    await expect(ensureEditionEmailDraft('2026-08', { create: true }, d)).rejects.toThrow('its email was not drafted: a printed figure has no citation')
    expect(wrote(d)).toBe(false)
  })

  it('marks each month on its own key', () => {
    expect(editionEmailMarker('2026-09-01')).toBe('cron:market-report-edition:2026-09')
  })
})

describe('an open email and its edition', () => {
  it('leaves alone an email built from this edition, or from a newer build than this read', async () => {
    for (const status of ['draft', 'scheduled', 'sending']) {
      const d = deps({ findDraft: vi.fn(async () => storedFrom(editionRow(), status)) })
      expect(await ensureEditionEmailDraft('2026-08', {}, d)).toEqual({ status: 'exists', id: 'nl-0', newsletterStatus: status })
      expect(wrote(d)).toBe(false)
    }
    const newer = deps({ findDraft: vi.fn(async () => storedFrom(republished())) })
    expect((await ensureEditionEmailDraft('2026-08', {}, newer)).status).toBe('exists')
    expect(wrote(newer)).toBe(false)
  })

  it('never touches one that is sent, failed or canceled (a month Matt skipped stays skipped)', async () => {
    for (const status of ['sent', 'failed', 'canceled']) {
      const d = deps({ getEdition: vi.fn(async () => republished()), findDraft: vi.fn(async () => storedFrom(editionRow(), status)) })
      expect(await ensureEditionEmailDraft('2026-08', { create: true }, d)).toEqual({ status: 'exists', id: 'nl-0', newsletterStatus: status })
      expect(d.getEdition).not.toHaveBeenCalled()
      expect(wrote(d)).toBe(false)
    }
  })
})

describe('a rebuild with the same printed figures', () => {
  it('keeps the draft and everything Matt did with it, and moves its trace to the new build', async () => {
    for (const status of ['draft', 'scheduled']) {
      const d = deps({ getEdition: vi.fn(async () => editionRow({ build: BUILD_B })), findDraft: vi.fn(async () => storedFrom(editionRow(), status)) })
      expect(await ensureEditionEmailDraft('2026-08', {}, d)).toEqual({ status: 'restamped', id: 'nl-0', newsletterStatus: status })
      const [id, from, citations] = d.restamp.mock.calls[0]!
      expect([id, from]).toEqual(['nl-0', BUILD_A])
      expect(new Set(citations.map((c) => c.fetched_at))).toEqual(new Set([BUILD_B]))
      expect(d.createDraft).not.toHaveBeenCalled()
      expect(d.replaceDraft).not.toHaveBeenCalled()
    }
  })

  it('judges by what is printed: a sample size that moved without moving a printed figure is the same email', async () => {
    const moved = editionRow({ build: BUILD_B, dtcN: 281 })
    expect(buildEditionEmail(moved).citations.map((c) => c.filter)).not.toEqual(buildEditionEmail(editionRow()).citations.map((c) => c.filter))
    const d = deps({ getEdition: vi.fn(async () => moved), findDraft: vi.fn(async () => storedFrom(editionRow())) })
    expect((await ensureEditionEmailDraft('2026-08', {}, d)).status).toBe('restamped')
    expect(d.replaceDraft).not.toHaveBeenCalled()
  })

  it('leaves the trace of an email going out as it was checked', async () => {
    const d = deps({ getEdition: vi.fn(async () => editionRow({ build: BUILD_B })), findDraft: vi.fn(async () => storedFrom(editionRow(), 'sending')) })
    expect((await ensureEditionEmailDraft('2026-08', {}, d)).status).toBe('exists')
    expect(wrote(d)).toBe(false)
  })

  it('reads it again when it moved under the re-stamp', async () => {
    const findDraft = vi.fn<EditionEmailDraftDeps['findDraft']>(async () => storedFrom(editionRow(), 'sending'))
    findDraft.mockResolvedValueOnce(storedFrom(editionRow()))
    const d = deps({ getEdition: vi.fn(async () => editionRow({ build: BUILD_B })), findDraft, restamp: vi.fn(async () => false) })
    expect(await ensureEditionEmailDraft('2026-08', {}, d)).toEqual({ status: 'exists', id: 'nl-0', newsletterStatus: 'sending' })
  })
})

describe('a rebuild with new figures', () => {
  it('replaces the draft in one step: the old one canceled under its own retired marker, the new one built from the new edition', async () => {
    const d = deps({ getEdition: vi.fn(async () => republished()), findDraft: vi.fn(async () => storedFrom(editionRow())) })
    expect(await ensureEditionEmailDraft('2026-08', {}, d)).toEqual({ status: 'replaced', id: 'nl-1', replacedId: 'nl-0', wasScheduled: false, touched: false })
    const input = d.replaceDraft.mock.calls[0]![0]
    expect(input).toMatchObject({ id: 'nl-0', expectedStatus: 'draft', retiredCreatedBy: REPLACED })
    expect(input.bodyHtml).toBe(buildEditionEmail(republished()).bodyHtml)
    expect(input.previewText).toContain('$655,000')
    expect(new Set(input.citations.map((c) => c.fetched_at))).toEqual(new Set([BUILD_B]))
    expect(d.createDraft).not.toHaveBeenCalled()
    expect(d.retireDraft).not.toHaveBeenCalled()
  })

  it('sees a change of direction the printed size hides ("down 2%" to "up 2%")', async () => {
    const up = editionRow({ yoy: 0.0229, build: BUILD_B })
    expect(buildEditionEmail(up).citations.map((c) => c.value)).toEqual(buildEditionEmail(editionRow()).citations.map((c) => c.value))
    const d = deps({ getEdition: vi.fn(async () => up), findDraft: vi.fn(async () => storedFrom(editionRow())) })
    expect((await ensureEditionEmailDraft('2026-08', {}, d)).status).toBe('replaced')
    expect(d.replaceDraft.mock.calls[0]![0].bodyHtml).toContain('up 2% from August 2025')
  })

  it('replaces an approved email too, and reports what the transaction found it to be', async () => {
    const d = deps({
      getEdition: vi.fn(async () => republished()),
      findDraft: vi.fn(async () => storedFrom(editionRow(), 'scheduled')),
      replaceDraft: vi.fn(async () => ({ ok: true as const, id: 'nl-1', previousStatus: 'scheduled' as const, touched: true })),
    })
    expect(await ensureEditionEmailDraft('2026-08', {}, d)).toMatchObject({ status: 'replaced', wasScheduled: true, touched: true })
    expect(d.replaceDraft.mock.calls[0]![0].expectedStatus).toBe('scheduled')
  })

  it('when the email moved under the replacement, checks what is there now from the start', async () => {
    // Scheduled between the read and the replacement: replaced as scheduled.
    const findDraft = vi.fn<EditionEmailDraftDeps['findDraft']>(async () => storedFrom(editionRow(), 'scheduled'))
    findDraft.mockResolvedValueOnce(storedFrom(editionRow()))
    const replaceDraft = vi.fn<EditionEmailDraftDeps['replaceDraft']>(async () => ({ ok: true, id: 'nl-1', previousStatus: 'scheduled', touched: true }))
    replaceDraft.mockResolvedValueOnce({ ok: false, status: 'scheduled' })
    const d = deps({ getEdition: vi.fn(async () => republished()), findDraft, replaceDraft })
    expect(await ensureEditionEmailDraft('2026-08', {}, d)).toMatchObject({ status: 'replaced', wasScheduled: true })
    expect(replaceDraft.mock.calls.map((c) => c[0].expectedStatus)).toEqual(['draft', 'scheduled'])
  })

  it('a replacement another run wrote from an older build is replaced again, not left live', async () => {
    const fromB = editionRow({ median: 655000, build: BUILD_B })
    const fromC = editionRow({ median: 661000, build: BUILD_C })
    const findDraft = vi.fn<EditionEmailDraftDeps['findDraft']>(async () => storedFrom(fromB, 'draft', 'nl-b'))
    findDraft.mockResolvedValueOnce(storedFrom(editionRow()))
    const replaceDraft = vi.fn<EditionEmailDraftDeps['replaceDraft']>(async () => ({ ok: true, id: 'nl-c', previousStatus: 'draft', touched: false }))
    replaceDraft.mockResolvedValueOnce({ ok: false, status: 'canceled' })
    const d = deps({ getEdition: vi.fn(async () => fromC), findDraft, replaceDraft })
    expect(await ensureEditionEmailDraft('2026-08', {}, d)).toMatchObject({ status: 'replaced', id: 'nl-c', replacedId: 'nl-b' })
    expect(replaceDraft.mock.calls[1]![0]).toMatchObject({ id: 'nl-b', retiredCreatedBy: `${MARKER}:replaced:nl-b` })
  })

  it('an email already going out cannot be recalled: flagged, nothing written', async () => {
    const d = deps({ getEdition: vi.fn(async () => republished()), findDraft: vi.fn(async () => storedFrom(editionRow(), 'sending')) })
    expect(await ensureEditionEmailDraft('2026-08', {}, d)).toEqual({ status: 'stale-sending', id: 'nl-0', build: BUILD_B })
    expect(wrote(d)).toBe(false)
  })

  it('an email going out whose new figures cannot be built is a failure to check, not "new figures"', async () => {
    const d = deps({ getEdition: vi.fn(async () => unbuildable()), findDraft: vi.fn(async () => storedFrom(editionRow(), 'sending')) })
    const err = await ensureEditionEmailDraft('2026-08', {}, d).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(EditionEmailError)
    expect((err as Error).message).toMatch(/^the report was republished while its email is going out, and the new figures could not be checked against it/)
    expect(wrote(d)).toBe(false)
  })

  it('a new email that cannot be built still takes the old one out of reach, and says so first', async () => {
    const d = deps({ getEdition: vi.fn(async () => unbuildable()), findDraft: vi.fn(async () => storedFrom(editionRow(), 'scheduled')) })
    await expect(ensureEditionEmailDraft('2026-08', {}, d)).rejects.toThrow(/^the report was republished and its approved email was pulled back and canceled, so it cannot go out with the earlier figures/)
    expect(d.retireDraft).toHaveBeenCalledWith('nl-0', 'scheduled', REPLACED)
    expect(d.replaceDraft).not.toHaveBeenCalled()
  })

  it('when the replacement cannot be written, the old email is still canceled, and the failure says so', async () => {
    const d = deps({
      getEdition: vi.fn(async () => republished()),
      findDraft: vi.fn(async () => storedFrom(editionRow())),
      replaceDraft: vi.fn(async () => {
        throw new Error('replaceNewsletterDraft: timeout')
      }),
    })
    await expect(ensureEditionEmailDraft('2026-08', {}, d)).rejects.toThrow(/its email draft was canceled, so it cannot go out with the earlier figures, but the new email could not be written: replaceNewsletterDraft: timeout/)
    expect(d.retireDraft).toHaveBeenCalledWith('nl-0', 'draft', REPLACED)
  })

  it('when neither the replacement nor the cancel goes through, it says the old email is still open and not to approve it', async () => {
    const d = deps({
      getEdition: vi.fn(async () => republished()),
      findDraft: vi.fn(async () => storedFrom(editionRow(), 'scheduled')),
      replaceDraft: vi.fn(async () => {
        throw new Error('down')
      }),
      retireDraft: vi.fn(async () => {
        throw new Error('down')
      }),
    })
    await expect(ensureEditionEmailDraft('2026-08', {}, d)).rejects.toThrow(/could not be replaced \(down\) and is still scheduled\. Do not approve it/)
  })

  it('a report no longer published takes its open email out of reach', async () => {
    const d = deps({ getEdition: vi.fn(async () => editionRow({ status: 'draft', build: BUILD_B })), findDraft: vi.fn(async () => storedFrom(editionRow())) })
    await expect(ensureEditionEmailDraft('2026-08', {}, d)).rejects.toThrow('the 2026-08 report is now draft, so its email draft was canceled. A new one is drafted when the report publishes again.')
    expect(d.retireDraft).toHaveBeenCalledWith('nl-0', 'draft', REPLACED)
  })
})

describe('texts to Matt', () => {
  it('texts the review link when the newest month is drafted, once per draft, and says nothing goes out without him', async () => {
    expect((await draftEditionEmailAndTell('2026-08', { create: true }, deps())).status).toBe('created')
    const alert = queueBrokerHealthAlert.mock.calls[0]![0]
    expect(alert.key).toBe('market-report-email-2026-08-nl-1')
    expect(alert.cooldownMinutes).toBe(30 * 1440)
    expect(alert.body).toContain('https://ryan-realty.com/admin/newsletters/nl-1')
    expect(alert.body).toContain('Nothing goes out until you approve it.')
    expect(alert.body).not.toContain('—')
  })

  it('asks again for the newest month while its draft sits unsent (the queue dedupes the key), never for an older month', async () => {
    await draftEditionEmailAndTell('2026-08', { create: true }, deps({ findDraft: vi.fn(async () => storedFrom(editionRow())) }))
    expect(queueBrokerHealthAlert.mock.calls.map((c) => c[0].key)).toEqual(['market-report-email-2026-08-nl-0'])
    queueBrokerHealthAlert.mockClear()
    await draftEditionEmailAndTell('2026-08', { create: false }, deps({ findDraft: vi.fn(async () => storedFrom(editionRow())) }))
    expect(queueBrokerHealthAlert).not.toHaveBeenCalled()
  })

  it('tells him about a replacement on the new draft\'s own key, whether the old one was approved, and that edits are not carried over', async () => {
    await draftEditionEmailAndTell(
      '2026-08',
      {},
      deps({
        getEdition: vi.fn(async () => republished()),
        findDraft: vi.fn(async () => storedFrom(editionRow(), 'scheduled')),
        replaceDraft: vi.fn(async () => ({ ok: true as const, id: 'nl-1', previousStatus: 'scheduled' as const, touched: true })),
      }),
    )
    const alert = queueBrokerHealthAlert.mock.calls[0]![0]
    expect(alert.key).toBe('market-report-email-2026-08-nl-1')
    expect(alert.body).toContain('The email you had approved was pulled back and canceled, so it will not go out.')
    expect(alert.body).toContain('If you had edited it, those edits are not in the new one.')
    expect(alert.body).toContain('https://ryan-realty.com/admin/newsletters/nl-1')
  })

  it('says nothing about edits when the old draft was never touched', async () => {
    await draftEditionEmailAndTell('2026-08', {}, deps({ getEdition: vi.fn(async () => republished()), findDraft: vi.fn(async () => storedFrom(editionRow())) }))
    const body = queueBrokerHealthAlert.mock.calls[0]![0].body
    expect(body).toContain('The earlier draft was canceled.')
    expect(body).not.toContain('edits')
  })

  it('a re-stamp is not news', async () => {
    await draftEditionEmailAndTell('2026-08', {}, deps({ getEdition: vi.fn(async () => editionRow({ build: BUILD_B })), findDraft: vi.fn(async () => storedFrom(editionRow())) }))
    expect(queueBrokerHealthAlert).not.toHaveBeenCalled()
  })

  it('tells him once per build to pause an email going out on revised figures', async () => {
    await draftEditionEmailAndTell('2026-08', {}, deps({ getEdition: vi.fn(async () => republished()), findDraft: vi.fn(async () => storedFrom(editionRow(), 'sending')) }))
    const alert = queueBrokerHealthAlert.mock.calls[0]![0]
    expect(alert.key).toBe('market-report-email-sending-nl-0-20261002090000')
    expect(alert.cooldownMinutes).toBe(365 * 1440)
    expect(alert.body).toContain('cannot be recalled')
    expect(alert.body).toContain('pause it: https://ryan-realty.com/admin/newsletters/nl-0')
  })

  it('never throws: a failure comes back as failed and is texted on a key of its kind, so a new kind is never muted', async () => {
    const r = await draftEditionEmailAndTell('2026-08', { create: true }, deps({ getEdition: vi.fn(async () => { throw new Error('read failed') }) }))
    expect(r).toEqual({ status: 'failed', error: 'read failed' })
    expect(queueBrokerHealthAlert.mock.calls[0]![0]).toMatchObject({ key: 'market-report-email-failed-2026-08-error', cooldownMinutes: 7 * 1440 })

    queueBrokerHealthAlert.mockClear()
    await draftEditionEmailAndTell('2026-08', {}, deps({ getEdition: vi.fn(async () => unbuildable()), findDraft: vi.fn(async () => storedFrom(editionRow())) }))
    const canceled = queueBrokerHealthAlert.mock.calls[0]![0]
    expect(canceled.key).toBe('market-report-email-failed-2026-08-canceled-nl-0')
    expect(canceled.body).toMatch(/^The August 2026 market report email needs a look: the report was republished and its email draft was canceled/)
  })
})

describe('backstopEditionEmails', () => {
  it('writes the newest month, checks the other open emails without creating or reminding, and writes a replacement that never landed', async () => {
    const d = deps({
      findDraft: vi.fn(async (marker: string) => (marker.endsWith('2026-07') ? storedFrom(editionRow(), 'draft', 'nl-7') : null)),
      findReplaced: vi.fn(async (marker: string) => (marker.endsWith('2026-06') ? { id: 'nl-6' } : null)),
      listMonths: vi.fn(async () => [
        { id: 'nl-8', created_by: 'cron:market-report-edition:2026-08' },
        { id: 'nl-7', created_by: 'cron:market-report-edition:2026-07' },
        { id: 'nl-6', created_by: 'cron:market-report-edition:2026-06:replaced:nl-5' },
      ]),
    })
    const out = await backstopEditionEmails('2026-08', d, new Date('2026-10-01T11:17:00Z'))
    expect(Object.keys(out)).toEqual(['2026-08', '2026-07', '2026-06'])
    expect(out['2026-08']!.status).toBe('created')
    expect(out['2026-07']!.status).toBe('exists')
    expect(out['2026-06']!.status).toBe('created')
    expect(d.listMonths!.mock.calls[0]).toEqual(['cron:market-report-edition:', '2026-08-17T11:17:00.000Z'])
    expect(queueBrokerHealthAlert.mock.calls.map((c) => c[0].key)).toEqual(['market-report-email-2026-08-nl-1', 'market-report-email-2026-06-nl-1'])
  })

  it('records a failed listing and still writes the newest month', async () => {
    const d = deps({ listMonths: vi.fn(async () => { throw new Error('list failed') }) })
    const out = await backstopEditionEmails('2026-08', d)
    expect(out['2026-08']!.status).toBe('created')
    expect(out.list).toEqual({ status: 'failed', error: 'list failed' })
  })
})
