'use client'

import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { SEARCH_CHROME_PX, shouldPinSearchWorkspace } from '@/components/search/search-workspace-pin'

/**
 * Pin dock + Field under chrome after the H1 leaves, then release once
 * that reserved block has scrolled past. Works at 390 and 1280 so the
 * stuck cream chrome never covers the Field map or list. H1 stays in
 * the page header and does not stick.
 */
export function SearchWorkspace({ children }: { children: ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const slotRef = useRef<HTMLDivElement>(null)
  const reservedRef = useRef(0)

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
      const shouldStick = shouldPinSearchWorkspace(naturalTop, reserved, SEARCH_CHROME_PX)
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
