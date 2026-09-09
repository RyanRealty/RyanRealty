/**
 * The basemap contract (SITE-44). These are the mechanical halves of the node's
 * accept test: the ladder is really the brand navy over the brand cream, the
 * style array really covers the features Google would otherwise paint in its
 * own colors, and the frame geometry really clears a mark's width.
 */
import { describe, expect, it } from 'vitest'
import { MAP_CREAM, MAP_NAVY } from '@/lib/maps/markers'
import {
  navyOnCream,
  v3FitPadding,
  V3_BASEMAP_INK,
  V3_BASEMAP_PALETTE,
  V3_BASEMAP_STYLE,
  V3_CLUSTER_MAX_ZOOM,
  V3_CLUSTER_RADIUS_PX,
  V3_MAP_CHROME_OFF,
  V3_MAP_MAX_ZOOM,
  V3_MARK_WIDTH_PX,
  getV3MapOptions,
} from '@/lib/maps/v3-basemap'

describe('the navy-on-cream ladder', () => {
  it('is pinned to the brand constants in lib/maps/markers.ts', () => {
    // v3-basemap.ts holds the two colors as channel triples rather than
    // importing them (a cycle). This is the assertion that keeps the copy
    // honest: drift the navy in markers.ts and this fails.
    expect(navyOnCream(1)).toBe(MAP_NAVY)
    expect(navyOnCream(0)).toBe(MAP_CREAM)
  })

  it('is monotonic — every rung is darker than the one below it', () => {
    const luminance = (hex: string) => {
      const h = hex.replace('#', '')
      return (
        Number.parseInt(h.slice(0, 2), 16) +
        Number.parseInt(h.slice(2, 4), 16) +
        Number.parseInt(h.slice(4, 6), 16)
      )
    }
    const rungs = [
      V3_BASEMAP_INK.field,
      V3_BASEMAP_INK.park,
      V3_BASEMAP_INK.roadLocal,
      V3_BASEMAP_INK.water,
      V3_BASEMAP_INK.roadArterial,
      V3_BASEMAP_INK.roadHighway,
      V3_BASEMAP_INK.labelQuiet,
      V3_BASEMAP_INK.boundary,
      V3_BASEMAP_INK.label,
    ]
    for (let i = 1; i < rungs.length; i += 1) {
      expect(luminance(rungs[i])).toBeLessThan(luminance(rungs[i - 1]))
    }
  })

  it('clamps out-of-range alphas rather than producing a broken hex', () => {
    expect(navyOnCream(-1)).toBe(MAP_CREAM)
    expect(navyOnCream(4)).toBe(MAP_NAVY)
  })
})

describe('the style array', () => {
  it('paints every color from the ladder and nothing else', () => {
    const painted = V3_BASEMAP_STYLE.flatMap((rule) =>
      (rule.stylers ?? []).flatMap((st) => {
        const color = (st as { color?: string }).color
        return color ? [color] : []
      }),
    )
    expect(painted.length).toBeGreaterThan(8)
    for (const color of painted) expect(V3_BASEMAP_PALETTE).toContain(color)
  })

  it('turns off the three layers that read as Google whatever their color', () => {
    const off = (featureType: string | undefined, elementType: string | undefined) =>
      V3_BASEMAP_STYLE.some(
        (r) =>
          r.featureType === featureType &&
          r.elementType === elementType &&
          (r.stylers ?? []).some((s) => (s as { visibility?: string }).visibility === 'off'),
      )
    expect(off(undefined, 'labels.icon')).toBe(true) // highway shields, POI glyphs
    expect(off('poi', undefined)).toBe(true)
    expect(off('transit', undefined)).toBe(true)
  })

  it('gives roads a fill and no casing, on three weights', () => {
    const fill = (featureType: string) =>
      V3_BASEMAP_STYLE.find((r) => r.featureType === featureType && r.elementType === 'geometry.fill')
    expect(fill('road.local')?.stylers?.[0]).toEqual({ color: V3_BASEMAP_INK.roadLocal })
    expect(fill('road.arterial')?.stylers?.[0]).toEqual({ color: V3_BASEMAP_INK.roadArterial })
    expect(fill('road.highway')?.stylers?.[0]).toEqual({ color: V3_BASEMAP_INK.roadHighway })
    const casing = V3_BASEMAP_STYLE.find(
      (r) => r.featureType === 'road' && r.elementType === 'geometry.stroke',
    )
    expect(casing?.stylers?.[0]).toEqual({ visibility: 'off' })
  })
})

describe('the map options', () => {
  it('never carries a mapId, because a mapId discards the style array', () => {
    expect(getV3MapOptions()).not.toHaveProperty('mapId')
    expect(getV3MapOptions({ gestureHandling: 'greedy' })).not.toHaveProperty('mapId')
  })

  it('switches off every control Google would draw for itself', () => {
    const opts = getV3MapOptions()
    for (const [key, value] of Object.entries(V3_MAP_CHROME_OFF)) {
      expect(opts[key as keyof google.maps.MapOptions]).toBe(value)
    }
    expect(opts.styles).toBe(V3_BASEMAP_STYLE)
    expect(opts.backgroundColor).toBe(V3_BASEMAP_INK.field)
  })

  it('lets a caller override gestures without losing the cartography', () => {
    const opts = getV3MapOptions({ gestureHandling: 'cooperative' })
    expect(opts.gestureHandling).toBe('cooperative')
    expect(opts.styles).toBe(V3_BASEMAP_STYLE)
    expect(opts.zoomControl).toBe(false)
  })
})

describe('the frame geometry', () => {
  it('merges anything closer than a full mark, at every zoom', () => {
    expect(V3_CLUSTER_RADIUS_PX).toBeGreaterThan(V3_MARK_WIDTH_PX)
    expect(V3_CLUSTER_MAX_ZOOM).toBe(V3_MAP_MAX_ZOOM)
  })

  it('pads the opening fit by a mark and a half on every edge', () => {
    // A mark is anchored at its centre, so clearing its own width from the edge
    // costs half a mark plus a full one.
    const floor = V3_MARK_WIDTH_PX * 1.5
    const phone = v3FitPadding({ clientWidth: 375, clientHeight: 700 })
    const desktop = v3FitPadding({ clientWidth: 790, clientHeight: 860 })
    for (const pad of [phone, desktop]) {
      expect(pad.left).toBeGreaterThanOrEqual(floor)
      expect(pad.right).toBeGreaterThanOrEqual(floor)
      expect(pad.top).toBeGreaterThanOrEqual(floor)
      expect(pad.bottom).toBeGreaterThanOrEqual(floor)
    }
    // …and never runs away with a wide frame.
    expect(desktop.left).toBeLessThanOrEqual(128)
  })

  it('survives a frame that has not been laid out yet', () => {
    const pad = v3FitPadding(null)
    expect(pad.left).toBeGreaterThanOrEqual(V3_MARK_WIDTH_PX * 1.5)
  })
})
