'use client'

/**
 * HeaderWithSession — client-side wrapper that fetches the current
 * session from /api/auth/me after mount, then forwards user state to
 * the existing Header component.
 *
 * Existed-prior pattern: app/layout.tsx called getSession() server-side
 * and passed user as a prop. That cookie read forced Next.js to set
 * `Cache-Control: private, no-store` on every response, which blocked
 * Vercel CDN caching and drove SITE_SPEC §45-47 cold-cache p95 over
 * budget on every probe.
 *
 * New pattern: server-side renders Header without user state (anonymous
 * shell). Hydration fires /api/auth/me which returns the session.
 * Header re-renders with the user prop populated. The brief "anonymous
 * → signed in" transition is invisible to logged-out users (the public
 * majority on LP traffic) and barely noticeable to logged-in users.
 *
 * Brokerage data still arrives as a server-rendered prop because the
 * fetcher is cookie-free + unstable_cache wrapped — no static-render
 * blocker.
 */

import { useEffect, useState } from 'react'
import type { AuthUser } from '@/app/actions/auth'
import Header from './Header'

export default function HeaderWithSession({
  brokerageName,
  headerLogoUrl,
}: {
  brokerageName: string
  headerLogoUrl: string
}) {
  const [user, setUser] = useState<AuthUser | null>(null)
  useEffect(() => {
    let active = true
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { user: AuthUser | null } | null) => {
        if (active && data) setUser(data.user)
      })
      .catch(() => {
        // ignore — anonymous shell is the fallback
      })
    return () => {
      active = false
    }
  }, [])
  return <Header user={user} brokerageName={brokerageName} headerLogoUrl={headerLogoUrl} />
}
