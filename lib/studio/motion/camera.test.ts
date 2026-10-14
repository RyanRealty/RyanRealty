import { describe, expect, it } from 'vitest'
import {
  cameraFromView,
  cameraKeys,
  cameraMove,
  cameraPose,
  cameraSpeeds,
  cameraView,
  holdCreep,
  lmix,
  type CameraKey,
  type CameraPose,
} from './camera'
import { BRAND_EASE_MOVE, BRAND_EASE_OUT, cubicBezier, progress } from './ease'
import { MAP_BOX, cameraAt as mapCameraAt, mapGeometry, type LngLatRing, type MapGeometry } from './map'
import { critical } from './spring'

const VIEW = { width: 1080, height: 1920 }

describe('lmix', () => {
  it('goes from a to b in log space: the same ratio for the same step', () => {
    expect(lmix(2, 32, 0)).toBeCloseTo(2, 12)
    expect(lmix(2, 32, 1)).toBeCloseTo(32, 12)
    expect(lmix(2, 32, 0.5)).toBeCloseTo(8, 12)
    expect(lmix(2, 32, 0.75) / lmix(2, 32, 0.5)).toBeCloseTo(lmix(2, 32, 0.5) / lmix(2, 32, 0.25), 12)
  })
})

describe('cameraPose on curves', () => {
  const keys: CameraKey[] = [
    [1, 100, 200, 1],
    [3, 700, 500, 8],
  ]

  it('is exactly the first key before it and the last key after it, and exactly a key at a key', () => {
    expect(cameraPose(keys, -5)).toEqual({ x: 100, y: 200, zoom: 1 })
    expect(cameraPose(keys, 1)).toEqual({ x: 100, y: 200, zoom: 1 })
    expect(cameraPose(keys, 3)).toEqual({ x: 700, y: 500, zoom: 8 })
    expect(cameraPose(keys, 99)).toEqual({ x: 700, y: 500, zoom: 8 })
    expect(cameraPose([[4, 9, 8, 2]], 0)).toEqual({ x: 9, y: 8, zoom: 2 })
  })

  it('rides the brand camera curve (.65,0,.35,1) by default, the arrival curve when a key says so, and linear on request', () => {
    const t = 1.5
    const x = progress(t, 1, 2)
    const move = cubicBezier(...BRAND_EASE_MOVE, x)
    expect(Math.log(cameraPose(keys, t).zoom)).toBeCloseTo(Math.log(8) * move, 12)
    const arrive = cubicBezier(...BRAND_EASE_OUT, x)
    const arrival: CameraKey[] = [keys[0], [3, 700, 500, 8, 'arrive']]
    expect(Math.log(cameraPose(arrival, t).zoom)).toBeCloseTo(Math.log(8) * arrive, 12)
    expect(Math.log(cameraPose(keys, t, { ease: 'linear' }).zoom)).toBeCloseTo(Math.log(8) * x, 12)
    // A key's own ease beats the camera's default.
    expect(Math.log(cameraPose(arrival, t, { ease: 'linear' }).zoom)).toBeCloseTo(Math.log(8) * arrive, 12)
    expect(move).not.toBeCloseTo(arrive, 2)
  })

  it('perceived zoom speed is even in log space: the same ratio every frame, at 1x and at 40x', () => {
    const wide = cameraKeys([[0, 0, 0, 1], [3, 0, 0, 64, 'linear']])
    const deep = cameraKeys([[0, 0, 0, 40], [3, 0, 0, 80, 'linear']])
    let ratio = 0
    for (let f = 0; f < 90; f++) {
      const a = cameraPose(wide, f / 30).zoom
      const b = cameraPose(wide, (f + 1) / 30).zoom
      if (f === 0) ratio = b / a
      expect(b / a).toBeCloseTo(ratio, 12)
    }
    expect(ratio).toBeCloseTo(Math.pow(64, 1 / 90), 12)
    // 1 to 2 and 40 to 80 are the same move to the eye: same shape against time.
    const octave = cameraKeys([[0, 0, 0, 1], [3, 0, 0, 2]])
    for (const t of [0.4, 1.1, 1.5, 2.2, 2.9]) {
      expect(Math.log(cameraPose(deep, t, { ease: 'linear' }).zoom / 40) / Math.LN2).toBeCloseTo(t / 3, 12)
      expect(Math.log(cameraPose(octave, t).zoom) / Math.LN2).toBeCloseTo(cubicBezier(...BRAND_EASE_MOVE, t / 3), 12)
    }
  })

  it('zooms about the one world point that stays still on screen, so a push goes toward the place', () => {
    const a: CameraPose = { x: 100, y: 200, zoom: 1 }
    const b: CameraPose = { x: 700, y: 500, zoom: 8 }
    // The point at the same screen position under both: c = (ca za - cb zb) / (za - zb).
    const fx = (a.x * a.zoom - b.x * b.zoom) / (a.zoom - b.zoom)
    const fy = (a.y * a.zoom - b.y * b.zoom) / (a.zoom - b.zoom)
    const screen = (pose: CameraPose) => {
      const v = cameraView(pose, VIEW)
      return [fx * v.s + v.tx, fy * v.s + v.ty]
    }
    const [sx, sy] = screen(a)
    for (const t of [0.1, 0.4, 0.5, 0.75, 0.95]) {
      const [x, y] = screen(cameraMove(a, b, t, 0, 1))
      expect(x).toBeCloseTo(sx, 8)
      expect(y).toBeCloseTo(sy, 8)
    }
  })

  it('with equal zooms a move is a plain pan along the line between the centres', () => {
    const pan = cameraPose([[0, 0, 0, 2], [2, 600, -300, 2, 'linear']], 0.5)
    expect(pan).toEqual({ x: 150, y: -75, zoom: 2 })
  })

  it('two keys at one time are a cut, and a hold is two keys on one pose', () => {
    const cut: CameraKey[] = [[1, 0, 0, 1], [2, 100, 0, 1], [2, 900, 50, 3], [4, 900, 50, 3]]
    expect(cameraPose(cut, 1.999999).x).toBeCloseTo(100, 3)
    expect(cameraPose(cut, 2)).toEqual({ x: 900, y: 50, zoom: 3 })
    expect(cameraPose(cut, 3)).toEqual({ x: 900, y: 50, zoom: 3 })
  })

  it('is pure: the same t gives the same pose in any order, and validated keys give the same as raw ones', () => {
    const checked = cameraKeys(keys)
    const ts = [2.2, 0.5, 1.7, 3.5, 1.7]
    expect(ts.map((t) => cameraPose(keys, t))).toEqual(ts.map((t) => cameraPose(checked, t)))
    expect([...ts].reverse().map((t) => cameraPose(checked, t)).reverse()).toEqual(ts.map((t) => cameraPose(checked, t)))
    expect(Object.isFrozen(checked)).toBe(true)
    expect(() => cameraPose(keys, Number.NaN)).toThrow(/finite/)
  })
})

describe('cameraKeys refuses a zoom in followed straight away by a zoom out', () => {
  const inThenOut: CameraKey[] = [[0, 0, 0, 1], [2, 0, 0, 3], [4, 0, 0, 1.5]]

  it('names the moves, in both directions', () => {
    expect(() => cameraKeys(inThenOut)).toThrow(/in from 0 s to 2 s and straight back out to 4 s/)
    expect(() => cameraKeys([[0, 0, 0, 3], [2, 0, 0, 1], [4, 0, 0, 2]])).toThrow(/out from 0 s to 2 s and straight back in to 4 s/)
    expect(() => cameraPose(inThenOut, 1)).toThrow(/never in then out/)
  })

  it('lets a hold, a pan or a cut sit between them, and a flag lifts it', () => {
    expect(() => cameraKeys([[0, 0, 0, 1], [2, 0, 0, 3], [3, 0, 0, 3], [5, 0, 0, 1.5]])).not.toThrow()
    expect(() => cameraKeys([[0, 0, 0, 1], [2, 0, 0, 3], [3, 400, 0, 3], [5, 400, 0, 1.5]])).not.toThrow()
    expect(() => cameraKeys([[0, 0, 0, 1], [2, 0, 0, 3], [2, 0, 0, 1.5], [4, 0, 0, 1.5]])).not.toThrow()
    expect(() => cameraKeys(inThenOut, { allowZoomReversal: true })).not.toThrow()
    // Zoom in twice in a row is one direction, not a reversal.
    expect(() => cameraKeys([[0, 0, 0, 1], [2, 0, 0, 3], [4, 0, 0, 9]])).not.toThrow()
  })

  it('sorts keys by time before it judges them, and refuses what is not a camera', () => {
    expect(cameraKeys([[3, 0, 0, 2], [1, 0, 0, 1]]).map((k) => k[0])).toEqual([1, 3])
    expect(() => cameraKeys([])).toThrow(/at least one/)
    expect(() => cameraKeys([[0, 0, 0, 0]])).toThrow(/zoom must be above 0/)
    expect(() => cameraKeys([[0, 0, 0, -2]])).toThrow(/zoom must be above 0/)
    expect(() => cameraKeys([[0, Number.NaN, 0, 1]])).toThrow(/finite/)
    expect(() => cameraKeys([[0, 0, 0, 1, 'wobble' as never]])).toThrow(/ease must be one of/)
  })
})

describe('cameraPose on a spring', () => {
  const keys: CameraKey[] = [
    [0, 0, 0, 1],
    [0.5, 300, 0, 1],
    [2, 300, 100, 4],
  ]
  const ts = Array.from({ length: 600 }, (_, i) => i / 100)

  it('with a critical spring is monotone, never overshoots a key, and rests on the last one', () => {
    const cfg = { spring: critical(8) }
    let lastX = -1
    let lastZ = 0
    for (const t of ts) {
      const p = cameraPose(keys, t, cfg)
      expect(p.x).toBeGreaterThanOrEqual(lastX - 1e-12)
      expect(p.x).toBeLessThanOrEqual(300 + 1e-9)
      expect(p.zoom).toBeGreaterThanOrEqual(lastZ - 1e-12)
      expect(p.zoom).toBeLessThanOrEqual(4 + 1e-9)
      lastX = p.x
      lastZ = p.zoom
    }
    expect(cameraPose(keys, 5.99, cfg).zoom).toBeCloseTo(4, 6)
    expect(cameraPose(keys, 5.99, { spring: { ...critical(8), snap: 0.01 } })).toEqual({ x: 300, y: 100, zoom: 4 })
  })

  it('keeps its velocity when the next key arrives in flight (a retarget is not a stop)', () => {
    const cfg = { spring: critical(5) }
    // The third key arrives 0.3 s after the second, while a spring this slow is still on its way to it.
    const inFlight: CameraKey[] = [[0, 0, 0, 1], [0.2, 300, 0, 1], [0.5, 600, 0, 1]]
    const slope = (t: number) => (cameraPose(inFlight, t + 1e-6, cfg).x - cameraPose(inFlight, t - 1e-6, cfg).x) / 2e-6
    expect(slope(0.5 - 1e-5)).toBeGreaterThan(400)
    expect(Math.abs(slope(0.5 + 1e-5) - slope(0.5 - 1e-5))).toBeLessThan(2)
  })

  it('stays on the zoom pivot between keys, and clamp holds the camera on the last pose instead of swinging past it', () => {
    const loose = { spring: { omega: 14, zeta: 0.35 } }
    const held = { spring: { omega: 14, zeta: 0.35, clamp: true } }
    let past = 0
    for (const t of ts) {
      past = Math.max(past, cameraPose(keys, t, loose).zoom)
      expect(cameraPose(keys, t, held).zoom).toBeLessThanOrEqual(4)
    }
    expect(past).toBeGreaterThan(4.2)
  })
})

describe('cameraView and cameraFromView', () => {
  it('turn a pose into the screen transform and back', () => {
    const pose: CameraPose = { x: 321.5, y: -48.25, zoom: 3.25 }
    const view = cameraView(pose, VIEW)
    expect(view.s).toBe(3.25)
    // The pose's centre lands on the middle of the viewport.
    expect(pose.x * view.s + view.tx).toBeCloseTo(VIEW.width / 2, 9)
    expect(pose.y * view.s + view.ty).toBeCloseTo(VIEW.height / 2, 9)
    const back = cameraFromView(view, VIEW)
    expect(back.x).toBeCloseTo(pose.x, 9)
    expect(back.y).toBeCloseTo(pose.y, 9)
    expect(back.zoom).toBe(3.25)
  })
})

describe('holdCreep', () => {
  const base: CameraPose = { x: 400, y: 900, zoom: 2 }
  const lnZ = (t: number, creep: Parameters<typeof holdCreep>[2]) => Math.log(holdCreep(base, t, creep).zoom)

  it('does nothing before the hold, and nothing at all with no rate and no drift', () => {
    expect(holdCreep(base, 1.9, { from: 2, rate: 0.05 })).toEqual(base)
    expect(holdCreep(base, 2, { from: 2, rate: 0.05 })).toEqual(base)
    expect(holdCreep(base, 4, { from: 2 })).toEqual(base)
  })

  it('pushes at its rate once it has eased in, and starts with no jolt', () => {
    const creep = { from: 2, rate: 0.03 }
    // Steady state: d ln(zoom) / dt is the rate.
    const slope = (t: number) => (lnZ(t + 1e-5, creep) - lnZ(t - 1e-5, creep)) / 2e-5
    expect(slope(12)).toBeCloseTo(0.03, 9)
    // At the start the speed is zero: ln(zoom) is flat to second order.
    expect(lnZ(2.001, creep) - lnZ(2, creep)).toBeLessThan(1e-6)
    // And it only ever grows (a push), never wobbles.
    let last = 0
    for (let i = 0; i <= 300; i++) {
      const v = lnZ(2 + i / 100, creep)
      expect(v).toBeGreaterThanOrEqual(last)
      last = v
    }
    // A pull is the same with the sign flipped.
    expect(lnZ(5, { from: 2, rate: -0.03 }) - Math.log(base.zoom)).toBeCloseTo(-(lnZ(5, creep) - Math.log(base.zoom)), 12)
  })

  it('pivots on its focal point: that world point does not move on screen', () => {
    const focal = [520, 760] as const
    const creep = { from: 1, rate: 0.05, focal }
    const at = (t: number) => {
      const v = cameraView(holdCreep(base, t, creep), VIEW)
      return [focal[0] * v.s + v.tx, focal[1] * v.s + v.ty]
    }
    const [sx, sy] = at(1)
    for (const t of [1.3, 2, 3.5, 6]) {
      expect(at(t)[0]).toBeCloseTo(sx, 8)
      expect(at(t)[1]).toBeCloseTo(sy, 8)
    }
    // With no focal the middle of the frame is the pivot.
    const centre = (t: number) => {
      const v = cameraView(holdCreep(base, t, { from: 1, rate: 0.05 }), VIEW)
      return [base.x * v.s + v.tx, base.y * v.s + v.ty]
    }
    expect(centre(5)[0]).toBeCloseTo(VIEW.width / 2, 8)
    expect(centre(5)[1]).toBeCloseTo(VIEW.height / 2, 8)
  })

  it('drifts the picture across the screen at its px/s, whatever the zoom', () => {
    const creep = { from: 0, drift: [-24, 10] as const }
    const where = (t: number) => {
      const v = cameraView(holdCreep(base, t, creep), VIEW)
      return [base.x * v.s + v.tx, base.y * v.s + v.ty]
    }
    // Past the ease-in (e^-25 of it left at 10 s), a second of creep is drift px of picture.
    expect(where(13)[0] - where(12)[0]).toBeCloseTo(-24, 8)
    expect(where(13)[1] - where(12)[1]).toBeCloseTo(10, 8)
  })

  it('is released by the next move: continuous speed into it, the exact pose out of it', () => {
    const keys: CameraKey[] = [[0, 400, 900, 2], [3, 400, 900, 2], [5, 900, 300, 4]]
    const release = { start: 3, seconds: 2 }
    const creep = { from: 0.5, rate: 0.04, drift: [-12, 0] as const, release }
    const pose = (t: number) => holdCreep(cameraPose(keys, t), t, creep)
    // The move lands exactly on its key, with no creep left.
    expect(pose(5)).toEqual({ x: 900, y: 300, zoom: 4 })
    expect(pose(7)).toEqual({ x: 900, y: 300, zoom: 4 })
    // Speed through the seam at 3 s: ln(zoom) slope the same from both sides.
    const slope = (t: number) => (Math.log(pose(t + 1e-5).zoom) - Math.log(pose(t - 1e-5).zoom)) / 2e-5
    // (The move itself starts from rest, so a little of its own speed is in the right-hand side: well under 1e-4 at 1e-4 s.)
    expect(Math.abs(slope(3 + 1e-4) - slope(3 - 1e-4))).toBeLessThan(1e-4)
    expect(slope(3 - 1e-4)).toBeGreaterThan(0.039)
    // The release follows the move's own ease, whichever it is: the pose is exact when the move lands.
    for (const ease of ['arrive', 'linear', 'move'] as const) {
      const eased: CameraKey[] = [[0, 400, 900, 2], [3, 400, 900, 2], [5, 900, 300, 4, ease]]
      const landed = holdCreep(cameraPose(eased, 5), 5, { ...creep, release: { ...release, ease } })
      expect(landed).toEqual({ x: 900, y: 300, zoom: 4 })
    }
    // Without the release the creep would stop dead at the seam; with it the speed is carried in.
    expect(slope(3 + 1e-4)).toBeGreaterThan(0.039)
  })
})

describe('cameraSpeeds', () => {
  const run = (keys: CameraKey[], from = 0, to = 4) =>
    cameraSpeeds((t) => cameraPose(keys, t), { fps: 30, viewport: VIEW, from, to })

  it('reports a pan in px per frame, and what it reports adds up to the distance moved', () => {
    const rows = run([[1, 0, 0, 1], [3, 600, 0, 1, 'linear']])
    expect(rows).toHaveLength(120)
    expect(rows[0]).toMatchObject({ frame: 0, t: 0, pan: 0, zoom: 0, max: 0 })
    // 600 px in 2 s is 10 px a frame at 30 fps, and nothing moves at the corners faster than the middle.
    for (const r of rows.filter((x) => x.t > 1.1 && x.t < 2.9)) {
      expect(r.pan).toBeCloseTo(10, 9)
      expect(r.max).toBeCloseTo(10, 9)
      expect(r.zoom).toBe(0)
    }
    // Frames either side of the move telescope: the total is the distance.
    expect(rows.reduce((sum, r) => sum + r.pan, 0)).toBeCloseTo(600, 9)
  })

  it('sees a zoom at the corners, where it is fastest, and as a share of zoom per frame', () => {
    const rows = run([[1, 0, 0, 1], [3, 0, 0, 4, 'linear']])
    const mid = rows.find((r) => r.t > 1.5 && r.t < 1.6)!
    expect(mid.pan).toBeCloseTo(0, 9)
    expect(mid.zoom).toBeCloseTo(Math.log(4) / 60, 9)
    // No pan, so only the corners move: the corner is hypot(540, 960) from the middle.
    const ratio = Math.exp(Math.log(4) / 60) - 1
    expect(mid.max).toBeCloseTo(Math.hypot(540, 960) * ratio, 4)
  })

  it('peaks in the middle of an eased move, and its peak is the number the blur pass reads', () => {
    const rows = run([[1, 0, 0, 1], [3, 600, 0, 1]])
    const peak = rows.reduce((a, b) => (b.max > a.max ? b : a))
    expect(peak.t).toBeGreaterThan(1.9)
    expect(peak.t).toBeLessThan(2.1)
    // The brand camera curve's steepest slope is 1.5 / 0.525 = 2.857x the average (10 px a frame here).
    expect(peak.max).toBeGreaterThan(28)
    expect(peak.max).toBeLessThan(29)
  })

  it('measures a camera with the living hold laid on it as it is drawn', () => {
    const base: CameraPose = { x: 540, y: 960, zoom: 1 }
    const rows = cameraSpeeds((t) => holdCreep(base, t, { from: 0, rate: 0.03 }), { fps: 30, viewport: VIEW, from: 2, to: 4 })
    for (const r of rows) {
      expect(r.zoom).toBeCloseTo(0.03 / 30, 4)
      // At 3% a second the corners crawl about 1.1 px a frame: a living hold, not a move.
      expect(r.max).toBeGreaterThan(0.9)
      expect(r.max).toBeLessThan(1.3)
    }
  })
})

describe('the map camera is the world camera', () => {
  const square = (lng: number, lat: number, size: number): LngLatRing => {
    const d = size / Math.cos((lat * Math.PI) / 180)
    return [[lng, lat], [lng + d, lat], [lng + d, lat + size], [lng, lat + size], [lng, lat]]
  }
  const city = square(-121.37, 44.0, 0.12)
  const place = square(-121.33, 44.05, 0.006)
  const geometries = [
    mapGeometry({ subject: [place], context: [city] }),
    mapGeometry({ subject: [place], context: null }),
    mapGeometry({ subject: [square(-121.5, 44.2, 0.01)], context: [square(-121.6, 44.1, 0.4)] }),
    mapGeometry({ subject: [square(-121.31, 44.06, 0.03), place], context: [city] }),
  ].filter((g): g is MapGeometry => g !== null)

  // map.ts cameraAt as it was before F2: its own closed form, kept here as the reference.
  const legacy = (geometry: MapGeometry, t: number, start: number, seconds: number) => {
    const [x1, y1, x2, y2] = [0.65, 0, 0.35, 1] as const
    const p = cubicBezier(x1, y1, x2, y2, progress(t, start, seconds))
    const { open, arrive } = geometry
    if (p <= 0) return open
    if (p >= 1) return arrive
    if (arrive.s === open.s) {
      return {
        s: open.s,
        tx: Math.round((open.tx + (arrive.tx - open.tx) * p) * 100) / 100,
        ty: Math.round((open.ty + (arrive.ty - open.ty) * p) * 100) / 100,
      }
    }
    const s = Math.exp(Math.log(open.s) + (Math.log(arrive.s) - Math.log(open.s)) * p)
    const fx = (open.tx - arrive.tx) / (arrive.s - open.s)
    const fy = (open.ty - arrive.ty) / (arrive.s - open.s)
    const sx = fx * open.s + open.tx
    const sy = fy * open.s + open.ty
    return {
      s: Math.round(s * 1e5) / 1e5,
      tx: Math.round((sx - fx * s) * 100) / 100,
      ty: Math.round((sy - fy * s) * 100) / 100,
    }
  }
  // JSON is what the frame signature and the page see, so -0 and 0 are the same camera.
  const same = (a: object, b: object) => JSON.stringify(a) === JSON.stringify(b)

  it('draws exactly what it drew before: every sample on the map move is the same camera, to the digit', () => {
    expect(geometries.length).toBe(4)
    let samples = 0
    for (const g of geometries) {
      for (const [start, seconds] of [[1, 2], [0.4, 1.3], [0, 3], [2.2, 0], [0.1, 1 / 30]] as const) {
        for (let i = -60; i <= 1200; i++) {
          const t = i / 240
          const now = mapCameraAt(g, t, start, seconds)
          const was = legacy(g, t, start, seconds)
          if (!same(now, was)) throw new Error(`map camera differs at t ${t} (start ${start}, ${seconds} s): ${JSON.stringify(now)} vs ${JSON.stringify(was)}`)
          samples++
        }
      }
    }
    expect(samples).toBe(4 * 5 * 1261)
  })

  it('lands on the open and arrive cameras exactly, and a place with no city has no move', () => {
    const [g, bare] = geometries
    expect(mapCameraAt(g, 0, 1, 2)).toEqual(g.open)
    expect(mapCameraAt(g, 3, 1, 2)).toEqual(g.arrive)
    // (Compared as the page sees it: JSON does not tell 0 from -0.)
    expect(JSON.stringify(mapCameraAt(bare, 1.5, 1, 2))).toBe(JSON.stringify(bare.open))
    expect(bare.open).toEqual(bare.arrive)
  })

  it('is a move of the world camera in the map box: the open pose goes to the arrive pose', () => {
    const [g] = geometries
    const box = { width: MAP_BOX.width, height: MAP_BOX.height }
    const a = cameraFromView(g.open, box)
    const b = cameraFromView(g.arrive, box)
    const mid = cameraMove(a, b, 2, 1, 2)
    const view = mapCameraAt(g, 2, 1, 2)
    expect(view.s).toBeCloseTo(mid.zoom, 5)
    expect(view.tx).toBeCloseTo(cameraView(mid, box).tx, 2)
    expect(view.ty).toBeCloseTo(cameraView(mid, box).ty, 2)
  })
})
