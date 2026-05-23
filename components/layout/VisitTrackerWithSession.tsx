'use client'

/**
 * VisitTrackerWithSession — client-side session fetch for VisitTracker.
 * Removes the server-side getSession() cookie read; user info attaches
 * to the visit event after hydration.
 */

import { useEffect, useState } from 'react'
import VisitTracker from '../VisitTracker'

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
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])
  return <VisitTracker userId={userInfo.id} userEmail={userInfo.email} />
}
