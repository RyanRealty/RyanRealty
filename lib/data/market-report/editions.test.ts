// The harness loads Next's server baseline, so it must come before next/cache.
import { staticGenerationHarness } from '@/test/next-fetch-cache-harness'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * A failed read is an error, never "no such edition" and never "no editions":
 * null made /housing-market/reports/monthly/<month> call notFound(), an empty
 * list made the archive render its empty, noindex state and the PDF route
 * answer 404, and ISR or the CDN kept each for its window. The rule PR #385 set
 * for the blog and the weekly reports (getMarketReportBySlug).
 */

type Result = { data: unknown; error: { message: string } | null }
let answer: () => Result

vi.mock('@/lib/data/client', () => ({
  createServiceClient: () => {
    throw new Error('service client is not used by the public reads')
  },
  supabaseAnon: () => ({
    from: () => {
      const q = {
        select: () => q,
        eq: () => q,
        order: () => q,
        range: async () => answer(),
        maybeSingle: async () => answer(),
      }
      return q
    },
  }),
}))

const { getPublishedEdition, listPublishedEditions } = await import('./editions')

const ITEM = {
  edition_month: '2026-08-01',
  published_at: '2026-09-02T12:00:00Z',
  pdf_path: 'central-oregon/2026/ryan-realty-central-oregon-market-report-2026-08.pdf',
}

describe('getPublishedEdition', () => {
  beforeEach(() => {
    answer = () => ({ data: ITEM, error: null })
  })

  it('returns the edition', async () => {
    const h = staticGenerationHarness()
    await h.run(async () => {
      expect(await getPublishedEdition('2026-08')).toMatchObject({ edition_month: '2026-08-01' })
    })
  })

  it('returns null only when no edition of that month is published', async () => {
    answer = () => ({ data: null, error: null })
    const h = staticGenerationHarness()
    await h.run(async () => {
      expect(await getPublishedEdition('1999-01')).toBeNull()
    })
  })

  it('throws when the read fails, and caches nothing from it', async () => {
    const h = staticGenerationHarness()
    await h.run(async () => {
      answer = () => ({ data: null, error: { message: 'canceling statement due to statement timeout' } })
      await expect(getPublishedEdition('2026-07')).rejects.toThrow(/read failed twice; not a missing edition/)
      await h.flushWrites()
      answer = () => ({ data: { ...ITEM, edition_month: '2026-07-01' }, error: null })
      expect(await getPublishedEdition('2026-07')).toMatchObject({ edition_month: '2026-07-01' })
    })
  })
})

describe('listPublishedEditions', () => {
  it('returns the list, and an empty one only when nothing is published', async () => {
    const h = staticGenerationHarness()
    await h.run(async () => {
      answer = () => ({ data: [ITEM], error: null })
      expect(await listPublishedEditions()).toHaveLength(1)
    })
  })

  it('throws when the read fails, and caches nothing from it', async () => {
    const h = staticGenerationHarness()
    await h.run(async () => {
      answer = () => ({ data: null, error: { message: 'connection reset' } })
      await expect(listPublishedEditions()).rejects.toThrow(/read failed twice; not an empty archive/)
      await h.flushWrites()
      answer = () => ({ data: [ITEM, { ...ITEM, edition_month: '2026-07-01' }], error: null })
      expect(await listPublishedEditions()).toHaveLength(2)
    })
  })
})
