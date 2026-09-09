'use client'

/**
 * The phone half of the Ledger's reveal (site queue SITE-52).
 *
 * A row with `reveal` shows one line the row's text does not carry — the
 * months-of-supply verdict, a twelve-month run of closes — on hover and on
 * keyboard focus, which CSS handles alone in V3Ledger.css. A phone has neither,
 * so this island gives it TAP-AND-HOLD: press a row for HOLD_MS and its reveal
 * opens in place; the tap that would have followed the row is swallowed once,
 * so a hold never also navigates. A tap anywhere else closes it. Everything
 * else about the row — that it is one link, that it works before hydration —
 * is untouched: this island renders a plain wrapper and attaches listeners
 * after mount.
 *
 * WHY POINTER EVENTS AND A TIMER, not a button. A control inside a link is
 * invalid HTML, and a second tap target on every row would make each row two
 * doors. The hold is the phone's hover, no more.
 *
 * Only mounted when at least one row carries a reveal, so a ledger without one
 * ships no client code for this.
 */

import { useEffect, useRef, type ReactNode } from 'react'

/** Long enough to be a hold, short enough that the OS context menu (~500ms) has not fired. */
export const V3_LEDGER_HOLD_MS = 350

const ITEM = '.v3-ledger__item'
const OPEN = 'data-revealed'

export function V3LedgerRevealIsland({ children }: { children: ReactNode }) {
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
      target instanceof Element ? target.closest<HTMLElement>(ITEM) : null

    const onPointerDown = (event: PointerEvent) => {
      // Mouse and pen already have hover; the hold is for touch alone.
      if (event.pointerType !== 'touch') return
      const item = itemOf(event.target)
      clearTimer()
      if (!item || !item.querySelector('.v3-ledger__reveal')) return
      startX = event.clientX
      startY = event.clientY
      timer = window.setTimeout(() => {
        timer = null
        closeAll(item)
        item.setAttribute(OPEN, 'true')
        swallowClick = true
      }, V3_LEDGER_HOLD_MS)
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
      const item = itemOf(event.target)
      if (!item || !root.contains(item)) closeAll()
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
  }, [])

  return (
    <div ref={ref} className="v3-ledger__hold">
      {children}
    </div>
  )
}
