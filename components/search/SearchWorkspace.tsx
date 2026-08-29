'use client'

import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * 1280: pin dock + Field under chrome after the H1 leaves, then release
 * when the email ask reaches the unit so the map never slides under the
 * filters. 390 keeps CSS sticky on the dock alone.
 */
export function SearchWorkspace({ children }: { children: ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const slotRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const box = boxRef.current
    const slot = slotRef.current
    if (!box || !slot) return

    const sync = () => {
      const wide = window.matchMedia('(min-width: 56.25rem)').matches
      if (wide === false) {
        box.classList.remove('search-workspace--stuck')
        slot.style.height = '0px'
        return
      }
      const chrome = 56
      const email = document.getElementById('search-alert-capture')
      const height = box.offsetHeight
      const naturalTop = slot.getBoundingClientRect().top
      const emailTop = email ? email.getBoundingClientRect().top : Number.POSITIVE_INFINITY
      const shouldStick = naturalTop <= chrome && emailTop > chrome + height
      if (shouldStick) {
        box.classList.add('search-workspace--stuck')
        slot.style.height = `${height}px`
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
