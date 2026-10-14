/**
 * lib/studio/motion/camera.ts — one world camera for footage, maps and type.
 *
 * Foundation F2 of the motion technique list (.claude/skills/motion-design/
 * references/technique-master-list.md). A film has ONE camera over one world;
 * every layer (a map, a plate of footage, a pin, a line of type that lives on
 * the picture) reads the same pose at frame t, so they cannot drift apart. It
 * generalises map.ts cameraAt, which now rides cameraMove. Pure in t: no state, no clock.
 *
 * The world is a plane in pixels. A pose is the world point at the middle of
 * the viewport and a zoom (screen pixels per world pixel):
 *
 *   screen = (world - [x, y]) * zoom + [width / 2, height / 2]
 *
 * Public API (frozen; build on it, do not widen it without Matt's say):
 *
 *   type CameraKey  = readonly [t, x, y, zoom, ease?]   at t the camera IS there;
 *                      ease (optional) shapes the move that ARRIVES at this key
 *   type CameraPose = { x, y, zoom }
 *   type CameraView = { s, tx, ty }      the same camera as a transform, the shape
 *                      map.ts calls Camera: screen = world * s + [tx, ty]
 *   type CameraEase = 'move' | 'arrive' | 'linear'
 *   type CameraCfg  = { ease?, spring? }
 *
 *   cameraKeys(keys, { allowZoomReversal? })  validate and sort: a frozen array.
 *                      Refuses a zoom-in followed straight away by a zoom-out (or
 *                      out then in): "one eased camera move per scene, never zoom
 *                      in then out consecutively" (prompt-motion ultimaxbt-2ddf1e).
 *                      A hold between them, or allowZoomReversal, lifts the refusal.
 *                      Also throws on no keys, a non-finite number, or zoom <= 0.
 *   cameraPose(keys, t, cfg?) the pose at t. Raw arrays are checked by cameraKeys on
 *                      every call; pass the result of cameraKeys to skip that.
 *   cameraMove(a, b, t, start, seconds, ease?)  one move between two poses; what each
 *                      cameraPose segment is, and what map.ts calls.
 *   cameraView(pose, viewport) / cameraFromView(view, viewport)  pose <-> transform.
 *   lmix(a, b, p)      a to b in log space: equal steps are equal perceived zoom.
 *   holdCreep(pose, t, creep)   the living hold: a slow push, pull or drift under a
 *                      still frame, released by the next move's own ease.
 *   cameraSpeeds(at, { fps, viewport, from?, to })  per-frame speed report for the
 *                      blur pass (F4): how fast the picture crosses the frame.
 *
 * How a move blends (cameraMove):
 *   - zoom = lmix(zoom_a, zoom_b, p): constant ratio per second at constant p speed,
 *     so a zoom feels the same speed at 1x and at 40x.
 *   - the centre travels the straight line from centre_a to centre_b at fraction
 *     g(p) = expm1(-p D) / expm1(-D), D = ln(zoom_b / zoom_a). That is exactly a zoom
 *     about the one world point that sits at the same screen position under both
 *     poses, so a push toward a place grows toward it instead of swinging out and
 *     back. With equal zooms D = 0 and g(p) = p, a plain pan.
 *   - p = ease((t - start) / seconds): 'move' is the brand draw and camera curve
 *     cubic-bezier(.65,0,.35,1) (the default), 'arrive' the brand ease-out
 *     (.22,.61,.36,1) for a camera that lands on a subject, 'linear' a constant
 *     speed (a follow, or a measurement). Before a key's time the camera is at the
 *     earlier key, after the last key it holds the last one. Two keys at one time
 *     are a cut.
 *
 * A heavy spring instead of a curve: cfg.spring = { omega, zeta, ... } (spring.ts
 * track options included). Then a key's time is when the camera is TOLD to go to
 * that pose, not when it arrives: the spring drives the fractional key index
 * through the keys, so a retarget in flight keeps the camera's velocity (a bezier
 * segment cannot), and every blend between two keys is the same pivoted log-space
 * blend above. Per-key eases are ignored then. clamp: true is a hard landing on each
 * key (the camera stops on a pose the first time it reaches it, instead of swinging
 * past); critical(omega) never overshoots a single move.
 */
import { BRAND_EASE_MOVE, BRAND_EASE_OUT, cubicBezier, progress } from './ease'
import { track, type SpringKey, type TrackCfg } from './spring'

export type CameraEase = 'move' | 'arrive' | 'linear'
export type CameraKey = readonly [t: number, x: number, y: number, zoom: number, ease?: CameraEase]
export type CameraPose = { x: number; y: number; zoom: number }
export type CameraView = { s: number; tx: number; ty: number }
export type CameraCfg = {
  /** The ease of a segment whose arriving key names none. Default 'move'. */
  ease?: CameraEase
  /** Drive the camera with a spring instead of curves. */
  spring?: TrackCfg
}
type Viewport = { width: number; height: number }

const EASES: readonly CameraEase[] = ['move', 'arrive', 'linear']
/** A zoom change under this many e-folds counts as no zoom at all (a hold, or a pan). */
const NO_ZOOM = 1e-9

function shape(ease: CameraEase, x: number): number {
  if (ease === 'linear') return Math.min(1, Math.max(0, x))
  const [x1, y1, x2, y2] = ease === 'arrive' ? BRAND_EASE_OUT : BRAND_EASE_MOVE
  return cubicBezier(x1, y1, x2, y2, x)
}

/** a to b in log space at p: the zoom ratio is constant per unit p. a and b must be above 0. Equal ends stay exactly themselves. */
export function lmix(a: number, b: number, p: number): number {
  if (a === b) return a
  return Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * p)
}

/** The pose a fraction p of the way from a to b (p may leave [0, 1] to extrapolate). */
function blend(a: CameraPose, b: CameraPose, p: number): CameraPose {
  if (p === 0) return { x: a.x, y: a.y, zoom: a.zoom }
  if (p === 1) return { x: b.x, y: b.y, zoom: b.zoom }
  const d = Math.log(b.zoom) - Math.log(a.zoom)
  const g = Math.abs(d) < NO_ZOOM ? p : Math.expm1(-p * d) / Math.expm1(-d)
  return { x: a.x + (b.x - a.x) * g, y: a.y + (b.y - a.y) * g, zoom: lmix(a.zoom, b.zoom, p) }
}

/** One move from pose a to pose b over [start, start + seconds] on `ease`. Exactly a before it, exactly b after it. */
export function cameraMove(
  a: CameraPose,
  b: CameraPose,
  t: number,
  start: number,
  seconds: number,
  ease: CameraEase = 'move',
): CameraPose {
  return blend(a, b, shape(ease, progress(t, start, seconds)))
}

const VALIDATED = new WeakSet<object>()
/** A validated camera's keys as spring keys (key i retargets the fractional index to i), made once. */
const INDEX_KEYS = new WeakMap<object, SpringKey[]>()

/**
 * Check and sort a camera's keys. The result is frozen and remembered, so
 * handing it back to cameraPose costs nothing.
 */
export function cameraKeys(keys: readonly CameraKey[], opts: { allowZoomReversal?: boolean } = {}): readonly CameraKey[] {
  if (keys.length === 0) throw new Error('a camera needs at least one key')
  for (const k of keys) {
    const [t, x, y, zoom, ease] = k
    if (![t, x, y, zoom].every(Number.isFinite)) throw new Error(`camera keys must be finite numbers, got [${k.join(', ')}]`)
    if (!(zoom > 0)) throw new Error(`camera zoom must be above 0, got ${zoom} at ${t} s`)
    if (ease !== undefined && !EASES.includes(ease)) throw new Error(`camera ease must be one of ${EASES.join(', ')}, got ${String(ease)}`)
  }
  const sorted = keys.map((k) => Object.freeze([...k]) as unknown as CameraKey).sort((a, b) => a[0] - b[0])
  if (!opts.allowZoomReversal) {
    // Adjacent moves only: a segment that has time and changes zoom, then the next one doing the opposite.
    const zoomOf = (i: number): number => {
      const [t0, , , z0] = sorted[i]
      const [t1, , , z1] = sorted[i + 1]
      return t1 > t0 ? Math.log(z1) - Math.log(z0) : 0
    }
    for (let i = 0; i + 2 < sorted.length; i++) {
      const first = zoomOf(i)
      const second = zoomOf(i + 1)
      if (Math.abs(first) > NO_ZOOM && Math.abs(second) > NO_ZOOM && first * second < 0) {
        throw new Error(
          `camera zooms ${first > 0 ? 'in' : 'out'} from ${sorted[i][0]} s to ${sorted[i + 1][0]} s and straight back ${first > 0 ? 'out' : 'in'} to ${sorted[i + 2][0]} s: one eased move per scene, never in then out (hold between them or merge the moves)`,
        )
      }
    }
  }
  const out = Object.freeze(sorted)
  VALIDATED.add(out)
  return out
}

const poseOf = (k: CameraKey): CameraPose => ({ x: k[1], y: k[2], zoom: k[3] })

/** The camera's pose at t. See the file header for the two ways keys can drive it. */
export function cameraPose(keys: readonly CameraKey[], t: number, cfg: CameraCfg = {}): CameraPose {
  if (!Number.isFinite(t)) throw new Error(`cameraPose needs a finite t, got ${t}`)
  const ks = VALIDATED.has(keys) ? keys : cameraKeys(keys)
  const n = ks.length
  if (n === 1) return poseOf(ks[0])

  if (cfg.spring) {
    // The spring drives the fractional key index; each key retargets it by one.
    let index = INDEX_KEYS.get(ks)
    if (!index) INDEX_KEYS.set(ks, (index = ks.map((k, i) => [k[0], i] as const)))
    const kappa = track(t, index, cfg.spring)
    const m = Math.min(n - 2, Math.max(0, Math.floor(kappa)))
    return blend(poseOf(ks[m]), poseOf(ks[m + 1]), kappa - m)
  }

  if (t <= ks[0][0]) return poseOf(ks[0])
  let i = 0
  while (i + 1 < n && ks[i + 1][0] <= t) i++
  if (i === n - 1) return poseOf(ks[i])
  const arrive = ks[i + 1]
  return cameraMove(poseOf(ks[i]), poseOf(arrive), t, ks[i][0], arrive[0] - ks[i][0], arrive[4] ?? cfg.ease ?? 'move')
}

/** The pose as a transform for a viewport: the centre of the viewport shows the pose's centre. */
export function cameraView(pose: CameraPose, viewport: Viewport): CameraView {
  return { s: pose.zoom, tx: viewport.width / 2 - pose.x * pose.zoom, ty: viewport.height / 2 - pose.y * pose.zoom }
}

/** The pose a transform stands for, in a viewport. The inverse of cameraView. */
export function cameraFromView(view: CameraView, viewport: Viewport): CameraPose {
  return { x: (viewport.width / 2 - view.tx) / view.s, y: (viewport.height / 2 - view.ty) / view.s, zoom: view.s }
}

export type HoldCreep = {
  /** When the hold begins (the moment the last move landed). Nothing creeps before it. */
  from: number
  /**
   * Zoom creep: the zoom is multiplied by e^(rate) each second of creep (0.03 is
   * about 3% a second in, negative pulls out). cinetic's scale creep is 2.4 to
   * 4.2% a second.
   */
  rate?: number
  /** Drift of the picture across the screen, [dx, dy] in px/s. The camera pans the other way. */
  drift?: readonly [number, number]
  /** The world point the zoom pivots on and keeps still on screen. The camera centre when omitted. */
  focal?: readonly [number, number]
  /** Seconds for the creep's speed to ease up from zero to its rate (exponential), so it never starts with a jolt. Default 0.4. */
  enter?: number
  /** The next move: the creep is eased out over it by the move's own ease (default 'move'), so the pose is exact when it lands. */
  release?: { start: number; seconds: number; ease?: CameraEase }
}

/**
 * A pose with the living hold applied (cam-living-hold: a barely visible push,
 * pull or drift under every hold, so a 2.5 s read never freezes). The creep
 * clock is the integral of a speed that eases in exponentially, so the seam
 * with the move before is velocity-continuous. With `release` the clock is
 * multiplied by 1 - p of the next move, so the creep carries its speed into the
 * move and is gone by the time the move lands.
 */
export function holdCreep(pose: CameraPose, t: number, creep: HoldCreep): CameraPose {
  const live = Math.max(0, t - creep.from)
  if (live <= 0) return { ...pose }
  const enter = creep.enter ?? 0.4
  let clock = enter > 0 ? live - enter * (1 - Math.exp(-live / enter)) : live
  if (creep.release) clock *= 1 - shape(creep.release.ease ?? 'move', progress(t, creep.release.start, creep.release.seconds))
  const k = Math.exp((creep.rate ?? 0) * clock)
  const [fx, fy] = creep.focal ?? [pose.x, pose.y]
  const [dx, dy] = creep.drift ?? [0, 0]
  const zoom = pose.zoom * k
  return {
    x: fx + (pose.x - fx) / k - (dx * clock) / zoom,
    y: fy + (pose.y - fy) / k - (dy * clock) / zoom,
    zoom,
  }
}

export type CameraSpeed = {
  frame: number
  /** Seconds at the frame's centre. */
  t: number
  /** px per frame the picture moves at the middle of the frame from the camera's pan alone. */
  pan: number
  /** Change in ln(zoom) across the frame (0.01 is about 1%). */
  zoom: number
  /** px per frame at the fastest of the frame's middle and four corners: pan and zoom together. */
  max: number
}

/**
 * How fast the picture crosses the frame, one row per frame in [from, to): the
 * pose half a frame either side of the frame's centre, with a world point at the
 * middle and each corner followed between them. The blur pass picks its subframe
 * count from `max` and the redesign rule is read off its peak (F4: nothing above
 * about 120 to 160 px per frame at 30 fps). `at` is any pose function, so a
 * camera with holdCreep layered on it is measured as drawn.
 */
export function cameraSpeeds(
  at: (t: number) => CameraPose,
  opts: { fps: number; viewport: Viewport; from?: number; to: number },
): CameraSpeed[] {
  const { fps, viewport } = opts
  if (!(fps > 0)) throw new Error(`cameraSpeeds needs fps above 0, got ${fps}`)
  const first = Math.round((opts.from ?? 0) * fps)
  const last = Math.round(opts.to * fps)
  const probes: Array<[number, number]> = [
    [0, 0],
    [-viewport.width / 2, -viewport.height / 2],
    [viewport.width / 2, -viewport.height / 2],
    [-viewport.width / 2, viewport.height / 2],
    [viewport.width / 2, viewport.height / 2],
  ]
  const rows: CameraSpeed[] = []
  for (let frame = first; frame < last; frame++) {
    const t = frame / fps
    const a = at(t - 0.5 / fps)
    const b = at(t + 0.5 / fps)
    // A world point at screen offset q from the middle under a sits at q * zb / za + (ca - cb) * zb under b.
    const ratio = b.zoom / a.zoom - 1
    const px = (a.x - b.x) * b.zoom
    const py = (a.y - b.y) * b.zoom
    let max = 0
    for (const [qx, qy] of probes) max = Math.max(max, Math.hypot(qx * ratio + px, qy * ratio + py))
    rows.push({ frame, t, pan: Math.hypot(px, py), zoom: Math.abs(Math.log(b.zoom) - Math.log(a.zoom)), max })
  }
  return rows
}
