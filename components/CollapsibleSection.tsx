'use client'

import { useState, useRef, useEffect } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon } from '@hugeicons/core-free-icons'
import { Button } from "@/components/ui/button"

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
      className="border-b border-border last:border-b-0"
      aria-labelledby={`${id}-heading`}
    >
      <Button
        type="button"
        id={`${id}-heading`}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 py-4 text-left"
        aria-expanded={open}
        aria-controls={`${id}-content`}
      >
        <span className="text-lg font-semibold text-foreground">{title}</span>
        {badge != null && badge !== '' && (
          <span className="text-sm font-medium text-muted-foreground">{badge}</span>
        )}
        <span
          className="shrink-0 text-muted-foreground transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          aria-hidden
        >
          <HugeiconsIcon icon={ArrowDown01Icon} className="h-5 w-5" />
        </span>
      </Button>
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
