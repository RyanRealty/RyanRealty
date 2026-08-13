// @data-free — E-CUT: this route only 301s to /housing-market/reports. No listings.
import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'

/**
 * /reports folds into /housing-market/reports (cut-list: dual URL space).
 * next.config already 308s this path. Query string is preserved so
 * ?cities=&range= deep links still land. This file never renders UI.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
  alternates: { canonical: '/housing-market/reports' },
}

export default async function ReportsHubRedirect({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const q = new URLSearchParams()
  for (const [key, value] of Object.entries(params ?? {})) {
    if (typeof value === 'string' && value) q.set(key, value)
    else if (Array.isArray(value)) {
      for (const item of value) {
        if (item) q.append(key, item)
      }
    }
  }
  const qs = q.toString()
  permanentRedirect(qs ? `/housing-market/reports?${qs}` : '/housing-market/reports')
}
