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
 *   - ?_fuid=<legacy id>    — silent alias for already-sent links; resolved
 *     via crm_people.fub_legacy_id.
 */
export default function PersonIdentityBridge() {
  const searchParams = useSearchParams()
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    const nativeValue = searchParams.get(NATIVE_EMAIL_CLICK_PARAM)
    const legacyValue = searchParams.get(DEFAULT_EMAIL_CLICK_PARAM)
    if (!nativeValue && !legacyValue) return
    done.current = true
    const identify = nativeValue
      ? identifyPersonFromEmailClickNative(nativeValue, readRrSessionId())
      : identifyPersonFromEmailClick(legacyValue as string, readRrSessionId())
    identify.then(() => {
      const url = new URL(window.location.href)
      url.searchParams.delete(NATIVE_EMAIL_CLICK_PARAM)
      url.searchParams.delete(DEFAULT_EMAIL_CLICK_PARAM)
      const newUrl = url.pathname + url.search + url.hash
      window.history.replaceState(null, '', newUrl)
      // Tell the analytics bridge to re-sync GA4 user_id + Meta Pixel
      // advanced matching now that rr_pid is freshly stamped.
      window.dispatchEvent(new CustomEvent('person-identified'))
    })
  }, [searchParams])

  return null
}
