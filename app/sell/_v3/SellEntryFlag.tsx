'use client'

/**
 * The /sell?from=cma hero swap, on the client side of the ISR line.
 *
 * /sell stays one statically cached page (revalidate 3600). The CMA variant
 * changes ONLY the hero copy, and both copies ship in the server HTML. An
 * inline script at the top of <main> (SELL_ENTRY_SCRIPT, ./sell-entry.ts)
 * sets html[data-sell-entry="cma"] before first paint when the URL carries
 * from=cma, and sell-landing.css shows the CMA pair instead of the default.
 * No text is mutated, so hydration has nothing to disagree about.
 *
 * This island covers what the inline script cannot: a client-side navigation
 * into or out of /sell?from=cma, and leaving /sell altogether.
 */
import { useEffect } from 'react'
import { SELL_ENTRY_ATTR } from './sell-entry'

export function SellEntryFlag() {
  useEffect(() => {
    const root = document.documentElement
    let cma = false
    try {
      cma = new URLSearchParams(window.location.search).get('from') === 'cma'
    } catch {
      cma = false
    }
    if (cma) root.setAttribute(SELL_ENTRY_ATTR, 'cma')
    else root.removeAttribute(SELL_ENTRY_ATTR)
    return () => root.removeAttribute(SELL_ENTRY_ATTR)
  }, [])
  return null
}
