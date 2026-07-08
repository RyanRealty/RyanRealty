'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

/**
 * ResultsStamp — records the most recent results URL (with filters + view) in
 * sessionStorage so listing detail can offer "← Back to results".
 *
 * document.referrer is empty on client-side route transitions, so the listing
 * page cannot detect a from-results arrival on its own (design-audit P1,
 * register-seam navigation).
 */
export const RESULTS_STAMP_KEY = 'rr_last_results'

function ResultsStampInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  useEffect(() => {
    try {
      const qs = searchParams?.toString()
      sessionStorage.setItem(
        RESULTS_STAMP_KEY,
        JSON.stringify({ url: qs ? `${pathname}?${qs}` : pathname, ts: Date.now() }),
      )
    } catch {
      // storage unavailable: the back link simply won't render
    }
  }, [pathname, searchParams])
  return null
}

export function ResultsStamp() {
  return (
    <Suspense fallback={null}>
      <ResultsStampInner />
    </Suspense>
  )
}
