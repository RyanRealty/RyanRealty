/**
 * The live map tile is cached by slug and the map inputs (rule 30).
 * A miss is not stored. A price that does not move a pin does not rebuild it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CmaComp, CmaSubject } from '@/lib/cma/types'

const state = vi.hoisted(() => ({
  kind: 'store' as 'store' | 'missing',
  builds: 0,
  tile: true,
}))

const stored = vi.hoisted(() => new Map<string, unknown>())

vi.mock('@/lib/data/cache/next-cache', () => ({
  unstable_cache: (cb: () => Promise<unknown>, keyParts: string[]) => {
    return async () => {
      if (state.kind === 'missing') {
        throw new Error('Invariant: incrementalCache missing in unstable_cache cb')
      }
      const key = keyParts.join('|')
      if (stored.has(key)) return stored.get(key)
      const value = await cb()
      stored.set(key, value)
      return value
    }
  },
}))

vi.mock('@/lib/cma/map', async () => {
  const actual = await vi.importActual<typeof import('@/lib/cma/map')>('@/lib/cma/map')
  return {
    ...actual,
    buildCmaMapDataUri: vi.fn(async () => {
      state.builds += 1
      if (!state.tile) return null
      return {
        dataUri: 'data:image/png;base64,TILE',
        pointCount: 1,
        view: { centerLat: 44.05, centerLng: -121.3, zoom: 14, width: 640, height: 360 },
        pins: [],
        boundaryShown: false,
        parentShown: false,
        radiusShown: false,
        outlineRings: [],
        streetPlaceShown: null,
      }
    }),
  }
})

import { cmaMapInputHash, cmaMapInputKey, loadCmaMapTile } from '@/lib/cma/map-tile-cache'

const subject = {
  streetAddress: '2902 Pinnacle',
  city: 'Bend',
  state: 'OR',
  postalCode: '97701',
  latitude: 44.06,
  longitude: -121.3,
  propertySubType: 'Single Family Residence',
} as CmaSubject

const comp = {
  address: '1 Eaglenest',
  latitude: 44.061,
  longitude: -121.301,
  propertySubType: 'Single Family Residence',
  closePrice: 500_000,
} as CmaComp

const args = { subject: { latitude: 44.06, longitude: -121.3 }, tiersUsed: [] }

beforeEach(() => {
  state.kind = 'store'
  state.builds = 0
  state.tile = true
  stored.clear()
})

describe('loadCmaMapTile', () => {
  it('remembers a finished tile and does not rebuild it', async () => {
    const first = await loadCmaMapTile({ slug: 'cma-2902-pinnacle', subject, comps: [comp], args })
    const second = await loadCmaMapTile({ slug: 'cma-2902-pinnacle', subject, comps: [comp], args })
    expect(first.dataUri).toBe('data:image/png;base64,TILE')
    expect(second.dataUri).toBe(first.dataUri)
    expect(state.builds).toBe(1)
  })

  it('does not store a miss, so the next view tries again', async () => {
    state.tile = false
    const first = await loadCmaMapTile({ slug: 'cma-2902-pinnacle-miss', subject, comps: [comp], args })
    const second = await loadCmaMapTile({ slug: 'cma-2902-pinnacle-miss', subject, comps: [comp], args })
    expect(first.dataUri).toBeNull()
    expect(second.dataUri).toBeNull()
    expect(state.builds).toBe(2)
    expect(stored.size).toBe(0)
  })

  it('keeps the tile when only the sale price changes', async () => {
    await loadCmaMapTile({ slug: 'cma-2902-pinnacle-price', subject, comps: [{ ...comp, closePrice: 483_000 }], args })
    await loadCmaMapTile({ slug: 'cma-2902-pinnacle-price', subject, comps: [{ ...comp, closePrice: 591_000 }], args })
    expect(state.builds).toBe(1)
  })

  it('rebuilds when a pin moves', async () => {
    await loadCmaMapTile({ slug: 'cma-2902-pinnacle-move', subject, comps: [comp], args })
    await loadCmaMapTile({
      slug: 'cma-2902-pinnacle-move',
      subject,
      comps: [{ ...comp, latitude: 44.2 }],
      args,
    })
    expect(state.builds).toBe(2)
  })

  it('falls through when incrementalCache is missing, and remembers the tile in process', async () => {
    state.kind = 'missing'
    const first = await loadCmaMapTile({ slug: 'cma-2902-pinnacle-local', subject, comps: [comp], args })
    const second = await loadCmaMapTile({ slug: 'cma-2902-pinnacle-local', subject, comps: [comp], args })
    expect(first.dataUri).toContain('data:image/png')
    expect(second.dataUri).toBe(first.dataUri)
    expect(state.builds).toBe(1)
  })

  it('does not remember a miss when incrementalCache is missing', async () => {
    state.kind = 'missing'
    state.tile = false
    await loadCmaMapTile({ slug: 'cma-2902-pinnacle-local-miss', subject, comps: [comp], args })
    await loadCmaMapTile({ slug: 'cma-2902-pinnacle-local-miss', subject, comps: [comp], args })
    expect(state.builds).toBe(2)
  })

  it('hashes the map slice, not the sale price', () => {
    const low = cmaMapInputKey('cma-2902-pinnacle', subject, [{ ...comp, closePrice: 483_000 }], {})
    const high = cmaMapInputKey('cma-2902-pinnacle', subject, [{ ...comp, closePrice: 591_000 }], {})
    expect(cmaMapInputHash(low)).toBe(cmaMapInputHash(high))
    const moved = cmaMapInputKey('cma-2902-pinnacle', subject, [{ ...comp, latitude: 44.2 }], {})
    expect(cmaMapInputHash(moved)).not.toBe(cmaMapInputHash(low))
  })
})
