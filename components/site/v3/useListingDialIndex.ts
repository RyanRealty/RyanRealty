'use client'

/**
 * Which listing a V3ListingDial is showing, read from outside the dial.
 *
 * WHY THIS EXISTS (Matt 2026-09-24, "Let's get all of those carousels in
 * place"). Three shelves that moved from a carousel to the dial keep a figure
 * that belongs to ONE listing beside the dial rather than inside its card: a
 * new-construction home's builder concession, the place-type map mark that
 * lights for the home in view, and the /buy asking-price ladder's filled
 * mark. Each needs to know which listing the dial is showing. The dial takes
 * no selection callback, so this reads the selection off the dial's own
 * WAI-ARIA tabs contract: exactly one `role="tab"` inside the dial root
 * carries `aria-selected="true"`, and its id is `dialTabId(dialId, index)`.
 * That contract is what a screen reader reads, so it cannot drift without
 * the dial's accessibility breaking with it.
 *
 * On the server and on the first client render the dial shows its first
 * listing, so this starts at 0 and agrees with the served HTML. A dial of one
 * listing has no tabs and stays at 0.
 */
import { useEffect, useState } from 'react'
import { dialTabId } from './V3ListingDial.logic'

/** The index the dial root's selected tab names, or null when none does. */
export function readListingDialIndex(root: ParentNode, dialId: string, count: number): number | null {
  const prefix = dialTabId(dialId, 0).replace(/0$/, '')
  const tabs = root.querySelectorAll<HTMLElement>('[role="tab"][aria-selected="true"]')
  for (const tab of Array.from(tabs)) {
    if (!tab.id.startsWith(prefix)) continue
    const index = Number(tab.id.slice(prefix.length))
    if (Number.isInteger(index) && index >= 0 && index < count) return index
  }
  return null
}

export function useListingDialIndex(dialId: string, count: number): number {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (count < 2 || typeof document === 'undefined' || typeof MutationObserver === 'undefined') return
    const root = document.getElementById(dialId)
    if (!root) return
    const read = () => {
      const next = readListingDialIndex(root, dialId, count)
      if (next != null) setIndex(next)
    }
    read()
    const observer = new MutationObserver(read)
    observer.observe(root, { subtree: true, attributes: true, attributeFilter: ['aria-selected'] })
    return () => observer.disconnect()
  }, [dialId, count])

  return count < 2 ? 0 : Math.min(index, count - 1)
}
