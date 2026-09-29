/**
 * THE HOLD, AS A STATE MACHINE (V3HoldReveal.client.tsx wires the DOM into it).
 *
 * A touch press that stays put for V3_HOLD_MS is a hold: it opens the pressed
 * item's reveal and arms a swallow for the one click the lift would produce, so
 * a hold never also follows the link. Everything else here exists to make sure
 * that swallow is spent on THAT click and on nothing later.
 *
 * The first build cleared the swallow only when a click arrived. Two ordinary
 * gestures never produce one: an iOS long press, and a hold that turns into a
 * scroll (the browser cancels the pointer). The armed swallow then ate the next
 * real click on any month, and a keyboard Enter too (code review, 2026-09-29).
 * So the swallow now stands down on the NEXT PRESS of any kind, and on its own
 * a short grace after the lift or the cancel, long enough for a late click to
 * land and no longer.
 *
 * Pure: no DOM, only the global timers, so it is tested with fake timers.
 */

/** Long enough to be a hold, short enough that the OS context menu (~500ms) has not fired. */
export const V3_HOLD_MS = 350

/**
 * How long after the lift (or the cancel) the swallow waits for the click the
 * hold would produce. A tap's click follows its lift at once; the legacy
 * double-tap delay is 300ms, so twice that clears it on a slow phone.
 */
export const V3_HOLD_GRACE_MS = 600

/** A finger that travels further than this is scrolling, not holding. */
export const V3_HOLD_SLOP_PX = 8

type TimerHandle = ReturnType<typeof setTimeout>

export type V3HoldControllerOptions<T> = {
  /** Called once when a press becomes a hold, with the item the press started on. */
  onHold: (item: T) => void
  holdMs?: number
  graceMs?: number
  slopPx?: number
}

export type V3HoldController<T> = {
  /**
   * A press, of any pointer. `item` is the holdable item under it, or null
   * when the press is not on one (or not on its handle). Any press stands the
   * previous gesture's swallow down; only a touch on an item can start a hold.
   */
  down: (pointerType: string, x: number, y: number, item: T | null) => void
  /** The pointer moved. Past the slop, a pending hold is a scroll and stops. */
  move: (x: number, y: number) => void
  /** The pointer lifted or was cancelled. */
  end: () => void
  /** A click arrived. True when it is the click a hold produced and must be swallowed. */
  click: () => boolean
  /** A context menu was asked for. True while a hold is pending or has just fired. */
  contextMenu: () => boolean
  /** True while a swallow is armed (for tests and diagnostics). */
  armed: () => boolean
  /** Unmount: stop every timer and forget the gesture. */
  dispose: () => void
}

export function createHoldController<T>({
  onHold,
  holdMs = V3_HOLD_MS,
  graceMs = V3_HOLD_GRACE_MS,
  slopPx = V3_HOLD_SLOP_PX,
}: V3HoldControllerOptions<T>): V3HoldController<T> {
  let pending: TimerHandle | null = null
  let grace: TimerHandle | null = null
  let swallow = false
  let startX = 0
  let startY = 0

  const stopPending = () => {
    if (pending != null) {
      clearTimeout(pending)
      pending = null
    }
  }
  const standDown = () => {
    if (grace != null) {
      clearTimeout(grace)
      grace = null
    }
    swallow = false
  }

  return {
    down(pointerType, x, y, item) {
      stopPending()
      standDown()
      // Mouse and pen already have hover; the hold is for touch alone.
      if (pointerType !== 'touch' || item == null) return
      startX = x
      startY = y
      pending = setTimeout(() => {
        pending = null
        swallow = true
        onHold(item)
      }, holdMs)
    },
    move(x, y) {
      if (pending == null) return
      if (Math.abs(x - startX) > slopPx || Math.abs(y - startY) > slopPx) stopPending()
    },
    end() {
      stopPending()
      if (!swallow) return
      if (grace != null) clearTimeout(grace)
      grace = setTimeout(() => {
        grace = null
        swallow = false
      }, graceMs)
    },
    click() {
      if (!swallow) return false
      standDown()
      return true
    },
    contextMenu() {
      return pending != null || swallow
    },
    armed() {
      return swallow
    },
    dispose() {
      stopPending()
      standDown()
    },
  }
}
