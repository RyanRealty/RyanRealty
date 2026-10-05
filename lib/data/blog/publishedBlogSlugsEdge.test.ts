import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  lookupPublishedBlogSlugEdge,
  resetPublishedBlogSlugsEdgeCache,
  type BlogSlugEdgeOptions,
} from './publishedBlogSlugsEdge'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function opts(fetchImpl: typeof fetch, clock: { t: number }): BlogSlugEdgeOptions {
  return { fetchImpl, now: () => clock.t, supabaseUrl: 'https://x.supabase.co', anonKey: 'anon' }
}

describe('lookupPublishedBlogSlugEdge', () => {
  beforeEach(() => resetPublishedBlogSlugsEdgeCache())

  it('reads published slugs only, with the anon key, and answers published / missing', async () => {
    const clock = { t: 1_000_000 }
    const f = vi.fn(async () => jsonResponse([{ slug: 'understanding-home-appraisals' }, { slug: 'bend-market' }]))
    const o = opts(f as unknown as typeof fetch, clock)
    expect(await lookupPublishedBlogSlugEdge('understanding-home-appraisals', o)).toBe('published')
    expect(await lookupPublishedBlogSlugEdge('zz-not-a-post', o)).toBe('missing')
    expect(f).toHaveBeenCalledTimes(1)
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('/rest/v1/blog_posts?')
    expect(new URL(url).searchParams.get('status')).toBe('eq.published')
    expect(new URL(url).searchParams.get('select')).toBe('slug')
    expect((init.headers as Record<string, string>).apikey).toBe('anon')
  })

  it('re-reads once before calling a slug missing when the set is older than 30s (a post just published)', async () => {
    const clock = { t: 1_000_000 }
    let rows = [{ slug: 'old-post' }]
    const f = vi.fn(async () => jsonResponse(rows))
    const o = opts(f as unknown as typeof fetch, clock)
    expect(await lookupPublishedBlogSlugEdge('old-post', o)).toBe('published')
    rows = [{ slug: 'old-post' }, { slug: 'new-post' }]
    clock.t += 31_000
    expect(await lookupPublishedBlogSlugEdge('new-post', o)).toBe('published')
    expect(f).toHaveBeenCalledTimes(2)
  })

  it('a fresh set answers misses without another read; a stale one (5 min) is refetched', async () => {
    const clock = { t: 1_000_000 }
    const f = vi.fn(async () => jsonResponse([{ slug: 'a' }]))
    const o = opts(f as unknown as typeof fetch, clock)
    await lookupPublishedBlogSlugEdge('a', o)
    clock.t += 10_000
    expect(await lookupPublishedBlogSlugEdge('zz', o)).toBe('missing')
    expect(f).toHaveBeenCalledTimes(1)
    clock.t += 5 * 60_000
    expect(await lookupPublishedBlogSlugEdge('a', o)).toBe('published')
    expect(f).toHaveBeenCalledTimes(2)
  })

  it('concurrent lookups share one read', async () => {
    const clock = { t: 1_000_000 }
    const f = vi.fn(async () => jsonResponse([{ slug: 'a' }]))
    const o = opts(f as unknown as typeof fetch, clock)
    const r = await Promise.all([lookupPublishedBlogSlugEdge('a', o), lookupPublishedBlogSlugEdge('b', o), lookupPublishedBlogSlugEdge('a', o)])
    expect(r).toEqual(['published', 'missing', 'published'])
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('every failure is unknown (pass through), never missing', async () => {
    const clock = { t: 1_000_000 }
    const cases: Array<typeof fetch> = [
      (async () => jsonResponse({ message: 'denied' }, 401)) as unknown as typeof fetch,
      (async () => jsonResponse({ not: 'an array' })) as unknown as typeof fetch,
      (async () => jsonResponse([])) as unknown as typeof fetch,
      (async () => {
        throw new Error('timeout')
      }) as unknown as typeof fetch,
    ]
    for (const f of cases) {
      resetPublishedBlogSlugsEdgeCache()
      expect(await lookupPublishedBlogSlugEdge('zz', opts(f, clock))).toBe('unknown')
    }
    resetPublishedBlogSlugsEdgeCache()
    expect(
      await lookupPublishedBlogSlugEdge('zz', { fetchImpl: cases[0], supabaseUrl: '', anonKey: '' }),
    ).toBe('unknown')
  })

  it('a failed refresh keeps the slug unknown rather than 404ing it, and is not memoised', async () => {
    const clock = { t: 1_000_000 }
    let fail = false
    const f = vi.fn(async () => (fail ? jsonResponse({}, 503) : jsonResponse([{ slug: 'a' }])))
    const o = opts(f as unknown as typeof fetch, clock)
    await lookupPublishedBlogSlugEdge('a', o)
    clock.t += 31_000
    fail = true
    expect(await lookupPublishedBlogSlugEdge('new-post', o)).toBe('unknown')
    fail = false
    expect(await lookupPublishedBlogSlugEdge('a', o)).toBe('published')
  })

  it('the seeded closing-costs post is published with no row, as getBlogPostBySlug serves it', async () => {
    const f = vi.fn(async () => jsonResponse([{ slug: 'a' }]))
    expect(
      await lookupPublishedBlogSlugEdge('closing-costs-buyers-bend-oregon', opts(f as unknown as typeof fetch, { t: 1 })),
    ).toBe('published')
    expect(f).not.toHaveBeenCalled()
  })
})
