/**
 * @vitest-environment jsdom
 *
 * SITE-210 — where Jax looks, driven through the real component with real
 * window events. Matt 2026-09-25, on a phone: "I want the dog to always go
 * back to the normal position on phone and not stay looking somewhere when
 * no one is scrolling." A mouse keeps his look while it is on the page; a
 * finger does not.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { TOUCH_LOOK_HOLD_MS, V3DogFloater } from './V3DogFloater.client'

vi.mock('next/navigation', () => ({ usePathname: () => '/' }))
vi.mock('@/lib/tracking', () => ({ trackEvent: vi.fn() }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...props }, children),
}))
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const REST = 'rotate(0deg)'
/** A 390-wide phone: the floater sits on the trailing edge, halfway down. */
const DOG = { left: 306, top: 388, size: 68 }

type Media = { finePointer: boolean; reducedMotion: boolean }

let media: Media = { finePointer: false, reducedMotion: false }
const mediaListeners = new Set<() => void>()

function stubMedia(next: Media) {
  media = next
  mediaListeners.clear()
  window.matchMedia = ((query: string) => ({
    get matches() {
      return (
        (query === '(hover: hover) and (pointer: fine)' && media.finePointer) ||
        (query === '(prefers-reduced-motion: reduce)' && media.reducedMotion)
      )
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, fn: () => void) => mediaListeners.add(fn),
    removeEventListener: (_type: string, fn: () => void) => mediaListeners.delete(fn),
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

/** A mouse or trackpad arrives (or leaves) after the page loaded. */
function setFinePointer(finePointer: boolean) {
  media = { ...media, finePointer }
  act(() => mediaListeners.forEach((fn) => fn()))
}

let container: HTMLDivElement
let root: Root | null = null

function mount(media: Media) {
  stubMedia(media)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root!.render(React.createElement(V3DogFloater)))
  const head = container.querySelector<HTMLElement>('.v3-dog-floater__head')!
  head.getBoundingClientRect = () =>
    ({
      left: DOG.left,
      top: DOG.top,
      width: DOG.size,
      height: DOG.size,
      right: DOG.left + DOG.size,
      bottom: DOG.top + DOG.size,
      x: DOG.left,
      y: DOG.top,
      toJSON() {},
    }) as DOMRect
  Object.defineProperty(head, 'offsetWidth', { configurable: true, value: DOG.size })
}

function look() {
  return container.querySelector<HTMLElement>('.v3-dog-floater__aim')!.style.transform
}

/** One animation frame: the floater reads the pointer at most once per frame. */
function frame() {
  act(() => vi.advanceTimersByTime(16))
}

function wait(ms: number) {
  act(() => vi.advanceTimersByTime(ms))
}

type TouchType = 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel'
/** [x, y] or [x, y, identifier]; a finger without one is identified by its place in the list. */
type Finger = [number, number] | [number, number, number]

function touch(type: TouchType, fingers: Finger[], target: EventTarget = window) {
  const event = new Event(type, { bubbles: true })
  Object.defineProperty(event, 'touches', {
    value: fingers.map(([x, y, id], i) => ({ clientX: x, clientY: y, identifier: id ?? i })),
  })
  act(() => {
    target.dispatchEvent(event)
  })
}

function pointer(type: string, x: number, y: number, pointerType: 'mouse' | 'touch' | 'pen') {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y })
  Object.defineProperty(event, 'pointerType', { value: pointerType })
  act(() => {
    window.dispatchEvent(event)
  })
}

function mouseLeavesWindow() {
  act(() => {
    document.body.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: null }))
  })
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'],
  })
})

afterEach(() => {
  if (root) {
    const current = root
    root = null
    act(() => current.unmount())
    container.remove()
  }
  vi.useRealTimers()
})

describe('V3DogFloater gaze on a phone (SITE-210)', () => {
  it('never stays looking where a scroll began (the stuck head in the 2026-09-25 screenshot)', () => {
    mount({ finePointer: false, reducedMotion: false })
    // The browser sends a finger's pointermove until it takes the gesture as a
    // scroll (pointercancel), then nothing. That last reading used to hold.
    pointer('pointermove', 100, 730, 'touch')
    frame()
    wait(10_000)
    expect(look()).toBe(REST)
  })

  it('watches a dragging finger, then looks back the moment it lifts', () => {
    mount({ finePointer: false, reducedMotion: false })
    touch('touchstart', [[100, 700]])
    touch('touchmove', [[100, 730]])
    frame()
    // Down and to the left of him: (100, 730) against his center (340, 422).
    expect(look()).toBe('rotate(-52.1deg)')
    touch('touchend', [])
    expect(look()).toBe(REST)
  })

  it('looks back after the hold when the finger rests on the glass without moving', () => {
    mount({ finePointer: false, reducedMotion: false })
    touch('touchstart', [[100, 700]])
    touch('touchmove', [[100, 730]])
    frame()
    wait(TOUCH_LOOK_HOLD_MS - 50)
    expect(look()).toBe('rotate(-52.1deg)')
    wait(50)
    expect(look()).toBe(REST)
  })

  it('a finger still moving keeps his look past the hold, and a cancelled touch releases it', () => {
    mount({ finePointer: false, reducedMotion: false })
    touch('touchstart', [[100, 700]])
    for (let y = 710; y <= 850; y += 20) {
      touch('touchmove', [[100, y]])
      frame()
      wait(TOUCH_LOOK_HOLD_MS / 2)
    }
    expect(look()).not.toBe(REST)
    touch('touchcancel', [])
    expect(look()).toBe(REST)
  })

  it('never turns for a tap, jitter and all', () => {
    mount({ finePointer: false, reducedMotion: false })
    touch('touchstart', [[100, 700]])
    // A browser sends the jitter twice: as a touch move and as a finger's
    // pointermove. Neither may turn him.
    pointer('pointermove', 103, 702, 'touch')
    touch('touchmove', [[103, 702]])
    frame()
    expect(look()).toBe(REST)
    touch('touchend', [])
    expect(look()).toBe(REST)
  })

  it('keeps watching while a second finger lifts and the first still drags', () => {
    mount({ finePointer: false, reducedMotion: false })
    touch('touchstart', [[100, 700, 0]])
    touch('touchmove', [[100, 730, 0]])
    frame()
    touch('touchstart', [[100, 730, 0], [250, 300, 1]])
    touch('touchend', [[100, 730, 0]])
    expect(look()).toBe('rotate(-52.1deg)')
  })

  it('looks back when the finger he watches lifts, and never jumps to the finger left behind', () => {
    mount({ finePointer: false, reducedMotion: false })
    touch('touchstart', [[100, 700, 0]])
    touch('touchmove', [[100, 730, 0]])
    frame()
    touch('touchstart', [[100, 730, 0], [250, 300, 1]])
    touch('touchend', [[250, 300, 1]])
    expect(look()).toBe(REST)
    touch('touchmove', [[260, 250, 1]])
    frame()
    expect(look()).toBe(REST)
  })

  it('after the hold, a resting finger has to really move again before he looks', () => {
    mount({ finePointer: false, reducedMotion: false })
    touch('touchstart', [[100, 700]])
    touch('touchmove', [[100, 730]])
    frame()
    wait(TOUCH_LOOK_HOLD_MS)
    expect(look()).toBe(REST)
    // A resting finger's jitter is not a scroll.
    touch('touchmove', [[101, 731]])
    frame()
    expect(look()).toBe(REST)
    touch('touchmove', [[100, 760]])
    frame()
    expect(look()).not.toBe(REST)
  })

  it('sees the finger even where a component stops the touch from bubbling', () => {
    mount({ finePointer: false, reducedMotion: false })
    const popup = document.createElement('div')
    document.body.appendChild(popup)
    for (const type of ['touchstart', 'touchmove', 'touchend'] as const) {
      popup.addEventListener(type, (event) => event.stopPropagation())
    }
    touch('touchstart', [[100, 700]], popup)
    touch('touchmove', [[100, 730]], popup)
    frame()
    expect(look()).toBe('rotate(-52.1deg)')
    touch('touchend', [], popup)
    expect(look()).toBe(REST)
    popup.remove()
  })

  it('never reads a pen from pointer events, so a pen tap never turns him', () => {
    mount({ finePointer: false, reducedMotion: false })
    pointer('pointermove', 100, 200, 'pen')
    frame()
    expect(look()).toBe(REST)
  })

  it('treats a mouse on a device without hover like a finger', () => {
    mount({ finePointer: false, reducedMotion: false })
    pointer('pointermove', 100, 200, 'mouse')
    frame()
    expect(look()).toBe('rotate(42.8deg)')
    wait(TOUCH_LOOK_HOLD_MS)
    expect(look()).toBe(REST)
  })
})

describe('V3DogFloater gaze with a mouse (Matt 2026-09-24: the head follows the ball)', () => {
  it('keeps looking at a still cursor, and looks back when the cursor leaves the window', () => {
    mount({ finePointer: true, reducedMotion: false })
    pointer('pointermove', 100, 200, 'mouse')
    frame()
    expect(look()).toBe('rotate(42.8deg)')
    wait(10_000)
    expect(look()).toBe('rotate(42.8deg)')
    mouseLeavesWindow()
    expect(look()).toBe(REST)
  })

  it('keeps the look once a mouse arrives on a device that loaded without one', () => {
    mount({ finePointer: false, reducedMotion: false })
    setFinePointer(true)
    pointer('pointermove', 100, 200, 'mouse')
    frame()
    wait(TOUCH_LOOK_HOLD_MS * 3)
    expect(look()).toBe('rotate(42.8deg)')
  })

  it('faces forward while the cursor is on the dog himself', () => {
    mount({ finePointer: true, reducedMotion: false })
    // 28px below his center, inside his 34px circle.
    pointer('pointermove', 340, 450, 'mouse')
    frame()
    expect(look()).toBe(REST)
  })

  it('never tracks at all under prefers-reduced-motion', () => {
    mount({ finePointer: true, reducedMotion: true })
    pointer('pointermove', 100, 200, 'mouse')
    touch('touchstart', [[100, 700]])
    touch('touchmove', [[100, 730]])
    frame()
    expect(look()).toBe(REST)
  })
})
