'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'

/**
 * When the URL has hash #admin (e.g. domain.com#admin), redirect to /admin so the user can log in.
 * Hash is only available on the client, so this runs in the layout.
 */
export default function AdminHashRedirect() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.location.hash?.toLowerCase() !== '#admin') return
    // Already on admin path — just strip hash so we don't re-trigger
    if (pathname?.startsWith('/admin')) {
      window.history.replaceState(null, '', pathname + window.location.search)
      return
    }
    router.replace('/admin')
  }, [pathname, router])

  return null
}
