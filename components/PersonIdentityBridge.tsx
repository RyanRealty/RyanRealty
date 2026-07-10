'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  identifyPersonFromEmailClick,
  identifyPersonFromEmailClickNative,
} from '@/app/actions/identity-bridge'
import { readRrSessionId } from '@/lib/tracking'

const DEFAULT_EMAIL_CLICK_PARAM = '_fuid'
const NATIVE_EMAIL_CLICK_PARAM = '_pid'

/**
 * Runs once on load. If the URL contains an email-click identity param,
 * identifies the visitor and sets the first-party rr_pid cookie so subsequent
 * events attach to that contact. Then removes the param(s) from the URL.
 *
 * Two params are honored:
 *   - ?_pid=<crm_people.id> — native id, stamped on every post-cutover send
 *     (attributeSiteLinks). Preferred when both are present.
 *   - ?_fuid=<legacy id>    — pre-cutover FUB id, resolved via fub_legacy_id.
 *     Kept because already-sent emails carry that exact link.
 *
 * Renamed from FubIdentityBridge.tsx 2026-07-09 (FUB decommissioned 2026-06-24).
 */
export default function PersonIdentityBridge() {
  const searchParams = useSearchParams()
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    const legacyParam = (typeof process.env.NEXT_PUBLIC_FUB_EMAIL_CLICK_PARAM === 'string'
      ? process.env.NEXT_PUBLIC_FUB_EMAIL_CLICK_PARAM
      : DEFAULT_EMAIL_CLICK_PARAM).trim() || DEFAULT_EMAIL_CLICK_PARAM
    const nativeValue = searchParams.get(NATIVE_EMAIL_CLICK_PARAM)
    const legacyValue = searchParams.get(legacyParam)
    if (!nativeValue && !legacyValue) return
    done.current = true
    const identify = nativeValue
      ? identifyPersonFromEmailClickNative(nativeValue, readRrSessionId())
      : identifyPersonFromEmailClick(legacyValue as string, readRrSessionId())
    identify.then(() => {
      const url = new URL(window.location.href)
      url.searchParams.delete(NATIVE_EMAIL_CLICK_PARAM)
      url.searchParams.delete(legacyParam)
      const newUrl = url.pathname + url.search + url.hash
      window.history.replaceState(null, '', newUrl)
      // Tell the analytics bridge to re-sync GA4 user_id + Meta Pixel
      // advanced matching now that rr_pid is freshly stamped.
      window.dispatchEvent(new CustomEvent('person-identified'))
    })
  }, [searchParams])

  return null
}
