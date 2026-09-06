'use client'
/**
 * Makes the footer's sitemap disclosures tell the truth at every width.
 *
 * THE DEFECT. The server rendered each column as a `<details>` and CSS forced
 * its list visible from 56.25rem up while leaving the element closed. There, a
 * keyboard or screen-reader user therefore met a control announced as COLLAPSED
 * standing over thirteen visible links, and activating it did nothing, because
 * the stylesheet showed the list either way. CSS can force a disclosure's
 * content visible; it cannot set `open`, which is what the accessibility tree
 * reads.
 *
 * THE FIX, AND WHY THIS DIRECTION. The markup ships OPEN and this island closes
 * the columns on a phone, rather than shipping closed and opening them here.
 * Inverted, a reader without JavaScript — and a crawler that does not run it —
 * would meet 52 hidden footer destinations on every page on the site, which is a
 * crawl surface we would be trading away for a phone convenience. This way the
 * no-JS case is the complete sitemap, which is the safe failure.
 *
 * Below 56.25rem the fold is the browser's own disclosure and works exactly as
 * it did. From there up every column is open, the state matches what is on
 * screen, and the control still works if someone wants to collapse one.
 *
 * 56.25rem and not 40rem: it is the width the sitemap goes five columns across.
 * At the two- and three-column steps in between, open groups measured a
 * footer taller than the page, which is the wall the fold exists to prevent.
 */
import { useEffect } from 'react'

/** The width the sitemap grid goes five across. Mirrors V3Footer.css. */
const WIDE = '(min-width: 56.25rem)'

export function V3FooterFold() {
  useEffect(() => {
    const mq = window.matchMedia(WIDE)
    const folds = () => Array.from(document.querySelectorAll<HTMLDetailsElement>('.v3-footer__fold'))
    // Only the width sets the default. A column the reader has since toggled
    // keeps whatever they chose until the width itself changes.
    const sync = () => {
      for (const d of folds()) d.open = mq.matches
    }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return null
}
