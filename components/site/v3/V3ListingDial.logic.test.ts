import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DIAL_JAX_GAP_PX,
  DIAL_NO_ASK,
  DIAL_RAIL_DEFAULT,
  DIAL_SWIPE_MIN_PX,
  DIAL_THUMB_WHOLE,
  DIAL_VIDEO_DWELL_MS,
  DIAL_VIDEO_LOAD_TIMEOUT_MS,
  DIAL_VIDEO_START_TIMEOUT_MS,
  createDialVideoController,
  createDialVideoCoordinator,
  dialEndClearance,
  dialPlayerHandshake,
  dialPlayerSignal,
  dialPlayerSize,
  dialReelAspect,
  dialRailHorizontal,
  dialRailPosition,
  dialRailPositionAt,
  dialVideoAutoplay,
  dialVideoLookupWanted,
  type DialVideoCoordinator,
  type DialVideoState,
  dialKeyTarget,
  dialPanelId,
  dialPosition,
  dialPriceSlot,
  dialRevealOffset,
  dialStep,
  dialSwipeDelta,
  dialTabId,
  dialThumbCut,
  dialThumbLabel,
  dialWrap,
} from './V3ListingDial.logic'

describe('dialWrap / dialStep: the dial has no end stop', () => {
  it('folds any index into 0..count-1', () => {
    expect(dialWrap(0, 5)).toBe(0)
    expect(dialWrap(4, 5)).toBe(4)
    expect(dialWrap(5, 5)).toBe(0)
    expect(dialWrap(-1, 5)).toBe(4)
    expect(dialWrap(-6, 5)).toBe(4)
    expect(dialWrap(12, 5)).toBe(2)
  })

  it('has no position without at least one listing', () => {
    expect(dialWrap(3, 0)).toBe(0)
    expect(dialWrap(3, -2)).toBe(0)
    expect(dialWrap(Number.NaN, 4)).toBe(0)
  })

  it('next on the last turns to the first, previous on the first to the last', () => {
    expect(dialStep(11, 1, 12)).toBe(0)
    expect(dialStep(0, -1, 12)).toBe(11)
    expect(dialStep(3, 1, 12)).toBe(4)
  })

  it('a one-listing dial never moves', () => {
    expect(dialStep(0, 1, 1)).toBe(0)
    expect(dialStep(0, -1, 1)).toBe(0)
  })
})

describe('dialKeyTarget', () => {
  it('reads both axes, so the vertical rail and the phone strip answer the same keys', () => {
    expect(dialKeyTarget('ArrowDown', 2, 6)).toBe(3)
    expect(dialKeyTarget('ArrowRight', 2, 6)).toBe(3)
    expect(dialKeyTarget('ArrowUp', 2, 6)).toBe(1)
    expect(dialKeyTarget('ArrowLeft', 2, 6)).toBe(1)
  })

  it('wraps at both ends, as the WAI-ARIA tabs pattern does', () => {
    expect(dialKeyTarget('ArrowDown', 5, 6)).toBe(0)
    expect(dialKeyTarget('ArrowLeft', 0, 6)).toBe(5)
  })

  it('Home and End are absolute', () => {
    expect(dialKeyTarget('Home', 4, 6)).toBe(0)
    expect(dialKeyTarget('End', 1, 6)).toBe(5)
  })

  it('ignores keys that are not the dial’s, and a dial with nothing to turn to', () => {
    expect(dialKeyTarget('Enter', 1, 6)).toBeNull()
    expect(dialKeyTarget('Tab', 1, 6)).toBeNull()
    expect(dialKeyTarget('ArrowDown', 0, 1)).toBeNull()
  })
})

describe('dialPosition: the "03 / 12" readout', () => {
  it('is 1-based and zero-padded like the rails’ readout', () => {
    const pos = dialPosition(2, 12)!
    expect(pos.text).toBe('03 / 12')
    expect(pos.now).toBe('03')
    expect(pos.total).toBe('12')
    expect(pos.shown).toBe(3)
    expect(pos.fraction).toBeCloseTo(3 / 12)
  })

  it('fills the rule completely on the last listing', () => {
    expect(dialPosition(11, 12)!.fraction).toBe(1)
    expect(dialPosition(11, 12)!.text).toBe('12 / 12')
  })

  it('does not pad past two digits', () => {
    expect(dialPosition(99, 120)!.text).toBe('100 / 120')
    expect(dialPosition(0, 120)!.text).toBe('01 / 120')
  })

  it('prints nothing for one listing or none: there is nothing to count through', () => {
    expect(dialPosition(0, 1)).toBeNull()
    expect(dialPosition(0, 0)).toBeNull()
  })

  it('wraps an out-of-range index rather than printing 13 / 12', () => {
    expect(dialPosition(12, 12)!.text).toBe('01 / 12')
  })
})

describe('dialSwipeDelta', () => {
  it('a swipe left is the next home, a swipe right the previous', () => {
    expect(dialSwipeDelta(-120, 8)).toBe(1)
    expect(dialSwipeDelta(120, -8)).toBe(-1)
  })

  it('a tap or a short drag does not turn the dial', () => {
    expect(dialSwipeDelta(0, 0)).toBe(0)
    expect(dialSwipeDelta(-(DIAL_SWIPE_MIN_PX - 1), 0)).toBe(0)
  })

  it('a mostly vertical drag is the page scrolling, not a turn', () => {
    expect(dialSwipeDelta(-60, 70)).toBe(0)
    expect(dialSwipeDelta(-60, 30)).toBe(1)
  })

  it('refuses non-finite input', () => {
    expect(dialSwipeDelta(Number.NaN, 0)).toBe(0)
  })
})

describe('dialThumbLabel: the thumbnail’s accessible name', () => {
  it('is the ask then the street, the order the caption prints them', () => {
    expect(dialThumbLabel('1234 NW Portland Ave', '$649,000')).toBe('$649,000, 1234 NW Portland Ave')
  })

  it('never invents an ask', () => {
    expect(dialThumbLabel('14 Porter Lane', null)).toBe(`${DIAL_NO_ASK}, 14 Porter Lane`)
    expect(DIAL_NO_ASK).toBe('Price not published')
    expect(dialThumbLabel('14 Porter Lane', null)).not.toMatch(/on request/i)
  })
})

describe('ids', () => {
  it('tie each tab to the card it controls', () => {
    expect(dialTabId('homes-sfr', 2)).toBe('homes-sfr-tab-2')
    expect(dialPanelId('homes-sfr', 2)).toBe('homes-sfr-card-2')
  })
})

describe('dialRevealOffset', () => {
  it('leaves the rail where it is when the thumbnail is already whole', () => {
    expect(dialRevealOffset(100, 400, 150, 120)).toBe(100)
  })

  it('centres a thumbnail it has to bring into view', () => {
    expect(dialRevealOffset(0, 400, 900, 120)).toBe(760)
    expect(dialRevealOffset(800, 400, 0, 120)).toBe(0)
  })
})

describe('dialThumbCut: a caption the rail edge would cut is hidden', () => {
  it('counts a thumbnail whole only when (all but a rounding sliver of) it is inside the rail', () => {
    expect(dialThumbCut(1)).toBe(false)
    expect(dialThumbCut(DIAL_THUMB_WHOLE)).toBe(false)
    expect(dialThumbCut(0.995)).toBe(false)
  })

  it('cuts a thumbnail the edge runs through, and one scrolled out of view', () => {
    // 375px strip, 2026-09-23: the third thumbnail showed 51 of its 92px and
    // its caption read "$1.00/".
    expect(dialThumbCut(51 / 92)).toBe(true)
    expect(dialThumbCut(0.98)).toBe(true)
    expect(dialThumbCut(0)).toBe(true)
  })

  it('never hides a caption on a reading it cannot trust', () => {
    expect(dialThumbCut(Number.NaN)).toBe(false)
  })
})

describe('dialPriceSlot: what the price slot prints', () => {
  it('prints the ask for a sale listing, and the withheld line without one', () => {
    expect(dialPriceSlot({ ask: '$649,000', lease: null })).toEqual({ text: '$649,000', withheld: false })
    expect(dialPriceSlot({ ask: null, lease: null })).toEqual({ text: DIAL_NO_ASK, withheld: true })
  })

  it('prints a lease rate with its unit, never the sale withheld line', () => {
    expect(
      dialPriceSlot({ ask: null, lease: { rate: '$1.40/sq ft/mo', text: '$1.40/sq ft/mo' } }),
    ).toEqual({ text: '$1.40/sq ft/mo', withheld: false })
    expect(
      dialPriceSlot({ ask: null, lease: { rate: null, text: 'Lease rate not published' } }),
    ).toEqual({ text: 'Lease rate not published', withheld: true })
  })
})

describe('dialRailPositionAt: no two stacked dials turn the same way (Matt 2026-09-24)', () => {
  it('cycles bottom, left, right down the page', () => {
    expect([0, 1, 2, 3, 4, 5].map(dialRailPositionAt)).toEqual(['bottom', 'left', 'right', 'bottom', 'left', 'right'])
  })

  it('never gives two adjacent dials the same position', () => {
    for (let i = 0; i < 30; i += 1) expect(dialRailPositionAt(i)).not.toBe(dialRailPositionAt(i + 1))
  })

  it('reads a bad index as the first dial', () => {
    expect(dialRailPositionAt(-1)).toBe('bottom')
    expect(dialRailPositionAt(Number.NaN)).toBe('bottom')
    expect(dialRailPositionAt(1.7)).toBe('left')
  })

  it('defaults to the rail under the card, and folds an unknown value to it', () => {
    expect(DIAL_RAIL_DEFAULT).toBe('bottom')
    expect(dialRailPosition(undefined)).toBe('bottom')
    expect(dialRailPosition('top')).toBe('bottom')
    expect(dialRailPosition('right')).toBe('right')
  })

  it('runs horizontally under the card, and on every phone', () => {
    expect(dialRailHorizontal('bottom', false)).toBe(true)
    expect(dialRailHorizontal('left', false)).toBe(false)
    expect(dialRailHorizontal('right', false)).toBe(false)
    expect(dialRailHorizontal('right', true)).toBe(true)
  })
})

describe('dialEndClearance: a right-hand rail never sits under the Jax button', () => {
  // V3DogFloater: fixed, right 1rem (16px), 4.25rem (68px) wide. At 1440 its left edge is 1356.
  const jaxLeft = 1440 - 16 - 68

  it('clears a dial that runs to the viewport edge by the button plus the gap', () => {
    expect(dialEndClearance(1440, jaxLeft)).toBe(84 + DIAL_JAX_GAP_PX)
    expect(dialEndClearance(1420, jaxLeft)).toBe(64 + DIAL_JAX_GAP_PX)
  })

  it('asks nothing of a dial that already ends left of the button (a 72rem dial centred at 1440 ends at 1296)', () => {
    expect(dialEndClearance(1296, jaxLeft)).toBe(0)
  })

  it('asks nothing on a page without the button', () => {
    expect(dialEndClearance(1440, null)).toBe(0)
    expect(dialEndClearance(Number.NaN, jaxLeft)).toBe(0)
  })
})

describe('dialVideoAutoplay: reduced motion, Save-Data and 2G never autoplay', () => {
  it('plays on its own for a reader who has asked for nothing else', () => {
    expect(dialVideoAutoplay({ reducedMotion: false })).toBe(true)
    expect(dialVideoAutoplay({ reducedMotion: false, saveData: false, effectiveType: '4g' })).toBe(true)
    expect(dialVideoAutoplay({ reducedMotion: false, effectiveType: '3g' })).toBe(true)
  })

  it('offers instead of playing under reduced motion, Save-Data, or a 2G connection', () => {
    expect(dialVideoAutoplay({ reducedMotion: true })).toBe(false)
    expect(dialVideoAutoplay({ reducedMotion: false, saveData: true })).toBe(false)
    expect(dialVideoAutoplay({ reducedMotion: false, effectiveType: '2g' })).toBe(false)
    expect(dialVideoAutoplay({ reducedMotion: false, effectiveType: 'slow-2g' })).toBe(false)
  })

  it('asks about a card unless the caller knows it has no reel', () => {
    expect(dialVideoLookupWanted(undefined)).toBe(true)
    expect(dialVideoLookupWanted(null)).toBe(true)
    expect(dialVideoLookupWanted(true)).toBe(true)
    expect(dialVideoLookupWanted(false)).toBe(false)
  })
})

type Reel = { url: string }

function harness(opts: { autoplay?: boolean; reels?: Record<string, Reel | null>; coordinator?: DialVideoCoordinator } = {}) {
  const reels = opts.reels ?? { a: { url: 'a.mp4' }, b: { url: 'b.mp4' }, none: null }
  const lookups: string[] = []
  const aborted: string[] = []
  const states: DialVideoState<Reel>[] = []
  const deferred = new Map<string, { resolve: (v: Reel | null) => void; reject: (e: unknown) => void }>()
  const controller = createDialVideoController<Reel>({
    autoplay: opts.autoplay ?? true,
    coordinator: opts.coordinator ?? createDialVideoCoordinator(),
    onChange: (s) => states.push(s),
    lookup: (key, signal) => {
      lookups.push(key)
      signal.addEventListener('abort', () => aborted.push(key))
      return new Promise<Reel | null>((resolve, reject) => deferred.set(key, { resolve, reject }))
    },
  })
  const answer = async (key: string) => {
    deferred.get(key)?.resolve(reels[key] ?? null)
    await Promise.resolve()
    await Promise.resolve()
  }
  const fail = async (key: string) => {
    deferred.get(key)?.reject(new Error('network'))
    await Promise.resolve()
    await Promise.resolve()
  }
  return { controller, lookups, aborted, states, answer, fail, stage: () => controller.state().stage }
}

describe('the card reel: photo first, then the reel after a dwell', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('shows the photograph, waits the dwell, then looks up and mounts the reel', async () => {
    const h = harness()
    h.controller.setEligible(true)
    h.controller.select('a')
    expect(h.stage()).toBe('dwell')
    vi.advanceTimersByTime(DIAL_VIDEO_DWELL_MS - 1)
    expect(h.lookups).toEqual([])
    vi.advanceTimersByTime(1)
    expect(h.lookups).toEqual(['a'])
    expect(h.stage()).toBe('lookup')
    await h.answer('a')
    expect(h.stage()).toBe('starting')
    expect(h.controller.state().video).toEqual({ url: 'a.mp4' })
    h.controller.started()
    expect(h.stage()).toBe('playing')
    expect(DIAL_VIDEO_DWELL_MS).toBe(1500)
  })

  it('a turn before the dwell ends cancels the wait: no lookup for the card left behind', () => {
    const h = harness()
    h.controller.setEligible(true)
    h.controller.select('a')
    vi.advanceTimersByTime(1000)
    h.controller.select('b')
    vi.advanceTimersByTime(1000)
    expect(h.lookups).toEqual([])
    vi.advanceTimersByTime(500)
    expect(h.lookups).toEqual(['b'])
  })

  it('a turn during the lookup aborts the request and never mounts the old reel', async () => {
    const h = harness()
    h.controller.setEligible(true)
    h.controller.select('a')
    vi.advanceTimersByTime(DIAL_VIDEO_DWELL_MS)
    h.controller.select('b')
    expect(h.aborted).toEqual(['a'])
    await h.answer('a')
    expect(h.stage()).toBe('dwell')
    expect(h.controller.state().key).toBe('b')
  })

  it('a turn while playing unmounts the reel at once', async () => {
    const h = harness()
    h.controller.setEligible(true)
    h.controller.select('a')
    vi.advanceTimersByTime(DIAL_VIDEO_DWELL_MS)
    await h.answer('a')
    h.controller.started()
    h.controller.select('b')
    expect(h.stage()).toBe('dwell')
    expect(h.controller.state().video).toBeNull()
  })

  it('a card without a reel stays on its photograph, and is not asked about twice', async () => {
    const h = harness()
    h.controller.setEligible(true)
    h.controller.select('none')
    vi.advanceTimersByTime(DIAL_VIDEO_DWELL_MS)
    await h.answer('none')
    expect(h.stage()).toBe('photo')
    h.controller.select('a')
    h.controller.select('none')
    vi.advanceTimersByTime(DIAL_VIDEO_DWELL_MS * 2)
    expect(h.lookups).toEqual(['none'])
  })

  it('never asks about a card the caller says has no reel', () => {
    const h = harness()
    h.controller.setEligible(true)
    h.controller.select('a', false)
    vi.advanceTimersByTime(DIAL_VIDEO_DWELL_MS * 2)
    expect(h.lookups).toEqual([])
    expect(h.stage()).toBe('photo')
  })

  it('does nothing while the dial is off screen or the tab is hidden, and starts the dwell over when it returns', async () => {
    const h = harness()
    h.controller.select('a')
    vi.advanceTimersByTime(DIAL_VIDEO_DWELL_MS * 2)
    expect(h.lookups).toEqual([])
    h.controller.setEligible(true)
    vi.advanceTimersByTime(DIAL_VIDEO_DWELL_MS)
    await h.answer('a')
    h.controller.started()
    h.controller.setEligible(false)
    expect(h.stage()).toBe('photo')
    h.controller.setEligible(true)
    expect(h.stage()).toBe('dwell')
    vi.advanceTimersByTime(DIAL_VIDEO_DWELL_MS)
    expect(h.stage()).toBe('starting')
    expect(h.lookups).toEqual(['a'])
  })
})

describe('the card reel: failure keeps the photograph, silently', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('a reel that has not started within the start timeout of its player being ready is dropped, and not retried', async () => {
    const h = harness()
    h.controller.setEligible(true)
    h.controller.select('a')
    vi.advanceTimersByTime(DIAL_VIDEO_DWELL_MS)
    await h.answer('a')
    expect(h.stage()).toBe('starting')
    vi.advanceTimersByTime(1000)
    h.controller.ready()
    vi.advanceTimersByTime(DIAL_VIDEO_START_TIMEOUT_MS - 1)
    expect(h.stage()).toBe('starting')
    vi.advanceTimersByTime(1)
    expect(h.stage()).toBe('photo')
    h.controller.select('b')
    h.controller.select('a')
    vi.advanceTimersByTime(DIAL_VIDEO_DWELL_MS * 2)
    expect(h.stage()).toBe('photo')
    expect(DIAL_VIDEO_START_TIMEOUT_MS).toBe(4000)
  })

  it('a player that never gets ready is dropped at the load timeout; a slow one that does still gets its start window', async () => {
    const h = harness()
    h.controller.setEligible(true)
    h.controller.select('a')
    vi.advanceTimersByTime(DIAL_VIDEO_DWELL_MS)
    await h.answer('a')
    vi.advanceTimersByTime(DIAL_VIDEO_LOAD_TIMEOUT_MS - 1)
    expect(h.stage()).toBe('starting')
    vi.advanceTimersByTime(1)
    expect(h.stage()).toBe('photo')

    const slow = harness()
    slow.controller.setEligible(true)
    slow.controller.select('b')
    vi.advanceTimersByTime(DIAL_VIDEO_DWELL_MS)
    await slow.answer('b')
    vi.advanceTimersByTime(DIAL_VIDEO_LOAD_TIMEOUT_MS - 500)
    slow.controller.ready()
    vi.advanceTimersByTime(DIAL_VIDEO_START_TIMEOUT_MS - 500)
    slow.controller.started()
    expect(slow.stage()).toBe('playing')
  })

  it('a reel that errors goes back to the photograph', async () => {
    const h = harness()
    h.controller.setEligible(true)
    h.controller.select('a')
    vi.advanceTimersByTime(DIAL_VIDEO_DWELL_MS)
    await h.answer('a')
    h.controller.started()
    h.controller.failed()
    expect(h.stage()).toBe('photo')
  })

  it('a failed lookup is the photograph, not an error, and not a verdict: the card is asked again next time', async () => {
    const h = harness()
    h.controller.setEligible(true)
    h.controller.select('a')
    vi.advanceTimersByTime(DIAL_VIDEO_DWELL_MS)
    await h.fail('a')
    expect(h.stage()).toBe('photo')
    h.controller.select('b')
    h.controller.select('a')
    vi.advanceTimersByTime(DIAL_VIDEO_DWELL_MS)
    expect(h.lookups).toEqual(['a', 'a'])
    await h.answer('a')
    expect(h.stage()).toBe('starting')
  })

  it('a browser that refuses autoplay gets "Play video", not a lost reel', async () => {
    const h = harness()
    h.controller.setEligible(true)
    h.controller.select('a')
    vi.advanceTimersByTime(DIAL_VIDEO_DWELL_MS)
    await h.answer('a')
    h.controller.blocked()
    expect(h.stage()).toBe('offer')
    expect(h.controller.state().video).toEqual({ url: 'a.mp4' })
    vi.advanceTimersByTime(DIAL_VIDEO_START_TIMEOUT_MS * 2)
    expect(h.stage()).toBe('offer')
    h.controller.play()
    expect(h.stage()).toBe('starting')
  })
})

describe('the card reel: reduced motion, Save-Data and the reader’s own controls', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('under reduced motion (or Save-Data) the card offers "Play video" and never starts on its own', async () => {
    const h = harness({ autoplay: false })
    h.controller.setEligible(true)
    h.controller.select('a')
    vi.advanceTimersByTime(DIAL_VIDEO_DWELL_MS)
    await h.answer('a')
    expect(h.stage()).toBe('offer')
    vi.advanceTimersByTime(DIAL_VIDEO_START_TIMEOUT_MS * 3)
    expect(h.stage()).toBe('offer')
    h.controller.play()
    expect(h.stage()).toBe('starting')
    h.controller.started()
    expect(h.stage()).toBe('playing')
  })

  it('turning reduced motion on while a reel plays stops it and offers it instead', async () => {
    const h = harness()
    h.controller.setEligible(true)
    h.controller.select('a')
    vi.advanceTimersByTime(DIAL_VIDEO_DWELL_MS)
    await h.answer('a')
    h.controller.started()
    h.controller.setAutoplay(false)
    expect(h.stage()).toBe('offer')
  })

  it('Pause returns to the photograph with "Play video" offered, and nothing restarts on its own', async () => {
    const h = harness()
    h.controller.setEligible(true)
    h.controller.select('a')
    vi.advanceTimersByTime(DIAL_VIDEO_DWELL_MS)
    await h.answer('a')
    h.controller.started()
    h.controller.pause()
    expect(h.stage()).toBe('offer')
    h.controller.setEligible(false)
    h.controller.setEligible(true)
    vi.advanceTimersByTime(DIAL_VIDEO_DWELL_MS * 2)
    expect(h.stage()).toBe('offer')
  })

  it('opening the card’s 3D tour takes the media: no reel until the next turn', async () => {
    const h = harness()
    h.controller.setEligible(true)
    h.controller.select('a')
    vi.advanceTimersByTime(DIAL_VIDEO_DWELL_MS)
    await h.answer('a')
    h.controller.started()
    h.controller.suspend()
    expect(h.stage()).toBe('photo')
    h.controller.setEligible(false)
    h.controller.setEligible(true)
    vi.advanceTimersByTime(DIAL_VIDEO_DWELL_MS * 2)
    expect(h.stage()).toBe('photo')
  })
})

describe('one reel on the whole page', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('a second dial starting its reel stops the first, which offers "Play video" instead of restarting', async () => {
    const coordinator = createDialVideoCoordinator()
    const one = harness({ coordinator })
    const two = harness({ coordinator })
    one.controller.setEligible(true)
    two.controller.setEligible(true)
    one.controller.select('a')
    vi.advanceTimersByTime(DIAL_VIDEO_DWELL_MS)
    await one.answer('a')
    one.controller.started()
    expect(one.stage()).toBe('playing')
    two.controller.select('b')
    vi.advanceTimersByTime(DIAL_VIDEO_DWELL_MS)
    await two.answer('b')
    expect(two.stage()).toBe('starting')
    expect(one.stage()).toBe('offer')
    two.controller.started()
    vi.advanceTimersByTime(DIAL_VIDEO_START_TIMEOUT_MS * 2)
    expect(one.stage()).toBe('offer')
    one.controller.play()
    expect(one.stage()).toBe('starting')
    expect(two.stage()).toBe('offer')
  })

  it('a card that stops releases the page, so the next claim yields nobody', () => {
    const coordinator = createDialVideoCoordinator()
    const owner = {}
    const yielded = vi.fn()
    coordinator.claim(owner, yielded)
    coordinator.release(owner)
    expect(coordinator.owner()).toBeNull()
    coordinator.claim({}, () => {})
    expect(yielded).not.toHaveBeenCalled()
  })
})

describe('dialPlayerSignal: fade in only when a player says frames are moving', () => {
  it('reads the YouTube widget protocol', () => {
    expect(dialPlayerSignal('youtube', JSON.stringify({ event: 'onReady' }))).toBe('ready')
    expect(dialPlayerSignal('youtube', JSON.stringify({ event: 'onStateChange', info: 1 }))).toBe('playing')
    expect(dialPlayerSignal('youtube', JSON.stringify({ event: 'onStateChange', info: 3 }))).toBeNull()
    expect(dialPlayerSignal('youtube', JSON.stringify({ event: 'infoDelivery', info: { playerState: 1 } }))).toBe('playing')
    expect(dialPlayerSignal('youtube', JSON.stringify({ event: 'infoDelivery', info: { playerState: -1 } }))).toBeNull()
  })

  it('reads Vimeo player events', () => {
    expect(dialPlayerSignal('vimeo', { event: 'ready' })).toBe('ready')
    expect(dialPlayerSignal('vimeo', JSON.stringify({ event: 'playing' }))).toBe('playing')
    expect(dialPlayerSignal('vimeo', { event: 'timeupdate', data: { seconds: 0.4 } })).toBe('playing')
    expect(dialPlayerSignal('vimeo', { event: 'timeupdate', data: { seconds: 0 } })).toBeNull()
  })

  it('reads Cloudflare Stream player events', () => {
    expect(dialPlayerSignal('stream', { __privateUnstableMessageType: 'iframeReady' })).toBe('ready')
    expect(dialPlayerSignal('stream', { __privateUnstableMessageType: 'event', eventName: 'playing' })).toBe('playing')
    expect(dialPlayerSignal('stream', { __privateUnstableMessageType: 'event', eventName: 'loadstart' })).toBeNull()
  })

  it('ignores anything else on the page’s message channel', () => {
    expect(dialPlayerSignal('youtube', 'not json')).toBeNull()
    expect(dialPlayerSignal('vimeo', null)).toBeNull()
    expect(dialPlayerSignal('stream', { type: 'webpackOk' })).toBeNull()
  })

  it('reads the reel’s own size from Stream, so the frame covers the photograph with the reel and not with bars', () => {
    expect(dialPlayerSize('stream', { __privateUnstableMessageType: 'propertyChange', property: 'videoWidth', value: 1440 })).toEqual({ width: 1440 })
    expect(dialPlayerSize('stream', { __privateUnstableMessageType: 'propertyChange', property: 'videoHeight', value: 1080 })).toEqual({ height: 1080 })
    expect(dialPlayerSize('stream', { __privateUnstableMessageType: 'propertyChange', property: 'currentTime', value: 3 })).toBeNull()
    expect(dialPlayerSize('stream', { __privateUnstableMessageType: 'propertyChange', property: 'videoWidth', value: 0 })).toBeNull()
    expect(dialPlayerSize('youtube', { event: 'onReady' })).toBeNull()
    expect(dialReelAspect(1440, 1080)).toBeCloseTo(4 / 3)
    expect(dialReelAspect(null, 1080)).toBeCloseTo(16 / 9)
    expect(dialReelAspect(0, 0)).toBeCloseTo(16 / 9)
  })

  it('tells YouTube it is listening on load and asks Vimeo for playback events once ready', () => {
    expect(dialPlayerHandshake('youtube', 'load').map((m) => JSON.parse(String(m)).event)).toEqual(['listening', 'command'])
    expect(dialPlayerHandshake('vimeo', 'ready')).toEqual([
      { method: 'addEventListener', value: 'playing' },
      { method: 'addEventListener', value: 'timeupdate' },
    ])
    expect(dialPlayerHandshake('stream', 'load')).toEqual([])
  })
})
