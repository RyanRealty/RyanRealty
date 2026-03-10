'use client'

import Link from 'next/link'
import { useComparison } from '@/contexts/ComparisonContext'
import { useState, useEffect } from 'react'

const MAX_DISPLAY = 4

export default function ComparisonTray() {
  const { comparisonItems, removeFromComparison, clearComparison } = useComparison()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || comparisonItems.length === 0) return null

  const compareUrl = `/compare?ids=${comparisonItems.slice(0, MAX_DISPLAY).map(encodeURIComponent).join(',')}`

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center gap-4 border-t border-[var(--gray-border)] bg-white px-4 py-3 shadow-lg safe-area-pb"
      role="region"
      aria-label="Comparison tray"
    >
      <div className="flex flex-1 items-center gap-2 overflow-x-auto">
        {comparisonItems.slice(0, MAX_DISPLAY).map((listingKey, i) => (
          <div key={listingKey} className="relative flex-shrink-0">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-[var(--gray-border)] bg-[var(--gray-bg)] text-sm font-semibold text-[var(--brand-navy)]">
              {i + 1}
            </div>
            <button
              type="button"
              onClick={() => removeFromComparison(listingKey)}
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand-navy)] text-white hover:bg-[var(--brand-primary-hover)]"
              aria-label={`Remove from comparison`}
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      <span className="flex-shrink-0 text-sm font-medium text-[var(--gray-secondary)]">
        {comparisonItems.length} home{comparisonItems.length !== 1 ? 's' : ''}
      </span>
      <Link
        href={compareUrl}
        className="flex-shrink-0 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--brand-navy)] hover:bg-[var(--accent-hover)]"
      >
        Compare Now
      </Link>
      <button
        type="button"
        onClick={clearComparison}
        className="flex-shrink-0 text-sm text-[var(--gray-muted)] underline hover:text-[var(--gray-secondary)]"
      >
        Clear
      </button>
    </div>
  )
}
