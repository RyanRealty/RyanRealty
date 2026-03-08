'use client'

import { useState, useRef, useEffect } from 'react'

type Props = {
  id: string
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
  /** Optional; when provided, section shows a count or badge */
  badge?: string | number | null
}

export default function CollapsibleSection({ id, title, defaultOpen = true, children, badge }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | 'auto'>(defaultOpen ? 'auto' : 0)

  useEffect(() => {
    if (!contentRef.current) return
    if (open) {
      const update = () => {
        if (contentRef.current) setHeight(contentRef.current.scrollHeight)
      }
      update()
      const ro = new ResizeObserver(update)
      ro.observe(contentRef.current)
      return () => ro.disconnect()
    } else {
      setHeight(0)
    }
  }, [open, children])

  return (
    <section
      id={id}
      className="border-b border-zinc-200 last:border-b-0"
      aria-labelledby={`${id}-heading`}
    >
      <button
        type="button"
        id={`${id}-heading`}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 py-4 text-left"
        aria-expanded={open}
        aria-controls={`${id}-content`}
      >
        <span className="text-lg font-semibold text-zinc-900">{title}</span>
        {badge != null && badge !== '' && (
          <span className="text-sm font-medium text-zinc-500">{badge}</span>
        )}
        <span
          className="shrink-0 text-zinc-500 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          aria-hidden
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      <div
        id={`${id}-content`}
        ref={contentRef}
        className="overflow-hidden transition-[height] duration-200 ease-out"
        style={{
          height: typeof height === 'number' ? `${height}px` : height,
          transitionTimingFunction: 'cubic-bezier(0.33, 1, 0.68, 1)',
        }}
      >
        <div className="pb-6">{children}</div>
      </div>
    </section>
  )
}
