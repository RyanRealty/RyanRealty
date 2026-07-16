'use client'

import { useEffect, useState } from 'react'
import type { AuthUser } from '@/app/actions/auth'

/**
 * useSessionUser — client-side session fetch for chrome components (admin rebuild
 * RC7 fix). Returns `undefined` while loading, then the signed-in `AuthUser` or
 * `null`. Uses /api/auth/me (private, no-store) so the header/nav shells stay
 * statically prerenderable — the SITE_SPEC §45-47 CDN-cache constraint that
 * forbids a server getSession() in the root layout.
 */
export function useSessionUser(): AuthUser | null | undefined {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined)
  useEffect(() => {
    let active = true
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { user: AuthUser | null } | null) => {
        if (active) setUser(data?.user ?? null)
      })
      .catch(() => {
        if (active) setUser(null)
      })
    return () => {
      active = false
    }
  }, [])
  return user
}
