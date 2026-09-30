import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Every enqueue (the scheduled send, Send now, a one-off list) asks whether a
 * monthly market report email still matches its report before it claims the
 * send, whoever approved it: an email whose report changed never goes out on
 * the earlier figures (CLAUDE.md §0). When it is behind, the draft writer
 * settles it at once: the same figures re-stamp it and it goes; new ones
 * replace it.
 */
type Letter = {
  id: string
  status: string
  subject: string
  body_html: string
  body_text: string
  audience: string
  created_by: string
  citations: Array<{ fetched_at: string }>
}
const OLD = '2026-09-25T13:48:04.422Z'
const NEW = '2026-10-02T09:00:00.000Z'
const letter = (over: Partial<Letter> = {}): Letter => ({
  id: 'nl-0',
  status: 'scheduled',
  subject: 'Central Oregon market report: August 2026',
  body_html: '<tr></tr>',
  body_text: 't',
  audience: 'all',
  created_by: 'cron:market-report-edition:2026-08',
  citations: [{ fetched_at: OLD }],
  ...over,
})
const getNewsletter = vi.fn(async (_id: string) => letter() as Letter | null)
const editionEmailFiguresCurrent = vi.fn<(createdBy: string | null, stamp: string | null) => Promise<boolean>>(async () => true)
const settleEditionEmailFor = vi.fn(async (_createdBy: string | null) => ({ status: 'failed' }) as { status: string } | null)
const claimNewsletterForSending = vi.fn(async () => null as string | null)

vi.mock('@/lib/data/newsletter', () => ({
  getNewsletter: (id: string) => getNewsletter(id),
  getActiveSubscribersForSend: vi.fn(async () => []),
}))
vi.mock('@/lib/data/newsletter/current-issue', () => ({
  editionEmailFiguresCurrent: (createdBy: string | null, stamp: string | null) => editionEmailFiguresCurrent(createdBy, stamp),
}))
vi.mock('@/lib/market-report/edition-email-draft', () => ({
  settleEditionEmailFor: (createdBy: string | null) => settleEditionEmailFor(createdBy),
}))
vi.mock('@/lib/data/newsletter/queue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/data/newsletter/queue')>()),
  claimNewsletterForSending: () => claimNewsletterForSending(),
}))

import { enqueueNewsletter, enqueueNewsletterToEmails } from './send-queue'

afterEach(() => {
  getNewsletter.mockReset()
  getNewsletter.mockImplementation(async () => letter())
  editionEmailFiguresCurrent.mockReset()
  editionEmailFiguresCurrent.mockResolvedValue(true)
  settleEditionEmailFor.mockReset()
  settleEditionEmailFor.mockResolvedValue({ status: 'failed' })
  claimNewsletterForSending.mockClear()
})

/** Behind on its first read, current once its stamp is the new build. */
function behindUntilRestamped() {
  editionEmailFiguresCurrent.mockImplementation(async (_c, stamp) => stamp === NEW)
}

describe('the report email hold at every enqueue', () => {
  it('lets a current email through to the claim without touching the writer', async () => {
    expect(await enqueueNewsletter('nl-0')).toEqual({ ok: false, error: 'already_sending' })
    expect(editionEmailFiguresCurrent).toHaveBeenCalledWith('cron:market-report-edition:2026-08', OLD)
    expect(settleEditionEmailFor).not.toHaveBeenCalled()
    expect(claimNewsletterForSending).toHaveBeenCalledTimes(1)
  })

  it('the scheduled-send cron holds an email behind its report, without running the writer', async () => {
    behindUntilRestamped()
    expect(await enqueueNewsletter('nl-0')).toEqual({ ok: false, error: 'report_changed' })
    expect(settleEditionEmailFor).not.toHaveBeenCalled()
    expect(claimNewsletterForSending).not.toHaveBeenCalled()
  })

  it('a click sends an email the writer re-stamped (the same printed figures from a new build)', async () => {
    behindUntilRestamped()
    getNewsletter.mockResolvedValueOnce(letter()).mockResolvedValueOnce(letter({ citations: [{ fetched_at: NEW }] }))
    settleEditionEmailFor.mockResolvedValue({ status: 'restamped' })
    expect(await enqueueNewsletter('nl-0', { settle: true })).toEqual({ ok: false, error: 'already_sending' })
    expect(claimNewsletterForSending).toHaveBeenCalledTimes(1)
  })

  it('holds an email the writer replaced, and says so', async () => {
    behindUntilRestamped()
    settleEditionEmailFor.mockResolvedValue({ status: 'replaced' })
    expect(await enqueueNewsletter('nl-0', { settle: true })).toEqual({ ok: false, error: 'report_replaced' })
    expect(await enqueueNewsletterToEmails('nl-0', ['a@example.invalid'], { settle: true })).toEqual({ ok: false, error: 'report_replaced' })
    expect(claimNewsletterForSending).not.toHaveBeenCalled()
  })

  it('holds an email the writer could not settle (a failure it texted)', async () => {
    behindUntilRestamped()
    expect(await enqueueNewsletter('nl-0', { settle: true })).toEqual({ ok: false, error: 'report_changed' })
    expect(claimNewsletterForSending).not.toHaveBeenCalled()
  })

  it('holds an email the writer canceled (its report taken down), not "already sending"', async () => {
    behindUntilRestamped()
    getNewsletter.mockResolvedValueOnce(letter()).mockResolvedValueOnce(
      letter({ status: 'canceled', created_by: 'cron:market-report-edition:2026-08:replaced:nl-0' }),
    )
    expect(await enqueueNewsletter('nl-0', { settle: true })).toEqual({ ok: false, error: 'report_changed' })
    expect(claimNewsletterForSending).not.toHaveBeenCalled()
  })

  it('a one-off checks its list before the report: an empty list never runs the writer', async () => {
    behindUntilRestamped()
    expect(await enqueueNewsletterToEmails('nl-0', ['not-an-email'], { settle: true })).toEqual({ ok: false, error: 'no_recipients' })
    expect(settleEditionEmailFor).not.toHaveBeenCalled()
  })

  it('holds when the report cannot be read, rather than sending unchecked', async () => {
    editionEmailFiguresCurrent.mockRejectedValue(new Error('editionEmailFiguresCurrent: timeout'))
    expect(await enqueueNewsletter('nl-0')).toEqual({ ok: false, error: 'report_check_failed' })
    expect(claimNewsletterForSending).not.toHaveBeenCalled()
  })

  it('says what a canceled or failed issue is, before any check', async () => {
    getNewsletter.mockImplementation(async () => letter({ status: 'canceled' }))
    expect(await enqueueNewsletter('nl-0')).toEqual({ ok: false, error: 'canceled' })
    getNewsletter.mockImplementation(async () => letter({ status: 'failed' }))
    expect(await enqueueNewsletterToEmails('nl-0', ['a@example.invalid'])).toEqual({ ok: false, error: 'failed' })
    expect(editionEmailFiguresCurrent).not.toHaveBeenCalled()
    expect(claimNewsletterForSending).not.toHaveBeenCalled()
  })
})
