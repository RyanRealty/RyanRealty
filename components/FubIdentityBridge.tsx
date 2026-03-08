'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { identifyFubFromEmailClick } from '@/app/actions/fub-identity-bridge'

const DEFAULT_FUB_PARAM = '_fuid'

/**
 * Runs once on load. If URL contains FUB email-click param (e.g. ?_fuid=123), identifies the visitor
 * and sets first-party cookie so subsequent events attach to that contact. Then removes the param from URL.
 */
export default function FubIdentityBridge() {
  const searchParams = useSearchParams()
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    const paramName = (typeof process.env.NEXT_PUBLIC_FUB_EMAIL_CLICK_PARAM === 'string'
      ? process.env.NEXT_PUBLIC_FUB_EMAIL_CLICK_PARAM
      : DEFAULT_FUB_PARAM).trim() || DEFAULT_FUB_PARAM
    const value = searchParams.get(paramName)
    if (!value) return
    done.current = true
    identifyFubFromEmailClick(value).then(() => {
      const url = new URL(window.location.href)
      url.searchParams.delete(paramName)
      const newUrl = url.pathname + url.search + url.hash
      window.history.replaceState(null, '', newUrl)
    })
  }, [searchParams])

  return null
}
