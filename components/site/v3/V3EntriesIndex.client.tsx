'use client'

/**
 * The index rail of V3Entries: one link per entry, and the entry being read
 * is marked as the reader scrolls (aria-current="true"). A door list first,
 * so it works before hydration and with scripting off (every link is a plain
 * hash link to an entry that is already in the served HTML); what hydration
 * adds is the mark that follows the reading position, and nothing else.
 *
 * One IntersectionObserver on the entries, a reading band across the middle
 * of the viewport. No scroll listener, no timers, no data of its own.
 */
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export type V3EntriesIndexItem = { id: string; label: string }

export function V3EntriesIndex({ items, label }: { items: readonly V3EntriesIndexItem[]; label: string }) {
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const targets = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null)
    if (targets.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length === 0) return
        const top = visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (top) setActive(top.target.id)
      },
      { rootMargin: '-35% 0px -55% 0px', threshold: 0 },
    )
    for (const el of targets) observer.observe(el)
    return () => observer.disconnect()
  }, [items])

  return (
    <nav className="v3-entries__index" aria-label={label}>
      <ol className="v3-entries__index-list">
        {items.map((item, index) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={cn('v3-entries__index-link', active === item.id && 'v3-entries__index-link--active')}
              aria-current={active === item.id ? 'true' : undefined}
            >
              <span className="v3-entries__index-num" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span>{item.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
