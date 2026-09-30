// The harness loads Next's server baseline, so it must come before next/cache.
import { staticGenerationHarness } from '@/test/next-fetch-cache-harness'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * A failed read is an error, never "no such report": returning null made
 * /housing-market/reports/[slug] call notFound() and ISR kept that 404 for its
 * revalidate window (3600 s). Same class as getBlogPostBySlug (CI 2026-09-25).
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

const { getMarketReportBySlug } = await import('./getMarketReports')

const ROW = {
  slug: 'weekly-test-report',
  period_type: 'weekly',
  period_start: '2026-09-14',
  period_end: '2026-09-20',
  title: 'Central Oregon market, week of Sep 14',
  image_storage_path: null,
  content_html: '<p>Report body</p>',
  created_at: '2026-09-21T12:00:00Z',
}

describe('getMarketReportBySlug', () => {
  beforeEach(() => {
    answer = () => ({ data: ROW, error: null })
  })

  it('returns the report', async () => {
    const h = staticGenerationHarness()
    await h.run(async () => {
      expect(await getMarketReportBySlug('weekly-test-report')).toMatchObject({ slug: 'weekly-test-report' })
    })
  })

  it('returns null only when no report has the slug', async () => {
    answer = () => ({ data: null, error: null })
    const h = staticGenerationHarness()
    await h.run(async () => {
      expect(await getMarketReportBySlug('no-such-report-anywhere')).toBeNull()
    })
  })

  it('throws when the read fails, and caches nothing from it', async () => {
    const h = staticGenerationHarness()
    await h.run(async () => {
      answer = () => ({ data: null, error: { message: 'canceling statement due to statement timeout' } })
      await expect(getMarketReportBySlug('weekly-test-report-blip')).rejects.toThrow(/read failed twice; not a missing report/)
      await h.flushWrites()
      answer = () => ({ data: ROW, error: null })
      expect(await getMarketReportBySlug('weekly-test-report-blip')).toMatchObject({ title: ROW.title })
    })
  })
})
