'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * If Supabase redirects to the app with ?code= on the wrong path (e.g. /?code=xxx
 * instead of /auth/callback?code=xxx), redirect to the callback route so the code
 * gets exchanged and the user lands on the right page.
 */
export default function AuthCodeRedirect() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code || pathname === '/auth/callback') return
    const next = pathname && pathname !== '/' ? pathname : '/'
    window.location.replace(`/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`)
  }, [pathname, searchParams])

  return null
}
