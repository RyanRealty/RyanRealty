'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDownIcon } from '@heroicons/react/20/solid'
import { Eyebrow } from '@/components/site/primitives'
import { cn } from '@/lib/utils'
import type { MenuEntry } from '@/lib/site-menu'

/**
 * MegaMenu — the clean editorial desktop nav (approved direction "menu-B").
 *
 * Renders the seven parent triggers on the navy header, plus ONE full-width
 * editorial panel for the active parent. Each panel is intent-grouped text-link
 * intent-grouped link columns, text only (no imagery).
 * No stats, tiles, sparklines, counts, or verdict pills anywhere.
 *
 * INTERACTION (the whole point — the rejected bento dropped on the way to a link):
 *   - HOVER-INTENT: entering a trigger starts a short OPEN timer; leaving the
 *     trigger OR the panel starts a longer CLOSE timer. Entering the open panel
 *     CANCELS the close timer, so the cursor can travel from trigger to link
 *     without the panel vanishing. Moving between triggers while already open
 *     switches instantly (no re-delay).
 *   - CLICK / TOUCH: clicking a trigger toggles its panel (works without hover).
 *   - KEYBOARD + A11Y: each trigger is a real <button> with aria-haspopup,
 *     aria-expanded, aria-controls. Enter/Space toggles. Escape closes and
 *     returns focus to the trigger. A document click-outside listener closes.
 *     The panel is a role="region" with a label.
 *   - prefers-reduced-motion: no transitions when the user asks for less motion.
 *
 * Only one panel is mounted/visible at a time. Static, serializable MENU comes
 * from lib/site-menu.ts (passed from the SERVER SiteHeader).
 */

const OPEN_DELAY_MS = 140
const CLOSE_DELAY_MS = 440

export default function MegaMenu({ menu }: { menu: MenuEntry[] }) {
  const [active, setActive] = useState<number | null>(null)
  const idPrefix = useId()

  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRefs = useRef<Array<HTMLButtonElement | null>>([])

  const clearOpen = useCallback(() => {
    if (openTimer.current) {
      clearTimeout(openTimer.current)
      openTimer.current = null
    }
  }, [])
  const clearClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }, [])

  const close = useCallback(() => {
    clearOpen()
    clearClose()
    setActive(null)
  }, [clearOpen, clearClose])

  // Clear any pending timers on unmount.
  useEffect(() => {
    return () => {
      clearOpen()
      clearClose()
    }
  }, [clearOpen, clearClose])

  // Document click-outside closes the active panel.
  useEffect(() => {
    if (active === null) return
    function onDocPointerDown(event: MouseEvent) {
      const root = rootRef.current
      if (root && event.target instanceof Node && !root.contains(event.target)) {
        close()
      }
    }
    document.addEventListener('mousedown', onDocPointerDown)
    return () => document.removeEventListener('mousedown', onDocPointerDown)
  }, [active, close])

  /** Hover-intent: schedule opening a trigger after a short delay. */
  function handleTriggerEnter(index: number) {
    clearClose()
    // If a panel is already open, switch instantly (no re-delay).
    if (active !== null) {
      clearOpen()
      setActive(index)
      return
    }
    clearOpen()
    openTimer.current = setTimeout(() => setActive(index), OPEN_DELAY_MS)
  }

  /** Hover-out: cancel a pending open, then schedule a close after a grace period. */
  function handleTriggerLeave() {
    clearOpen()
    clearClose()
    closeTimer.current = setTimeout(() => setActive(null), CLOSE_DELAY_MS)
  }

  /** Click toggles the panel open/closed (also covers touch). */
  function handleTriggerClick(index: number) {
    clearOpen()
    clearClose()
    setActive((current) => (current === index ? null : index))
  }

  function handleTriggerKeyDown(event: React.KeyboardEvent, index: number) {
    if (event.key === 'Escape') {
      if (active !== null) {
        event.preventDefault()
        close()
      }
      return
    }
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault()
      handleTriggerClick(index)
    }
  }

  /** Entering the open panel cancels the pending close. */
  function handlePanelEnter() {
    clearClose()
  }
  /** Leaving the open panel starts the close timer. */
  function handlePanelLeave() {
    clearOpen()
    clearClose()
    closeTimer.current = setTimeout(() => setActive(null), CLOSE_DELAY_MS)
  }

  function panelId(index: number) {
    return `${idPrefix}-panel-${index}`
  }
  function triggerId(index: number) {
    return `${idPrefix}-trigger-${index}`
  }

  return (
    <div
      ref={rootRef}
      className="hidden md:flex md:items-center"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && active !== null) {
          close()
          triggerRefs.current[active]?.focus()
        }
      }}
    >
      <nav aria-label="Primary" className="flex items-center gap-0.5">
        {menu.map((entry, index) => {
          const isActive = active === index
          return (
            <button
              key={entry.label}
              ref={(node) => {
                triggerRefs.current[index] = node
              }}
              id={triggerId(index)}
              type="button"
              aria-haspopup="true"
              aria-expanded={isActive}
              aria-controls={panelId(index)}
              onMouseEnter={() => handleTriggerEnter(index)}
              onMouseLeave={handleTriggerLeave}
              onClick={() => handleTriggerClick(index)}
              onKeyDown={(event) => handleTriggerKeyDown(event, index)}
              className={cn(
                'inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[15px] font-medium',
                'text-white/85 transition-colors hover:bg-white/10 hover:text-white',
                'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/40',
                'motion-reduce:transition-none',
                isActive && 'bg-white/10 text-white',
              )}
            >
              {entry.label}
              <ChevronDownIcon
                aria-hidden
                className={cn(
                  'h-3.5 w-3.5 text-white/55 transition-transform motion-reduce:transition-none',
                  isActive && 'rotate-180 text-white/80',
                )}
              />
            </button>
          )
        })}
      </nav>

      {active !== null && (
        <MegaPanelView
          entry={menu[active]!}
          id={panelId(active)}
          labelledBy={triggerId(active)}
          onMouseEnter={handlePanelEnter}
          onMouseLeave={handlePanelLeave}
        />
      )}
    </div>
  )
}

/**
 * MegaPanelView — the full-width editorial panel for one parent.
 *
 * Spans the viewport (fixed, left-1/2 -translate-x-1/2 w-screen) under the 72px
 * sticky header. Inner content is a max-w-7xl container: intent-grouped link
 * intent-grouped link columns, text only.
 */
function MegaPanelView({
  entry,
  id,
  labelledBy,
  onMouseEnter,
  onMouseLeave,
}: {
  entry: MenuEntry
  id: string
  labelledBy: string
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  return (
    <div
      id={id}
      role="region"
      aria-labelledby={labelledBy}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        'fixed left-1/2 top-[72px] z-30 w-screen -translate-x-1/2',
        'border-t border-border bg-card text-foreground shadow-lg',
        'duration-200 animate-in fade-in-0 slide-in-from-top-1 motion-reduce:animate-none',
      )}
    >
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <Eyebrow as="p" className="mb-5 font-display tracking-[0.12em] text-muted-foreground">
          {entry.label}
        </Eyebrow>
        <div className="flex flex-wrap gap-x-16 gap-y-8">
          {entry.columns.map((column) => (
            <div key={column.heading} className="min-w-[11rem]">
              <Eyebrow as="h3" className="mb-3 text-muted-foreground">
                {column.heading}
              </Eyebrow>
              <ul className="flex flex-col">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={cn(
                        'block py-1.5 text-[15px] text-foreground transition-colors',
                        'hover:text-primary hover:underline underline-offset-4',
                        'focus-visible:outline-none focus-visible:text-primary focus-visible:underline',
                        'motion-reduce:transition-none',
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

