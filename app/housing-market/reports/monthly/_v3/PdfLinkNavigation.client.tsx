'use client'

/**
 * Hands a click on a report PDF link to the browser instead of the app router.
 *
 * WHY. The house controls that carry the download (V3Instrument's action, a
 * V3Doors door) render next/link. A next/link click is a client navigation:
 * the router fetches the target as RSC, gets no page back (our /pdf route
 * answers the router with an empty 204), and falls back to a full navigation.
 * That navigation ends in a file download, so the document never unloads, and
 * the router is left holding a navigation to that URL that never finished. A
 * second click on the same link is then deduplicated against it and does
 * nothing until the page is reloaded (measured in Chromium, 2026-09-25: the
 * first click downloaded, the second produced no request at all).
 *
 * THE FIX, AND WHY HERE. A capture listener on the document runs before
 * React's own listener, marks the click handled, and follows the link itself.
 * next/link sees `defaultPrevented` and stands down, so every click is an
 * ordinary browser navigation to our /pdf route, which redirects to the file.
 * Modified clicks (a new tab, a new window) are left alone: the browser
 * already does the right thing with those. When the barrel's link controls
 * grow a native-download option, delete this file.
 *
 * Renders nothing.
 */
import { useEffect } from 'react'

/** Our own PDF route for one edition: /housing-market/reports/monthly/YYYY-MM/pdf */
const REPORT_PDF_PATH = /^\/housing-market\/reports\/monthly\/\d{4}-\d{2}\/pdf$/

export function PdfLinkNavigation() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest('a[href]')
      if (!(anchor instanceof HTMLAnchorElement)) return
      if (anchor.target && anchor.target !== '_self') return
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin || !REPORT_PDF_PATH.test(url.pathname)) return
      event.preventDefault()
      window.location.assign(url.href)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])
  return null
}
