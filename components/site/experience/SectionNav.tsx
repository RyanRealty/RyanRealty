/**
 * SectionNav — Experience System shared module
 *
 * Sticky in-page anchor navigation for long Geo/Content archetype pages.
 * Renders as a slim navy pill strip; becomes visible (via IntersectionObserver)
 * only once the user scrolls past the hero threshold.
 *
 * Items link to section IDs on the page via smooth scroll.
 * The active item highlights based on scroll position.
 *
 * Usage:
 *   <SectionNav items={[
 *     { id: 'listings', label: 'Homes for sale' },
 *     { id: 'map', label: 'Map' },
 *     { id: 'about', label: 'About' },
 *     { id: 'open-houses', label: 'Open houses' },
 *     { id: 'faq', label: 'Questions' },
 *   ]} />
 */
'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { HEADER_HEIGHT_PX } from '@/lib/site/layout-constants'

type NavItem = {
  id: string
  label: string
}

type Props = {
  items: NavItem[]
  /** Offset from top when pinning links (px). Accounts for fixed nav. Default 72. */
  topOffset?: number
  className?: string
}

export function SectionNav({ items, topOffset = HEADER_HEIGHT_PX, className }: Props) {
  const [visible, setVisible] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Show SectionNav once the user scrolls past a sentinel placed below the hero
  useEffect(() => {
    if (!sentinelRef.current || typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0 },
    )
    obs.observe(sentinelRef.current)
    return () => obs.disconnect()
  }, [])

  // Track which section is active based on scroll position
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return

    const sectionEls = items
      .map((item) => document.getElementById(item.id))
      .filter(Boolean) as HTMLElement[]

    if (sectionEls.length === 0) return

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        }
      },
      { threshold: 0.3, rootMargin: `-${topOffset}px 0px 0px 0px` },
    )

    sectionEls.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [items, topOffset])

  const handleClick = (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    const el = document.getElementById(id)
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY - topOffset - 8
    window.scrollTo({ top, behavior: 'smooth' })
  }

  return (
    <>
      {/* Sentinel — placed at the bottom of the hero section */}
      <div ref={sentinelRef} aria-hidden className="h-px w-full" />

      {/* Sticky strip */}
      <nav
        aria-label="Page sections"
        className={cn(
          'fixed left-0 right-0 z-40 bg-primary/95 backdrop-blur-md border-b border-white/8',
          'transition-transform duration-300 ease-out',
          visible ? 'translate-y-0' : '-translate-y-full',
          className,
        )}
        style={{ top: topOffset }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <ul className="flex items-center gap-1 overflow-x-auto scrollbar-none h-11">
            {items.map((item) => (
              <li key={item.id} className="flex-shrink-0">
                <a
                  href={`#${item.id}`}
                  onClick={(e) => handleClick(item.id, e)}
                  className={cn(
                    'inline-block px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors',
                    activeId === item.id
                      ? 'bg-white/14 text-white'
                      : 'text-white/60 hover:text-white/90',
                  )}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </>
  )
}
