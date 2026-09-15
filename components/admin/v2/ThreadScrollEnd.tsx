'use client'

import { useEffect, useRef } from 'react'

/**
 * Sentinel at the end of an oldest→newest thread. Scrolls the latest message
 * into view on mount (iMessage: open on the bottom / newest).
 */
export function ThreadScrollEnd() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'end' })
  }, [])
  return <div ref={ref} aria-hidden className="av2-thread-end" />
}
