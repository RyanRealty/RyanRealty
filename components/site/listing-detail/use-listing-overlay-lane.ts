'use client'

import { useEffect, useState } from 'react'

/**
 * One public overlay lane on listing: cookie notice, then phone sticky,
 * then the alerts coach. Cookie wins while it is on screen.
 */
export function useCookieNoticeOpen(): boolean {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const sync = () => {
      setOpen(Boolean(document.querySelector('[data-cookie-notice]')))
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-cookie-notice', 'hidden', 'class'],
    })
    return () => observer.disconnect()
  }, [])

  return open
}
