import { describe, expect, it } from 'vitest'
import {
  PLAT_WARM_CLAIM_UNTIL_MS,
  PLAT_WARM_HARD_STOP_MS,
  PLAT_WARM_PASS_GAP_LEASE,
  PLAT_WARM_PASS_GAP_S,
  PLAT_WARM_SLICE,
  platPassMarkerName,
  platSliceLeaseName,
  platWarmPaths,
  platWarmSlices,
} from '@/lib/warm-plat-pages'

describe('platWarmPaths', () => {
  it('orders by closed-sale history, drops redirect slugs and duplicates', () => {
    const paths = platWarmPaths(
      [
        { slug: 'elkai-woods', closedCount: 58 },
        { slug: 'waywest-properties', closedCount: 3245 },
        { slug: 'eagle-crest', closedCount: 900 },
        { slug: 'blakley-heights', closedCount: 58 },
        { slug: 'waywest-properties', closedCount: 3245 },
      ],
      (slug) => slug === 'eagle-crest',
    )
    expect(paths).toEqual([
      '/subdivisions/waywest-properties',
      '/subdivisions/blakley-heights',
      '/subdivisions/elkai-woods',
    ])
  })

  it('uses the middleware redirect map by default', () => {
    // brasada-ranch is a marketing-area slug middleware 308s to its community page.
    expect(platWarmPaths([{ slug: 'brasada-ranch', closedCount: 10 }])).toEqual([])
    expect(platWarmPaths([{ slug: 'elkai-woods', closedCount: 10 }])).toEqual(['/subdivisions/elkai-woods'])
  })
})

describe('platWarmSlices', () => {
  it('covers every path exactly once, in order', () => {
    const paths = Array.from({ length: 2642 }, (_, i) => `/subdivisions/p${i}`)
    const slices = platWarmSlices(paths)
    expect(slices).toHaveLength(Math.ceil(2642 / PLAT_WARM_SLICE))
    expect(slices.flat()).toEqual(paths)
    expect(slices.every((s) => s.length <= PLAT_WARM_SLICE)).toBe(true)
  })

  it('rejects a zero slice', () => {
    expect(() => platWarmSlices(['/a'], 0)).toThrow()
  })
})

describe('platSliceLeaseName', () => {
  it('is per deployment, per set size and per slice', () => {
    expect(platSliceLeaseName('abc123', 2642, 0)).toBe('warm-plats-abc123-n2642-s0')
    expect(platSliceLeaseName('abc123', 2641, 0)).not.toBe(platSliceLeaseName('abc123', 2642, 0))
  })
})

describe('invocation budget', () => {
  it('stops claiming well before it stops fetching, and both sit inside maxDuration 300', () => {
    expect(PLAT_WARM_CLAIM_UNTIL_MS).toBeLessThan(PLAT_WARM_HARD_STOP_MS)
    expect(PLAT_WARM_HARD_STOP_MS).toBeLessThan(300_000 - 20_000)
  })
})

describe('the pass gap (SITE-212)', () => {
  it('names a pass by its deployment and path count, the same pass its slices name', () => {
    expect(platPassMarkerName('abcdef123456', 2617)).toBe('warm-plats-pass:abcdef123456:n2617')
    // A resized set is a new pass, so it asks for the gap again.
    expect(platPassMarkerName('abcdef123456', 2618)).not.toBe(platPassMarkerName('abcdef123456', 2617))
    expect(platPassMarkerName('0123456789ab', 2617)).not.toBe(platPassMarkerName('abcdef123456', 2617))
  })

  it('allows at most four passes a day, the deploy count the tier was sized for', () => {
    expect(PLAT_WARM_PASS_GAP_S).toBe(6 * 3600)
    expect((24 * 3600) / PLAT_WARM_PASS_GAP_S).toBeLessThanOrEqual(4)
  })

  it('names the gap lease and the pass marker apart from every slice lease', () => {
    const slice = platSliceLeaseName('abcdef123456', 2617, 0)
    for (const name of [PLAT_WARM_PASS_GAP_LEASE, platPassMarkerName('abcdef123456', 2617)]) {
      expect(name).not.toBe(slice)
      expect(slice.startsWith(name)).toBe(false)
      expect(name.startsWith(slice)).toBe(false)
    }
    expect(PLAT_WARM_PASS_GAP_LEASE).not.toBe(platPassMarkerName('abcdef123456', 2617))
  })
})
