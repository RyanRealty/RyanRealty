import { describe, it, expect, vi } from 'vitest'
import { resolveAreaRedirectWith } from './resolveAreaRedirect'

/**
 * Contract: a MARKETING-level slug that misses the /subdivisions plat lookup
 * must resolve to its canonical home so the page can 308 instead of soft-404ing
 * (hollow HTTP 200). This pins the resolution rules:
 *
 *   - Resort / area registry slug      → /communities/<slug>   (no DB read)
 *   - Bend-neighborhood boundary slug  → /cities/bend/<slug>   (one boundaries read)
 *   - anything else                    → null                  (genuine notFound)
 *
 * The boundary probe is injected so every branch is exercised without a
 * Supabase mock. `never()` proves the resort branch short-circuits before any DB.
 */

const never = vi.fn(async () => {
  throw new Error('boundary probe must not run for a registry hit')
})

describe('resolveAreaRedirect', () => {
  describe('resort / area community branch (no DB)', () => {
    it.each([
      ['tetherow', '/communities/tetherow'],
      ['broken-top', '/communities/broken-top'],
      ['sunriver', '/communities/sunriver'],
      ['eagle-crest', '/communities/eagle-crest'],
      ['three-rivers', '/communities/three-rivers'],
      ['black-butte-ranch', '/communities/black-butte-ranch'],
    ])('bare registry slug %s → %s', async (slug, path) => {
      const res = await resolveAreaRedirectWith(slug, never)
      expect(res).toEqual({ path, reason: 'resort-community' })
    })

    it('short-circuits before the boundary probe for a registry slug', async () => {
      const probe = vi.fn(async () => true)
      await resolveAreaRedirectWith('tetherow', probe)
      expect(probe).not.toHaveBeenCalled()
    })

    it.each([
      ['bend-tetherow', '/communities/tetherow'],
      ['redmond-eagle-crest', '/communities/eagle-crest'],
      ['powell-butte-brasada-ranch', '/communities/brasada-ranch'],
    ])('city-prefixed registry slug %s → %s', async (slug, path) => {
      const res = await resolveAreaRedirectWith(slug, never)
      expect(res).toEqual({ path, reason: 'resort-community' })
    })
  })

  describe('Bend neighborhood branch (boundary probe)', () => {
    it('bare marketing name → /cities/bend/<slug> and probes the bend- prefixed boundary', async () => {
      const probe = vi.fn(async (s: string) => s === 'bend-awbrey-butte')
      const res = await resolveAreaRedirectWith('awbrey-butte', probe)
      expect(res).toEqual({ path: '/cities/bend/awbrey-butte', reason: 'city-neighborhood' })
      expect(probe).toHaveBeenCalledWith('bend-awbrey-butte')
    })

    it('already bend- prefixed slug resolves to the bare /cities/bend path', async () => {
      const probe = vi.fn(async (s: string) => s === 'bend-old-farm-district')
      const res = await resolveAreaRedirectWith('bend-old-farm-district', probe)
      expect(res).toEqual({ path: '/cities/bend/old-farm-district', reason: 'city-neighborhood' })
      expect(probe).toHaveBeenCalledWith('bend-old-farm-district')
    })

    it('trims and lowercases before resolving', async () => {
      const probe = vi.fn(async (s: string) => s === 'bend-awbrey-butte')
      const res = await resolveAreaRedirectWith('  Awbrey-Butte  ', probe)
      expect(res).toEqual({ path: '/cities/bend/awbrey-butte', reason: 'city-neighborhood' })
    })

    it('returns null when no neighborhood boundary exists', async () => {
      const res = await resolveAreaRedirectWith('awbrey-butte', async () => false)
      expect(res).toBeNull()
    })
  })

  describe('genuine 404 (no redirect)', () => {
    it('returns null for an unknown plat-style slug', async () => {
      const res = await resolveAreaRedirectWith('totally-made-up-phase-9', async () => false)
      expect(res).toBeNull()
    })

    it('returns null for an empty / whitespace slug without probing', async () => {
      const probe = vi.fn(async () => true)
      expect(await resolveAreaRedirectWith('', probe)).toBeNull()
      expect(await resolveAreaRedirectWith('   ', probe)).toBeNull()
      expect(probe).not.toHaveBeenCalled()
    })
  })
})
