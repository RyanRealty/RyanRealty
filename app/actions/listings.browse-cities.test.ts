import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * getBrowseCities reads market_pulse_live, then the listings table, then falls
 * back to a static city list. It used to try get_listings_breakdown() as a
 * third read with the ANON client. That function is an admin function with
 * EXECUTE granted to service_role only, so the call answered "permission denied
 * for function get_listings_breakdown" every time it ran (57 times in one
 * database-restart window, 2026-10-14). Pinned: the anon client never calls
 * that RPC, and the static fallback says so once instead of failing quietly.
 */
const rpc = vi.hoisted(() => vi.fn(async (_fn: string) => ({ data: null, error: { message: 'permission denied' } })))
const pulseRows = vi.hoisted(() => vi.fn(async (_args: unknown): Promise<unknown[]> => []))
const fetchAll = vi.hoisted(() => vi.fn(async (..._args: unknown[]): Promise<unknown[]> => []))

vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc }) }))
vi.mock('@/lib/data', () => ({
  getMarketPulseRowsByGeoType: (args: unknown) => pulseRows(args),
}))
vi.mock('@/lib/supabase/paginate', () => ({ fetchAllRows: (...args: unknown[]) => fetchAll(...args) }))
// Run the uncached body every time.
vi.mock('@/lib/data/cache/next-cache', () => ({
  unstable_cache: <T extends (...a: never[]) => unknown>(fn: T) => fn,
}))

const env = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY }
beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-test-key'
})
// The actions module is heavy: load it once, up front.
beforeAll(async () => {
  await import('./listings')
}, 60_000)
afterAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = env.url
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = env.key
})
beforeEach(() => {
  rpc.mockClear()
  pulseRows.mockReset().mockResolvedValue([])
  fetchAll.mockReset().mockResolvedValue([])
})

describe('getBrowseCities', () => {
  it('serves the market_pulse_live cities when the cache has them', async () => {
    pulseRows.mockResolvedValue([
      { geo_label: 'Bend', active_count: 412 },
      { geo_label: 'Redmond', active_count: 97 },
      { geo_label: 'Sisters', active_count: 31 },
      { geo_label: 'La Pine', active_count: 44 },
    ])
    const { getBrowseCities } = await import('./listings')
    const out = await getBrowseCities()
    expect(out[0]).toEqual({ City: 'Bend', count: 412 })
    expect(out).toHaveLength(4)
    expect(fetchAll).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('when both live reads are empty it serves the static list, warns once, and never calls the admin RPC', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const { getBrowseCities } = await import('./listings')
      const out = await getBrowseCities()
      expect(out.map((c) => c.City)).toContain('Bend')
      expect(out.every((c) => c.count === 0)).toBe(true)
      expect(rpc).not.toHaveBeenCalled()
      expect(warn).toHaveBeenCalledTimes(1)
      expect(String(warn.mock.calls[0][0])).toContain('[browse-cities]')
    } finally {
      warn.mockRestore()
    }
  })
})
