'use client'

/**
 * THE PHONE'S HOVER, FOR ANY SET OF DOORS THAT REVEAL SOMETHING.
 *
 * Generalised 2026-09-25 from the Ledger's hold (site queue SITE-52), which is
 * still what V3LedgerRevealIsland mounts, so a row and an archive month answer
 * a finger the same way. An item that carries a reveal shows it on hover and
 * on keyboard focus through its own stylesheet alone. A phone has neither, so
 * this island gives it TAP-AND-HOLD: press an item for V3_HOLD_MS and the
 * island sets `data-revealed="true"` on it, which the item's stylesheet reads
 * to open the reveal in place; the tap that would have followed the hold is
 * swallowed once, so a hold never also navigates. A plain tap still opens the
 * door, and a tap outside every item closes what is open. Holding a second
 * item moves the reveal to it.
 *
 * The swallow is spent on the hold's own click or not at all: the next press
 * of any kind stands it down, and so does a short grace after the lift or the
 * cancel, because an iOS long press and a hold that turns into a scroll never
 * produce a click (V3HoldReveal.logic.ts, where the gesture is tested).
 *
 * `handle` narrows where a hold may start inside an item: an archive month is
 * held by its month link, so its PDF door keeps the phone's own long-press
 * menu (open, download, share).
 *
 * Everything else about the items (that they are links, that they work before
 * hydration, how a keyboard and a screen reader reach the reveal) is left to
 * the markup: this renders one plain wrapper and attaches listeners after
 * mount.
 *
 * WHY POINTER EVENTS AND A TIMER, NOT A BUTTON. A control inside a link is
 * invalid HTML, and a second tap target on every item would make each item two
 * doors. The hold is the phone's hover, no more.
 */

import { useEffect, useRef, type ReactNode } from 'react'
import { createHoldController } from './V3HoldReveal.logic'

const OPEN = 'data-revealed'

export type V3HoldRevealProps = {
  /** Selector for one holdable item (a Ledger row's item, an archive month). */
  item: string
  /** Selector for the reveal inside an item. An item without one is never held. */
  reveal: string
  /**
   * Selector for the part of an item a hold starts from. Omitted, the whole
   * item. A press anywhere else in the item behaves as the platform does.
   */
  handle?: string
  /** The wrapper's class, for the owning stylesheet. */
  className?: string
  children: ReactNode
}

export function V3HoldReveal({ item, reveal, handle, className, children }: V3HoldRevealProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return

    const closeAll = (except?: Element | null) => {
      for (const open of root.querySelectorAll(`[${OPEN}="true"]`)) {
        if (open !== except) open.removeAttribute(OPEN)
      }
    }
    const itemOf = (target: EventTarget | null): HTMLElement | null =>
      target instanceof Element ? target.closest<HTMLElement>(item) : null
    // The item a press may hold: inside this wrapper, carrying a reveal, and
    // pressed on its handle when the caller named one.
    const holdableAt = (target: EventTarget | null): HTMLElement | null => {
      const hit = itemOf(target)
      if (!hit || !root.contains(hit) || !hit.querySelector(reveal)) return null
      if (handle) {
        const grip = target instanceof Element ? target.closest(handle) : null
        if (!grip || !hit.contains(grip)) return null
      }
      return hit
    }

    const hold = createHoldController<HTMLElement>({
      onHold: (held) => {
        closeAll(held)
        held.setAttribute(OPEN, 'true')
      },
    })

    // Every press on the page, seen first (capture): a new gesture always
    // starts clean, a press outside every item closes what is open, and a
    // touch on an item's handle starts the hold.
    const onDocumentPointerDown = (event: PointerEvent) => {
      const hit = itemOf(event.target)
      if (!hit || !root.contains(hit)) closeAll()
      hold.down(event.pointerType, event.clientX, event.clientY, holdableAt(event.target))
    }
    // A scroll is not a hold.
    const onPointerMove = (event: PointerEvent) => hold.move(event.clientX, event.clientY)
    const onPointerEnd = () => hold.end()
    const onClick = (event: MouseEvent) => {
      if (!hold.click()) return
      event.preventDefault()
      event.stopPropagation()
    }
    // The OS long-press menu on a link, held back only while a hold is live.
    const onContextMenu = (event: Event) => {
      if (hold.contextMenu()) event.preventDefault()
    }

    document.addEventListener('pointerdown', onDocumentPointerDown, true)
    root.addEventListener('pointermove', onPointerMove)
    root.addEventListener('pointerup', onPointerEnd)
    root.addEventListener('pointercancel', onPointerEnd)
    root.addEventListener('click', onClick, true)
    root.addEventListener('contextmenu', onContextMenu)
    return () => {
      hold.dispose()
      document.removeEventListener('pointerdown', onDocumentPointerDown, true)
      root.removeEventListener('pointermove', onPointerMove)
      root.removeEventListener('pointerup', onPointerEnd)
      root.removeEventListener('pointercancel', onPointerEnd)
      root.removeEventListener('click', onClick, true)
      root.removeEventListener('contextmenu', onContextMenu)
    }
  }, [item, reveal, handle])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
