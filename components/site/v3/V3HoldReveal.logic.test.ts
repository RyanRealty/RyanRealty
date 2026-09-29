import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  V3_HOLD_GRACE_MS,
  V3_HOLD_MS,
  V3_HOLD_SLOP_PX,
  createHoldController,
  type V3HoldController,
} from './V3HoldReveal.logic'

type Item = { name: string }

const MONTH: Item = { name: 'Aug 2026' }
const OTHER: Item = { name: 'Jul 2026' }

function setup(): { hold: V3HoldController<Item>; held: Item[] } {
  const held: Item[] = []
  const hold = createHoldController<Item>({ onHold: (item) => held.push(item) })
  return { hold, held }
}

/** A finger down on an item, kept still until the hold fires. */
function pressAndHold(hold: V3HoldController<Item>, item: Item = MONTH) {
  hold.down('touch', 100, 100, item)
  vi.advanceTimersByTime(V3_HOLD_MS)
}

describe('createHoldController', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('a touch held still opens the item and swallows the one click its lift produces', () => {
    const { hold, held } = setup()
    pressAndHold(hold)
    expect(held).toEqual([MONTH])
    hold.end()
    expect(hold.click()).toBe(true)
    // Spent: the next click is a real one.
    expect(hold.click()).toBe(false)
  })

  it('a quick tap is not a hold and its click goes through', () => {
    const { hold, held } = setup()
    hold.down('touch', 100, 100, MONTH)
    vi.advanceTimersByTime(V3_HOLD_MS - 1)
    hold.end()
    vi.advanceTimersByTime(V3_HOLD_MS)
    expect(held).toEqual([])
    expect(hold.click()).toBe(false)
  })

  it('an iOS long press (lift, no click) stands the swallow down after the grace, so a later click opens its month', () => {
    const { hold } = setup()
    pressAndHold(hold)
    hold.end()
    // A click that lands inside the grace is still the hold's own, late.
    vi.advanceTimersByTime(V3_HOLD_GRACE_MS - 1)
    expect(hold.armed()).toBe(true)
    vi.advanceTimersByTime(1)
    expect(hold.armed()).toBe(false)
    // A keyboard Enter on any month much later is a click with no press before it.
    vi.advanceTimersByTime(5_000)
    expect(hold.click()).toBe(false)
  })

  it('a hold that turns into a scroll (pointercancel) never leaves a swallow behind', () => {
    const { hold } = setup()
    pressAndHold(hold)
    hold.move(100, 100 + V3_HOLD_SLOP_PX + 20)
    hold.end() // the browser cancels the pointer to scroll
    vi.advanceTimersByTime(V3_HOLD_GRACE_MS)
    expect(hold.click()).toBe(false)
  })

  it('the next press of any kind stands a stale swallow down at once', () => {
    for (const pointerType of ['touch', 'mouse', 'pen']) {
      const { hold } = setup()
      pressAndHold(hold)
      hold.end()
      // Inside the grace, a fresh press starts a new gesture.
      hold.down(pointerType, 300, 300, pointerType === 'touch' ? OTHER : null)
      hold.end()
      expect(hold.click(), pointerType).toBe(false)
    }
  })

  it('a press still pending when the swallow is stood down can itself become a hold', () => {
    const { hold, held } = setup()
    pressAndHold(hold)
    hold.end()
    hold.down('touch', 300, 300, OTHER)
    vi.advanceTimersByTime(V3_HOLD_MS)
    expect(held).toEqual([MONTH, OTHER])
    hold.end()
    expect(hold.click()).toBe(true)
  })

  it('a finger that travels past the slop before the hold is a scroll', () => {
    const { hold, held } = setup()
    hold.down('touch', 100, 100, MONTH)
    hold.move(100 + V3_HOLD_SLOP_PX + 1, 100)
    vi.advanceTimersByTime(V3_HOLD_MS * 2)
    expect(held).toEqual([])
    hold.end()
    expect(hold.click()).toBe(false)
  })

  it('a finger that stays inside the slop still holds', () => {
    const { hold, held } = setup()
    hold.down('touch', 100, 100, MONTH)
    hold.move(100 + V3_HOLD_SLOP_PX, 100 - V3_HOLD_SLOP_PX)
    vi.advanceTimersByTime(V3_HOLD_MS)
    expect(held).toEqual([MONTH])
  })

  it('a mouse or a pen never holds: they already have hover', () => {
    for (const pointerType of ['mouse', 'pen']) {
      const { hold, held } = setup()
      hold.down(pointerType, 100, 100, MONTH)
      vi.advanceTimersByTime(V3_HOLD_MS * 3)
      hold.end()
      expect(held, pointerType).toEqual([])
      expect(hold.click(), pointerType).toBe(false)
    }
  })

  it('a press off every item (or off its handle) never holds', () => {
    const { hold, held } = setup()
    hold.down('touch', 100, 100, null)
    vi.advanceTimersByTime(V3_HOLD_MS * 3)
    hold.end()
    expect(held).toEqual([])
    expect(hold.click()).toBe(false)
  })

  it('holds back the long-press menu only while a hold is pending or has just fired', () => {
    const { hold } = setup()
    expect(hold.contextMenu()).toBe(false)
    hold.down('touch', 100, 100, MONTH)
    expect(hold.contextMenu()).toBe(true)
    vi.advanceTimersByTime(V3_HOLD_MS)
    expect(hold.contextMenu()).toBe(true)
    hold.end()
    vi.advanceTimersByTime(V3_HOLD_GRACE_MS)
    expect(hold.contextMenu()).toBe(false)
  })

  it('a press off a handle leaves the platform menu alone', () => {
    const { hold } = setup()
    hold.down('touch', 100, 100, null)
    vi.advanceTimersByTime(V3_HOLD_MS * 2)
    expect(hold.contextMenu()).toBe(false)
  })

  it('dispose stops a pending hold and forgets an armed swallow', () => {
    const { hold, held } = setup()
    hold.down('touch', 100, 100, MONTH)
    hold.dispose()
    vi.advanceTimersByTime(V3_HOLD_MS * 2)
    expect(held).toEqual([])
    pressAndHold(hold)
    hold.dispose()
    expect(hold.click()).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })
})
