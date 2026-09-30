'use client'

/**
 * VisitTrackerWithSession — client-side session fetch for VisitTracker.
 * Removes the server-side getSession() cookie read; user info attaches
 * to the visit event after hydration.
 */

import { useEffect, useState } from 'react'
import VisitTracker from '../VisitTracker'
import { identifyAuthenticatedSession } from '@/app/actions/identity-bridge'
import { readRrSessionId } from '@/lib/tracking'

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
          //
          // The session is the one this page's tracker is recording, read the way
          // every tracker reads it (the id and its lifecycle record as one pair):
          // straight out of localStorage, a storage that refuses writes answered the
          // id of a session that had already ended here.
          try {
            if (sessionStorage.getItem('rr_session_bridged') !== '1') {
              void identifyAuthenticatedSession(readRrSessionId(), {
                webdriver: navigator.webdriver === true,
              })
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
