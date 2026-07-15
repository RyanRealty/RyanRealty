'use client'

/**
 * KeyboardInsetSync — publishes the soft-keyboard overlap as CSS state.
 *
 * iOS Safari (and Android Chrome since 108) keeps the LAYOUT viewport
 * full-height when the on-screen keyboard opens and shrinks only the visual
 * viewport. Anything anchored `fixed`/`sticky` to the bottom (the CRM tab bar,
 * the SMS composer, the FABs) therefore lands behind the keyboard, and iOS
 * pans the page trying to reveal the focused input — the 2026-07-15 mobile
 * screenshots showed the composer + tab bar floating mid-screen.
 *
 * This component watches `window.visualViewport` and mirrors the keyboard
 * overlap onto the root element:
 *   --kb-inset      px the keyboard covers (layout-viewport bottom → keyboard top)
 *   [data-kb-open]  present while the keyboard is up
 *
 * Consumers:
 *   - CrmMobileTabBar slides off-screen while [data-kb-open]
 *   - --crm-dock-offset (console-theme.css) swaps from tab-bar height to
 *     --kb-inset so the Comms composer docks to the keyboard top
 *   - the "+" / "?" / pencil FABs hide while [data-kb-open]
 *
 * Pinch-zoom guard: when the user is zoomed (vv.scale > ~1), the visual
 * viewport is small for reasons that have nothing to do with the keyboard —
 * report 0 rather than yanking the chrome around.
 */

import { useEffect } from 'react'

export default function KeyboardInsetSync() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const root = document.documentElement
    let raf = 0

    const update = () => {
      raf = 0
      const zoomed = vv.scale > 1.05
      const inset = zoomed
        ? 0
        : Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
      // Browser-chrome collapse (URL bar) moves these numbers by ~0–60px;
      // a keyboard is 250px+. 100px cleanly separates the two.
      const open = inset > 100
      root.style.setProperty('--kb-inset', `${open ? inset : 0}px`)
      if (open) root.setAttribute('data-kb-open', '')
      else root.removeAttribute('data-kb-open')
    }

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }

    update()
    vv.addEventListener('resize', schedule)
    vv.addEventListener('scroll', schedule)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      vv.removeEventListener('resize', schedule)
      vv.removeEventListener('scroll', schedule)
      root.style.removeProperty('--kb-inset')
      root.removeAttribute('data-kb-open')
    }
  }, [])

  return null
}
