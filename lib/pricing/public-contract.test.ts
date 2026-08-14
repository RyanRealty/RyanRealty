import { describe, expect, it } from 'vitest'
import {
  PUBLIC_RANGE_BAND,
  isBuilderPhase,
  publicListingRead,
  publishedCmaWins,
} from '@/lib/pricing/public-contract'

function input(over: Partial<Parameters<typeof publicListingRead>[0]> = {}) {
  return {
    factsReady: true,
    n: 5,
    compsClose: 700_000,
    listPrice: 725_000,
    sqft: 2000,
    newConstruction: false,
    subdivision: 'Kenwood',
    sameSubdivisionTight: true,
    ...over,
  }
}

describe('publishedCmaWins', () => {
  it('lets a published CMA take the listing page', () => {
    expect(publishedCmaWins(true)).toBe(true)
    expect(publishedCmaWins(false)).toBe(false)
  })
})

describe('isBuilderPhase', () => {
  it('flags a numbered phase plat', () => {
    expect(isBuilderPhase('Canyon Ridge Phase 5')).toBe(true)
    expect(isBuilderPhase('Kenwood')).toBe(false)
    expect(isBuilderPhase(null)).toBe(false)
  })
})

describe('publicListingRead', () => {
  it('refuses when facts are not ready', () => {
    expect(publicListingRead(input({ factsReady: false }))).toEqual({
      kind: 'refuse',
      reason: 'facts-not-ready',
    })
  })

  it('refuses a thin set', () => {
    expect(publicListingRead(input({ n: 2, compsClose: null }))).toEqual({
      kind: 'refuse',
      reason: 'thin-set',
    })
  })

  it('refuses when living area is missing', () => {
    expect(publicListingRead(input({ sqft: null, compsClose: null, listPrice: null }))).toEqual({
      kind: 'refuse',
      reason: 'no-gla',
    })
  })

  it('never returns comps close as the public price on a listed home', () => {
    const out = publicListingRead(input())
    expect(out.kind).toBe('listed-over-under')
    if (out.kind !== 'listed-over-under') return
    expect(out.listPrice).toBe(725_000)
    expect(out.compsClose).toBe(700_000)
    expect(out.deltaPct).toBeCloseTo((700_000 - 725_000) / 725_000)
    expect(out.n).toBe(5)
    expect(out.rangeLow).toBe(Math.round((700_000 * (1 - PUBLIC_RANGE_BAND)) / 1000) * 1000)
    expect(out.rangeHigh).toBe(Math.round((700_000 * (1 + PUBLIC_RANGE_BAND)) / 1000) * 1000)
  })

  it('returns a range, not a single dollar, when there is no ask', () => {
    const out = publicListingRead(input({ listPrice: null }))
    expect(out.kind).toBe('unlisted-range')
    if (out.kind !== 'unlisted-range') return
    expect(out.compsClose).toBe(700_000)
    expect(out.rangeLow).toBeLessThan(out.compsClose)
    expect(out.rangeHigh).toBeGreaterThan(out.compsClose)
    expect(out.n).toBe(5)
  })

  it('refuses Quartz-class new construction even when n is 5', () => {
    expect(
      publicListingRead(
        input({
          newConstruction: true,
          subdivision: 'Ward Commons',
          listPrice: 535_000,
          compsClose: 341_000,
          n: 5,
          sameSubdivisionTight: false,
        }),
      ),
    ).toEqual({ kind: 'refuse', reason: 'new-construction' })
  })

  it('refuses Kiesow-class new construction even on a tight same-subdivision set', () => {
    expect(
      publicListingRead(
        input({
          newConstruction: true,
          subdivision: 'Grand Meadow',
          listPrice: 999_900,
          compsClose: 705_000,
          n: 5,
          sameSubdivisionTight: true,
        }),
      ),
    ).toEqual({ kind: 'refuse', reason: 'new-construction' })
  })

  it('refuses Walnut-class builder phase', () => {
    expect(
      publicListingRead(
        input({
          newConstruction: true,
          subdivision: 'Canyon Ridge Phase 5',
          listPrice: 641_664,
          compsClose: 458_000,
          n: 4,
          sameSubdivisionTight: true,
        }),
      ),
    ).toEqual({ kind: 'refuse', reason: 'new-construction' })
  })

  it('refuses a resale on a numbered phase plat as builder-phase', () => {
    expect(
      publicListingRead(
        input({
          newConstruction: false,
          subdivision: 'Canyon Ridge Phase 5',
          n: 5,
        }),
      ),
    ).toEqual({ kind: 'refuse', reason: 'builder-phase' })
  })
})
