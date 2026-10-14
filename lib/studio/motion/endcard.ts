/**
 * lib/studio/motion/endcard.ts: Ryan Realty's locked end card, as a pure function of t.
 *
 * Matt locked this card on 2026-10-08 (RULEBOOK §1, templates/END_CARD_SPEC.md):
 * cream field, the real logo at the top springing down into place, the words
 * Quality, Local, Service popping at centre in about a second, then "Call now"
 * and 541.703.3095 slamming up from the bottom and holding to the out. It closes
 * every Studio film that carries the brand.
 *
 * Nothing here touches a browser, a clock or a random number. `endcardState(t)`
 * returns plain numbers for each element (the card, the logo, the three words,
 * the pill, the phone) and page.ts applies them. Every number the look depends
 * on lives in ENDCARD below, so a frame-by-frame comparison against Matt's
 * reference changes one value, never the code.
 *
 * The guarantees, each held by a guard or by construction:
 *  - No frame shows two words overlapping, a word clipped, or a word outside
 *    x 120..950. Service flashes in at a reduced scale so it clears Quality;
 *    Local is hidden while Service holds centre and returns only once Service's
 *    left edge has cleared it; the card's breathe and punches are capped by the
 *    words that are on screen. endcard.test.ts checks every frame from the
 *    model; endcard.int.test.ts checks every frame from Chromium's own boxes.
 *  - Nothing sits in the top 220 px or the bottom 380 px: the call block rises
 *    from behind the y 1540 line instead of crossing the platform's button band.
 *  - Guards throw: words out of order, words that run into the call, a call
 *    hold under 1.5 s, a word line that cannot fit x 120..950 at the minimum
 *    size, and empty or dashed copy.
 */
import { BRAND_EASE_OUT, cubicBezier, progress } from './ease'
import { track } from './spring'

/** Advance width and ink extent of one word, in em of its own face. */
export type WordMetrics = { advance: number; inkLeft: number; inkRight: number }

/**
 * The locked card. Geometry is authored at 1080 x 1920; page.ts scales it with
 * the frame width.
 */
export const ENDCARD = {
  frame: { width: 1080, height: 1920, centreX: 540, centreY: 960 },
  fps: 30,
  /** Seconds from the end cue to the out (Call now at 1.25 s, so a 1.8 s hold). */
  duration: 3.05,
  /** Seconds from the end cue. Words in about a second, then the call. */
  offsets: { quality: 0, local: 0.4, service: 0.8, call: 1.25 },
  /** The hold after Call now. Under this the card throws. */
  minCallHold: 1.5,
  /** The optional loop transition: an iris closing over the last 0.3 s. */
  loop: { seconds: 0.3, irisFromPx: 1250 },
  /** The kick grid after Call now when the song gives none, seconds. */
  beatSeconds: 0.45,
  /** Nothing drawn above y 220 or below y 1540 (the bottom 380 px). */
  safe: { top: 220, bottom: 1540 },
  colors: { navy: '#102742', cream: '#faf8f4' },
  copy: { words: ['Quality', 'Local', 'Service'] as const, cta: 'Call now', phone: '541.703.3095' },
  logo: {
    /** The real stacked logo, byte-identical to design_system/ryan-realty/assets/brand/logo-blue.png. Never retyped. */
    file: 'public/brand/wordmark-stacked-navy.png',
    naturalWidth: 959,
    naturalHeight: 629,
    width: 520,
    top: 400,
    /** The spring: falls from 120 px up, settles with a small overshoot (about 10 px). */
    dropPx: 120,
    omega: 16,
    zeta: 0.62,
    fadeSeconds: 0.1,
    /** No bob until the spring has settled. */
    settleSeconds: 0.6,
    /** The slight beat bob while holding: down this far and back, on each hit. */
    bobPx: 4,
    bobSeconds: 0.3,
  },
  words: {
    /** Top of the words' 1 em line box. */
    top: 895,
    /**
     * The baseline inside that box, in em: Amboqia's ascent (0.7) plus half the
     * leading a 1.0 line height leaves (0.05). Words scale about it, so a
     * smaller Service sits on the same baseline as Quality.
     */
    baselineEm: 0.75,
    xMin: 120,
    xMax: 950,
    /** Space between neighbouring words on the last frame, in em. */
    gapEm: 0.3,
    minFs: 78,
    maxFs: 96,
    /**
     * The size is the largest whole pixel at which the final line, scaled by the
     * card's punch about the frame centre, still fits x 120..950. With the
     * measured metrics below that is 82 px (the spec's size).
     */
    fitHeadroom: 1.02,
    /** No two visible words closer than this, ever. */
    minGapPx: 8,
    /**
     * Amboqia Boriango, with the capital-I patch face in front of it, measured
     * in Chromium 141 at 1000 px (advance from layout, ink from canvas
     * measureText). endcard.int.test.ts re-measures and fails on drift.
     */
    metrics: {
      Quality: { advance: 3.418, inkLeft: 0, inkRight: 3.444 },
      Local: { advance: 2.437, inkLeft: 0, inkRight: 2.4449 },
      Service: { advance: 3.202, inkLeft: 0.0156, inkRight: 3.1905 },
    } as Record<string, WordMetrics>,
    /** Quality pops at centre (a back-out from 0.55x, about 2% over), then slides left. */
    quality: { popFrom: 0.55, popSeconds: 0.2, popBack: 1.2, slideDelay: 0.16, slideSeconds: 0.26 },
    /** Local flashes in at centre, settling from 1.12x, capped to clear Quality by clearPx. */
    local: { flashFrom: 1.12, flashSeconds: 0.2, clearPx: 22, returnGapPx: 12 },
    /** Service flashes in at centre at the scale that clears Quality by clearPx, holds, then grows as it slides right. */
    service: { clearPx: 22, holdSeconds: 0.12, slideSeconds: 0.3 },
    /** A word whose cap would draw it smaller than this stays hidden instead. */
    minVisibleScale: 0.5,
  },
  card: {
    /** A slow breathe on the whole card, so no stretch of it is frozen. */
    breathe: 0.004,
    breathePeriod: 2.2,
    /** The punch on Local's flash and on the call's landing. */
    punch: 0.02,
    punchSeconds: 0.24,
  },
  call: {
    pill: { left: 205, top: 1130, width: 660, height: 160 },
    ctaPx: 66,
    phoneTop: 1320,
    phonePx: 64,
    /** Rises from behind the safe line: 420 px below its place is fully hidden. */
    slamPx: 420,
    slamSeconds: 0.22,
    phoneDelay: 0.05,
    /** A hard decelerating stop, no overshoot. */
    slamEase: [0.16, 1, 0.3, 1] as const,
  },
}

export type EndcardTimesKey = 'quality' | 'local' | 'service' | 'call'

export type EndcardOptions = {
  /** The end cue, seconds into the film. Default 0. */
  start?: number
  /** Seconds from start to the out. Default ENDCARD.duration (3.05). */
  duration?: number
  fps?: number
  /** Seconds from start for each hit. */
  offsets?: Partial<Record<EndcardTimesKey, number>>
  /** Absolute seconds for any hit or the out; wins over offsets and duration. */
  at?: Partial<Record<EndcardTimesKey | 'out', number>>
  /** The kick grid after Call now, as a spacing or as absolute beat times. */
  beat_s?: number
  beats?: number[]
  /** Close an iris over the last loopDur seconds, so the film can loop into frame 0. */
  loop?: boolean
  loopDur?: number
  words?: readonly [string, string, string]
  cta?: string
  phone?: string
  /** Per-word metrics, for words other than the locked three. */
  metrics?: Record<string, WordMetrics>
  minFs?: number
  maxFs?: number
  xMin?: number
  xMax?: number
}

export type EndcardTimes = {
  start: number
  quality: number
  local: number
  service: number
  call: number
  out: number
  /** When the loop transition starts (out minus loopDur). */
  loopFrom: number
  duration: number
  fps: number
  /** Each time as a frame index at fps. */
  frames: Record<'start' | EndcardTimesKey | 'out' | 'loopFrom', number>
}

const clean = (n: number) => Math.round(n * 1e6) / 1e6

/** When each beat of the card lands. Throws on an order or hold the spec forbids. */
export function endcardTimes(opts: EndcardOptions = {}): EndcardTimes {
  const start = opts.start ?? 0
  const fps = opts.fps ?? ENDCARD.fps
  const at = (key: EndcardTimesKey) => clean(opts.at?.[key] ?? start + (opts.offsets?.[key] ?? ENDCARD.offsets[key]))
  const quality = at('quality')
  const local = at('local')
  const service = at('service')
  const call = at('call')
  const out = clean(opts.at?.out ?? start + (opts.duration ?? ENDCARD.duration))
  if (![start, quality, local, service, call, out].every(Number.isFinite)) throw new Error('End card times must be finite numbers')
  if (!(start <= quality && quality < local && local < service && service < call)) {
    throw new Error(`End card words out of order: quality ${quality}, local ${local}, service ${service}, call ${call}`)
  }
  const w = ENDCARD.words.service
  const wordsDone = clean(service + w.holdSeconds + w.slideSeconds)
  if (wordsDone > call + 1e-9) {
    throw new Error(`End card words run into call: Service settles at ${wordsDone}s, Call now is at ${call}s`)
  }
  const hold = clean(out - call)
  if (hold < ENDCARD.minCallHold - 1e-9) {
    throw new Error(`End card hold after Call now is ${hold}s; it must be at least ${ENDCARD.minCallHold}s`)
  }
  const loopFrom = clean(out - (opts.loopDur ?? ENDCARD.loop.seconds))
  const frame = (t: number) => Math.round(t * fps)
  return {
    start,
    quality,
    local,
    service,
    call,
    out,
    loopFrom,
    duration: clean(out - start),
    fps,
    frames: {
      start: frame(start),
      quality: frame(quality),
      local: frame(local),
      service: frame(service),
      call: frame(call),
      out: frame(out),
      loopFrom: frame(loopFrom),
    },
  }
}

/** Throws on empty copy or any dash (hyphen, en, em, minus). */
export function assertEndcardCopy(texts: string[]): void {
  for (const text of texts) {
    if (typeof text !== 'string' || !text.trim()) throw new Error('End card copy is empty')
    if (/[‐-―−-]/.test(text)) throw new Error(`End card copy carries a dash: "${text}"`)
  }
}

export type EndcardWordSlot = {
  text: string
  metrics: WordMetrics
  /** Centre x on the last frame. */
  cx: number
  /** Half-extent left and right of the centre at scale 1, px (advance and ink, whichever is wider). */
  left: number
  right: number
}

export type EndcardLayout = {
  fs: number
  gap: number
  /** The words' band centre: Local's place, and where each word pops. */
  band: number
  xMin: number
  xMax: number
  words: [EndcardWordSlot, EndcardWordSlot, EndcardWordSlot]
  /** Service's scale while it holds centre, so it clears Quality by service.clearPx. */
  serviceHoldScale: number
  copy: { words: [string, string, string]; cta: string; phone: string }
}

/** Where the three words end up, and at what size. Throws when the line cannot fit. */
export function endcardLayout(opts: EndcardOptions = {}): EndcardLayout {
  const words = [...(opts.words ?? ENDCARD.copy.words)] as [string, string, string]
  const cta = opts.cta ?? ENDCARD.copy.cta
  const phone = opts.phone ?? ENDCARD.copy.phone
  if (words.length !== 3) throw new Error('End card copy is empty: it needs exactly three words')
  assertEndcardCopy([...words, cta, phone])
  const table = { ...ENDCARD.words.metrics, ...(opts.metrics ?? {}) }
  const metrics = words.map((word) => {
    const m = table[word]
    if (!m) throw new Error(`End card word "${word}" has no measured metrics; measure it in Chromium first`)
    return m
  })
  const xMin = opts.xMin ?? ENDCARD.words.xMin
  const xMax = opts.xMax ?? ENDCARD.words.xMax
  const band = (xMin + xMax) / 2
  const cx0 = ENDCARD.frame.centreX
  const [mq, ml, ms] = metrics

  const slotsAt = (fs: number): EndcardWordSlot[] => {
    const gap = fs * ENDCARD.words.gapEm
    const half = (m: WordMetrics) => ({
      left: fs * (m.advance / 2 - Math.min(0, m.inkLeft)),
      right: fs * (Math.max(m.advance, m.inkRight) - m.advance / 2),
    })
    const centres = [
      band - fs * (ml.advance / 2 + mq.advance / 2) - gap,
      band,
      band + fs * (ml.advance / 2 + ms.advance / 2) + gap,
    ]
    return metrics.map((m, i) => ({ text: words[i], metrics: m, cx: centres[i], ...half(m) }))
  }
  const fits = (fs: number, headroom: number) =>
    slotsAt(fs).every((w) => {
      const l = cx0 - (cx0 - (w.cx - w.left)) * headroom
      const r = cx0 + (w.cx + w.right - cx0) * headroom
      return l >= xMin - 1e-9 && r <= xMax + 1e-9
    })

  const minFs = opts.minFs ?? ENDCARD.words.minFs
  const maxFs = opts.maxFs ?? ENDCARD.words.maxFs
  let fs: number | null = null
  for (let f = Math.floor(maxFs); f >= minFs; f--) {
    if (fits(f, ENDCARD.words.fitHeadroom)) {
      fs = f
      break
    }
  }
  if (fs == null && fits(minFs, 1)) fs = minFs
  if (fs == null) throw new Error(`End card word line cannot fit x ${xMin}..${xMax} at ${minFs}px`)

  const slots = slotsAt(fs) as [EndcardWordSlot, EndcardWordSlot, EndcardWordSlot]
  const quality = slots[0]
  const service = slots[2]
  const serviceHoldScale = Math.min(1, (band - (quality.cx + quality.right) - ENDCARD.words.service.clearPx) / service.left)
  if (!(serviceHoldScale >= ENDCARD.words.minVisibleScale)) {
    throw new Error(`End card word line cannot fit x ${xMin}..${xMax}: Service cannot clear Quality at centre`)
  }
  return {
    fs,
    gap: fs * ENDCARD.words.gapEm,
    band,
    xMin,
    xMax,
    words: slots,
    serviceHoldScale,
    copy: { words, cta, phone },
  }
}

/** One element's pose: translation from its authored place (px at 1080 wide), scale, opacity. */
export type EndcardPose = { x: number; y: number; scale: number; opacity: number }
/** A word's pose: its centre x in card space, plus the pose the page applies. */
export type EndcardWordPose = EndcardPose & { cx: number }

export type EndcardState = {
  /** The cream field. iris is the loop's clip radius in px, or null for no clip. */
  card: { opacity: number; scale: number; iris: number | null }
  logo: EndcardPose
  quality: EndcardWordPose
  local: EndcardWordPose
  service: EndcardWordPose
  pill: EndcardPose
  phone: EndcardPose
}

const ease = (p: number) => cubicBezier(BRAND_EASE_OUT[0], BRAND_EASE_OUT[1], BRAND_EASE_OUT[2], BRAND_EASE_OUT[3], p)
const slam = (p: number) => {
  const [a, b, c, d] = ENDCARD.call.slamEase
  return cubicBezier(a, b, c, d, p)
}
/** Back-out: lands past 1 by a little, then settles. Only Quality's pop uses it. */
function backOut(p: number, c1: number): number {
  if (p <= 0) return 0
  if (p >= 1) return 1
  const x = p - 1
  return 1 + (c1 + 1) * x * x * x + c1 * x * x
}

// `+ 0` turns a rounded -0 into 0, so equal frames compare equal.
const r2 = (n: number) => Math.round(n * 100) / 100 + 0
const r3 = (n: number) => Math.round(n * 1000) / 1000 + 0
const r5 = (n: number) => Math.round(n * 100000) / 100000 + 0

/** The beats the logo bobs on: the hits after its spring has settled, then the kick grid. */
export function endcardBeats(times: EndcardTimes, opts: EndcardOptions = {}): number[] {
  const settled = times.start + ENDCARD.logo.settleSeconds
  const grid: number[] = []
  if (opts.beats?.length) {
    grid.push(...opts.beats.filter((b) => b > times.call && b < times.out))
  } else {
    const step = opts.beat_s ?? ENDCARD.beatSeconds
    if (step > 0) for (let b = times.call + step; b < times.out - 1e-9; b += step) grid.push(clean(b))
  }
  return [times.service, times.call, ...grid].filter((b) => b >= settled).sort((a, b) => a - b)
}

/**
 * Where everything on the card is at t. Plain numbers; page.ts applies them.
 * Before the end cue everything is hidden; after the out it holds the last pose.
 */
export function endcardState(t: number, opts: EndcardOptions = {}): EndcardState {
  const T = endcardTimes(opts)
  const L = endcardLayout(opts)
  const W = ENDCARD.words
  const [Q, Lw, S] = L.words
  const band = L.band

  // Quality: pops at centre, then slides left to its slot.
  const qScaleAt = (time: number) =>
    W.quality.popFrom + (1 - W.quality.popFrom) * backOut(progress(time, T.quality, W.quality.popSeconds), W.quality.popBack)
  const qCxAt = (time: number) => band + (Q.cx - band) * ease(progress(time, T.quality + W.quality.slideDelay, W.quality.slideSeconds))
  const qRight = (time: number) => qCxAt(time) + qScaleAt(time) * Q.right
  const qOn = t >= T.quality
  const qScale = qScaleAt(t)
  const qCx = qCxAt(t)

  // Service: flashes in at centre at the scale that clears Quality, holds,
  // then grows to full size as it slides right.
  const sProgress = (time: number) => ease(progress(time, T.service + W.service.holdSeconds, W.service.slideSeconds))
  const sCxAt = (time: number) => band + (S.cx - band) * sProgress(time)
  const sScaleAt = (time: number) => {
    const grown = L.serviceHoldScale + (1 - L.serviceHoldScale) * sProgress(time)
    // Never closer to Quality than clearPx, whatever Quality is doing.
    const cap = (sCxAt(time) - qRight(time) - W.service.clearPx) / S.left
    return Math.min(grown, cap)
  }
  const sLeftAt = (time: number) => sCxAt(time) - sScaleAt(time) * S.left
  const sOn = t >= T.service
  const sScale = sScaleAt(t)

  // Local comes back only once Service's left edge has cleared it. The slide
  // is monotonic, so the moment is found by bisection, not by stepping frames.
  const localRight = band + Lw.right
  const clears = (time: number) => sLeftAt(time) >= localRight + W.local.returnGapPx
  const slideFrom = T.service + W.service.holdSeconds
  const slideTo = slideFrom + W.service.slideSeconds
  let tReturn = slideTo
  if (clears(slideFrom)) tReturn = slideFrom
  else if (clears(slideTo)) {
    let lo = slideFrom
    let hi = slideTo
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2
      if (clears(mid)) hi = mid
      else lo = mid
    }
    tReturn = hi
  } else tReturn = Number.POSITIVE_INFINITY

  // Local: flashes in at centre, capped so it clears Quality while Quality is
  // still sliding out, and Service once it is back.
  const lFlash = 1 + (W.local.flashFrom - 1) * (1 - ease(progress(t, T.local, W.local.flashSeconds)))
  const lCapQ = (band - qRight(t) - W.local.clearPx) / Lw.left
  const lCapS = sOn ? (sLeftAt(t) - W.local.returnGapPx - band) / Lw.right : Number.POSITIVE_INFINITY
  const lScale = Math.min(lFlash, lCapQ, lCapS)
  const lHidden = t >= T.service && t < tReturn
  const lOn = t >= T.local && !lHidden && lScale >= W.minVisibleScale

  const before = t < T.start
  const cx0 = ENDCARD.frame.centreX
  // Poses are rounded here, once, and everything after reads the rounded
  // numbers, so the cap below holds for exactly what the page draws.
  const wordPose = (cx: number, scale: number, on: boolean): EndcardWordPose => ({
    cx: r2(cx),
    x: r2(r2(cx) - cx0),
    y: 0,
    scale: r5(scale),
    opacity: !before && on ? 1 : 0,
  })
  const poses = {
    quality: wordPose(qCx, qScale, qOn),
    local: wordPose(band, lScale, lOn),
    service: wordPose(sCxAt(t), sScale, sOn && sScale >= W.minVisibleScale),
  }

  // The card: a slow breathe plus a punch on Local's flash and on the call's
  // landing, capped so no visible word is pushed past x 120..950.
  const C = ENDCARD.card
  const call = ENDCARD.call
  const landed = T.call + call.slamSeconds
  const since = t - T.start
  let raw = 1 + C.breathe * Math.sin((2 * Math.PI * Math.max(0, since)) / C.breathePeriod)
  for (const hit of [T.local, landed]) {
    if (t >= hit) raw += C.punch * (1 - ease(progress(t, hit, C.punchSeconds)))
  }
  let cap = Number.POSITIVE_INFINITY
  for (const [pose, slot] of [
    [poses.quality, Q],
    [poses.local, Lw],
    [poses.service, S],
  ] as const) {
    if (pose.opacity <= 0) continue
    const left = pose.cx - pose.scale * slot.left
    const right = pose.cx + pose.scale * slot.right
    if (left < cx0) cap = Math.min(cap, (cx0 - L.xMin) / (cx0 - left))
    if (right > cx0) cap = Math.min(cap, (L.xMax - cx0) / (right - cx0))
  }
  // The cap is rounded down, so rounding never carries a word out.
  const cardScale = Math.min(r5(raw), Math.floor(cap * 1e5) / 1e5)

  // The logo springs down into place, then bobs a little on each beat.
  const G = ENDCARD.logo
  let logoY = track(t, [[T.start, -G.dropPx], [T.start, 0]], { omega: G.omega, zeta: G.zeta })
  for (const beat of endcardBeats(T, opts)) {
    if (t >= beat && t < beat + G.bobSeconds) logoY += G.bobPx * Math.sin(Math.PI * progress(t, beat, G.bobSeconds))
  }

  // The call block slams up from behind the safe line and holds.
  const pillP = slam(progress(t, T.call, call.slamSeconds))
  const phoneP = slam(progress(t, T.call + call.phoneDelay, call.slamSeconds))

  // The loop: an iris closing over the last loopDur seconds, accelerating out.
  let iris: number | null = null
  if (opts.loop && t >= T.loopFrom) {
    const p = progress(t, T.loopFrom, T.out - T.loopFrom)
    iris = r2(ENDCARD.loop.irisFromPx * (1 - p * p))
  }

  return {
    card: { opacity: before ? 0 : 1, scale: cardScale, iris },
    logo: { x: 0, y: r2(logoY), scale: 1, opacity: before ? 0 : r3(ease(progress(t, T.start, G.fadeSeconds))) },
    quality: poses.quality,
    local: poses.local,
    service: poses.service,
    pill: { x: 0, y: r2(call.slamPx * (1 - pillP)), scale: 1, opacity: !before && t >= T.call ? 1 : 0 },
    phone: { x: 0, y: r2(call.slamPx * (1 - phoneP)), scale: 1, opacity: !before && t >= T.call + call.phoneDelay ? 1 : 0 },
  }
}

export type EndcardBox = { word: string; left: number; right: number; opacity: number }

/**
 * The frame-space horizontal extent of each word at a state: its own scale
 * about its centre, then the card's scale about the frame centre. What the
 * every-frame checks measure against.
 */
export function endcardWordBoxes(state: EndcardState, layout: EndcardLayout): EndcardBox[] {
  const cx0 = ENDCARD.frame.centreX
  const keys = ['quality', 'local', 'service'] as const
  return keys.map((key, i) => {
    const pose = state[key]
    const slot = layout.words[i]
    const left = pose.cx - pose.scale * slot.left
    const right = pose.cx + pose.scale * slot.right
    return {
      word: slot.text,
      left: cx0 + (left - cx0) * state.card.scale,
      right: cx0 + (right - cx0) * state.card.scale,
      opacity: pose.opacity * state.card.opacity,
    }
  })
}
