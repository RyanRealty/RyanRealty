'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

/**
 * Shows "Back to search results" when user came from a search page (referrer or return param).
 * Per listing page audit: persist at top of page when user arrived from search.
 */
export default function BackToSearchLink({ returnUrl }: { returnUrl?: string | null }) {
  const [referrer, setReferrer] = useState<string | null>(null)
  useEffect(() => {
    if (typeof window !== 'undefined' && document.referrer) {
      try {
        const u = new URL(document.referrer)
        if (u.pathname.startsWith('/homes-for-sale/') || u.pathname.startsWith('/search/')) setReferrer(document.referrer)
      } catch {
        // ignore
      }
    }
  }, [])
  const href = returnUrl ?? referrer ?? '/listings'
  const show = returnUrl != null || referrer != null
  if (!show) return null
  return (
    <Link
      href={href}
      className="text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      ← Back to search results
    </Link>
  )
}
