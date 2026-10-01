/**
 * The SMS short-link redirect (/r/<code>) and automation. A link-preview fetch
 * (iMessage, WhatsApp, Slack, a social crawler) is redirected but never recorded as
 * a click (isLikelyBotUserAgent), and since 2026-09-30 it is also sent on with no
 * person token: the redirect used to re-sign the destination for it too, so a
 * previewer or scanner that renders the page it was sent to arrived carrying the
 * contact's signed _pid, and the track route identified it as the contact (review of
 * 2026-09-30, the same break as the email click redirect).
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { signPersonLinkToken, verifyPersonLinkToken } from '@/lib/identity/link-token'

const state = vi.hoisted(() => ({
  resolve: vi.fn(),
}))
vi.mock('@/lib/data/crm/shortLinks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/data/crm/shortLinks')>()
  return { ...actual, resolveAndLogShortLinkClick: state.resolve }
})

import { GET } from './route'

const HUMAN_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const PREVIEW_UA = 'facebookexternalhit/1.1 Facebot Twitterbot/1.0'
const TARGET = 'https://ryan-realty.com/homes-for-sale/bend?utm_source=crm&utm_medium=sms&agent=matt'

function hit(ua: string | null) {
  return GET(new NextRequest('https://ryan-realty.com/r/Ab3dE5f', { headers: ua === null ? {} : { 'user-agent': ua } }), {
    params: Promise.resolve({ code: 'Ab3dE5f' }),
  })
}

beforeEach(() => {
  state.resolve.mockReset()
  state.resolve.mockResolvedValue({ targetUrl: TARGET, personId: 7, broker: 'matt', channel: 'sms' })
})

describe('/r/<code>', () => {
  it('a person tapping the link arrives with a signed token naming the contact, and the click is recorded', async () => {
    const res = await hit(HUMAN_UA)
    expect(res.status).toBe(302)
    const to = new URL(res.headers.get('location')!)
    expect(verifyPersonLinkToken(to.searchParams.get('_pid'))).toMatchObject({ personId: 7, channel: 'sms' })
    expect(state.resolve).toHaveBeenCalledWith('Ab3dE5f', { log: true })
  })

  it.each([
    ['a link previewer', PREVIEW_UA],
    ['no user agent at all', null],
  ])('%s: redirected, not recorded, and carries no person token', async (_label, ua) => {
    const res = await hit(ua)
    expect(res.status).toBe(302)
    const to = new URL(res.headers.get('location')!)
    expect(to.origin + to.pathname).toBe('https://ryan-realty.com/homes-for-sale/bend')
    expect(to.searchParams.has('_pid')).toBe(false)
    expect(to.searchParams.get('utm_source')).toBe('crm')
    expect(state.resolve).toHaveBeenCalledWith('Ab3dE5f', { log: false })
  })

  it('a stored target that already carries a token loses it for a previewer', async () => {
    state.resolve.mockResolvedValue({ targetUrl: `${TARGET}&_pid=${signPersonLinkToken(7, 'sms')}`, personId: 7, broker: 'matt', channel: 'sms' })
    const to = new URL((await hit(PREVIEW_UA)).headers.get('location')!)
    expect(to.searchParams.has('_pid')).toBe(false)
  })

  it('a third-party target is sent on untouched either way', async () => {
    state.resolve.mockResolvedValue({ targetUrl: 'https://example.org/listing?_pid=theirs', personId: 7, broker: 'matt', channel: 'sms' })
    expect((await hit(PREVIEW_UA)).headers.get('location')).toBe('https://example.org/listing?_pid=theirs')
    expect((await hit(HUMAN_UA)).headers.get('location')).toBe('https://example.org/listing?_pid=theirs')
  })
})
