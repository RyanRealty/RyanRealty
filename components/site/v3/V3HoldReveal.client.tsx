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

/** Long enough to be a hold, short enough that the OS context menu (~500ms) has not fired. */
export const V3_HOLD_MS = 350

const OPEN = 'data-revealed'

export type V3HoldRevealProps = {
  /** Selector for one holdable item (a Ledger row's item, an archive month). */
  item: string
  /** Selector for the reveal inside an item. An item without one is never held. */
  reveal: string
  /** The wrapper's class, for the owning stylesheet. */
  className?: string
  children: ReactNode
}

export function V3HoldReveal({ item, reveal, className, children }: V3HoldRevealProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return

    let timer: number | null = null
    let startX = 0
    let startY = 0
    let swallowClick = false

    const clearTimer = () => {
      if (timer != null) {
        window.clearTimeout(timer)
        timer = null
      }
    }
    const closeAll = (except?: Element | null) => {
      for (const open of root.querySelectorAll(`[${OPEN}="true"]`)) {
        if (open !== except) open.removeAttribute(OPEN)
      }
    }
    const itemOf = (target: EventTarget | null): HTMLElement | null =>
      target instanceof Element ? target.closest<HTMLElement>(item) : null

    const onPointerDown = (event: PointerEvent) => {
      // Mouse and pen already have hover; the hold is for touch alone.
      if (event.pointerType !== 'touch') return
      const held = itemOf(event.target)
      clearTimer()
      if (!held || !root.contains(held) || !held.querySelector(reveal)) return
      startX = event.clientX
      startY = event.clientY
      timer = window.setTimeout(() => {
        timer = null
        closeAll(held)
        held.setAttribute(OPEN, 'true')
        swallowClick = true
      }, V3_HOLD_MS)
    }
    // A scroll is not a hold.
    const onPointerMove = (event: PointerEvent) => {
      if (timer == null) return
      if (Math.abs(event.clientX - startX) > 8 || Math.abs(event.clientY - startY) > 8) clearTimer()
    }
    const onPointerEnd = () => clearTimer()
    const onClick = (event: MouseEvent) => {
      if (!swallowClick) return
      swallowClick = false
      event.preventDefault()
      event.stopPropagation()
    }
    // The OS long-press menu on a link, held back only while a hold is live.
    const onContextMenu = (event: Event) => {
      if (timer != null || swallowClick) event.preventDefault()
    }
    const onDocumentPointerDown = (event: PointerEvent) => {
      const hit = itemOf(event.target)
      if (!hit || !root.contains(hit)) closeAll()
    }

    root.addEventListener('pointerdown', onPointerDown)
    root.addEventListener('pointermove', onPointerMove)
    root.addEventListener('pointerup', onPointerEnd)
    root.addEventListener('pointercancel', onPointerEnd)
    root.addEventListener('click', onClick, true)
    root.addEventListener('contextmenu', onContextMenu)
    document.addEventListener('pointerdown', onDocumentPointerDown)
    return () => {
      clearTimer()
      root.removeEventListener('pointerdown', onPointerDown)
      root.removeEventListener('pointermove', onPointerMove)
      root.removeEventListener('pointerup', onPointerEnd)
      root.removeEventListener('pointercancel', onPointerEnd)
      root.removeEventListener('click', onClick, true)
      root.removeEventListener('contextmenu', onContextMenu)
      document.removeEventListener('pointerdown', onDocumentPointerDown)
    }
  }, [item, reveal])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
