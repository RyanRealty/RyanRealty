'use client'

/**
 * VisitTrackerWithSession — client-side session fetch for VisitTracker.
 * Removes the server-side getSession() cookie read; user info attaches
 * to the visit event after hydration.
 */

import { useEffect, useState } from 'react'
import VisitTracker from '../VisitTracker'
import { identifyAuthenticatedSession } from '@/app/actions/identity-bridge'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default function VisitTrackerWithSession() {
  const [userInfo, setUserInfo] = useState<{ id: string | null; email: string | null }>({
    id: null,
    email: null,
  })
  useEffect(() => {
    let active = true
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { user: { id?: string | null; email?: string | null } | null } | null) => {
        if (active && data?.user) {
          setUserInfo({ id: data.user.id ?? null, email: data.user.email ?? null })
          // Bridge this authenticated session to the known person: stamp forward
          // attribution + replay the prior anonymous browsing history so a
          // "Continue with Google" (or email-link / password) sign-in matches
          // their identity to the activity they did while anonymous. Once per
          // browser session (idempotent server-side regardless).
          try {
            if (sessionStorage.getItem('rr_session_bridged') !== '1') {
              const sid = localStorage.getItem('rr_session_id')
              void identifyAuthenticatedSession(sid && UUID_V4.test(sid) ? sid : undefined)
                .then(() => { try { sessionStorage.setItem('rr_session_bridged', '1') } catch {} })
                .catch(() => {})
            }
          } catch {}
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])
  return <VisitTracker userId={userInfo.id} userEmail={userInfo.email} />
}
