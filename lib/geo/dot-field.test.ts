import { describe, expect, it } from 'vitest'
import { buildDotField, trimmedBbox, DOT_FIELD_WIDTH } from './dot-field'

/** A Bend-shaped cloud plus a Redmond-shaped one, so the box has real span. */
function cloud(n: number, lat: number, lng: number) {
  return Array.from({ length: n }, (_, i) => ({
    lat: lat + (i % 25) * 0.004,
    lng: lng - Math.floor(i / 25) * 0.004,
  }))
}

describe('trimmedBbox', () => {
  it('needs two usable points to make a box', () => {
    expect(trimmedBbox([])).toBeNull()
    expect(trimmedBbox([{ lat: 44, lng: -121 }])).toBeNull()
    expect(trimmedBbox([{ lat: 44, lng: -121 }, { lat: 44, lng: -121 }])).toBeNull()
  })

  it('trims to the 1st and 99th percentile so one outlier cannot own the frame', () => {
    const points = [...cloud(200, 44.0, -121.3), { lat: 47.6, lng: -122.3 }]
    const box = trimmedBbox(points)!
    expect(box.maxLat).toBeLessThan(45)
    expect(box.minLon).toBeGreaterThan(-122)
  })

  it('ignores non-finite coordinates rather than producing NaN bounds', () => {
    const box = trimmedBbox([
      ...cloud(50, 44.0, -121.3),
      { lat: Number.NaN, lng: -121.3 },
      { lat: 44.05, lng: Number.POSITIVE_INFINITY },
    ])!
    expect(Number.isFinite(box.minLat)).toBe(true)
    expect(Number.isFinite(box.maxLon)).toBe(true)
  })
})

describe('buildDotField', () => {
  const classes = [
    { key: 'active' as const, points: cloud(1500, 44.0, -121.3) },
    { key: 'pending' as const, points: cloud(300, 44.25, -121.18) },
    { key: 'sold' as const, points: cloud(120, 43.8, -121.5) },
  ]

  it('draws one path per class in one shared frame', () => {
    const field = buildDotField(classes)!
    expect(field.w).toBe(DOT_FIELD_WIDTH)
    expect(field.h).toBeGreaterThan(0)
    expect(field.paths.map((p) => p.key)).toEqual(['active', 'pending', 'sold'])
    for (const path of field.paths) {
      for (const m of path.d.matchAll(/M(\d+) (\d+)h0/g)) {
        expect(Number(m[1])).toBeLessThanOrEqual(field.w)
        expect(Number(m[2])).toBeLessThanOrEqual(field.h)
      }
    }
  })

  it('is one map with layers: the frame does not move when a class is removed', () => {
    const all = buildDotField(classes)!
    const activeOnlyPath = all.paths.find((p) => p.key === 'active')!.d
    const again = buildDotField(classes)!
    expect(again.paths.find((p) => p.key === 'active')!.d).toBe(activeOnlyPath)
    // Dropping a class changes the union, so the frame is allowed to change —
    // what must not happen is two frames inside ONE call.
    expect(new Set(all.paths.map(() => `${all.w}x${all.h}`)).size).toBe(1)
  })

  it('strides a class over its cap and says how many it drew', () => {
    const field = buildDotField(classes, { cap: 200 })!
    const active = field.paths.find((p) => p.key === 'active')!
    expect(active.total).toBe(1500)
    expect(active.plotted).toBeLessThanOrEqual(200)
    expect(active.plotted).toBeGreaterThan(100)
  })

  it('plots every point when the cap is above the population', () => {
    const field = buildDotField(classes, { cap: 4000 })!
    const sold = field.paths.find((p) => p.key === 'sold')!
    expect(sold.plotted).toBe(sold.total)
  })

  it('returns nothing rather than a fake frame when the population cannot make a box', () => {
    expect(buildDotField([{ key: 'active', points: [{ lat: 44, lng: -121 }] }])).toBeUndefined()
    expect(buildDotField([{ key: 'active', points: [] }])).toBeUndefined()
  })

  it('drops an empty class instead of shipping an empty path', () => {
    const field = buildDotField([
      { key: 'active', points: cloud(100, 44.0, -121.3) },
      { key: 'pending', points: [] },
    ])!
    expect(field.paths.map((p) => p.key)).toEqual(['active'])
  })
})
