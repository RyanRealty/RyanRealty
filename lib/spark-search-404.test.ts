import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchSparkListingsPage } from '@/lib/spark'

/**
 * A search that 404s. The sync reads it as an empty page (unchanged); the
 * outreach relist check asks for it as an error, because "Spark said nothing
 * is listed here" and "the endpoint was not there" must not look alike on a
 * send path (2026-09-30 review of lib/prospecting/sparkRelist.ts).
 */
afterEach(() => {
  vi.unstubAllGlobals()
})

function stub404() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{"D":{"Success":false,"Message":"Not Found"}}', { status: 404 })),
  )
}

describe('fetchSparkListingsPage on a 404', () => {
  it('answers an empty page by default (the sync)', async () => {
    stub404()
    const page = await fetchSparkListingsPage('token', { filter: "StreetNumber Eq '1'" })
    expect(page.D?.Results).toEqual([])
    expect(page.D?.Pagination?.TotalRows).toBe(0)
  })

  it('throws when the caller asked for a 404 to be an error (the relist check)', async () => {
    stub404()
    await expect(
      fetchSparkListingsPage('token', { filter: "StreetNumber Eq '1'", notFoundAsError: true, retryOn429: false }),
    ).rejects.toThrow(/Spark API error 404/)
  })
})
