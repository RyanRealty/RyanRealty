'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { RESULTS_STAMP_KEY } from '@/components/search/ResultsStamp.client'

/**
 * BackToResults — a compact "← Back to results" control on listing detail.
 *
 * The buy path crosses the editorial/portal register seam exactly here
 * (search results → listing), and the audit found no in-page way back to the
 * result set besides browser chrome (design-audit P1, navigation).
 *
 * Renders ONLY when a fresh results stamp exists (written by ResultsStamp on
 * the results surfaces — document.referrer is empty on client-side route
 * transitions). Links to the stored URL, restoring the exact filters + view;
 * direct/external landings keep the clean no-breadcrumb page (Matt directive).
 */
const FRESH_MS = 30 * 60 * 1000

export function BackToResults() {
  const [href, setHref] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(RESULTS_STAMP_KEY)
      if (!raw) return
      const stamp = JSON.parse(raw) as { url?: string; ts?: number }
      if (!stamp.url || !stamp.url.startsWith('/')) return
      if (typeof stamp.ts !== 'number' || Date.now() - stamp.ts > FRESH_MS) return
      setHref(stamp.url)
    } catch {
      // no stamp / bad JSON: keep the page clean
    }
  }, [])

  if (!href) return null

  return (
    <Link
      href={href}
      className="self-start text-sm font-semibold underline-offset-2 hover:underline"
      style={{ color: 'var(--navy)' }}
    >
      ← Back to results
    </Link>
  )
}
