import { describe, expect, it } from 'vitest'
import { renderParcelSilhouettesHtml } from './parcel-silhouettes'
import type { CmaParcel, CmaParcelSet } from './parcel-shapes'

/** A square lot `deg` degrees on a side, centred near Bend. */
function square(deg: number, at: [number, number] = [-121.31, 44.06]): GeoJSON.Polygon {
  const [lng, lat] = at
  const h = deg / 2
  return {
    type: 'Polygon',
    coordinates: [[
      [lng - h, lat - h], [lng + h, lat - h], [lng + h, lat + h], [lng - h, lat + h], [lng - h, lat - h],
    ]],
  }
}

function parcel(over: Partial<CmaParcel> = {}): CmaParcel {
  return {
    n: null,
    label: '123 Main St',
    taxlot: '171219DB02100',
    acres: 0.25,
    mlsAcres: 0.25,
    closePrice: null,
    geometry: square(0.0006),
    ...over,
  }
}

function set(over: Partial<CmaParcelSet> = {}): CmaParcelSet {
  return { subject: parcel(), comps: [parcel({ n: 1, label: '9 Oak Ave' })], disagrees: false, ...over }
}

/** Every `d="..."` in the output, in order. */
function paths(html: string): string[] {
  return [...html.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]!)
}

/** Width of a path's bounding box in user units. */
function pathWidth(d: string): number {
  const xs = [...d.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map((m) => Number(m[1]))
  return Math.max(...xs) - Math.min(...xs)
}

describe('renderParcelSilhouettesHtml', () => {
  it('draws nothing at all when there is no parcel set', () => {
    expect(renderParcelSilhouettesHtml(null)).toBe('')
  })

  it('draws nothing when only one lot is known — one lot compares against nothing', () => {
    expect(renderParcelSilhouettesHtml(set({ comps: [] }))).toBe('')
  })

  it('draws one tile per lot, subject first and marked', () => {
    const html = renderParcelSilhouettesHtml(set())
    expect(html.match(/class="lot-tile/g)).toHaveLength(2)
    expect(html).toContain('lot-tile is-subject')
    expect(html.indexOf('is-subject')).toBeLessThan(html.indexOf('9 Oak Ave'))
    expect(html).toContain('>Subject<')
  })

  it('SHARES ONE SCALE: a lot with twice the side is drawn twice as wide', () => {
    const html = renderParcelSilhouettesHtml(
      set({ comps: [parcel({ n: 1, geometry: square(0.0012) })] }),
    )
    const [subjectPath, compPath] = paths(html)
    const ratio = pathWidth(compPath!) / pathWidth(subjectPath!)
    expect(ratio).toBeGreaterThan(1.9)
    expect(ratio).toBeLessThan(2.1)
    expect(html).toContain('drawn at the same scale')
  })

  it('says so IN WORDS when the spread is too wide to share a scale', () => {
    // A 40x lot alongside two small ones: a shared scale would leave the small
    // ones a few pixels across, which compares nothing.
    const html = renderParcelSilhouettesHtml(
      set({
        comps: [parcel({ n: 1 }), parcel({ n: 2, geometry: square(0.024) })],
      }),
    )
    expect(html).toContain('Each lot is drawn to fit its own frame.')
    expect(html).not.toContain('drawn at the same scale')
    // Each fills its own frame, so the outlines are near-identical in width.
    const [a, b] = paths(html)
    expect(Math.abs(pathWidth(a!) - pathWidth(b!))).toBeLessThan(1)
  })

  it('prints a scale bar only when the scale is shared', () => {
    expect(renderParcelSilhouettesHtml(set())).toContain('lot-scale')
    const wide = renderParcelSilhouettesHtml(
      set({ comps: [parcel({ n: 1 }), parcel({ n: 2, geometry: square(0.024) })] }),
    )
    expect(wide).not.toContain('lot-scale')
  })

  it('states price per RECORDED acre, never per the MLS figure', () => {
    const html = renderParcelSilhouettesHtml(
      set({
        subject: parcel({ acres: 3, mlsAcres: 3 }),
        comps: [parcel({ n: 1, acres: 2, mlsAcres: 4, closePrice: 800_000 })],
      }),
    )
    // 800,000 / 2 recorded acres = $400K, not 800,000 / 4 = $200K.
    expect(html).toContain('$400K an acre')
    expect(html).not.toContain('$200K')
  })

  it('withholds price per acre on a street of house lots, where it means nothing', () => {
    // A $900K sale on a fifth of an acre is $4.5M "an acre". True, and useless.
    const html = renderParcelSilhouettesHtml(
      set({
        subject: parcel({ acres: 0.2, mlsAcres: 0.2 }),
        comps: [parcel({ n: 1, acres: 0.2, mlsAcres: 0.2, closePrice: 900_000 })],
      }),
    )
    expect(html).not.toContain('an acre')
    expect(html).toContain('0.20 acres')
  })

  it('shows price per acre once the set is actually about land', () => {
    const html = renderParcelSilhouettesHtml(
      set({
        subject: parcel({ acres: 5, mlsAcres: 5, geometry: square(0.003) }),
        comps: [parcel({ n: 1, acres: 4, mlsAcres: 4, closePrice: 1_200_000, geometry: square(0.0028) })],
      }),
    )
    expect(html).toContain('$300K an acre')
  })

  it('flags a lot whose MLS and county acreages disagree, and leaves agreeing ones alone', () => {
    const html = renderParcelSilhouettesHtml(
      set({
        subject: parcel({ acres: 1.0, mlsAcres: 1.02 }),
        comps: [parcel({ n: 1, acres: 1.0, mlsAcres: 2.5 })],
      }),
    )
    expect(html.match(/MLS says/g)).toHaveLength(1)
    expect(html).toContain('MLS says 2.50')
  })

  it('says acreage is not recorded rather than printing a zero', () => {
    const html = renderParcelSilhouettesHtml(set({ subject: parcel({ acres: null }) }))
    expect(html).toContain('acreage not recorded')
    expect(html).not.toContain('0.00 acres')
  })

  it('draws a donut lot with its hole, not as a solid block', () => {
    const donut: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [
        square(0.0012).coordinates[0]!,
        square(0.0004).coordinates[0]!,
      ],
    }
    const html = renderParcelSilhouettesHtml(set({ subject: parcel({ geometry: donut }) }))
    expect(html).toContain('fill-rule="evenodd"')
    // Two rings means two subpaths.
    expect(paths(html)[0]!.match(/M/g)).toHaveLength(2)
  })

  it('handles a multipolygon lot split by a road', () => {
    const split: GeoJSON.MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [square(0.0006, [-121.31, 44.06]).coordinates, square(0.0006, [-121.308, 44.06]).coordinates],
    }
    const html = renderParcelSilhouettesHtml(set({ subject: parcel({ geometry: split }) }))
    expect(paths(html)[0]!.match(/M/g)).toHaveLength(2)
  })

  it('skips a lot whose geometry has no extent instead of dividing by zero', () => {
    const degenerate: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [[[-121.31, 44.06], [-121.31, 44.06], [-121.31, 44.06], [-121.31, 44.06]]],
    }
    const html = renderParcelSilhouettesHtml(
      set({ comps: [parcel({ n: 1 }), parcel({ n: 2, geometry: degenerate })] }),
    )
    expect(paths(html)).toHaveLength(2)
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('Infinity')
  })

  it('escapes an address rather than letting it close a tag', () => {
    const html = renderParcelSilhouettesHtml(
      set({ subject: parcel({ label: '<script>alert(1)</script> Ln' }) }),
    )
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('puts north at the top: a lot extended northward grows upward in the drawing', () => {
    const tall: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [[
        [-121.3103, 44.0600], [-121.3097, 44.0600], [-121.3097, 44.0612], [-121.3103, 44.0612], [-121.3103, 44.0600],
      ]],
    }
    const html = renderParcelSilhouettesHtml(set({ subject: parcel({ geometry: tall }) }))
    const pts = [...paths(html)[0]!.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map((m) => ({
      lngIndex: Number(m[1]),
      y: Number(m[2]),
    }))
    // The first coordinate is the southern edge, so it must sit LOWER on the
    // page (a larger y) than the third, which is the northern edge.
    expect(pts[0]!.y).toBeGreaterThan(pts[2]!.y)
  })
})
