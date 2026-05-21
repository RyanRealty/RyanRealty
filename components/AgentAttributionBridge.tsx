'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

const COOKIE_NAME = 'rr_agent_attribution'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90

export default function AgentAttributionBridge() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const agentSlug = searchParams.get('agent')?.trim().toLowerCase()
    if (!agentSlug) return
    const payload = encodeURIComponent(JSON.stringify({ slug: agentSlug, capturedAt: new Date().toISOString() }))
    document.cookie = `${COOKIE_NAME}=${payload}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax; Secure`
  }, [searchParams])

  return null
}
