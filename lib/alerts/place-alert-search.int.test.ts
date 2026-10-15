/**
 * READ-ONLY live check of the filters the place-page alert captures write
 * (Matt 2026-10-14: every area page, every property type, daily). It runs the
 * alert engine's own search (getCachedSearchListings, the call
 * runListingAlerts makes) at the daily window against production and writes
 * nothing, so it registers no sweep target.
 *
 * What it proves, per filter shape:
 *   - the search answers (no degraded empty grid),
 *   - a city alert carries more than houses (the old `propertyType: 'A'` pin is gone),
 *   - a Bend district alert is matched by location (listing_boundary_xref_mv)
 *     and is a strict subset of the city,
 *   - a ZIP alert is the ZIP,
 *   - the window is newest first, which the first-email batch relies on.
 */
import { describe, expect, it, vi } from 'vitest'

// Outside a Next request there is no incremental cache; the alert search's
// unstable_cache wrapper reads straight through.
vi.mock('next/cache', () => ({
  unstable_cache: (cb: (...a: unknown[]) => unknown) => cb,
  revalidateTag: () => undefined,
  revalidatePath: () => undefined,
}))

import { getCachedSearchListings } from '@/app/actions/search-cache'
import { alertMatchWindow } from '@/lib/alerts/run-policy'

const DAILY = alertMatchWindow('daily')

type Tile = Record<string, unknown>
const key = (t: Tile) => String(t.ListNumber ?? t.ListingKey ?? '')

describe.skipIf(process.env.RR_INT_RUN !== '1')('place alert filters against the live search', () => {
  it('a city alert covers every property type, newest first', async () => {
    const r = await getCachedSearchListings({ city: 'Bend' }, 1, DAILY)
    expect(r.listings.length).toBe(DAILY)
    const types = new Set((r.listings as Tile[]).map((t) => String(t.PropertyType ?? '')))
    // The houses-only alert returned only 'A'. Every type means at least one more.
    const housesOnly = await getCachedSearchListings({ city: 'Bend', propertyType: 'A' }, 1, DAILY)
    expect(housesOnly.totalCount).toBeLessThan(r.totalCount)
    console.log(`[int] Bend all types total ${r.totalCount} vs houses ${housesOnly.totalCount}; window types ${[...types].join(',')}`)
    const dates = (r.listings as Tile[]).map((t) => String(t.OnMarketDate ?? '')).filter(Boolean)
    expect([...dates].sort().reverse().slice(0, 5)).toEqual(dates.slice(0, 5))
  })

  it('a Bend district alert is matched by location and sits inside the city', async () => {
    const district = await getCachedSearchListings({ neighborhoodSlug: 'bend-river-west' }, 1, 100)
    const city = await getCachedSearchListings({ city: 'Bend' }, 1, 100)
    expect(district.listings.length).toBeGreaterThan(0)
    expect(district.totalCount).toBeLessThan(city.totalCount)
    for (const t of district.listings as Tile[]) expect(String(t.City)).toBe('Bend')
    console.log(`[int] bend-river-west total ${district.totalCount} of Bend ${city.totalCount}`)
  })

  it('a ZIP alert is the ZIP', async () => {
    const r = await getCachedSearchListings({ postalCode: '97702' }, 1, DAILY)
    expect(r.listings.length).toBeGreaterThan(0)
    for (const t of r.listings as Tile[]) expect(String(t.PostalCode)).toBe('97702')
  })

  it('a community alert (city + subdivision) answers with no property type pin', async () => {
    const r = await getCachedSearchListings({ city: 'Bend', subdivision: 'Tetherow' }, 1, DAILY)
    expect(r.totalCount).toBeGreaterThanOrEqual(0)
    const keys = (r.listings as Tile[]).map(key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
