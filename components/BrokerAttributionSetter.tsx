'use client'

import { useEffect } from 'react'

const COOKIE_NAME = 'rr_agent_attribution'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90

/**
 * Sets the agent-attribution cookie to THIS broker's canonical slug while a
 * visitor is on the broker's landing page (no ?agent= needed in the URL). So a
 * lead submitted from Rebecca's page — the inline form or a downstream LP CTA —
 * is created in FUB assigned to Rebecca, not the default broker.
 *
 * Mirrors AgentAttributionBridge's cookie format (the LP actions read it via
 * readAttributedAgentServer). The broker page IS the broker's context, so it
 * sets the attribution to that broker (last-touch on their own page wins) —
 * which is exactly Matt's rule: a CTA on their page loads into FUB as theirs.
 */
export default function BrokerAttributionSetter({ slug }: { slug: string | null }) {
  useEffect(() => {
    if (!slug) return
    const payload = encodeURIComponent(JSON.stringify({ slug, capturedAt: new Date().toISOString() }))
    document.cookie = `${COOKIE_NAME}=${payload}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax; Secure`
  }, [slug])
  return null
}
