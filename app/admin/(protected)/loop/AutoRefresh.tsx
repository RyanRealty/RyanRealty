'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Re-pulls the server component on an interval so the status stays live while the tab sits open. */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000)
    return () => clearInterval(id)
  }, [router, seconds])
  return null
}
