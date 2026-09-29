/**
 * V3ListingDial — the pure half. Index arithmetic, the position readout, the
 * key map, the swipe rule and the thumbnail's accessible name live here so the
 * unit suite can hold them without a DOM.
 *
 * THE DIAL WRAPS. Matt named it a dial (2026-09-23), and a dial has no end
 * stop: Next on the last home turns to the first, Previous on the first turns
 * to the last. That is also the WAI-ARIA tabs pattern's arrow-key rule
 * (focus moves from the last tab to the first), so the buttons, the keys and
 * a swipe all move the same way. Home and End are the two absolute moves.
 */

/** `index` folded into 0..count-1. A count under 1 has no position: 0. */
export function dialWrap(index: number, count: number): number {
  if (!Number.isFinite(count) || count < 1) return 0
  const n = Math.floor(count)
  const i = Math.trunc(Number.isFinite(index) ? index : 0)
  return ((i % n) + n) % n
}

/** One turn of the dial: `delta` steps from `index`, wrapping at both ends. */
export function dialStep(index: number, delta: number, count: number): number {
  return dialWrap(index + delta, count)
}

/**
 * The index a key moves the selection to, or null when the key is not the
 * dial's. Both axes are honoured in both layouts: the rail stands vertical
 * beside the card on a wide screen and lies horizontal under it on a phone,
 * and a reader should not have to know which one they are looking at.
 */
export function dialKeyTarget(key: string, index: number, count: number): number | null {
  if (count < 2) return null
  switch (key) {
    case 'ArrowDown':
    case 'ArrowRight':
      return dialStep(index, 1, count)
    case 'ArrowUp':
    case 'ArrowLeft':
      return dialStep(index, -1, count)
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

export type DialPosition = {
  /** 1-based position shown to the reader. */
  shown: number
  count: number
  /** "03" */
  now: string
  /** "12" */
  total: string
  /** "03 / 12", the same readout HomeRailPosition prints on the rails. */
  text: string
  /** shown / count, 0..1: how far the hairline under the readout fills. */
  fraction: number
}

/** The "03 / 12" readout for the whole dial. Null when there is nothing to count through. */
export function dialPosition(index: number, count: number): DialPosition | null {
  if (!Number.isFinite(count) || count < 2) return null
  const n = Math.floor(count)
  const shown = dialWrap(index, n) + 1
  const now = pad2(shown)
  const total = pad2(n)
  return { shown, count: n, now, total, text: `${now} / ${total}`, fraction: shown / n }
}

/** The smallest horizontal travel, in CSS px, that counts as a swipe. */
export const DIAL_SWIPE_MIN_PX = 40

/**
 * A finished touch on the lead photograph: +1 (swiped left, the next home),
 * -1 (swiped right, the previous one), or 0 (a tap, or a mostly vertical drag,
 * which is the page scrolling and must not turn the dial).
 */
export function dialSwipeDelta(dx: number, dy: number, minPx = DIAL_SWIPE_MIN_PX): -1 | 0 | 1 {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return 0
  if (Math.abs(dx) < minPx) return 0
  if (Math.abs(dx) < Math.abs(dy) * 1.5) return 0
  return dx < 0 ? 1 : -1
}

/**
 * The one fact a thumbnail carries under its ask (2026-09-25: a rail of bare
 * photographs read as a stock carousel, not as homes to compare): the beds
 * and the size, taken from the card's own meta line (publishListingCardFacts)
 * so the rail can never print a figure the card does not. "3 bd · 1,800 sqft";
 * a lease or a lot with no beds keeps its size; nothing to say is null.
 */
export function dialThumbFact(meta: readonly string[]): string | null {
  const beds = meta.find((m) => / bd$/.test(m))
  // " sqft" with a space: the living area, never the "$322/sqft" price.
  const size = meta.find((m) => / sqft$/.test(m))
  const parts = [beds, size].filter((part): part is string => Boolean(part))
  return parts.length > 0 ? parts.join(' · ') : null
}

/**
 * THE ASKS STRIP (2026-09-29). Every priced home in the set as a tick on one
 * price axis, the home in front marked on it, so the dial reads as a set to
 * browse rather than one house at a time, and a drag along it turns the dial
 * by price. The figures are the rows' own asks, sorted; nothing is derived
 * but their order and where each falls between the cheapest and the dearest.
 *
 * `x` is 0..1 on a log scale (an ask is a ratio quantity: $400K to $800K is
 * the same step as $2M to $4M, and a linear axis pins most of a place's homes
 * into its first third). A set whose dearest ask is under 1.5x its cheapest is
 * drawn on a linear axis, where the log bend buys nothing.
 */
export type DialAsk = { index: number; price: number; x: number }
export type DialAskScale = {
  /** Priced homes, cheapest first; ties keep dial order. */
  asks: DialAsk[]
  lo: number
  hi: number
  /** Dial index -> rank in `asks` (a home with no ask has none). */
  rank: Map<number, number>
}

/** Fewer priced homes than this and the strip draws nothing. */
export const DIAL_ASKS_MIN = 5

export function dialAskScale(
  rows: ReadonlyArray<{ price: number | null | undefined; lease: boolean }>,
  min = DIAL_ASKS_MIN,
): DialAskScale | null {
  const priced: Array<{ index: number; price: number }> = []
  rows.forEach((row, index) => {
    const p = row.price
    if (row.lease || p == null || !Number.isFinite(p) || p <= 0) return
    priced.push({ index, price: p })
  })
  if (priced.length < min) return null
  priced.sort((a, b) => a.price - b.price || a.index - b.index)
  const lo = priced[0]!.price
  const hi = priced[priced.length - 1]!.price
  const log = hi / lo >= 1.5
  const span = log ? Math.log(hi) - Math.log(lo) : hi - lo
  const asks = priced.map(({ index, price }) => ({
    index,
    price,
    x: span > 0 ? (log ? (Math.log(price) - Math.log(lo)) / span : (price - lo) / span) : 0.5,
  }))
  const rank = new Map<number, number>()
  asks.forEach((ask, r) => rank.set(ask.index, r))
  return { asks, lo, hi, rank }
}

/** The rank of the ask nearest `x` (0..1); ties go to the cheaper home. */
export function dialAskNearest(asks: readonly DialAsk[], x: number): number {
  if (asks.length === 0) return -1
  const at = Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0))
  let lo = 0
  let hi = asks.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (asks[mid]!.x < at) lo = mid + 1
    else hi = mid
  }
  if (lo > 0 && Math.abs(asks[lo - 1]!.x - at) <= Math.abs(asks[lo]!.x - at)) return lo - 1
  return lo
}

/** The rank a key moves to from `rank` (null: the home in front has no ask). */
export function dialAskKeyTarget(key: string, rank: number | null, total: number): number | null {
  if (total < 1) return null
  const page = Math.max(1, Math.round(total / 10))
  const from = rank ?? -1
  switch (key) {
    case 'ArrowRight':
    case 'ArrowUp':
      return Math.min(total - 1, from + 1)
    case 'ArrowLeft':
    case 'ArrowDown':
      return rank == null ? 0 : Math.max(0, from - 1)
    case 'PageUp':
      return Math.min(total - 1, Math.max(0, from) + page)
    case 'PageDown':
      return Math.max(0, (rank ?? 0) - page)
    case 'Home':
      return 0
    case 'End':
      return total - 1
    default:
      return null
  }
}

/** One path of ticks, `d` for an SVG whose viewBox is 1000 wide and `h` tall. */
export function dialAskTicksPath(asks: readonly DialAsk[], h: number): string {
  let d = ''
  for (const ask of asks) d += `M${(ask.x * 1000).toFixed(1)} 0v${h}`
  return d
}

/**
 * A price cut, as the page that knows it hands it to the dial (/price-drops):
 * the words and the magnitude the row already carries, never re-derived here.
 * `was` is the earlier ask as printed ("$1,149,000"), `pct` the cut as printed
 * ("-13.1%"), `share` the cut as a share of the deepest cut in the same set,
 * 0..1, or null when the row has no percent (unknown is not zero).
 */
export type DialPriceCut = {
  was: string | null
  pct: string | null
  share: number | null
}

/** The cut track's fill, as a CSS width: a share outside 0..1 is clamped, none is null. */
export function dialCutWidth(share: number | null | undefined): string | null {
  if (share == null || !Number.isFinite(share) || share <= 0) return null
  return `${(Math.min(1, share) * 100).toFixed(1)}%`
}

/** Shown when the row has no ask to publish (never "Price on request"). */
export const DIAL_NO_ASK = 'Price not published'

/**
 * What the dial prints in the price slot, and whether it is a withheld line
 * rather than a figure (the card sets it quieter). A commercial lease prints
 * its rate with the unit, or its own withheld line; a sale listing its ask, or
 * DIAL_NO_ASK. `lease` is publishListingCardFacts' own, never built here.
 */
export function dialPriceSlot(facts: {
  ask: string | null
  lease: { rate: string | null; text: string } | null
}): { text: string; withheld: boolean } {
  if (facts.lease) return { text: facts.lease.text, withheld: facts.lease.rate == null }
  if (facts.ask) return { text: facts.ask, withheld: false }
  return { text: DIAL_NO_ASK, withheld: true }
}

/**
 * A thumbnail's accessible name: the ask, then the street, in the order the
 * thumbnail prints them, so the visible caption is inside the name
 * (WCAG 2.5.3). "$649,000, 1234 NW Portland Ave".
 */
export function dialThumbLabel(addressLine: string, ask: string | null): string {
  const address = addressLine.trim()
  const price = ask?.trim() || DIAL_NO_ASK
  return address ? `${price}, ${address}` : price
}

/** The id of one thumbnail tab and of the card panel it controls. */
export function dialTabId(dialId: string, index: number): string {
  return `${dialId}-tab-${index}`
}

export function dialPanelId(dialId: string, index: number): string {
  return `${dialId}-card-${index}`
}

/**
 * The scroll offset that brings item [start, start+size) fully into a
 * scroller of `viewport` length currently at `scroll`, centring it when it has
 * to move, and leaving the rail where it is when the item is already whole.
 * Returns the new offset (unclamped low bound 0).
 */
export function dialRevealOffset(
  scroll: number,
  viewport: number,
  start: number,
  size: number,
): number {
  if (start >= scroll && start + size <= scroll + viewport) return scroll
  return Math.max(0, Math.round(start - (viewport - size) / 2))
}

/**
 * The share of a thumbnail that must sit inside the rail for it to count as
 * whole. Under it the rail's edge cuts through the thumbnail, and the dial
 * hides its caption (a price cut off mid-string, "$1.00/", is not a price),
 * leaving the photograph under the fade as the sign there is more. Just under
 * 1 so a sub-pixel sliver lost to rounding does not hide a caption.
 */
export const DIAL_THUMB_WHOLE = 0.99

/** Whether the rail's edge cuts through a thumbnail showing `ratio` of itself (0..1). */
export function dialThumbCut(ratio: number): boolean {
  if (!Number.isFinite(ratio)) return false
  return ratio < DIAL_THUMB_WHOLE
}

/* ---------------------------------------------------------------------------
   THE RAIL'S PLACE (Matt 2026-09-24). The thumbnails stand under the card
   (bottom, the default) or in a column on its left or its right. Matt does
   not want every dial on the site to turn the same way, so a page that stacks
   several dials gives the i-th one dialRailPositionAt(i): no two adjacent
   dials share a position. A phone lays every one as a strip under the card.
   --------------------------------------------------------------------------- */

export type DialRailPosition = 'bottom' | 'left' | 'right'

/** The cycle dialRailPositionAt walks: bottom, left, right. */
export const DIAL_RAIL_POSITIONS: readonly DialRailPosition[] = ['bottom', 'left', 'right']

export const DIAL_RAIL_DEFAULT: DialRailPosition = 'bottom'

/** Any caller value folded to a position the dial draws; anything unknown is the default. */
export function dialRailPosition(raw: unknown): DialRailPosition {
  return raw === 'left' || raw === 'right' || raw === 'bottom' ? raw : DIAL_RAIL_DEFAULT
}

/**
 * The rail position for the `index`-th dial stacked on a page (0-based):
 * bottom, left, right, bottom, ... so two adjacent dials never share one.
 * A non-finite or negative index is the first dial.
 */
export function dialRailPositionAt(index: number): DialRailPosition {
  const i = Number.isFinite(index) && index > 0 ? Math.floor(index) : 0
  return DIAL_RAIL_POSITIONS[i % DIAL_RAIL_POSITIONS.length]
}

/** Whether the thumbnails run left to right: a bottom rail, or any rail on a phone. */
export function dialRailHorizontal(position: DialRailPosition, phone: boolean): boolean {
  return phone || position === 'bottom'
}

/**
 * The site's Jax button (V3DogFloater) is fixed at the viewport's right edge
 * and vertically centred, so as the page scrolls it passes over the whole
 * height of a right-hand rail. The rail keeps this much air between its
 * thumbnails and the button.
 */
export const DIAL_JAX_GAP_PX = 12

/**
 * How far (CSS px) a right-hand rail must stop short of the dial's right edge
 * so no thumbnail, step or readout ever sits under the Jax button: 0 when the
 * dial already ends left of the button, or when the page has no button.
 * `dialRight` and `jaxLeft` are viewport x coordinates (getBoundingClientRect).
 */
export function dialEndClearance(dialRight: number, jaxLeft: number | null, gap = DIAL_JAX_GAP_PX): number {
  if (jaxLeft == null || !Number.isFinite(jaxLeft) || !Number.isFinite(dialRight)) return 0
  return Math.max(0, Math.ceil(dialRight - (jaxLeft - gap)))
}

/* ---------------------------------------------------------------------------
   THE CARD'S REEL (Matt 2026-09-24): "as we toggle through or navigate those
   cards, have the primary photo come in first; after a second or two, play
   the video associated with it if there is one."

   The photograph shows the moment a card turns up. Only when the reader rests
   on it for DIAL_VIDEO_DWELL_MS, with the dial on screen and the tab in front,
   does the dial ask for the card's reel (one small cached request). A reel is
   mounted under the photograph and fades in only once it is actually playing;
   if it has not started within DIAL_VIDEO_START_TIMEOUT_MS, or it errors, the
   photograph simply stays. A turn, the dial leaving the screen, or the tab
   going to the background cancels the wait, the request and the reel at once.
   One reel plays on the whole page (the coordinator).

   Reduced motion, Save-Data and a 2G connection never autoplay: the card
   offers a "Play video" control instead and plays only when asked.
   --------------------------------------------------------------------------- */

/** How long the reader rests on a card before its reel is looked up. */
export const DIAL_VIDEO_DWELL_MS = 1500

/**
 * How long a reel has to start playing once its player is ready (a hosted
 * player says so; a file has its metadata) before the card gives up and
 * keeps its photograph.
 */
export const DIAL_VIDEO_START_TIMEOUT_MS = 4000

/**
 * How long a mounted reel's player has to get ready at all. A hosted player
 * loads its own page and scripts first (YouTube took about 8 s through a slow
 * link, 2026-09-24), which is not the reel failing to start; the photograph
 * stays the whole time either way.
 */
export const DIAL_VIDEO_LOAD_TIMEOUT_MS = 8000

/** The share of the card's photograph that must be on screen for its reel to run. */
export const DIAL_VIDEO_ON_SCREEN_RATIO = 0.5

export type DialVideoEnv = {
  /** prefers-reduced-motion: reduce */
  reducedMotion: boolean
  /** navigator.connection.saveData */
  saveData?: boolean | null
  /** navigator.connection.effectiveType ("4g", "3g", "2g", "slow-2g") */
  effectiveType?: string | null
}

/** Whether a reel may start on its own. Never under reduced motion, Save-Data or 2G. */
export function dialVideoAutoplay(env: DialVideoEnv): boolean {
  if (env.reducedMotion) return false
  if (env.saveData === true) return false
  const type = (env.effectiveType ?? '').toLowerCase()
  return type !== '2g' && type !== 'slow-2g'
}

/**
 * Whether a card is worth asking about. A caller that already knows a listing
 * has no reel (its row carries no Videos and no VirtualTours: a walkthrough is
 * often filed as a virtual tour) passes `hasVideo: false` and the dial never
 * asks. Unknown (undefined or null) asks.
 */
export function dialVideoLookupWanted(hasVideo: boolean | null | undefined): boolean {
  return hasVideo !== false
}

/**
 * Where a card's reel stands.
 *   photo     the photograph alone (no reel, not yet, or the reel failed)
 *   dwell     resting on the card; the lookup starts when the dwell ends
 *   lookup    asking whether the card has a reel
 *   offer     the card has a reel that is not playing: the "Play video" control
 *   starting  the reel is mounted under the photograph, not yet playing
 *   playing   the reel is playing and has faded in over the photograph
 */
export type DialVideoStage = 'photo' | 'dwell' | 'lookup' | 'offer' | 'starting' | 'playing'

export type DialVideoState<V> = { key: string | null; stage: DialVideoStage; video: V | null }

/** One reel on the page at a time. A new claim stops the one before it. */
export type DialVideoCoordinator = {
  claim(owner: object, onYield: () => void): void
  release(owner: object): void
  owner(): object | null
}

export function createDialVideoCoordinator(): DialVideoCoordinator {
  let current: { owner: object; onYield: () => void } | null = null
  return {
    claim(owner, onYield) {
      if (current && current.owner !== owner) {
        const previous = current
        current = null
        previous.onYield()
      }
      current = { owner, onYield }
    },
    release(owner) {
      if (current?.owner === owner) current = null
    },
    owner() {
      return current?.owner ?? null
    },
  }
}

export type DialTimers = {
  set: (fn: () => void, ms: number) => unknown
  clear: (handle: unknown) => void
}

const REAL_TIMERS: DialTimers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

export type DialVideoControllerOptions<V> = {
  /** Resolve a card's reel. Aborted when the reader turns away first. */
  lookup: (key: string, signal: AbortSignal) => Promise<V | null>
  coordinator: DialVideoCoordinator
  onChange: (state: DialVideoState<V>) => void
  /** dialVideoAutoplay(env) at mount; setAutoplay follows changes. */
  autoplay: boolean
  dwellMs?: number
  startTimeoutMs?: number
  loadTimeoutMs?: number
  timers?: DialTimers
}

export type DialVideoController<V> = {
  /** The card now in front of the reader (null: none). A new key cancels everything for the old one. */
  select(key: string | null, hasVideo?: boolean | null): void
  /** The dial is on screen and the tab is visible. */
  setEligible(eligible: boolean): void
  setAutoplay(autoplay: boolean): void
  /** The mounted reel's player is ready (or its file has metadata): it now has the start timeout to play. */
  ready(): void
  /** The mounted reel reported that it is playing. */
  started(): void
  /** The mounted reel errored: keep the photograph, and never retry this card on this page view. */
  failed(): void
  /**
   * The browser refused to start the reel on its own (autoplay blocked, e.g.
   * iOS Low Power Mode): the reel is fine, so the card offers "Play video"
   * and waits for the reader.
   */
  blocked(): void
  /** The reader pressed "Play video". */
  play(): void
  /** The reader pressed "Pause": back to the photograph, with "Play video" offered. */
  pause(): void
  /** Something else took the card's media (its 3D tour): the photograph, and no reel until the next turn. */
  suspend(): void
  state(): DialVideoState<V>
  destroy(): void
}

export function createDialVideoController<V>(opts: DialVideoControllerOptions<V>): DialVideoController<V> {
  const timers = opts.timers ?? REAL_TIMERS
  const dwellMs = opts.dwellMs ?? DIAL_VIDEO_DWELL_MS
  const startTimeoutMs = opts.startTimeoutMs ?? DIAL_VIDEO_START_TIMEOUT_MS
  const loadTimeoutMs = opts.loadTimeoutMs ?? DIAL_VIDEO_LOAD_TIMEOUT_MS
  const self = {}
  /** The mounted reel's player has said it is ready (the start clock has been reset once). */
  let readied = false
  /** Resolved lookups for this page view: a reel, or null (none, or it failed to start). */
  const known = new Map<string, V | null>()
  let key: string | null = null
  let hint: boolean | null | undefined
  let eligible = false
  let autoplay = opts.autoplay
  /** The reader paused, or another reel took over: nothing starts on its own until the next turn. */
  let held = false
  let suspended = false
  let destroyed = false
  let stage: DialVideoStage = 'photo'
  let video: V | null = null
  let timer: unknown = null
  let pending: AbortController | null = null

  const snapshot = (): DialVideoState<V> => ({ key, stage, video })

  function set(next: DialVideoStage, nextVideo: V | null): void {
    if (next === stage && nextVideo === video) return
    stage = next
    video = nextVideo
    if (!destroyed) opts.onChange(snapshot())
  }

  function clearTimer(): void {
    if (timer != null) {
      timers.clear(timer)
      timer = null
    }
  }

  /** Stop waiting, stop asking, stop playing. */
  function cancel(): void {
    clearTimer()
    if (pending) {
      pending.abort()
      pending = null
    }
    opts.coordinator.release(self)
  }

  function failed(): void {
    if (stage !== 'starting' && stage !== 'playing') return
    if (key != null) known.set(key, null)
    cancel()
    set('photo', null)
  }

  function onYield(): void {
    // Another card took the page's one reel. The coordinator has already moved
    // ownership, so only this card's own timer stops.
    clearTimer()
    held = true
    set(video ? 'offer' : 'photo', video)
  }

  /** Give the mounted reel `ms` to reach the next step, or keep the photograph. */
  function startClock(ms: number): void {
    clearTimer()
    timer = timers.set(() => {
      timer = null
      if (stage === 'starting') failed()
    }, ms)
  }

  function begin(reel: V): void {
    opts.coordinator.claim(self, onYield)
    clearTimer()
    readied = false
    set('starting', reel)
    startClock(loadTimeoutMs)
  }

  function resolve(reel: V | null): void {
    if (!reel) {
      set('photo', null)
      return
    }
    if (autoplay && !held) begin(reel)
    else set('offer', reel)
  }

  function lookUp(): void {
    const at = key
    if (at == null) return
    if (known.has(at)) {
      resolve(known.get(at) ?? null)
      return
    }
    const request = new AbortController()
    pending = request
    set('lookup', null)
    opts.lookup(at, request.signal).then(
      (reel) => {
        if (pending !== request) return
        pending = null
        known.set(at, reel ?? null)
        resolve(reel ?? null)
      },
      () => {
        // A failed request (a 503 from a failed read, a 429 from the API
        // limiter, the network) is not a fact about the listing: the
        // photograph now, and the card is asked again the next time the
        // reader rests on it.
        if (pending !== request) return
        pending = null
        set('photo', null)
      },
    )
  }

  function arm(): void {
    cancel()
    if (destroyed || key == null || !eligible || suspended || !dialVideoLookupWanted(hint)) {
      set('photo', null)
      return
    }
    const reel = known.has(key) ? (known.get(key) ?? null) : undefined
    if (reel === null) {
      set('photo', null)
      return
    }
    if (reel !== undefined && held) {
      set('offer', reel)
      return
    }
    set('dwell', null)
    timer = timers.set(() => {
      timer = null
      lookUp()
    }, dwellMs)
  }

  return {
    select(nextKey, nextHint) {
      if (destroyed) return
      if (nextKey === key && nextHint === hint) return
      key = nextKey
      hint = nextHint
      held = false
      suspended = false
      arm()
    },
    setEligible(next) {
      if (destroyed || next === eligible) return
      eligible = next
      arm()
    },
    setAutoplay(next) {
      if (destroyed || next === autoplay) return
      autoplay = next
      if (!autoplay && (stage === 'starting' || stage === 'playing')) {
        const reel = video
        cancel()
        set('offer', reel)
      } else if (autoplay && stage === 'offer' && video && !held) {
        begin(video)
      }
    },
    ready() {
      if (stage !== 'starting' || readied) return
      readied = true
      startClock(startTimeoutMs)
    },
    started() {
      if (stage !== 'starting') return
      clearTimer()
      set('playing', video)
    },
    failed,
    blocked() {
      if (stage !== 'starting' && stage !== 'playing') return
      const reel = video
      cancel()
      held = true
      set('offer', reel)
    },
    play() {
      if (destroyed || stage !== 'offer' || !video) return
      held = false
      begin(video)
    },
    pause() {
      if (stage !== 'starting' && stage !== 'playing') return
      const reel = video
      cancel()
      held = true
      set('offer', reel)
    },
    suspend() {
      if (destroyed) return
      suspended = true
      cancel()
      set('photo', null)
    },
    state: snapshot,
    destroy() {
      destroyed = true
      cancel()
    },
  }
}

/* The players' own reports. The dial fades a reel in only on a report that
   frames are moving, so a player still showing its spinner or a black frame
   is never what the reader sees. */

export type DialIframeKind = 'youtube' | 'vimeo' | 'stream'
export type DialPlayerSignal = 'ready' | 'playing' | null

function messageData(data: unknown): Record<string, unknown> | null {
  let value = data
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return null
    }
  }
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

/** What a player's postMessage says: ready, playing, or nothing the dial needs. */
export function dialPlayerSignal(kind: DialIframeKind, data: unknown): DialPlayerSignal {
  const msg = messageData(data)
  if (!msg) return null
  if (kind === 'youtube') {
    const event = msg.event
    const info = msg.info
    if (event === 'onReady') return 'ready'
    if (event === 'onStateChange') return info === 1 ? 'playing' : null
    if ((event === 'infoDelivery' || event === 'initialDelivery') && info && typeof info === 'object') {
      return (info as Record<string, unknown>).playerState === 1 ? 'playing' : null
    }
    return null
  }
  if (kind === 'vimeo') {
    const event = msg.event
    if (event === 'ready') return 'ready'
    if (event === 'playing') return 'playing'
    if (event === 'timeupdate') {
      const seconds = (msg.data as Record<string, unknown> | undefined)?.seconds
      return typeof seconds === 'number' && seconds > 0 ? 'playing' : null
    }
    return null
  }
  const type = msg.__privateUnstableMessageType
  if (type === 'iframeReady') return 'ready'
  if (type === 'event') return msg.eventName === 'playing' || msg.eventName === 'timeupdate' ? 'playing' : null
  if (type === 'propertyChange' && msg.property === 'currentTime') {
    return typeof msg.value === 'number' && msg.value > 0 ? 'playing' : null
  }
  return null
}

/**
 * The reel's own frame size, when its player reports it (Cloudflare Stream
 * does, as property changes). A hosted player letterboxes a reel that is not
 * 16:9 inside its frame; knowing the reel's shape, the dial sizes the frame
 * to cover the photograph's box with the reel itself, never with bars.
 */
export function dialPlayerSize(kind: DialIframeKind, data: unknown): { width?: number; height?: number } | null {
  if (kind !== 'stream') return null
  const msg = messageData(data)
  if (!msg || msg.__privateUnstableMessageType !== 'propertyChange') return null
  const value = msg.value
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  if (msg.property === 'videoWidth') return { width: value }
  if (msg.property === 'videoHeight') return { height: value }
  return null
}

/** Width over height for a reel of `width` x `height`, or the players' 16:9 when either is unknown. */
export function dialReelAspect(width: number | null | undefined, height: number | null | undefined): number {
  if (!width || !height || !Number.isFinite(width / height)) return 16 / 9
  return width / height
}

/**
 * What the dial posts to a player so it will report playback. YouTube reports
 * only to a page that says it is listening (sent on load and repeated until
 * the player answers); Vimeo reports the events it is asked for once it says
 * it is ready; Stream reports unasked.
 */
export function dialPlayerHandshake(kind: DialIframeKind, on: 'load' | 'ready'): unknown[] {
  if (kind === 'youtube' && on === 'load') {
    return [
      JSON.stringify({ event: 'listening', id: 'rr-dial', channel: 'widget' }),
      JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onStateChange'], id: 'rr-dial', channel: 'widget' }),
    ]
  }
  if (kind === 'vimeo' && on === 'ready') {
    return [
      { method: 'addEventListener', value: 'playing' },
      { method: 'addEventListener', value: 'timeupdate' },
    ]
  }
  return []
}
