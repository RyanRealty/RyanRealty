import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EditionListItem } from '@/lib/data/market-report/editions'

const list = vi.fn<() => Promise<EditionListItem[]>>()

vi.mock('@/lib/data/market-report/editions', () => ({
  listPublishedEditions: () => list(),
  editionPdfObjectUrl: (path: string) =>
    `https://example.supabase.co/storage/v1/object/public/market-reports/${path}`,
}))

import { GET } from './route'

function edition(month: string, over: Partial<EditionListItem> = {}): EditionListItem {
  return {
    edition_month: `${month}-01`,
    slug: `central-oregon-${month}`,
    title: 'Central Oregon Market Report',
    summary: null,
    pdf_path: `central-oregon/${month.slice(0, 4)}/ryan-realty-central-oregon-market-report-${month}.pdf`,
    pdf_bytes: 1_000_000,
    page_count: 19,
    published_at: '2026-09-08T15:30:00Z',
    data_complete_through: '2026-09-03',
    figures: null,
    ...over,
  }
}

function call(month: string, headers: Record<string, string> = {}) {
  return GET(new Request(`https://ryan-realty.com/housing-market/reports/monthly/${month}/pdf`, { headers }), {
    params: Promise.resolve({ month }),
  })
}

describe('GET /housing-market/reports/monthly/[month]/pdf', () => {
  beforeEach(() => {
    list.mockReset()
    list.mockResolvedValue([edition('2026-08'), edition('2026-07', { pdf_path: null })])
  })

  it('redirects a published month to its stored file, as an attachment with a readable name', async () => {
    const res = await call('2026-08')
    expect(res.status).toBe(302)
    const location = new URL(res.headers.get('location')!)
    expect(location.pathname).toBe(
      '/storage/v1/object/public/market-reports/central-oregon/2026/ryan-realty-central-oregon-market-report-2026-08.pdf',
    )
    expect(location.searchParams.get('download')).toBe('ryan-realty-central-oregon-market-report-2026-08.pdf')
    expect(res.headers.get('cache-control')).toContain('s-maxage=3600')
  })

  it('404s a malformed month without reading anything', async () => {
    for (const bad of ['2026-8', '2026-13', 'latest']) {
      const res = await call(bad)
      expect(res.status).toBe(404)
    }
    expect(list).not.toHaveBeenCalled()
  })

  it('404s a month with no published edition, and one with no stored file', async () => {
    expect((await call('2026-09')).status).toBe(404)
    expect((await call('2026-07')).status).toBe(404)
  })

  it('answers the app router with an empty 204 so it navigates the browser here instead', async () => {
    const res = await call('2026-08', { RSC: '1' })
    expect(res.status).toBe(204)
    expect(res.headers.get('location')).toBeNull()
    expect(list).not.toHaveBeenCalled()
  })
})
