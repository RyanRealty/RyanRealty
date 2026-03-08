'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { trackSignUp } from '@/lib/tracking'

/** If URL has ?signed_up=1, fires sign_up + CompleteRegistration and removes the param. */
export default function SignUpTracker() {
  const searchParams = useSearchParams()
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    if (searchParams.get('signed_up') !== '1') return
    done.current = true
    trackSignUp()
    const url = new URL(window.location.href)
    url.searchParams.delete('signed_up')
    const next = url.pathname + url.search + url.hash
    window.history.replaceState(null, '', next)
  }, [searchParams])

  return null
}
