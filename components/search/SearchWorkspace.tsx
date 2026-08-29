'use client'

import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { SEARCH_CHROME_PX, shouldPinSearchWorkspace } from '@/components/search/search-workspace-pin'

/**
 * Pin dock + Field under chrome after the H1 leaves, then release once
 * the email ask reaches the viewport (latched until the H1 returns).
 * Works at 390 and 1280 so the stuck cream chrome never covers the
 * Field map or list. H1 stays in the page header and does not stick.
 */
export function SearchWorkspace({ children }: { children: ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const slotRef = useRef<HTMLDivElement>(null)
  const reservedRef = useRef(0)
  const releasedRef = useRef(false)

  useEffect(() => {
    const box = boxRef.current
    const slot = slotRef.current
    if (!box || !slot) return

    const sync = () => {
      const stuck = box.classList.contains('search-workspace--stuck')
      if (stuck === false) {
        reservedRef.current = box.offsetHeight
      }
      const reserved = reservedRef.current || box.offsetHeight
      const naturalTop = slot.getBoundingClientRect().top
      const email = document.getElementById('search-alert-capture')
      const emailTop = email ? email.getBoundingClientRect().top : Number.POSITIVE_INFINITY
      if (naturalTop > SEARCH_CHROME_PX) {
        releasedRef.current = false
      } else if (emailTop < window.innerHeight) {
        releasedRef.current = true
      }
      const shouldStick =
        releasedRef.current === false &&
        shouldPinSearchWorkspace(naturalTop, reserved, SEARCH_CHROME_PX)
      if (shouldStick) {
        box.classList.add('search-workspace--stuck')
        slot.style.height = `${reserved}px`
      } else {
        box.classList.remove('search-workspace--stuck')
        slot.style.height = '0px'
      }
    }

    sync()
    window.addEventListener('scroll', sync, { passive: true })
    window.addEventListener('resize', sync)
    return () => {
      window.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
    }
  }, [])

  return (
    <>
      <div ref={slotRef} className="search-workspace-slot" aria-hidden="true" />
      <div ref={boxRef} className={cn('search-workspace')}>
        {children}
      </div>
    </>
  )
}
