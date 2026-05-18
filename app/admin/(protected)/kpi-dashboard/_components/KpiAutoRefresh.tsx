'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Lightweight client component that calls router.refresh() on an interval
 * so the server-side KPI data reloads without a full page navigation.
 */
export function KpiAutoRefresh({ intervalMs }: { intervalMs: number }) {
  const router = useRouter()

  useEffect(() => {
    const id = setInterval(() => {
      router.refresh()
    }, intervalMs)
    return () => clearInterval(id)
  }, [router, intervalMs])

  return null
}
