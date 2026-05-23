'use client'

/**
 * SignInPromptWithSession — client-side session fetch for the SignInPrompt
 * modal. Same pattern as HeaderWithSession: removes the server-side
 * getSession() cookie read that was blocking CDN caching.
 */

import { useEffect, useState } from 'react'
import type { AuthUser } from '@/app/actions/auth'
import SignInPrompt from '../SignInPrompt'

export default function SignInPromptWithSession() {
  const [user, setUser] = useState<AuthUser | null>(null)
  useEffect(() => {
    let active = true
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { user: AuthUser | null } | null) => {
        if (active && data) setUser(data.user)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])
  return <SignInPrompt user={user} />
}
