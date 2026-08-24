'use client'

import { useEffect } from 'react'

/**
 * App Router client navigations to /path#id often land at the top of the
 * page instead of the term. Scroll the hash target into view on mount and
 * on later hash changes.
 */
export function HowNumberHashScroll() {
  useEffect(() => {
    const jump = () => {
      const id = decodeURIComponent(window.location.hash.replace(/^#/, ''))
      if (!id) return
      document.getElementById(id)?.scrollIntoView({ block: 'start' })
    }
    jump()
    const t = window.setTimeout(jump, 50)
    window.addEventListener('hashchange', jump)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('hashchange', jump)
    }
  }, [])
  return null
}
