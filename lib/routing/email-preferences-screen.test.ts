/**
 * The footer Unsubscribe of every market report opens /email-preferences
 * (review 2026-09-30). The page-route bot screen in middleware.ts 403s screened
 * countries and HTTP-library User-Agents; an opt-out page must never be one of
 * the pages it blocks. The Edge listing reader is mocked (unused here).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/data/listings/getListingCanonicalPathFieldsEdge', () => ({
  getListingCanonicalPathFieldsEdge: async () => ({ kind: 'miss' }),
}))

import { middleware } from '@/middleware'

const BROWSER = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'

function req(path: string, headers: Record<string, string>, method = 'GET') {
  return new NextRequest(new URL(path, 'https://ryan-realty.com'), { method, headers: { host: 'ryan-realty.com', ...headers } })
}

const saved = process.env.BOT_SCREEN_DISABLED
afterEach(() => {
  if (saved === undefined) delete process.env.BOT_SCREEN_DISABLED
  else process.env.BOT_SCREEN_DISABLED = saved
})

describe('middleware bot screen and the email-preferences pages', () => {
  it('a screened country and a scripted client are still 403 on an ordinary page (the screen is on)', async () => {
    delete process.env.BOT_SCREEN_DISABLED
    expect((await middleware(req('/about', { 'user-agent': BROWSER, 'x-vercel-ip-country': 'SG' }))).status).toBe(403)
    expect((await middleware(req('/about', { 'user-agent': 'python-requests/2.31' }))).status).toBe(403)
  })

  it('never blocks the preferences page, its stored-report view, or the form post, from anywhere, for any client', async () => {
    delete process.env.BOT_SCREEN_DISABLED
    const paths = [
      '/email-preferences?t=abc.def&stop=1',
      '/email-preferences/?t=abc.def',
      '/email-preferences/report?t=view.tok',
    ]
    const clients: Array<Record<string, string>> = [
      { 'user-agent': BROWSER, 'x-vercel-ip-country': 'SG' },
      { 'user-agent': BROWSER, 'x-vercel-ip-country': 'HK' },
      { 'user-agent': 'python-requests/2.31' },
      { 'user-agent': '' },
    ]
    for (const path of paths) {
      for (const headers of clients) {
        const res = await middleware(req(path, headers))
        expect(res.status, `${path} ${JSON.stringify(headers)}`).not.toBe(403)
        expect(res.headers.get('x-bot-screen')).toBeNull()
      }
    }
    // The page's own buttons post back to it (a server action).
    const post = await middleware(req('/email-preferences?t=abc.def', { 'user-agent': 'curl/8.4', 'x-vercel-ip-country': 'RU' }, 'POST'))
    expect(post.status).not.toBe(403)
  })

  it('does not widen the exemption to look-alike paths', async () => {
    delete process.env.BOT_SCREEN_DISABLED
    expect((await middleware(req('/email-preferences-evil', { 'user-agent': 'python-requests/2.31' }))).status).toBe(403)
  })
})
