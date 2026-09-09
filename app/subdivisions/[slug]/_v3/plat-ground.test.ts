import { describe, expect, it } from 'vitest'
import {
  ATLAS_FRAME_PAD,
  bboxOfPoints,
  bboxPolygon,
  frameAt,
  FRAME_ASPECT,
  FRAME_MAX_DEG,
  FRAME_MIN_CONTENT_DEG,
  FRAME_MIN_FEATURES,
  platFrame,
  platGround,
} from './plat-ground'

/** Diamond Bar Ranch's one active listing, 2026-09-09. */
const ONE_HOME = [{ lat: 44.300526, lng: -121.163048 }]

describe('bboxOfPoints', () => {
  it('is null with nothing to frame, and ignores impossible coordinates', () => {
    expect(bboxOfPoints([])).toBeNull()
    expect(bboxOfPoints([{ lat: 999, lng: 0 }])).toBeNull()
    expect(bboxOfPoints([{ lat: Number.NaN, lng: 0 }])).toBeNull()
  })

  it('holds every point', () => {
    const b = bboxOfPoints([
      { lat: 44.3, lng: -121.17 },
      { lat: 44.31, lng: -121.16 },
    ])
    expect(b).toEqual({ minLon: -121.17, minLat: 44.3, maxLon: -121.16, maxLat: 44.31 })
  })
})

describe('frameAt', () => {
  it('builds the stage aspect, correcting longitude for latitude', () => {
    const b = frameAt(-121.3, 44.06, 0.01)
    const kx = Math.cos((44.06 * Math.PI) / 180)
    expect(b.maxLat - b.minLat).toBeCloseTo(0.01, 10)
    expect(((b.maxLon - b.minLon) * kx) / (b.maxLat - b.minLat)).toBeCloseTo(FRAME_ASPECT, 6)
  })
})

describe('platFrame', () => {
  it('has nothing to frame without content', () => {
    expect(platFrame(null)).toBeNull()
  })

  it('gives a single home a real span instead of a collapsed point', () => {
    const frame = platFrame(bboxOfPoints(ONE_HOME))
    expect(frame).not.toBeNull()
    const lat = frame!.visibleBbox.maxLat - frame!.visibleBbox.minLat
    expect(lat).toBeGreaterThanOrEqual(FRAME_MIN_CONTENT_DEG)
    expect(Number.isFinite(lat)).toBe(true)
    // The box V3Atlas is handed, padded by what V3Atlas adds, is what a reader
    // sees — the two must agree or the basemap is clipped to the wrong extent.
    const handed = frame!.bbox.maxLat - frame!.bbox.minLat
    expect(handed * (1 + 2 * ATLAS_FRAME_PAD)).toBeCloseTo(lat, 10)
  })

  it('draws a real map around a home in town', () => {
    const frame = platFrame(bboxOfPoints(ONE_HOME))
    expect(frame!.features).toBeGreaterThanOrEqual(FRAME_MIN_FEATURES)
  })

  it('holds the content it was given inside what the reader sees', () => {
    const content = { minLon: -121.168, minLat: 44.298, maxLon: -121.158, maxLat: 44.304 }
    const frame = platFrame(content)!
    expect(frame.visibleBbox.minLon).toBeLessThanOrEqual(content.minLon)
    expect(frame.visibleBbox.maxLon).toBeGreaterThanOrEqual(content.maxLon)
    expect(frame.visibleBbox.minLat).toBeLessThanOrEqual(content.minLat)
    expect(frame.visibleBbox.maxLat).toBeGreaterThanOrEqual(content.maxLat)
  })

  it('never widens past the cap, however empty the ground', () => {
    // The middle of the high desert: no roads at any rung.
    const frame = platFrame({ minLon: -120.2, minLat: 43.3, maxLon: -120.19, maxLat: 43.31 })!
    expect(frame.visibleBbox.maxLat - frame.visibleBbox.minLat).toBeLessThanOrEqual(FRAME_MAX_DEG + 1e-9)
  })

  it('returns a closed ring V3Atlas can project', () => {
    const ring = bboxPolygon({ minLon: -1, minLat: 2, maxLon: 3, maxLat: 4 }).coordinates[0]!
    expect(ring).toHaveLength(5)
    expect(ring[0]).toEqual(ring[4])
  })
})

describe('platGround', () => {
  it('draws the plat’s own ground as an SVG data URI with its homes on it', () => {
    const frame = platFrame(bboxOfPoints(ONE_HOME))!
    const ground = platGround({ frame: frame.visibleBbox, rings: [], homes: ONE_HOME })
    expect(ground).not.toBeNull()
    expect(ground!.src.startsWith('data:image/svg+xml;base64,')).toBe(true)
    expect(ground!.featureCount).toBeGreaterThan(0)
    const svg = Buffer.from(ground!.src.split(',')[1]!, 'base64').toString('utf8')
    // One mark for the one home, and the provenance the ground always carries.
    expect((svg.match(/<circle /g) ?? []).length).toBe(1)
    expect(svg).toContain('US Census TIGER')
  })

  it('draws the recorded outline when the plat has one', () => {
    const frame = platFrame(bboxOfPoints(ONE_HOME))!
    const ring: Array<readonly [number, number]> = [
      [-121.165, 44.299],
      [-121.161, 44.299],
      [-121.161, 44.302],
      [-121.165, 44.302],
      [-121.165, 44.299],
    ]
    const ground = platGround({ frame: frame.visibleBbox, rings: [ring], homes: ONE_HOME })!
    const svg = Buffer.from(ground.src.split(',')[1]!, 'base64').toString('utf8')
    expect(svg).toContain('fill-opacity="0.13"')
  })

  it('is null when the frame is over nothing at all and there is no outline', () => {
    // Mid-Pacific: no basemap, no rings, nothing to draw.
    const ground = platGround({
      frame: { minLon: -150, minLat: 20, maxLon: -149.99, maxLat: 20.01 },
      rings: [],
      homes: [],
    })
    expect(ground).toBeNull()
  })
})
