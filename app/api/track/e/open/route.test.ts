/**
 * The email open pixel and the "they opened your report" alert (Matt 2026-09-29:
 * an automated request must never fire the CMA opened alert).
 *
 * A scanner or previewer that fetches the pixel is not the recipient reading the
 * report. The open itself is still recorded, as it always was; only the alert to
 * the broker's phone is withheld from a request the classifier reads as automated.
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { signEmailToken } from '@/lib/email-tracking'

const mocks = vi.hoisted(() => ({
  recordEmailEvent: vi.fn(),
  timelineUpsert: vi.fn(),
  cmaOpened: vi.fn(async () => true),
  ledger: vi.fn(async () => undefined),
}))

vi.mock('@/lib/crm/email-events', async () => {
  const actual = await vi.importActual<typeof import('@/lib/crm/email-events')>('@/lib/crm/email-events')
  return { ...actual, recordEmailEvent: mocks.recordEmailEvent }
})
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({ from: () => ({ upsert: mocks.timelineUpsert }) }) }))
vi.mock('@/lib/newsletter/track-ledger', () => ({ recordNewsletterEngagement: mocks.ledger }))
vi.mock('@/lib/crm/cma-engagement', () => ({
  queueCmaOpenedAlert: mocks.cmaOpened,
  cmaSlugFromEmailKey: (k: string | null | undefined) => (String(k ?? '').startsWith('cma:') ? String(k).slice(4) : null),
}))

import { GET } from './route'

const HUMAN_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
const cmaToken = signEmailToken({ personId: 7, emailKey: 'cma:cma-828-florida', label: 'Your home report', broker: 'matt' })
const newsletterToken = signEmailToken({ personId: 7, emailKey: 'newsletter:42', label: 'September', broker: 'matt' })

function open(t: string, ua: string | null) {
  return GET(
    new NextRequest(`https://ryan-realty.com/api/track/e/open?t=${encodeURIComponent(t)}`, {
      headers: ua === null ? {} : { 'user-agent': ua },
    }),
  )
}

beforeEach(() => {
  mocks.recordEmailEvent.mockReset()
  mocks.recordEmailEvent.mockResolvedValue({ ok: true, inserted: true, event: 'open', personId: 7 })
  mocks.timelineUpsert.mockReset()
  mocks.timelineUpsert.mockResolvedValue({ error: null })
  mocks.cmaOpened.mockClear()
  mocks.ledger.mockClear()
})

describe('the CMA opened alert from the email pixel', () => {
  it('fires for a person who opens the email', async () => {
    const res = await open(cmaToken, HUMAN_UA)
    expect(res.headers.get('content-type')).toBe('image/gif')
    expect(mocks.cmaOpened).toHaveBeenCalledTimes(1)
    expect(mocks.cmaOpened).toHaveBeenCalledWith({ slug: 'cma-828-florida', crmPersonId: 7, trigger: 'email' })
  })

  it.each([
    ['a declared crawler', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
    ['an HTTP library', 'python-requests/2.31.0'],
    ['a headless browser', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36'],
    ['no user agent', null],
  ])('does not fire for %s, and the pixel and the open row are unchanged', async (_label, ua) => {
    const res = await open(cmaToken, ua)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/gif')
    expect(mocks.cmaOpened).not.toHaveBeenCalled()
    // the open is still recorded, exactly as before
    expect(mocks.timelineUpsert).toHaveBeenCalledTimes(1)
    expect(mocks.recordEmailEvent).toHaveBeenCalledTimes(1)
    expect(mocks.recordEmailEvent.mock.calls[0][0]).toMatchObject({ event: 'open', personId: 7 })
    expect(mocks.ledger).toHaveBeenCalledTimes(1)
  })

  it('a send that is not a CMA never alerts, whoever opens it', async () => {
    await open(newsletterToken, HUMAN_UA)
    expect(mocks.cmaOpened).not.toHaveBeenCalled()
  })
})
