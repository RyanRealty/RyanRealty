/**
 * The email click tracker and automation (Matt 2026-09-29).
 *
 * Email security scanners, link previewers and crawlers follow every link in a
 * message the moment it lands. Each one used to be recorded as the recipient
 * CLICKING: a crm_timeline `email_click`, an email_events `click`, a newsletter
 * ledger click. A contact whose mail was scanned looked engaged, and the
 * engagement reports counted the scanner as the reader.
 *
 * Now the request's user agent is classified. An automated request is still
 * redirected, and is recorded once as email_events `click_automated` with
 * meta.automation_reason and nothing else.
 */
import { NextRequest } from 'next/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { signEmailToken } from '@/lib/email-tracking'
import { signPersonLinkToken, verifyPersonLinkToken } from '@/lib/identity/link-token'

const mocks = vi.hoisted(() => ({
  recordEmailEvent: vi.fn(),
  timelineUpsert: vi.fn(),
  tables: [] as string[],
  ledger: vi.fn(async () => undefined),
}))

vi.mock('@/lib/crm/email-events', async () => {
  const actual = await vi.importActual<typeof import('@/lib/crm/email-events')>('@/lib/crm/email-events')
  return { ...actual, recordEmailEvent: mocks.recordEmailEvent }
})
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      mocks.tables.push(table)
      return { upsert: mocks.timelineUpsert }
    },
  }),
}))
vi.mock('@/lib/newsletter/track-ledger', () => ({ recordNewsletterEngagement: mocks.ledger }))

import { GET } from './route'

const HUMAN_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
const TARGET = 'https://ryan-realty.com/cma/cma-828-florida?utm_source=cma&utm_medium=email&utm_campaign=cma-828-florida&agent=matt'

function token(over: { url?: string; emailKey?: string } = {}) {
  return signEmailToken({
    personId: 7,
    emailKey: over.emailKey ?? 'cma:cma-828-florida',
    label: 'Your home report',
    url: over.url ?? TARGET,
    broker: 'matt',
  })
}

function click(t: string, ua: string | null) {
  return GET(
    new NextRequest(`https://ryan-realty.com/api/track/e/click?t=${encodeURIComponent(t)}`, {
      headers: ua === null ? {} : { 'user-agent': ua },
    }),
  )
}

beforeEach(() => {
  mocks.recordEmailEvent.mockReset()
  mocks.recordEmailEvent.mockResolvedValue({ ok: true, inserted: true, event: 'click', personId: 7 })
  mocks.timelineUpsert.mockReset()
  mocks.timelineUpsert.mockResolvedValue({ error: null })
  mocks.tables.length = 0
  mocks.ledger.mockClear()
})

describe('a person clicking (unchanged)', () => {
  it('records the timeline row, the email_events click and the newsletter click, then redirects with the signed token', async () => {
    const res = await click(token(), HUMAN_UA)
    expect(res.status).toBe(302)
    const to = new URL(res.headers.get('location')!)
    expect(to.origin + to.pathname).toBe('https://ryan-realty.com/cma/cma-828-florida')
    expect(verifyPersonLinkToken(to.searchParams.get('_pid'))).toMatchObject({ personId: 7, channel: 'document' })

    expect(mocks.tables).toEqual(['crm_timeline'])
    expect(mocks.timelineUpsert).toHaveBeenCalledTimes(1)
    expect(mocks.timelineUpsert.mock.calls[0][0]).toMatchObject({ person_id: 7, kind: 'email_click', source: 'email-tracking' })
    expect(mocks.recordEmailEvent).toHaveBeenCalledTimes(1)
    expect(mocks.recordEmailEvent.mock.calls[0][0]).toMatchObject({ event: 'click', personId: 7, sendType: 'cma', emailKey: 'cma:cma-828-florida' })
    expect(mocks.ledger).toHaveBeenCalledTimes(1)
  })
})

describe('a click by automation is recorded as click_automated and nothing else', () => {
  const AUTOMATED: Array<{ label: string; ua: string | null; reason: string }> = [
    { label: 'a declared crawler', ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', reason: 'declared-crawler' },
    { label: 'a link previewer', ua: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', reason: 'declared-crawler' },
    { label: 'an HTTP library', ua: 'python-requests/2.31.0', reason: 'tool' },
    { label: 'a headless browser', ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36', reason: 'headless' },
    { label: 'no user agent at all', ua: null, reason: 'empty-ua' },
  ]

  it.each(AUTOMATED)('$label: still redirects, records click_automated with its reason, writes no timeline row and no newsletter click', async ({ ua, reason }) => {
    const res = await click(token(), ua)
    expect(res.status).toBe(302)
    const to = new URL(res.headers.get('location')!)
    expect(to.origin + to.pathname).toBe('https://ryan-realty.com/cma/cma-828-florida')
    // no person token: a gateway that resolves the link with a library user agent
    // renders where it was sent in a sandbox with an ordinary one, and a signed _pid
    // there identified the sandbox as the contact (review of 2026-09-30)
    expect(to.searchParams.has('_pid')).toBe(false)
    expect(to.searchParams.get('utm_campaign')).toBe('cma-828-florida')
    expect(to.searchParams.get('agent')).toBe('matt')

    expect(mocks.tables).toEqual([])
    expect(mocks.timelineUpsert).not.toHaveBeenCalled()
    expect(mocks.ledger).not.toHaveBeenCalled()
    expect(mocks.recordEmailEvent).toHaveBeenCalledTimes(1)
    const call = mocks.recordEmailEvent.mock.calls[0][0]
    expect(call).toMatchObject({
      event: 'click_automated',
      personId: 7,
      broker: 'matt',
      sendType: 'cma',
      emailKey: 'cma:cma-828-florida',
      subject: 'Your home report',
    })
    expect(call.event).not.toBe('click')
    expect(call.meta).toEqual({ url: TARGET, automation_reason: reason })
  })

  it('is sent on without a person token even when the link itself carried one (review of 2026-09-30)', async () => {
    const carried = `${TARGET}&_pid=${signPersonLinkToken(7, 'document')}&_fuid=22288`
    const res = await click(token({ url: carried }), 'python-requests/2.31.0')
    const to = new URL(res.headers.get('location')!)
    expect(to.searchParams.has('_pid')).toBe(false)
    expect(to.searchParams.has('_fuid')).toBe(false)
    expect(to.searchParams.get('utm_source')).toBe('cma')
    // while a person clicking the same link still arrives identified
    const human = new URL((await click(token({ url: carried }), HUMAN_UA)).headers.get('location')!)
    expect(verifyPersonLinkToken(human.searchParams.get('_pid'))).toMatchObject({ personId: 7 })
  })

  it('records the link without the person token, like a human click does', async () => {
    await click(token({ url: `${TARGET}&_pid=64115.email.abcdefghijklmnopqrstuv` }), 'python-requests/2.31.0')
    expect(String(mocks.recordEmailEvent.mock.calls[0][0].meta.url)).not.toContain('_pid')
  })

  it('a third-party destination is redirected untouched and still recorded once', async () => {
    const res = await click(token({ url: 'https://example.org/listing/1' }), 'python-requests/2.31.0')
    expect(res.headers.get('location')).toBe('https://example.org/listing/1')
    expect(mocks.recordEmailEvent).toHaveBeenCalledTimes(1)
    expect(mocks.recordEmailEvent.mock.calls[0][0].event).toBe('click_automated')
  })

  it('redirects even when the event cannot be stored (the migration widening the CHECK has not run)', async () => {
    mocks.recordEmailEvent.mockResolvedValue({ ok: false, error: 'new row violates check constraint "email_events_event_check"' })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const res = await click(token(), 'python-requests/2.31.0')
    expect(res.status).toBe(302)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
    expect(mocks.timelineUpsert).not.toHaveBeenCalled()
  })

  it('redirects even when recording throws', async () => {
    mocks.recordEmailEvent.mockRejectedValue(new Error('db down'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const res = await click(token(), 'python-requests/2.31.0')
    expect(res.status).toBe(302)
    warn.mockRestore()
  })
})

describe('a token we did not sign records nothing from anyone', () => {
  it.each([HUMAN_UA, 'python-requests/2.31.0'])('%s: goes to the site, writes nothing', async (ua) => {
    const res = await click('forged.token', ua)
    expect(res.status).toBe(302)
    expect(mocks.recordEmailEvent).not.toHaveBeenCalled()
    expect(mocks.timelineUpsert).not.toHaveBeenCalled()
  })
})

describe('the store accepts the value', () => {
  it('the migration widens the CHECK to click_automated and keeps every value that was already allowed', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20260929170000_email_events_click_automated.sql'), 'utf8')
    const list = /CHECK \(event IN \(([^)]*)\)\)/.exec(sql)![1]
    const values = [...list.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
    expect(values).toEqual(
      expect.arrayContaining(['sent', 'accepted', 'delivered', 'open', 'click', 'bounce', 'complaint', 'unsubscribe', 'click_automated']),
    )
    expect(values).toHaveLength(9)
    // the previous migration's list is a subset of this one
    const before = readFileSync(join(process.cwd(), 'supabase/migrations/20260925160000_email_events_accepted.sql'), 'utf8')
    const previous = [...(/CHECK \(event IN \(([^)]*)\)\)/.exec(before)![1]).matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
    for (const v of previous) expect(values).toContain(v)
  })
})
