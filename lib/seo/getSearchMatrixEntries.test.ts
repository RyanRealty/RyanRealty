// The harness loads Next's server baseline, so it must come before next/cache.
import { staticGenerationHarness } from '@/test/next-fetch-cache-harness'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SearchMatrixInventoryRow } from '@/lib/data/listings/getSearchMatrixInventory'

/*
 * The matrix reads behind the sitemap and the search page's robots + canonical
 * (2026-10-14, the /sitemaps/matrix.xml defect). Only the DAL reads are mocked;
 * makeResilientCached runs on Next 16.1.6's REAL unstable_cache inside the
 * static-generation harness, so what is cached and what is not is the real
 * answer. No network, no Supabase.
 */

const inventory = vi.fn<() => Promise<SearchMatrixInventoryRow[] | null>>()
vi.mock('@/lib/data/listings/getSearchMatrixInventory', () => ({
  getSearchMatrixInventory: () => inventory(),
  getSubdivisionLifetimeCounts: async () => [],
  getSubdivisionDescriptionKeys: async () => [],
  getMatrixNeighborhoods: async () => [],
}))

import {
  getMatrixCityPresetDecisionSet,
  getMatrixCityPresetNoIndex,
  getSearchMatrixSitemapEntries,
  matrixCityPresetNoIndexFromSet,
  resolveMatrixNoIndex,
  resolvePresetTypeTwinPath,
} from '@/lib/seo/getSearchMatrixEntries'

function row(overrides: Partial<SearchMatrixInventoryRow> = {}): SearchMatrixInventoryRow {
  return {
    standard_status: 'Active',
    list_price: 500_000,
    city_lower: 'redmond',
    subdivision_lower: null,
    boundary_neighborhood: null,
    property_type: 'A',
    property_sub_type: 'Single Family Residence',
    year_built: 2005,
    lot_size_acres: 0.2,
    pool_yn: false,
    fireplace_yn: false,
    waterfront_yn: false,
    view_types: null,
    hoa_amenities: null,
    parking_features: null,
    ...overrides,
  }
}

/** Redmond: four single-family homes and four commercial (type F); no condos, no farms. */
function healthyInventory(): SearchMatrixInventoryRow[] {
  return [
    ...Array.from({ length: 4 }, () => row()),
    ...Array.from({ length: 4 }, () => row({ property_type: 'F', property_sub_type: 'Retail' })),
  ]
}

const BASE = new Date('2026-10-14T12:00:00Z')

beforeEach(() => {
  inventory.mockReset()
})

describe('a good decision (the happy path, unchanged)', () => {
  it('counts the city x preset sets the sitemap loop and the page both read', async () => {
    inventory.mockResolvedValue(healthyInventory())
    const h = staticGenerationHarness()
    await h.run(async () => {
      const decision = await getMatrixCityPresetDecisionSet()
      expect(decision).not.toBeNull()
      expect(decision!.positiveCityPresets.has('/homes-for-sale/redmond/single-family')).toBe(true)
      expect(decision!.positiveCityPresets.has('/homes-for-sale/redmond/commercial')).toBe(true)
      // Enumerated and zero: the verified-zero case the page noindexes.
      expect(decision!.cityPresetKeys.has('/homes-for-sale/redmond/farms')).toBe(true)
      expect(decision!.positiveCityPresets.has('/homes-for-sale/redmond/farms')).toBe(false)
      expect(matrixCityPresetNoIndexFromSet(decision, 'redmond', 'farms')).toBe(true)
      expect(matrixCityPresetNoIndexFromSet(decision, 'redmond', 'single-family')).toBe(false)
    })
  })

  it('the page noindexes a verified zero and canonicalizes a positive type preset to its type page', async () => {
    inventory.mockResolvedValue(healthyInventory())
    const h = staticGenerationHarness()
    await h.run(async () => {
      expect(await resolveMatrixNoIndex(['redmond', 'farms'], 'farms', false)).toBe(true)
      expect(await getMatrixCityPresetNoIndex('redmond', 'condos')).toBe(true)
      expect(await resolveMatrixNoIndex(['redmond', 'commercial'], 'commercial', false)).toBe(false)
      expect(await resolvePresetTypeTwinPath(['redmond', 'commercial'], 'commercial')).toBe(
        '/cities/redmond/types/commercial',
      )
      expect(await resolvePresetTypeTwinPath(['redmond', 'single-family'], 'single-family')).toBe(
        '/cities/redmond/types/single-family',
      )
      // Not a type preset: never a twin.
      expect(await resolvePresetTypeTwinPath(['redmond', 'under-1m'], 'under-1m')).toBeNull()
    })
  })
})

describe('a failed decision read', () => {
  it('stays unknown, and the PAGE keeps failing OPEN on it', async () => {
    inventory.mockResolvedValue(null) // getSearchMatrixInventory swallows a statement timeout into null
    const h = staticGenerationHarness()
    await h.run(async () => {
      expect(await getMatrixCityPresetDecisionSet()).toBeNull()
      // Never noindex a live page on a read blip.
      expect(await resolveMatrixNoIndex(['redmond', 'farms'], 'farms', false)).toBe(false)
      expect(await resolveMatrixNoIndex(['redmond', 'bend-acres', 'farms'], 'farms', false)).toBe(false)
      expect(await getMatrixCityPresetNoIndex('redmond', 'condos')).toBe(false)
      // And never canonicalize away on an unknown count.
      expect(await resolvePresetTypeTwinPath(['redmond', 'commercial'], 'commercial')).toBeNull()
      // The four-segment matrix is omitted, as it always was.
      expect(await getSearchMatrixSitemapEntries('https://ryan-realty.com', BASE)).toEqual([])
    })
    expect(matrixCityPresetNoIndexFromSet(null, 'redmond', 'farms')).toBe(false)
  })

  it('is retried once uncached, so a transient timeout still resolves the decision', async () => {
    inventory.mockResolvedValueOnce(null).mockResolvedValue(healthyInventory())
    const h = staticGenerationHarness()
    await h.run(async () => {
      const decision = await getMatrixCityPresetDecisionSet()
      expect(decision).not.toBeNull()
      expect(decision!.positiveCityPresets.has('/homes-for-sale/redmond/commercial')).toBe(true)
    })
    expect(inventory).toHaveBeenCalledTimes(2)
  })

  it('is not cached: the next read after the database recovers is the real decision', async () => {
    // It used to return null from the build, which unstable_cache keeps for the
    // whole window (lib/data/cache/next-cache.test.ts), so a recovered database
    // still read as unknown and the last good matrix was gone.
    inventory.mockResolvedValue(null)
    const h = staticGenerationHarness()
    await h.run(async () => {
      expect(await getMatrixCityPresetDecisionSet()).toBeNull()
      await h.flushWrites()
      inventory.mockResolvedValue(healthyInventory())
      h.clock.now += 120_000
      const decision = await getMatrixCityPresetDecisionSet()
      expect(decision).not.toBeNull()
      expect(decision!.positiveCityPresets.has('/homes-for-sale/redmond/single-family')).toBe(true)
    })
  })

  it('does not replace a good cached matrix with an unknown one', async () => {
    inventory.mockResolvedValue(healthyInventory())
    const h = staticGenerationHarness()
    await h.run(async () => {
      expect(await getMatrixCityPresetDecisionSet()).not.toBeNull()
      await h.flushWrites()
      // A later render, past the hour: the entry is stale, the callback runs
      // again, and the database fails. unstable_cache logs the failed
      // revalidation and hands back the last good value; nothing replaces it.
      h.newRender()
      inventory.mockResolvedValue(null)
      h.clock.now += 3_700_000
      const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
      const decision = await getMatrixCityPresetDecisionSet()
      await h.flushWrites()
      quiet.mockRestore()
      expect(decision).not.toBeNull()
      expect(decision!.positiveCityPresets.has('/homes-for-sale/redmond/commercial')).toBe(true)
    })
  })
})
