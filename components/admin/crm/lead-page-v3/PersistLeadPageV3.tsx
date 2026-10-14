'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { LEAD_PAGE_V3_COOKIE, isLeadPageV3Enabled } from '@/lib/admin/lead-page-v3'

/** Writes or clears the v3 cookie so the layout stays after the query is dropped. */
export function PersistLeadPageV3() {
  const sp = useSearchParams()
  useEffect(() => {
    const v = sp.get('v')
    const named = sp.get('lead-page-v3')
    const on = isLeadPageV3Enabled({ searchParams: { v, 'lead-page-v3': named } })
    const forceOff = v === '2' || named === '0' || named === 'off'
    if (forceOff) {
      document.cookie = `${LEAD_PAGE_V3_COOKIE}=; Path=/admin; Max-Age=0; SameSite=Lax`
      return
    }
    if (on) {
      document.cookie = `${LEAD_PAGE_V3_COOKIE}=1; Path=/admin; Max-Age=${60 * 60 * 24 * 14}; SameSite=Lax`
    }
  }, [sp])
  return null
}
