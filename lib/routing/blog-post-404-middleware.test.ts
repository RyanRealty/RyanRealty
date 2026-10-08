/**
 * Soft-404 found 2026-10-05: /blog/<unknown slug> served HTTP 200 + noindex to
 * browsers and Googlebot, because the route's own notFound() runs under
 * app/loading.tsx with streamed metadata. middleware.ts now answers a real 404
 * before render from the published-slug set. The Edge reader is mocked; the
 * path parse and the middleware branch are real.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const lookup = vi.fn()
vi.mock('@/lib/data/blog/publishedBlogSlugsEdge', () => ({
  lookupPublishedBlogSlugEdge: (slug: string) => lookup(slug),
}))

import { middleware } from '@/middleware'

const UAS = {
  browser: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
  googlebot:
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
}

function req(path: string, ua: string) {
  return new NextRequest(new URL(path, 'https://ryan-realty.com'), {
    headers: { 'user-agent': ua, host: 'ryan-realty.com' },
  })
}

describe('middleware /blog/<slug> 404', () => {
  beforeEach(() => {
    lookup.mockReset()
    lookup.mockImplementation(async (slug: string) =>
      slug === 'understanding-home-appraisals' ? 'published' : slug === 'zz-unknown' ? 'missing' : 'unknown',
    )
  })

  for (const [name, ua] of Object.entries(UAS)) {
    it(`an unknown or draft slug is a real 404 with a noindex body (${name})`, async () => {
      const res = await middleware(req('/blog/zz-unknown', ua))
      expect(res.status).toBe(404)
      expect(res.headers.get('cache-control')).toBe('no-store')
      expect(res.headers.get('x-robots-tag')).toBe('noindex')
      const html = await res.text()
      expect(html).toContain('<meta name="robots" content="noindex">')
      expect(html).toContain('Page not found')
    })

    it(`a published post passes through to render untouched (${name})`, async () => {
      const res = await middleware(req('/blog/understanding-home-appraisals', ua))
      expect(res.status).toBe(200)
      expect(res.headers.get('x-middleware-next')).toBe('1')
    })
  }

  it('a failed read passes through (the route renders as before, never a 404)', async () => {
    const res = await middleware(req('/blog/some-post-the-read-could-not-answer', UAS.browser))
    expect(res.status).toBe(200)
    expect(res.headers.get('x-middleware-next')).toBe('1')
  })

  it('looks up the decoded slug and leaves the index, category and page families alone', async () => {
    await middleware(req('/blog/zz%2Dunknown', UAS.browser))
    expect(lookup).toHaveBeenLastCalledWith('zz-unknown')
    lookup.mockClear()
    for (const p of ['/blog', '/blog/category/Market%20Reports', '/blog/page/2']) {
      await middleware(req(p, UAS.browser))
    }
    expect(lookup).not.toHaveBeenCalled()
  })
})
