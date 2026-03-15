'use client'

import Link from 'next/link'
import { useComparison } from '@/contexts/ComparisonContext'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeftRightIcon } from '@hugeicons/core-free-icons'
import { Button } from "@/components/ui/button"

/** Fixed bottom tray that shows when the user has added listings to compare. */
export default function ComparisonTray() {
  const { comparisonItems, removeFromComparison, clearComparison } = useComparison()

  if (comparisonItems.length === 0) return null

  const compareUrl = `/compare?ids=${comparisonItems.join(',')}`

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-primary text-primary-foreground shadow-md safe-area-pb transition-transform duration-300"
      role="region"
      aria-label="Property comparison tray"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        {/* Slots */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium whitespace-nowrap">
            Compare ({comparisonItems.length}/4)
          </span>
          <div className="hidden sm:flex items-center gap-1.5">
            {Array.from({ length: 4 }).map((_, i) => {
              const hasItem = i < comparisonItems.length
              return (
                <span
                  key={i}
                  className={[
                    'flex h-8 w-8 items-center justify-center rounded-md border text-xs font-semibold transition-colors',
                    hasItem
                      ? 'border-accent bg-accent/20 text-accent-foreground'
                      : 'border-primary-foreground/20 bg-card/5 text-primary-foreground/30',
                  ].join(' ')}
                >
                  {hasItem ? (
                    <Button
                      type="button"
                      onClick={() => removeFromComparison(comparisonItems[i])}
                      className="flex h-full w-full items-center justify-center"
                      aria-label={`Remove listing ${i + 1} from comparison`}
                    >
                      {i + 1}
                    </Button>
                  ) : (
                    i + 1
                  )}
                </span>
              )
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={clearComparison}
            className="rounded-md border border-primary-foreground/30 px-3 py-1.5 text-xs font-medium text-primary-foreground/80 hover:bg-card/10 transition-colors"
          >
            Clear
          </Button>
          <Link
            href={compareUrl}
            className={[
              'inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-semibold transition-colors',
              comparisonItems.length >= 2
                ? 'bg-accent text-primary hover:bg-accent/90'
                : 'bg-card/20 text-primary-foreground/50 pointer-events-none',
            ].join(' ')}
            aria-disabled={comparisonItems.length < 2}
          >
            <HugeiconsIcon icon={ArrowLeftRightIcon} className="h-4 w-4" />
            Compare Now
          </Link>
        </div>
      </div>
    </div>
  )
}
