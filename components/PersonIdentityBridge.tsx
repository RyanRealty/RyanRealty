'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { identifyPersonFromEmailClick } from '@/app/actions/identity-bridge'
import { readRrSessionId } from '@/lib/tracking'

const DEFAULT_EMAIL_CLICK_PARAM = '_fuid'

/**
 * Runs once on load. If the URL contains an email-click param (e.g.
 * ?_fuid=123, a legacy id from a pre-cutover campaign email), identifies
 * the visitor and sets the first-party rr_pid cookie so subsequent events
 * attach to that contact. Then removes the param from the URL.
 *
 * Renamed from FubIdentityBridge.tsx 2026-07-09 (FUB decommissioned
 * 2026-06-24). The ?_fuid= param name itself is unchanged since old
 * already-sent emails carry that exact link.
 */
export default function PersonIdentityBridge() {
  const searchParams = useSearchParams()
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    const paramName = (typeof process.env.NEXT_PUBLIC_FUB_EMAIL_CLICK_PARAM === 'string'
      ? process.env.NEXT_PUBLIC_FUB_EMAIL_CLICK_PARAM
      : DEFAULT_EMAIL_CLICK_PARAM).trim() || DEFAULT_EMAIL_CLICK_PARAM
    const value = searchParams.get(paramName)
    if (!value) return
    done.current = true
    identifyPersonFromEmailClick(value, readRrSessionId()).then(() => {
      const url = new URL(window.location.href)
      url.searchParams.delete(paramName)
      const newUrl = url.pathname + url.search + url.hash
      window.history.replaceState(null, '', newUrl)
      // Tell the analytics bridge to re-sync GA4 user_id + Meta Pixel
      // advanced matching now that rr_pid is freshly stamped.
      window.dispatchEvent(new CustomEvent('person-identified'))
    })
  }, [searchParams])

  return null
}
