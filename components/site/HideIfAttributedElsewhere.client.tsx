'use client'

/**
 * Hides its children when the visitor has a broker-attribution cookie pointing
 * to a DIFFERENT broker than `ctaSlug`. Paired with AttributedBrokerCard so a
 * listing shows exactly ONE broker: when you arrived through Rebecca's link, the
 * generic "Talk to a broker (Matt fallback)" CTA is suppressed and the
 * "Your broker: Rebecca" card is the single contact. With no attribution, or an
 * attribution that matches the CTA broker, the children render normally.
 */
import { useEffect, useState } from 'react'

function readAttributedSlug(): string | null {
  try {
    const raw = document.cookie.split('; ').find((c) => c.startsWith('rr_agent_attribution='))?.split('=').slice(1).join('=')
    if (!raw) return null
    const parsed = JSON.parse(decodeURIComponent(raw)) as { slug?: string }
    const s = (parsed.slug ?? '').toLowerCase()
    return s === 'matt' || s === 'rebecca' || s === 'paul' ? s : null
  } catch {
    return null
  }
}

export default function HideIfAttributedElsewhere({
  ctaSlug,
  children,
}: {
  ctaSlug: string
  children: React.ReactNode
}) {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    const s = readAttributedSlug()
    setHidden(!!s && !ctaSlug.toLowerCase().includes(s))
  }, [ctaSlug])
  if (hidden) return null
  return <>{children}</>
}
