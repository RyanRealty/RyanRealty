// The harness loads Next's server baseline, so it must come before next/cache.
import { staticGenerationHarness } from '@/test/next-fetch-cache-harness'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * CI 2026-09-25 (PR #382, ci:route-content-floor): with the database degraded,
 * /blog/awbrey-glen-median-price-hoa-dues-2026 rendered the 404 page (31
 * words) twice. The read failed, the resilient wrapper answered null, the page
 * called notFound(), and ISR keeps a 404 for the page's revalidate window.
 * A failed read must be an error, never "no such post".
 */

type Result = { data: unknown; error: { message: string } | null }
let answer: () => Result

vi.mock('@/lib/data/client', () => ({
  supabaseAnon: () => ({
    from: () => {
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => answer(),
      }
      return q
    },
  }),
}))

const { getBlogPostBySlug } = await import('./getBlogPostBySlug')

const ROW = {
  id: 'p1',
  title: 'Awbrey Glen homes',
  slug: 'awbrey-glen-test-post',
  content: 'Body',
  excerpt: null,
  category: 'Communities',
  tags: null,
  hero_image_url: null,
  published_at: '2026-09-09T16:00:00Z',
  updated_at: '2026-09-09T15:59:10Z',
  author_broker_id: null,
  seo_title: null,
  seo_description: null,
}

describe('getBlogPostBySlug', () => {
  beforeEach(() => {
    answer = () => ({ data: ROW, error: null })
  })

  it('returns the published post', async () => {
    const h = staticGenerationHarness()
    await h.run(async () => {
      expect(await getBlogPostBySlug('awbrey-glen-test-post')).toMatchObject({ slug: 'awbrey-glen-test-post', title: 'Awbrey Glen homes' })
    })
  })

  it('returns null only when no published post has the slug', async () => {
    answer = () => ({ data: null, error: null })
    const h = staticGenerationHarness()
    await h.run(async () => {
      expect(await getBlogPostBySlug('no-such-post-anywhere')).toBeNull()
    })
  })

  it('throws when the read fails, so the page never renders a 404 for a real post', async () => {
    answer = () => ({ data: null, error: { message: 'canceling statement due to statement timeout' } })
    const h = staticGenerationHarness()
    await h.run(async () => {
      await expect(getBlogPostBySlug('awbrey-glen-test-post-down')).rejects.toThrow(/read failed twice; not a missing post/)
    })
  })

  it('caches nothing from a failed read: the next request gets the post', async () => {
    const h = staticGenerationHarness()
    await h.run(async () => {
      answer = () => ({ data: null, error: { message: 'connection reset' } })
      await expect(getBlogPostBySlug('awbrey-glen-test-post-blip')).rejects.toThrow()
      await h.flushWrites()
      answer = () => ({ data: ROW, error: null })
      expect(await getBlogPostBySlug('awbrey-glen-test-post-blip')).toMatchObject({ title: 'Awbrey Glen homes' })
    })
  })
})
