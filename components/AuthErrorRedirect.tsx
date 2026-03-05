'use client'

import { useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

/**
 * If the user lands on the site with Supabase auth error in URL (e.g. after failed OAuth),
 * redirect to /auth-error with the message so they see a clear "Try again" flow.
 */
export default function AuthErrorRedirect() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (pathname !== '/') return
    const queryError = searchParams.get('error')
    const hash = typeof window !== 'undefined' ? window.location.hash : ''
    const hashParams = new URLSearchParams(hash.replace(/^#/, ''))
    const hashError = hashParams.get('error')
    const error = queryError || hashError
    if (!error) return
    const description = searchParams.get('error_description') || hashParams.get('error_description')
    const next = searchParams.get('next') || hashParams.get('next') || '/'
    const message = description ? decodeURIComponent(String(description).replace(/\+/g, ' ')) : 'Sign-in failed'
    router.replace(`/auth-error?message=${encodeURIComponent(message)}&next=${encodeURIComponent(next)}`)
  }, [pathname, searchParams, router])

  return null
}
