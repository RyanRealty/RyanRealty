'use client'

import { useEffect } from 'react'

/**
 * Refreshes the `rr_internal` cookie once per admin page load (the protected
 * layout persists across admin navigations), so a broker signed in before
 * 2026-10-05 is marked without signing in again. The route re-verifies the
 * session and the admin role before it sets anything (markInternalBrowser).
 * Renders nothing. Matt 2026-10-05: GA4 counts only outside visitors.
 */
export default function InternalBrowserMark() {
  useEffect(() => {
    void fetch('/api/admin/internal-browser', { method: 'POST', credentials: 'same-origin' }).catch(() => {})
  }, [])
  return null
}
