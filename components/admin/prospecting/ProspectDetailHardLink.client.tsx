'use client'

/**
 * Prospect detail door — real <a href> for middle-click / copy-link, but a
 * primary click forces a full document navigation (window.location.assign).
 *
 * Soft App Router transitions under (protected)/loading.tsx can stick on the
 * skeleton forever (Next 16 + loading.tsx race). Desk Open / Review / title
 * must hard-navigate so Cos deep-link and click parity paint the detail.
 */

import type { CSSProperties, MouseEvent, ReactNode } from 'react'

export function ProspectDetailHardLink({
  href,
  className,
  style,
  children,
}: {
  href: string
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    if (e.defaultPrevented) return
    if (e.button !== 0) return
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    window.location.assign(href)
  }

  return (
    <a href={href} className={className} style={style} onClick={onClick}>
      {children}
    </a>
  )
}
