import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Every enqueue (the scheduled send, Send now, a one-off list) asks whether a
 * monthly market report email still matches its report before it claims the
 * send, whoever approved it: an email whose report changed never goes out on
 * the earlier figures (CLAUDE.md §0).
 */
const letter = {
  id: 'nl-0',
  subject: 'Central Oregon market report: August 2026',
  body_html: '<tr></tr>',
  body_text: 't',
  audience: 'all',
  created_by: 'cron:market-report-edition:2026-08',
  citations: [{ fetched_at: '2026-09-25T13:48:04.422Z' }],
}
const editionEmailFiguresCurrent = vi.fn<(createdBy: string | null, stamp: string | null) => Promise<boolean>>(async () => true)
const claimNewsletterForSending = vi.fn(async () => null as string | null)

vi.mock('@/lib/data/newsletter', () => ({
  getNewsletter: vi.fn(async () => letter),
  getActiveSubscribersForSend: vi.fn(async () => []),
}))
vi.mock('@/lib/data/newsletter/current-issue', () => ({
  editionEmailFiguresCurrent: (createdBy: string | null, stamp: string | null) => editionEmailFiguresCurrent(createdBy, stamp),
}))
vi.mock('@/lib/data/newsletter/queue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/data/newsletter/queue')>()),
  claimNewsletterForSending: () => claimNewsletterForSending(),
}))

import { enqueueNewsletter, enqueueNewsletterToEmails } from './send-queue'

afterEach(() => {
  editionEmailFiguresCurrent.mockReset()
  editionEmailFiguresCurrent.mockResolvedValue(true)
  claimNewsletterForSending.mockClear()
})

describe('the report email hold at every enqueue', () => {
  it('refuses a report email whose report changed, before anything is claimed', async () => {
    editionEmailFiguresCurrent.mockResolvedValue(false)
    expect(await enqueueNewsletter('nl-0')).toEqual({ ok: false, error: 'report_changed' })
    expect(await enqueueNewsletterToEmails('nl-0', ['a@example.invalid'])).toEqual({ ok: false, error: 'report_changed' })
    expect(editionEmailFiguresCurrent).toHaveBeenCalledWith('cron:market-report-edition:2026-08', '2026-09-25T13:48:04.422Z')
    expect(claimNewsletterForSending).not.toHaveBeenCalled()
  })

  it('refuses when the check cannot be made, rather than sending unchecked', async () => {
    editionEmailFiguresCurrent.mockRejectedValue(new Error('editionEmailFiguresCurrent: timeout'))
    expect(await enqueueNewsletter('nl-0')).toEqual({ ok: false, error: 'report_check_failed' })
    expect(claimNewsletterForSending).not.toHaveBeenCalled()
  })

  it('lets a current email through to the claim', async () => {
    expect(await enqueueNewsletter('nl-0')).toEqual({ ok: false, error: 'already_sending' })
    expect(claimNewsletterForSending).toHaveBeenCalledTimes(1)
  })
})
